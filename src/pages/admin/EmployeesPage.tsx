import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
  Select,
  Switch,
} from "antd";
import api from "../../lib/api";

// ✅ Put this JSON in: src/config/employeeCustomFields.json (Vite supports JSON imports)
import employeeCustomFields from "../../config/employeeCustomFields.json";

type Emp = {
  id: string;
  email: string;
  name: string;

  // existing columns
  department?: string;
  grade?: string;
  mobile?: string;
  managerId?: string;
  status?: string;

  // ✅ new "real columns" (v1)
  employeeCode?: string;
  designation?: string;
  costCenter?: string;
  sbu?: string;
  branch?: string;
  legalEntity?: string;
  companyCode?: string;
  employmentType?: string;
  jobLevel?: string;

  // jsonb
  customFields?: Record<string, any>;
};

type UserItem = {
  id: string;
  email: string;
  role: string;
  status: string;
  employeeId?: string;
  employeeName?: string;
};

type FoundationValue = {
  id: string;
  objectType: string; // e.g. DEPARTMENT
  code: string;       // e.g. IT / L8 / IN01
  name: string;       // e.g. IT / L8 / Acme India Pvt Ltd
  status: string;
  sortOrder?: number;
  meta?: any;
};

function normEmail(s?: string) {
  return (s || "").toLowerCase().trim();
}

// Map employee form fields -> foundation object types
const FOUNDATION_TYPES = {
  department: "DEPARTMENT",
  designation: "DESIGNATION",
  grade: "GRADE",
  jobLevel: "JOB_LEVEL",
  employmentType: "EMPLOYMENT_TYPE",
  costCenter: "COST_CENTER",
  sbu: "SBU",
  branch: "BRANCH",
  companyCode: "COMPANY_CODE",
  legalEntity: "LEGAL_ENTITY",
} as const;

type FoundationKey = keyof typeof FOUNDATION_TYPES;

