import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Divider,
  Switch,
  Card,
  Select,
  message,
} from "antd";
import api from "../../lib/api";

type PolicyRow = { id: string; name: string; status: string; rules: any };

type FoundationValue = {
  id: string;
  objectType: string; // DEPARTMENT, JOB_LEVEL, CURRENCY, EXPENSE_CATEGORY, etc
  code: string;
  name: string;
  status: string;
  sortOrder?: number;
  meta?: any;
};

const OPS = ["eq", "ne", "gt", "lt", "gte", "lte", "in"] as const;

// ✅ Map fields used in rules -> foundation object types
// (use the same snake_case you used in policy JSON examples)
const FIELD_TO_FOUNDATION_TYPE: Record<string, string> = {
  "employee.department": "DEPARTMENT",
  "employee.designation": "DESIGNATION",
  "employee.grade": "GRADE",
  "employee.job_level": "JOB_LEVEL",
  "employee.employment_type": "EMPLOYMENT_TYPE",
  "employee.cost_center": "COST_CENTER",
  "employee.sbu": "SBU",
  "employee.branch": "BRANCH",
  "employee.company_code": "COMPANY_CODE",
  "employee.legal_entity": "LEGAL_ENTITY",

  "claim.currency": "CURRENCY",
  "claim.category": "EXPENSE_CATEGORY",
  "claim.total_amount": "TOTAL_AMOUNT",
};

