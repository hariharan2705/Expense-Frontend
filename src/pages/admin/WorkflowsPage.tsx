import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Alert,
} from "antd";
import api from "../../lib/api";

type Row = { id: string; name: string; appliesTo: string; status: string; definition: any };

type WorkflowStep = {
  approverType: "MANAGER" | "MANAGER_MANAGER" | "ROLE" | string;
  role?: string;
  approverEmail?: string;
};

const APPROVER_TYPE_OPTIONS = [
  { label: "Manager", value: "MANAGER" },
  { label: "Manager's Manager", value: "MANAGER_MANAGER" },
  { label: "Role", value: "ROLE" },
];

const isEmail = (v?: string) => {
  if (!v) return true;
  // Simple, safe validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

export default function WorkflowsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [advancedJson, setAdvancedJson] = useState(false);
  const [form] = Form.useForm();

  // Live preview of steps (builder mode)
  const stepsWatch: WorkflowStep[] = Form.useWatch("steps", form) || [];

  const computedDefinition = useMemo(() => {
    const steps = (stepsWatch || []).map((s) => {
      const step: any = {
        approverType: s?.approverType,
      };
      if (s?.approverType === "ROLE") {
        if (s?.role) step.role = s.role;
      }
      if (s?.approverEmail) step.approverEmail = s.approverEmail;
      return step;
    }).filter((s) => !!s.approverType);
    return { steps };
  }, [stepsWatch]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/workflows");
      setRows(res.data.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showAdd = () => {
    setEditing(null);
    setAdvancedJson(false);
    form.resetFields();
    form.setFieldsValue({
      status: "ACTIVE",
      appliesTo: "EXPENSE_CLAIM",
      steps: [{ approverType: "MANAGER" }],
      definitionJson: "{\n  \"steps\": [\n    {\n      \"approverType\": \"MANAGER\"\n    }\n  ]\n}"
    });
    setOpen(true);
  };

  const showEdit = (r: Row) => {
    setEditing(r);
    setAdvancedJson(false);
    form.resetFields();
    const steps: WorkflowStep[] = Array.isArray(r.definition?.steps) ? r.definition.steps : [];
    form.setFieldsValue({
      name: r.name,
      status: r.status || "ACTIVE",
      appliesTo: r.appliesTo,
      steps: steps.length ? steps : [{ approverType: "MANAGER" }],
      definitionJson: JSON.stringify(r.definition || {}, null, 2),
    });
    setOpen(true);
  };

  const buildDefinitionFromSteps = (steps: WorkflowStep[]) => {
    const cleaned = (steps || [])
      .map((s) => {
        const st: any = {
          approverType: s?.approverType,
        };
        if (s?.approverType === "ROLE") {
          if (s?.role) st.role = s.role;
        }
        if (s?.approverEmail) st.approverEmail = s.approverEmail;
        return st;
      })
      .filter((s) => !!s.approverType);
    return { steps: cleaned };
  };

  const syncJsonPreview = () => {
    if (advancedJson) return; // In advanced mode, user controls JSON directly
    const steps = (form.getFieldValue("steps") || []) as WorkflowStep[];
    const def = buildDefinitionFromSteps(steps);
    form.setFieldsValue({ definitionJson: JSON.stringify(def, null, 2) });
  };

  const save = async () => {
    const v = await form.validateFields();

    let definition: any;
    if (advancedJson) {
      definition = JSON.parse(v.definitionJson || "{}") || {};
    } else {
      definition = buildDefinitionFromSteps((v.steps || []) as WorkflowStep[]);
    }

    const payload = {
      name: v.name,
      status: v.status || "ACTIVE",
      appliesTo: v.appliesTo,
      definition,
    };
    try {
      if (editing) {
        await api.put(`/api/workflows/${editing.id}`, payload);
        message.success("Workflow updated");
      } else {
        await api.post(`/api/workflows`, payload);
        message.success("Workflow created");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: string) => {
    try {
      await api.delete(`/api/workflows/${id}`);
      message.success("Deleted");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  };

  const columns = useMemo(() => [
    { title: "Name", dataIndex: "name" },
    { title: "Applies To", dataIndex: "appliesTo" },
    { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={v === "ACTIVE" ? "green" : "red"}>{v}</Tag> },
    {
      title: "Actions",
      render: (_: any, r: Row) => (
        <Space>
          <Button size="small" onClick={() => showEdit(r)}>Edit</Button>
          <Popconfirm title="Delete workflow?" onConfirm={() => del(r.id)}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      )
    }
  ], []);

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={showAdd}>Add Workflow</Button>
        <Button onClick={load}>Refresh</Button>
      </Space>

      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns as any} />

      <Modal
        open={open}
        title={editing ? "Edit Workflow" : "Add Workflow"}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? "Update" : "Create"}
        width={780}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            // Keep JSON preview in sync while using UI mode
            syncJsonPreview();
          }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="appliesTo" label="Applies To" rules={[{ required: true }]}>
            <Input placeholder="EXPENSE_CLAIM" />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Input placeholder="ACTIVE / INACTIVE" />
          </Form.Item>

          <Divider style={{ marginTop: 8, marginBottom: 12 }} />

          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Typography.Text strong>Approval Steps</Typography.Text>
            <Button
              size="small"
              onClick={() => {
                // Toggle advanced mode, but keep both fields populated
                const next = !advancedJson;
                setAdvancedJson(next);
                if (!next) {
                  // Going back to UI mode: try to parse JSON into steps
                  try {
                    const parsed = JSON.parse(form.getFieldValue("definitionJson") || "{}") || {};
                    const parsedSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];
                    if (parsedSteps.length) {
                      form.setFieldsValue({ steps: parsedSteps });
                    }
                  } catch {
                    // ignore; UI mode will keep current steps
                  }
                  syncJsonPreview();
                }
              }}
            >
              {advancedJson ? "Use UI Builder" : "Advanced JSON"}
            </Button>
          </Space>

          {!advancedJson ? (
            <>
              <Form.List
                name="steps"
                rules={[
                  {
                    validator: async (_, steps) => {
                      if (!steps || steps.length < 1) {
                        return Promise.reject(new Error("Add at least one step"));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                {(fields, { add, remove, move }, { errors }) => (
                  <>
                    {fields.map((field, idx) => {
                      const stepType: string | undefined = form.getFieldValue(["steps", field.name, "approverType"]);
                      const isRole = stepType === "ROLE";
                      return (
                        <div
                          key={field.key}
                          style={{
                            border: "1px solid #f0f0f0",
                            borderRadius: 8,
                            padding: 12,
                            marginTop: 10,
                          }}
                        >
                          <Space style={{ width: "100%", justifyContent: "space-between" }}>
                            <Typography.Text>Step {idx + 1}</Typography.Text>
                            <Space>
                              <Button
                                size="small"
                                disabled={idx === 0}
                                onClick={() => move(idx, idx - 1)}
                              >
                                Up
                              </Button>
                              <Button
                                size="small"
                                disabled={idx === fields.length - 1}
                                onClick={() => move(idx, idx + 1)}
                              >
                                Down
                              </Button>
                              <Button size="small" danger onClick={() => remove(field.name)}>
                                Remove
                              </Button>
                            </Space>
                          </Space>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                            <Form.Item
                              {...field}
                              name={[field.name, "approverType"]}
                              label="Approver Type"
                              rules={[{ required: true, message: "Select approver type" }]}
                            >
                              <Select options={APPROVER_TYPE_OPTIONS} placeholder="Select" />
                            </Form.Item>

                            <Form.Item
                              {...field}
                              name={[field.name, "approverEmail"]}
                              label="Approver Email (optional)"
                              rules={[
                                {
                                  validator: async (_, value) => {
                                    if (!value) return Promise.resolve();
                                    if (!isEmail(value)) return Promise.reject(new Error("Invalid email"));
                                    return Promise.resolve();
                                  },
                                },
                              ]}
                            >
                              <Input placeholder="e.g., appr1@acme.com" />
                            </Form.Item>
                          </div>

                          {isRole ? (
                            <>
                            <Form.Item
                              {...field}
                              name={[field.name, "role"]}
                              label="Role"
                              rules={[{ required: true, message: "Role is required for ROLE approver type" }]}
                            >
                              <Input placeholder="e.g., FINANCE" />
                            </Form.Item>
                            {(() => {
      const stepRole = form.getFieldValue(["steps", field.name, "role"]);
      const stepEmail = form.getFieldValue(["steps", field.name, "approverEmail"]);

      if (!stepEmail) {
        return (
          <Alert
            type="info"
            showIcon
            message={`Any user with role ${stepRole || "<ROLE>"} can approve this step`}
          />
        );
      }

      return (
        <Alert
          type="warning"
          showIcon
          message={`Only ${stepEmail} can approve this step`}
        />
      );
    })()}
    </>
                          ) : null}

                        </div>
                      );
                    })}

                    <Form.ErrorList errors={errors} />
                    <div style={{ marginTop: 12 }}>
                      <Button onClick={() => add({ approverType: "MANAGER" })}>Add Step</Button>
                    </div>
                  </>
                )}
              </Form.List>

              {/* <Collapse
                style={{ marginTop: 14 }}
                items={[
                  {
                    key: "preview",
                    label: "Generated Definition (JSON) Preview",
                    children: (
                      <Form.Item name="definitionJson" style={{ marginBottom: 0 }}>
                        <Input.TextArea rows={10} readOnly />
                      </Form.Item>
                    ),
                  },
                ]}
              /> */}
            </>
          ) : (
            <Form.Item
              name="definitionJson"
              label="Definition (JSON)"
              rules={[
                {
                  validator: async (_, value) => {
                    try {
                      const parsed = JSON.parse(value || "{}") || {};
                      if (!Array.isArray(parsed?.steps) || parsed.steps.length < 1) {
                        return Promise.reject(new Error("Definition must include steps[] with at least one step"));
                      }
                      return Promise.resolve();
                    } catch {
                      return Promise.reject(new Error("Invalid JSON"));
                    }
                  },
                },
              ]}
            >
              <Input.TextArea rows={12} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
