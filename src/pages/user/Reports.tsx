import { useEffect, useMemo, useState } from "react";
import {
    Row,
    Col,
    DatePicker,
    Table,
    Typography,
    Spin,
    Button,
    Tag,
    Card,
    Statistic,
    Segmented,
    Empty,
    Space
} from "antd";
import {
    FilterOutlined,
    ReloadOutlined,
    FileTextOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    WalletOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import api from "../../lib/api";

dayjs.extend(isBetween);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const fmtCurrency = (n: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(n);

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState<any[]>([]);
    const [range, setRange] = useState<any>(null);
    const [status, setStatus] = useState<string | undefined>();

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/claims");
            const data = (res.data?.items || []).map((c: any) => ({
                ...c,
                totalAmount: parseFloat(c.totalAmount ?? "0"),
            }));
            setClaims(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        return claims.filter((c) => {
            const matchStatus = !status || c.status === status;
            const matchDate = range
                ? dayjs(c.createdAt).isBetween(range[0], range[1], 'day', "[]")
                : true;
            return matchStatus && matchDate;
        });
    }, [claims, range, status]);

    const summary = useMemo(() => {
        const approved = filtered.filter((c) => c.status === "APPROVED");
        return {
            total: filtered.length,
            approved: approved.length,
            pending: filtered.filter((c) => c.status === "PENDING_APPROVAL").length,
            totalAmt: approved.reduce((s, c) => s + c.totalAmount, 0),
        };
    }, [filtered]);

    const getStatusTag = (status: string) => {
        const map: any = {
            APPROVED: { color: "success", label: "Approved" },
            PENDING_APPROVAL: { color: "processing", label: "Pending" },
            REJECTED: { color: "error", label: "Rejected" },
            DRAFT: { color: "default", label: "Draft" },
        };
        const config = map[status] || map.DRAFT;
        return <Tag color={config.color}>{config.label}</Tag>;
    };

    const columns = [
        {
            title: "Date",
            dataIndex: "createdAt",
            render: (d: string) => <Text type="secondary">{dayjs(d).format("DD MMM YYYY")}</Text>,
        },
        {
            title: "Claim Title",
            dataIndex: "title",
            render: (t: string) => <Text strong>{t}</Text>,
        },
        {
            title: "Status",
            dataIndex: "status",
            render: (s: string) => getStatusTag(s),
        },
        {
            title: "Amount",
            dataIndex: "totalAmount",
            align: 'right' as const,
            render: (v: number) => <Text strong>{fmtCurrency(v)}</Text>,
        },
    ];

    if (loading) return <Spin fullscreen tip="Generating insights..." />;

    return (
        <div style={{ padding: '24px', background: '#f5f7f9', minHeight: '100vh' }}>

            {/* --- HEADER --- */}
            <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
                <Col>
                    <Title level={2} style={{ margin: 0 }}>Reports & Analytics</Title>
                    <Text type="secondary">Monitor and filter your expense claims history</Text>
                </Col>
                <Col>
                    <Button icon={<ReloadOutlined />} onClick={load}>Refresh Data</Button>
                </Col>
            </Row>

            {/* --- SUMMARY CARDS --- */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic title="Total Claims" value={summary.total} prefix={<FileTextOutlined style={{ color: '#1890ff' }} />} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic title="Approved" value={summary.approved} valueStyle={{ color: '#3f8600' }} prefix={<CheckCircleOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic title="Pending" value={summary.pending} valueStyle={{ color: '#cf1322' }} prefix={<ClockCircleOutlined />} />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic title="Approved Spend" value={summary.totalAmt} formatter={(v) => fmtCurrency(v as number)} prefix={<WalletOutlined />} />
                    </Card>
                </Col>
            </Row>

            {/* --- FILTERS & TABLE --- */}
            <Card bordered={false} title={<Space><FilterOutlined /><span>Filters</span></Space>}>
                <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 20 }}>
                    <Col xs={24} md={12}>
                        <RangePicker
                            style={{ width: '100%' }}
                            value={range}
                            onChange={setRange}
                        />
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                        <Space wrap>
                            <Segmented
                                options={[
                                    { label: "All", value: "ALL" },
                                    { label: "Approved", value: "APPROVED" },
                                    { label: "Pending", value: "PENDING_APPROVAL" },
                                    { label: "Rejected", value: "REJECTED" },
                                ]}
                                value={status || "ALL"}
                                onChange={(v) => setStatus(v === "ALL" ? undefined : v)}
                            />
                            <Button type="link" onClick={() => { setRange(null); setStatus(undefined); }}>
                                Reset Filters
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <Table
                    dataSource={filtered}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    locale={{ emptyText: <Empty description="No claims found for this period" /> }}
                />
            </Card>
        </div>
    );
}