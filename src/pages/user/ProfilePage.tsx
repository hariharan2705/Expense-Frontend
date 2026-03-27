import { useEffect, useMemo, useState } from "react";
import { Card, Col, Descriptions, Grid, Row, Space, Spin, Tag, Typography, message } from "antd";
import api from "../../lib/api";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Map employee form fields -> foundation object types (same mapping as EmployeesPage)
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

type FoundationValue = {
  id: string;
  objectType: string;
  code: string;
  name: string;
  status: string;
  sortOrder?: number;
  meta?: any;
};

type MeResponse = {
  tenantId: string;
  user: { id: string; email: string; role: string; status: string };
  employee?: { id: string; email: string; name: string } | null;
};

type Emp = {
  id: string;
  email: string;
  name: string;
  department?: string;
  grade?: string;
  mobile?: string;
  managerId?: string;
  status?: string;

  employeeCode?: string;
  designation?: string;
  costCenter?: string;
  sbu?: string;
  branch?: string;
  legalEntity?: string;
  companyCode?: string;
  employmentType?: string;
  jobLevel?: string;

  customFields?: Record<string, any>;
};

function upper(v?: string) {
  return (v || "").toString().trim().toUpperCase();
}

export default function ProfilePage() {
  const screens = useBreakpoint();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [emp, setEmp] = useState<Emp | null>(null);

  const [foundation, setFoundation] = useState<Record<string, FoundationValue[]>>({});

  const loadFoundation = async () => {
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

      Object.keys(grouped).forEach((k) => {
        grouped[k].sort((a, b) => {
          const ao = a.sortOrder ?? 0;
          const bo = b.sortOrder ?? 0;
          if (ao != bo) return ao - bo;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
      });

      setFoundation(grouped);
    } catch (e) {
      // Not fatal
      setFoundation({});
    }
  };

  const resolveFoundationLabel = (field: keyof typeof FOUNDATION_TYPES, value?: string) => {
    const v = (value || "").trim();
    if (!v) return "-";
    const ot = FOUNDATION_TYPES[field];
    const list = foundation[ot] || [];
    const found = list.find((x) => x.name === v || x.code === v);
    return found?.name || v;
  };

  const load = async () => {
    setLoading(true);
    try {
      const meRes = await api.get("/api/me");
      const meData: MeResponse = meRes.data;
      setMe(meData);

      await loadFoundation();

      // Prefer direct employeeId if present
      const empId = meData?.employee?.id;
      if (empId) {
        const eRes = await api.get(`/api/employees/${empId}`);
        setEmp(eRes.data?.item || eRes.data || null);
      } else {
        // fallback: search employee list by email
        const listRes = await api.get("/api/employees");
        const items: Emp[] = listRes.data?.items || [];
        const hit = items.find((x) => (x.email || "").toLowerCase() === (meData.user.email || "").toLowerCase());
        setEmp(hit || null);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load profile");
      setMe(null);
      setEmp(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <Spin fullscreen />;

  if (!me) return <Text type="danger">Profile not available</Text>;

  const { user, employee } = me;

  const isMobile = !screens.md;

  return (
    <Space direction="vertical" size={isMobile ? 12 : 16} style={{ width: "100%" }}>
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24}>
          <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>
            Profile
          </Title>
          <Text type="secondary">Read-only view</Text>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={10}>
          <Card title="Login" bodyStyle={{ padding: isMobile ? 12 : 16 }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
              <Descriptions.Item label="Role">
                <Tag color="blue">{user.role}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={upper(user.status) === "ACTIVE" ? "green" : "red"}>{upper(user.status) || "ACTIVE"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Linked Employee">{employee?.name || "-"}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Employee" bodyStyle={{ padding: isMobile ? 12 : 16 }}>
            {emp ? (
              <Descriptions column={isMobile ? 1 : 2} size="small" bordered>
                <Descriptions.Item label="Name">{emp.name}</Descriptions.Item>
                <Descriptions.Item label="Email">{emp.email}</Descriptions.Item>
                <Descriptions.Item label="Employee Code">{emp.employeeCode || "-"}</Descriptions.Item>
                <Descriptions.Item label="Mobile">{emp.mobile || "-"}</Descriptions.Item>

                <Descriptions.Item label="Department">{resolveFoundationLabel("department", emp.department)}</Descriptions.Item>
                <Descriptions.Item label="Designation">{resolveFoundationLabel("designation", emp.designation)}</Descriptions.Item>
                <Descriptions.Item label="Grade">{resolveFoundationLabel("grade", emp.grade)}</Descriptions.Item>
                <Descriptions.Item label="Job Level">{resolveFoundationLabel("jobLevel", emp.jobLevel)}</Descriptions.Item>

                <Descriptions.Item label="Employment Type">{resolveFoundationLabel("employmentType", emp.employmentType)}</Descriptions.Item>
                <Descriptions.Item label="Cost Center">{resolveFoundationLabel("costCenter", emp.costCenter)}</Descriptions.Item>
                <Descriptions.Item label="SBU">{resolveFoundationLabel("sbu", emp.sbu)}</Descriptions.Item>
                <Descriptions.Item label="Branch">{resolveFoundationLabel("branch", emp.branch)}</Descriptions.Item>

                <Descriptions.Item label="Company Code">{resolveFoundationLabel("companyCode", emp.companyCode)}</Descriptions.Item>
                <Descriptions.Item label="Legal Entity">{resolveFoundationLabel("legalEntity", emp.legalEntity)}</Descriptions.Item>

                <Descriptions.Item label="Status" span={isMobile ? 1 : 2}>
                  <Tag color={upper(emp.status) === "ACTIVE" ? "green" : "red"}>{upper(emp.status) || "ACTIVE"}</Tag>
                </Descriptions.Item>

                {/* <Descriptions.Item label="Custom Fields" span={isMobile ? 1 : 2}>
                  {emp.customFields && Object.keys(emp.customFields).length ? (
                    <pre style={{ margin: 0, background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto" }}>
                      {JSON.stringify(emp.customFields, null, 2)}
                    </pre>
                  ) : (
                    "-"
                  )}
                </Descriptions.Item> */}
              </Descriptions>
            ) : (
              <Text type="secondary">
                No employee master record found for this login. Ask admin to link your user to an employee.
              </Text>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
