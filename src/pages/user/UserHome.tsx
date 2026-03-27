import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Grid,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
} from "@ant-design/icons";

import api from "../../lib/api";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

type MeResponse = {
  tenantId: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
  employee?: {
    id: string;
    email: string;
    name: string;
    department?: string;
    grade?: string;
    mobile?: string;
    status?: string;
    customFields?: any;
  } | null;
};

type ClaimRow = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
};

function upper(v?: string) {
  return (v || "").toString().trim().toUpperCase();
}

export default function UserHome() {
  const screens = useBreakpoint();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [myClaims, setMyClaims] = useState<ClaimRow[]>([]);
  const [teamClaims, setTeamClaims] = useState<ClaimRow[]>([]);

  const roleUpper = useMemo(() => upper(me?.user?.role), [me]);

  const canApproveLike =
    roleUpper === "APPROVER" ||
    roleUpper === "FINANCE" ||
    roleUpper === "TENANT_ADMIN" ||
    roleUpper === "MANAGER";

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/me");
      const meData: MeResponse = res.data;
      setMe(meData);

      // Claims list:
      // - normal users: /api/claims (their own)
      // - approver-like: prefer scope=my for "My Claims"
      const myReq = canApproveLike
        ? api.get("/api/claims", { params: { scope: "my" } })
        : api.get("/api/claims");

      // Team claims only for approver-like (dashboard metrics)
      const teamReq = canApproveLike
        ? api.get("/api/claims", { params: { scope: "team" } })
        : Promise.resolve({ data: { items: [] } });

      const [myRes, teamRes] = await Promise.all([myReq, teamReq]);

      setMyClaims(myRes.data?.items || []);
      setTeamClaims(teamRes.data?.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myStats = useMemo(() => {
    const by = (st: string) => myClaims.filter((c) => upper(c.status) === st).length;
    return {
      total: myClaims.length,
      draft: by("DRAFT"),
      pending: by("PENDING_APPROVAL"),
      approved: by("APPROVED"),
      rejected: by("REJECTED"),
    };
  }, [myClaims]);

  const teamStats = useMemo(() => {
    const by = (st: string) => teamClaims.filter((c) => upper(c.status) === st).length;
    return {
      total: teamClaims.length,
      pending: by("PENDING_APPROVAL") + by("SUBMITTED"),
      approved: by("APPROVED"),
      rejected: by("REJECTED"),
    };
  }, [teamClaims]);

  if (loading) return <Spin fullscreen />;

  if (!me) return <Text type="danger">Failed to load user profile</Text>;

  const { user, employee } = me;

  return (
    <div>
      <Space direction="vertical" size={screens.xs ? 12 : 16} style={{ width: "100%" }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={16}>
            <Title level={screens.xs ? 4 : 3} style={{ margin: 0 }}>
              Welcome{employee?.name ? `, ${employee.name}` : ""}
            </Title>
            <Space wrap style={{ marginTop: 6 }}>
              <Tag color={user.status === "ACTIVE" ? "green" : "red"}>{user.status}</Tag>
              <Tag color="blue">{user.role}</Tag>
              <Text type="secondary">{user.email}</Text>
            </Space>
          </Col>

          <Col xs={24} md={8} style={{ textAlign: screens.xs ? "left" : "right" }}>
            <Space wrap>
              <Button type="primary" icon={<FileTextOutlined />} onClick={() => nav("/app/claims")}>
                Go to Claims
              </Button>
              <Button onClick={load}>Refresh</Button>
            </Space>
          </Col>
        </Row>

        <Card title="Dashboard" bodyStyle={{ padding: screens.xs ? 12 : 16 }}>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="My Claims" value={myStats.total} prefix={<FileTextOutlined />} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="Draft" value={myStats.draft} prefix={<EditOutlined />} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="Pending" value={myStats.pending} prefix={<ClockCircleOutlined />} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="Approved" value={myStats.approved} prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>

            <Col xs={24} md={8}>
              <Card size="small" style={{ height: "100%" }}>
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <Text strong>Quick actions</Text>
                  <Button type="primary" block icon={<FileTextOutlined />} onClick={() => nav("/app/claims?create=1")}>Create Claim</Button>
                  <Button type="primary" block onClick={() => nav("/app/claims")}>
                    Create / Manage Claims
                  </Button>
                  <Button block onClick={() => nav("/app/claims")}>
                    View status & approvals
                  </Button>
                </Space>
              </Card>
            </Col>

            <Col xs={24} md={16}>
              <Card size="small" style={{ height: "100%" }}>
                <Row gutter={[12, 12]}>
                  <Col xs={12} sm={8}>
                    <Statistic title="Rejected" value={myStats.rejected} prefix={<CloseCircleOutlined />} />
                  </Col>

                  {canApproveLike ? (
                    <>
                      <Col xs={12} sm={8}>
                        <Statistic title="Team Pending" value={teamStats.pending} />
                      </Col>
                      <Col xs={12} sm={8}>
                        <Statistic title="Team Total" value={teamStats.total} />
                      </Col>
                    </>
                  ) : (
                    <Col xs={24} sm={16}>
                      <Text type="secondary">
                        You don’t have approval access. Pending approvals will appear for approver/manager/finance roles.
                      </Text>
                    </Col>
                  )}
                </Row>
              </Card>
            </Col>
          </Row>
        </Card>

        <Row gutter={[12, 12]}>
          <Col xs={24} lg={12}>
            <Card title="Login Info" bodyStyle={{ padding: screens.xs ? 12 : 16 }}>
              <Row gutter={[12, 8]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary">Email</Text>
                  <div>
                    <Text strong>{user.email}</Text>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">Role</Text>
                  <div>
                    <Tag color={user.role === "TENANT_ADMIN" ? "blue" : "green"}>{user.role}</Tag>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary">Status</Text>
                  <div>
                    <Tag color={user.status === "ACTIVE" ? "green" : "red"}>{user.status}</Tag>
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Employee Profile" bodyStyle={{ padding: screens.xs ? 12 : 16 }}>
              {employee ? (
                <Row gutter={[12, 8]}>
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Name</Text>
                    <div>
                      <Text strong>{employee.name}</Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Department</Text>
                    <div>
                      <Text>{employee.department || "-"}</Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Grade</Text>
                    <div>
                      <Text>{employee.grade || "-"}</Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Text type="secondary">Mobile</Text>
                    <div>
                      <Text>{employee.mobile || "-"}</Text>
                    </div>
                  </Col>

                  {/* {employee.customFields && Object.keys(employee.customFields).length > 0 ? (
                    <Col xs={24}>
                      <Text type="secondary">Custom Fields</Text>
                      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 8, overflow: "auto" }}>
                        {JSON.stringify(employee.customFields, null, 2)}
                      </pre>
                    </Col>
                  ) : null} */}
                </Row>
              ) : (
                <Text type="secondary">No employee profile linked to this login.</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* <Text type="secondary" style={{ fontSize: 12 }}>
          Responsive note: prefer <b>Grid breakpoints</b>, <b>maxWidth containers</b>, and <b>minHeight: 100vh</b>.
          Avoid <b>100vw</b> wrappers (can cause horizontal scroll due to scrollbar width).
        </Text> */}
      </Space>
    </div>
  );
}