export default function EmployeesPage() {
  const [rows, setRows] = useState<Emp[]>([]);
  const [managerUsers, setManagerUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Emp | null>(null);
  const [form] = Form.useForm();

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginFor, setLoginFor] = useState<Emp | null>(null);
  const [loginForm] = Form.useForm();

  // ✅ foundation values loaded from backend
  const [foundation, setFoundation] = useState<Record<string, FoundationValue[]>>({});
  const [foundationLoading, setFoundationLoading] = useState(false);

  const loadFoundation = async () => {
    setFoundationLoading(true);
    try {
      const types = Object.values(FOUNDATION_TYPES);
      const qs = types.map((t) => `type=${encodeURIComponent(t)}`).join("&");
      const res = await api.get(`/api/foundation-values?${qs}&status=ACTIVE`);
      const items: FoundationValue[] = res.data.items || [];

      const grouped: Record<string, FoundationValue[]> = {};
      for (const it of items) {
        const ot = String(it.objectType || "").toUpperCase();
        grouped[ot] = grouped[ot] || [];
        grouped[ot].push(it);
      }

      // Sort within each type
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
      // Don't block page if master data isn't ready yet
      console.warn("Failed to load foundation values", e);
      setFoundation({});
    } finally {
      setFoundationLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/employees");
      setRows(res.data.items || []);

      // Managers list comes from /api/users (tenant admin only)
      // We treat any non-EMPLOYEE role as eligible for "manager selection".
      try {
        const ures = await api.get("/api/users");
        const all: UserItem[] = ures.data.items || [];
        const mgrs = all.filter(
          (u) =>
            String(u.role || "").toUpperCase() !== "EMPLOYEE" &&
            String(u.status || "").toUpperCase() === "ACTIVE" &&
            !!u.employeeId
        );
        setManagerUsers(mgrs);
      } catch (e2: any) {
        console.warn("Failed to load users for manager dropdown", e2);
        setManagerUsers([]);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load both: employees + foundation values
    load();
    loadFoundation();
  }, []);

  // Build options from foundation values, keeping compatibility:
  // - value uses `name` (common current DB usage)
  // - also adds `code` if different (so old values stored as code still match)
  const getFoundationOptions = (type: string) => {
    const list = foundation[type] || [];
    const opts: { value: string; label: string }[] = [];

    for (const it of list) {
      const name = String(it.name || "").trim();
      const code = String(it.code || "").trim();

      if (name) opts.push({ value: name, label: name });

      if (code && code !== name) {
        // add code as selectable value but keep label as friendly name
        opts.push({ value: code, label: `${name} (${code})` });
      }
    }

    // de-dupe by value
    const seen = new Set<string>();
    return opts.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  };

  const showCreateLogin = (r: Emp) => {
    setLoginFor(r);
    loginForm.resetFields();
    loginForm.setFieldsValue({ email: r.email, role: "EMPLOYEE", status: "ACTIVE" });
    setLoginOpen(true);
  };

  const createLogin = async () => {
    const v = await loginForm.validateFields();
    try {
      await api.post("/api/users", {
        email: v.email,
        password: v.password,
        role: v.role,
        status: v.status,
      });
      message.success("Login created for employee");
      setLoginOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Create login failed");
    }
  };

  const showAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      status: "ACTIVE",
      customFields: {},
      advancedCustomFieldsJson: "{}",
      cashAdvanceAllowedSwitch: false,
    });
    setOpen(true);
  };

  const showEdit = (r: Emp) => {
    setEditing(r);
    form.resetFields();

    const cf = r.customFields || {};

    form.setFieldsValue({
      email: r.email,
      name: r.name,
      department: r.department || "",
      grade: r.grade || "",
      mobile: r.mobile || "",
      managerId: r.managerId || "",
      status: r.status || "ACTIVE",

      employeeCode: r.employeeCode || "",
      designation: r.designation || "",
      costCenter: r.costCenter || "",
      sbu: r.sbu || "",
      branch: r.branch || "",
      legalEntity: r.legalEntity || "",
      companyCode: r.companyCode || "",
      employmentType: r.employmentType || "",
      jobLevel: r.jobLevel || "",

      customFields: cf,
      advancedCustomFieldsJson: JSON.stringify(cf || {}, null, 2),
      cashAdvanceAllowedSwitch: !!cf.cash_advance_allowed,
    });

    setOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();

    // Merge customFields with advanced JSON (advanced wins)
    let advanced: Record<string, any> = {};
    try {
      advanced = JSON.parse(v.advancedCustomFieldsJson || "{}");
    } catch {
      // validator already handles
    }

    const customFields = {
      ...(v.customFields || {}),
      ...advanced,
      // keep boolean switch consistent
      cash_advance_allowed: !!v.cashAdvanceAllowedSwitch,
    };

    const payload: any = {
      email: v.email,
      name: v.name,

      department: v.department || "",
      grade: v.grade || "",
      mobile: v.mobile || "",
      managerId: v.managerId || "",
      status: v.status || "ACTIVE",

      // ✅ new columns
      employeeCode: v.employeeCode || "",
      designation: v.designation || "",
      costCenter: v.costCenter || "",
      sbu: v.sbu || "",
      branch: v.branch || "",
      legalEntity: v.legalEntity || "",
      companyCode: v.companyCode || "",
      employmentType: v.employmentType || "",
      jobLevel: v.jobLevel || "",

      // jsonb
      customFields,
    };

    try {
      if (editing) {
        await api.put(`/api/employees/${editing.id}`, payload);
        message.success("Employee updated");
      } else {
        await api.post(`/api/employees`, payload);
        message.success("Employee created");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: string) => {
    try {
      await api.delete(`/api/employees/${id}`);
      message.success("Deleted");
      load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  };

  const columns = useMemo(
    () => [
      { title: "Email", dataIndex: "email" },
      { title: "Name", dataIndex: "name" },
      { title: "Dept", dataIndex: "department" },
      { title: "Designation", dataIndex: "designation" },
      { title: "Grade/Level", dataIndex: "grade" },
      { title: "Cost Center", dataIndex: "costCenter" },
      { title: "SBU", dataIndex: "sbu" },
      { title: "Branch", dataIndex: "branch" },
      {
        title: "Status",
        dataIndex: "status",
        render: (v: string) => (
          <Tag color={v === "ACTIVE" ? "green" : "red"}>{v || "ACTIVE"}</Tag>
        ),
      },
      {
        title: "Actions",
        render: (_: any, r: Emp) => (
          <Space>
            <Button size="small" onClick={() => showEdit(r)}>
              Edit
            </Button>
            <Popconfirm title="Delete employee?" onConfirm={() => del(r.id)}>
              <Button size="small" danger>
                Delete
              </Button>
            </Popconfirm>
            <Button size="small" onClick={() => showCreateLogin(r)}>
              Create Login
            </Button>
          </Space>
        ),
      },
    ],
    [rows]
  );

  const customFieldDefs = (employeeCustomFields as any)?.customFields || [];

  // Precompute options for each dropdown once
  const deptOpts = useMemo(() => getFoundationOptions("DEPARTMENT"), [foundation]);
  const desigOpts = useMemo(() => getFoundationOptions("DESIGNATION"), [foundation]);
  const gradeOpts = useMemo(() => getFoundationOptions("GRADE"), [foundation]);
  const jobLevelOpts = useMemo(() => getFoundationOptions("JOB_LEVEL"), [foundation]);
  const empTypeOpts = useMemo(() => getFoundationOptions("EMPLOYMENT_TYPE"), [foundation]);
  const costCenterOpts = useMemo(() => getFoundationOptions("COST_CENTER"), [foundation]);
  const sbuOpts = useMemo(() => getFoundationOptions("SBU"), [foundation]);
  const branchOpts = useMemo(() => getFoundationOptions("BRANCH"), [foundation]);
  const companyCodeOpts = useMemo(() => getFoundationOptions("COMPANY_CODE"), [foundation]);
  const legalEntityOpts = useMemo(() => getFoundationOptions("LEGAL_ENTITY"), [foundation]);

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={showAdd}>
          Add Employee
        </Button>
        <Button onClick={load}>Refresh</Button>
        <Button loading={foundationLoading} onClick={loadFoundation}>
          Refresh Master Data
        </Button>
      </Space>

      <Table rowKey="id" loading={loading} dataSource={rows} columns={columns as any} />

      {/* Employee Create/Edit */}
      <Modal
        open={open}
        title={editing ? "Edit Employee" : "Add Employee"}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? "Update" : "Create"}
        width={820}
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left">Basic</Divider>

          <Space style={{ width: "100%" }} size="middle" wrap>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true }, { type: "email" }]}
              style={{ minWidth: 260 }}
            >
              <Input />
            </Form.Item>

            <Form.Item name="name" label="Name" rules={[{ required: true }]} style={{ minWidth: 260 }}>
              <Input />
            </Form.Item>

            <Form.Item name="employeeCode" label="Employee Code" style={{ minWidth: 200 }}>
              <Input placeholder="E10234" />
            </Form.Item>

            <Form.Item name="mobile" label="Mobile" style={{ minWidth: 200 }}>
              <Input />
            </Form.Item>
          </Space>

          <Space style={{ width: "100%" }} size="middle" wrap>
            <Form.Item name="department" label="Department" style={{ minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={deptOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="designation" label="Designation" style={{ minWidth: 240 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={desigOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="grade" label="Grade" style={{ minWidth: 160 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={gradeOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="jobLevel" label="Job Level" style={{ minWidth: 160 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="L4"
                options={jobLevelOpts}
                loading={foundationLoading}
              />
            </Form.Item>
          </Space>

          <Divider orientation="left">Org / Finance</Divider>

          <Space style={{ width: "100%" }} size="middle" wrap>
            <Form.Item name="employmentType" label="Employment Type" style={{ minWidth: 220 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Permanent"
                options={empTypeOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="costCenter" label="Cost Center" style={{ minWidth: 220 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="CC-1001"
                options={costCenterOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="sbu" label="SBU" style={{ minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={sbuOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="branch" label="Branch" style={{ minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={branchOpts}
                loading={foundationLoading}
              />
            </Form.Item>
          </Space>

          <Space style={{ width: "100%" }} size="middle" wrap>
            <Form.Item name="companyCode" label="Company Code" style={{ minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={companyCodeOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="legalEntity" label="Legal Entity" style={{ minWidth: 320 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select"
                options={legalEntityOpts}
                loading={foundationLoading}
              />
            </Form.Item>

            <Form.Item name="managerId" label="Manager" style={{ minWidth: 320 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Select manager (optional)"
                options={managerUsers.map((u) => ({
                  value: u.employeeId || "",
                  label: `${u.employeeName || u.email} (${u.email}) - ${u.role}`,
                }))}
              />
            </Form.Item>

            <Form.Item name="status" label="Status" rules={[{ required: true }]} style={{ minWidth: 180 }}>
              <Select
                options={[
                  { value: "ACTIVE", label: "ACTIVE" },
                  { value: "INACTIVE", label: "INACTIVE" },
                ]}
              />
            </Form.Item>
          </Space>

          <Divider orientation="left">Custom Fields</Divider>

          {/* Render configured custom fields */}
          <Space style={{ width: "100%" }} size="middle" wrap>
            {customFieldDefs.map((f: any) => {
              const key = f.key as string;
              const label = f.label || key;
              const type = f.type || "text";
              const opts: string[] = f.options || [];

              if (type === "select") {
                return (
                  <Form.Item key={key} name={["customFields", key]} label={label} style={{ minWidth: 260 }}>
                    <Select allowClear options={opts.map((x) => ({ value: x, label: x }))} />
                  </Form.Item>
                );
              }
              if (type === "multi") {
                return (
                  <Form.Item key={key} name={["customFields", key]} label={label} style={{ minWidth: 320 }}>
                    <Select mode="multiple" allowClear options={opts.map((x) => ({ value: x, label: x }))} />
                  </Form.Item>
                );
              }
              if (type === "boolean") {
                return (
                  <Form.Item
                    key={key}
                    label={label}
                    name="cashAdvanceAllowedSwitch"
                    valuePropName="checked"
                    style={{ minWidth: 260 }}
                  >
                    <Switch />
                  </Form.Item>
                );
              }
              return (
                <Form.Item key={key} name={["customFields", key]} label={label} style={{ minWidth: 260 }}>
                  <Input />
                </Form.Item>
              );
            })}
          </Space>

          {/* <Collapse
            style={{ marginTop: 8 }}
            items={[
              {
                key: "adv",
                label: "Advanced: Custom Fields JSON",
                children: (
                  <Form.Item
                    name="advancedCustomFieldsJson"
                    label="Custom Fields (JSON)"
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
                    <Input.TextArea rows={6} />
                  </Form.Item>
                ),
              },
            ]}
          /> */}
        </Form>
      </Modal>

      {/* Create Login */}
      <Modal
        open={loginOpen}
        title={loginFor ? `Create Login for ${loginFor.email}` : "Create Login"}
        onCancel={() => setLoginOpen(false)}
        onOk={createLogin}
        okText="Create"
        width={520}
      >
        <Form form={loginForm} layout="vertical">
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: "email" }]}>
            <Input disabled />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "EMPLOYEE", label: "EMPLOYEE" },
                { value: "APPROVER", label: "APPROVER" },
                { value: "FINANCE", label: "FINANCE" },
                { value: "TENANT_ADMIN", label: "TENANT_ADMIN" },
                { value: "HR", label: "HR" }
              ]}
            />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