export default function PoliciesPage() {
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PolicyRow | null>(null);
  const [form] = Form.useForm();

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [employeeFields, setEmployeeFields] = useState<Record<string, string[]>>({});
  const [claimFields, setClaimFields] = useState<string[]>([]);
  const [advancedJson, setAdvancedJson] = useState(false);

  // ✅ foundation values cache
  const [foundation, setFoundation] = useState<Record<string, FoundationValue[]>>({});
  const [foundationLoading, setFoundationLoading] = useState(false);

  /* ------------------ Load data ------------------ */

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/policies");
      setRows(res.data.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load policies");
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      const res = await api.get("/api/workflows");
      setWorkflows(res.data.items || []);
    } catch {
      // ignore
    }
  };

  const loadFoundation = async () => {
    setFoundationLoading(true);
    try {
      const types = Array.from(
        new Set(Object.values(FIELD_TO_FOUNDATION_TYPE).map((x) => x.toUpperCase()))
      );

      const qs = types.map((t) => `type=${encodeURIComponent(t)}`).join("&");
      const res = await api.get(`/api/foundation-values?${qs}&status=ACTIVE`);

      const items: FoundationValue[] = res.data.items || [];

      const grouped: Record<string, FoundationValue[]> = {};
      for (const it of items) {
        const ot = String(it.objectType || "").toUpperCase();
        grouped[ot] = grouped[ot] || [];
        grouped[ot].push(it);
      }

      Object.keys(grouped).forEach((k) => {
        grouped[k].sort((a, b) => {
          const ao = a.sortOrder ?? 0;
          const bo = b.sortOrder ?? 0;
          if (ao !== bo) return ao - bo;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
      });

      setFoundation(grouped);
    } catch (e: any) {
      // Policies page should still work without this, fallback to Input
      console.warn("Failed to load foundation-values", e);
      setFoundation({});
    } finally {
      setFoundationLoading(false);
    }
  };

  // Optional: still load employee-derived unique values (used for field list + fallback)
  const loadEmployees = async () => {
    try {
      const res = await api.get("/api/employees");
      const map: Record<string, Set<string>> = {};
      (res.data.items || []).forEach((e: any) => {
        const pairs: Array<[string, any]> = [
          ["department", e.department],
          ["grade", e.grade],
          ["job_level", e.jobLevel || e.job_level],
          ["employment_type", e.employmentType || e.employment_type],
        ];

        for (const [k, val] of pairs) {
          if (val !== undefined && val !== null && String(val).trim() !== "") {
            map[k] = map[k] || new Set();
            map[k].add(String(val));
          }
        }
      });

      const out: Record<string, string[]> = {};
      Object.keys(map).forEach((k) => (out[k] = [...map[k]].sort()));
      setEmployeeFields(out);
    } catch {
      // ignore
    }
  };

  const loadExpenseForms = async () => {
    const tryUrls = ["/api/expense-forms", "/api/expense_forms", "/api/expenseForms"];
    for (const url of tryUrls) {
      try {
        const res = await api.get(url);
        const fields = new Set<string>();

        const walk = (obj: any) => {
          if (!obj || typeof obj !== "object") return;
          if (Array.isArray(obj)) {
            obj.forEach(walk);
            return;
          }
          for (const [k, v] of Object.entries(obj)) {
            if (v && typeof v === "object") walk(v);
            else fields.add(k);
          }
        };

        (res.data.items || []).forEach((f: any) => {
          walk(f.schema || {});
        });

        setClaimFields([...fields].sort());
        return;
      } catch {
        // try next
      }
    }
  };

  useEffect(() => {
    loadPolicies();
    loadWorkflows();
    loadFoundation();
    loadEmployees();
    loadExpenseForms();
  }, []);

  /* ------------------ Helpers ------------------ */

  const buildRulesFromForm = (v: any) => {
    const validations = (v.validations || []).map((val: any) => {
      let paramsObj: any = val.params;

      if (typeof val.paramsJson === "string") {
        const txt = val.paramsJson.trim();
        paramsObj = txt ? JSON.parse(txt) : {};
      }

      if (typeof paramsObj === "string") {
        try {
          paramsObj = JSON.parse(paramsObj);
        } catch {
          paramsObj = { raw: paramsObj };
        }
      }

      return {
        type: val.type,
        severity: val.severity,
        message: val.message,
        params: paramsObj || {},
      };
    });

    return {
      description: v.description,
      appliesTo: v.appliesTo,
      priority: v.priority,
      selectWorkflowName: v.selectWorkflowName,
      whenLogic: v.whenLogic || "AND",
      when: v.when || [],
      validations,
    };
  };

  const hydrateFormFromRules = (rules: any) => {
    const validations = (rules?.validations || []).map((val: any) => ({
      ...val,
      params: val?.params || {},
      paramsJson: JSON.stringify(val?.params || {}, null, 2),
    }));

    return {
      description: rules?.description,
      appliesTo: rules?.appliesTo || "EXPENSE_CLAIM",
      priority: rules?.priority ?? 50,
      selectWorkflowName: rules?.selectWorkflowName,
      whenLogic: rules?.whenLogic || "AND",
      when: rules?.when || [],
      validations,
      rulesJson: JSON.stringify(rules || {}, null, 2),
    };
  };

  const computePreviewRules = () => {
    const v = form.getFieldsValue(true);
    if (advancedJson) {
      try {
        return JSON.parse(v.rulesJson || "{}");
      } catch {
        return { error: "Invalid JSON in Advanced mode" };
      }
    }
    try {
      return buildRulesFromForm(v);
    } catch (e: any) {
      return { error: e?.message || "Invalid structured rules" };
    }
  };

  /* ------------------ Modal actions ------------------ */

  const showAdd = () => {
    setEditing(null);
    setAdvancedJson(false);
    form.resetFields();
    form.setFieldsValue({
      status: "ACTIVE",
      appliesTo: "EXPENSE_CLAIM",
      priority: 50,
      whenLogic: "AND",
      when: [],
      validations: [],
    });
    setOpen(true);
  };

  const showEdit = (r: PolicyRow) => {
    setEditing(r);
    setAdvancedJson(false);
    form.resetFields();
    form.setFieldsValue({
      name: r.name,
      status: r.status || "ACTIVE",
      ...hydrateFormFromRules(r.rules || {}),
    });
    setOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();

    const rules = advancedJson
      ? JSON.parse(v.rulesJson || "{}")
      : buildRulesFromForm(v);

    const payload = {
      name: v.name,
      status: v.status || "ACTIVE",
      rules,
    };

    try {
      if (editing) {
        await api.put(`/api/policies/${editing.id}`, payload);
        message.success("Policy updated");
      } else {
        await api.post(`/api/policies`, payload);
        message.success("Policy created");
      }
      setOpen(false);
      loadPolicies();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: string) => {
    try {
      await api.delete(`/api/policies/${id}`);
      message.success("Deleted");
      loadPolicies();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  };

  /* ------------------ Table ------------------ */

  const columns = useMemo(
    () => [
      { title: "Name", dataIndex: "name" },
      {
        title: "Status",
        dataIndex: "status",
        render: (v: string) => (
          <Tag color={v === "ACTIVE" ? "green" : "red"}>{v}</Tag>
        ),
      },
      {
        title: "Actions",
        render: (_: any, r: PolicyRow) => (
          <Space>
            <Button size="small" onClick={() => showEdit(r)}>
              Edit
            </Button>
            <Popconfirm title="Delete policy?" onConfirm={() => del(r.id)}>
              <Button size="small" danger>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    []
  );

  /* ------------------ Condition field + RHS options ------------------ */

  const whenFieldOptions = useMemo(() => {
    const emp = Object.keys(employeeFields).map((k) => ({
      value: `employee.${k}`,
      label: `employee.${k}`,
    }));
    const clm = claimFields.map((k) => ({
      value: `claim.${k}`,
      label: `claim.${k}`,
    }));

    // Ensure mapped fields exist even if not present in employees/schema yet
    const mapped = Object.keys(FIELD_TO_FOUNDATION_TYPE).map((f) => ({
      value: f,
      label: f,
    }));

    const all = [...mapped, ...emp, ...clm];
    const seen = new Set<string>();
    return all.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [employeeFields, claimFields]);

  const getFoundationOptionsForField = (field?: string) => {
    if (!field) return null;
    const typ = FIELD_TO_FOUNDATION_TYPE[field];
    if (!typ) return null;

    const list = foundation[String(typ).toUpperCase()] || [];
    if (!list.length) return [];

    // Provide both name and code (so old data doesn't break)
    const opts: { value: string; label: string }[] = [];
    for (const it of list) {
      const name = String(it.name || "").trim();
      const code = String(it.code || "").trim();
      if (name) opts.push({ value: name, label: name });
      if (code && code !== name) opts.push({ value: code, label: `${name} (${code})` });
    }

    // de-dupe
    const seen = new Set<string>();
    return opts.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  };

  const isProbablyNumberField = (field?: string) => {
    if (!field) return false;
    const f = field.toLowerCase();
    return f.includes("amount") || f.includes("total") || f.includes("count") || f.includes("days");
  };

  /* ------------------ Render ------------------ */

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={showAdd}>
          Add Policy
        </Button>
        <Button onClick={loadPolicies}>Refresh</Button>
        <Button onClick={loadFoundation} loading={foundationLoading}>
          Refresh Master Data
        </Button>
      </Space>

      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns as any} />

      <Modal
        open={open}
        title={editing ? "Edit Policy" : "Add Policy"}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? "Update" : "Create"}
        width={920}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Policy Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="status" label="Status">
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Short description for admin readability" />
          </Form.Item>

          <Divider />

          <Card title="Rule Configuration" size="small">
            <Form.Item name="appliesTo" label="Applies To" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "EXPENSE_CLAIM", label: "EXPENSE_CLAIM" },
                  { value: "CASH_ADVANCE", label: "CASH_ADVANCE" },
                ]}
              />
            </Form.Item>

            <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
              <InputNumber min={1} max={999} style={{ width: 160 }} />
            </Form.Item>

            <Form.Item name="selectWorkflowName" label="Workflow (optional)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={(workflows || []).map((w) => ({
                  value: w.name,
                  label: w.name,
                }))}
              />
            </Form.Item>
          </Card>

          <Divider />

          <Card title="Conditions (WHEN)" size="small">
            <Form.Item name="whenLogic" label="Condition Logic">
              <Select options={[{ value: "AND" }, { value: "OR" }]} />
            </Form.Item>

            <Form.List name="when">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Space key={key} align="start" style={{ display: "flex", marginBottom: 8 }}>
                      {/* LHS Field */}
                      <Form.Item
                        name={[name, "field"]}
                        rules={[{ required: true, message: "Field required" }]}
                      >
                        <Select style={{ width: 260 }} options={whenFieldOptions} />
                      </Form.Item>

                      {/* OP */}
                      <Form.Item
                        name={[name, "op"]}
                        rules={[{ required: true, message: "Op required" }]}
                      >
                        <Select
                          style={{ width: 110 }}
                          options={OPS.map((o) => ({ value: o, label: o }))}
                        />
                      </Form.Item>

                      {/* RHS Value - dynamic */}
                      <Form.Item
                        shouldUpdate={(prev, cur) =>
                          prev?.when?.[name]?.field !== cur?.when?.[name]?.field ||
                          prev?.when?.[name]?.op !== cur?.when?.[name]?.op
                        }
                      >
                        {() => {
                          const field = form.getFieldValue(["when", name, "field"]);
                          const op = form.getFieldValue(["when", name, "op"]);

                          /* 🔥 FORCE numeric input for total_amount */
    if (field === "claim.total_amount") {
      return (
        <Form.Item
          name={[name, "value"]}
          rules={[{ required: true, message: "Value required" }]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber
            style={{ width: 260 }}
            placeholder="Enter amount"
          />
        </Form.Item>
      );
    }
    
                          const opts = getFoundationOptionsForField(field);

                          // If foundation mapping exists -> use Select/MultiSelect
                          if (opts !== null) {
                            return (
                              <Form.Item
                                name={[name, "value"]}
                                rules={[{ required: true, message: "Value required" }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  style={{ width: 260 }}
                                  mode={op === "in" ? "multiple" : undefined}
                                  allowClear
                                  showSearch
                                  optionFilterProp="label"
                                  loading={foundationLoading}
                                  options={opts}
                                  placeholder={op === "in" ? "Select one or more" : "Select value"}
                                />
                              </Form.Item>
                            );
                          }

                          // Fallback: number input for amount-like fields and numeric ops
                          if (isProbablyNumberField(field) && op && op !== "in") {
                            return (
                              <Form.Item
                                name={[name, "value"]}
                                rules={[{ required: true, message: "Value required" }]}
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber style={{ width: 260 }} />
                              </Form.Item>
                            );
                          }

                          // Default fallback: free input
                          return (
                            <Form.Item
                              name={[name, "value"]}
                              rules={[{ required: true, message: "Value required" }]}
                              style={{ marginBottom: 0 }}
                            >
                              <Input style={{ width: 260 }} />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>

                      <Button danger onClick={() => remove(name)}>
                        ✕
                      </Button>
                    </Space>
                  ))}

                  <Button onClick={() => add()} type="dashed">
                    Add Condition
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Divider />

          <Card title="Validations" size="small">
            <Form.List name="validations">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name }) => (
                    <Card key={key} size="small" style={{ marginBottom: 12 }}>
                      {/* Type */}
                      <Form.Item
                        name={[name, "type"]}
                        label="Type"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: "DISALLOW_CATEGORY", label: "DISALLOW_CATEGORY" },
                            { value: "MAX_TOTAL_AMOUNT", label: "MAX_TOTAL_AMOUNT" },
                          ]}
                        />
                      </Form.Item>

                      {/* Severity */}
                      <Form.Item
                        name={[name, "severity"]}
                        label="Severity"
                        rules={[{ required: true }]}
                      >
                        <Select
                          options={[
                            { value: "HARD", label: "HARD (block)" },
                            { value: "SOFT", label: "SOFT (allow with warning)" },
                          ]}
                        />
                      </Form.Item>

                      {/* Message */}
                      <Form.Item
                        name={[name, "message"]}
                        label="Message"
                        rules={[{ required: true }]}
                      >
                        <Input />
                      </Form.Item>

                      {/* PARAMS — dynamic by type */}
                      <Form.Item shouldUpdate>
                        {() => {
                          const type = form.getFieldValue(["validations", name, "type"]);

                          // ---------- DISALLOW_CATEGORY ----------
                          if (type === "DISALLOW_CATEGORY") {
                            return (
                              <Form.Item
                                label="Disallowed Categories"
                                name={[name, "params", "categories"]}
                                rules={[{ required: true }]}
                              >
                                <Select
                                  mode="multiple"
                                  allowClear
                                  showSearch
                                  optionFilterProp="label"
                                  placeholder="Select categories"
                                  options={
                                    (foundation["EXPENSE_CATEGORY"] || []).map((c) => ({
                                      value: c.name,
                                      label: c.name,
                                    }))
                                  }
                                />
                              </Form.Item>
                            );
                          }

                          // ---------- MAX_TOTAL_AMOUNT ----------
                          if (type === "MAX_TOTAL_AMOUNT") {
                            return (
                              <Space direction="vertical" style={{ width: "100%" }}>
                                <Form.Item
                                  label="Maximum Amount"
                                  name={[name, "params", "amount"]}
                                  rules={[{ required: true }]}
                                >
                                  <InputNumber style={{ width: 200 }} min={0} />
                                </Form.Item>

                                <Form.Item
                                  label="Currency"
                                  name={[name, "params", "currency"]}
                                  rules={[{ required: true }]}
                                >
                                  <Select
                                    style={{ width: 200 }}
                                    options={
                                      (foundation["CURRENCY"] || []).map((c) => ({
                                        value: c.code || c.name,
                                        label: c.name,
                                      }))
                                    }
                                  />
                                </Form.Item>
                              </Space>
                            );
                          }

                          return null;
                        }}
                      </Form.Item>

                      <Button danger onClick={() => remove(name)}>
                        Remove Validation
                      </Button>
                    </Card>
                  ))}

                  <Button
                    type="dashed"
                    onClick={() =>
                      add({
                        type: "DISALLOW_CATEGORY",
                        severity: "HARD",
                        message: "",
                        params: {},
                      })
                    }
                  >
                    Add Validation
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Divider />

          {/* <Space style={{ marginBottom: 8 }}>
            <Switch
              checked={advancedJson}
              onChange={(v) => {
                setAdvancedJson(v);
                if (v) {
                  const preview = computePreviewRules();
                  form.setFieldsValue({ rulesJson: JSON.stringify(preview || {}, null, 2) });
                }
              }}
              checkedChildren="Advanced JSON"
              unCheckedChildren="Structured UI"
            />
          </Space>

          {advancedJson ? (
            <Form.Item
              name="rulesJson"
              label="Rules JSON"
              rules={[
                {
                  validator: async (_, value) => {
                    try {
                      JSON.parse(value || "{}");
                      return Promise.resolve();
                    } catch {
                      return Promise.reject(new Error("Invalid JSON"));
                    }
                  },
                },
              ]}
            >
              <Input.TextArea rows={10} />
            </Form.Item>
          ) : (
            <Form.Item label="Rules JSON (Preview)">
              <Input.TextArea rows={10} value={JSON.stringify(computePreviewRules(), null, 2)} readOnly />
            </Form.Item>
          )} */}
        </Form>
      </Modal>
    </>
  );
}
