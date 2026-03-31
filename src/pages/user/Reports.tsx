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
    Space,
    message
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
import * as XLSX from 'xlsx';
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
    const [status, setStatus] = useState<string | undefined>();
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    useEffect(() => {
        if (startDate && endDate && dayjs(startDate).isAfter(dayjs(endDate))) {
            message.error("End date cannot be earlier than start date");
            setEndDate(null); // Reset the invalid date
        }
    }, [startDate, endDate]);
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
            // 1. Filter by Status
            const matchStatus = !status || c.status === status;

            // 2. Filter by Date Range
            const claimDate = dayjs(c.createdAt);

            const matchStart = startDate
                ? claimDate.isAfter(dayjs(startDate).subtract(1, 'day'), 'day')
                : true;

            const matchEnd = endDate
                ? claimDate.isBefore(dayjs(endDate).add(1, 'day'), 'day')
                : true;

            return matchStatus && matchStart && matchEnd;
        });
    }, [claims, startDate, endDate, status]); // Updated dependencies

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

    const handleDownload = () => {
        if (!filtered || filtered.length === 0) {
            message.warning("No data available to export. Please adjust your filters.");
            return;
        }
        // 1. Prepare the data (Optional: Map the data to have clean headers)
        const dataToExport = filtered.map(item => ({
            "ID": item.id,
            "Employee Name": item.employeeName, // Adjust based on your data keys
            "Amount": item.amount,
            "Status": item.status,
            "Date": item.createdAt ? dayjs(item.createdAt).format('YYYY-MM-DD') : 'N/A'
        }));

        // 2. Create a worksheet
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);

        // 3. Create a workbook and add the worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Claims Report");

        // 4. Generate the Excel file and trigger download
        XLSX.writeFile(workbook, `Claims_Report_${dayjs().format('YYYY-MM-DD')}.xlsx`);
    };

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
            <Card
                bordered={false}
                title={
                    <Space>
                        <FilterOutlined />
                        <span>Filters</span>
                    </Space>
                }
                extra={
                    <button className="btn-download" onClick={handleDownload}>
                        Download
                    </button>
                }
            >
                <Row gutter={[16, 16]} align="middle" justify="space-between" style={{ marginBottom: 20 }}>

                    {/* Start Date */}
                    <Col xs={24} md={5}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#8c8c8c' }}>From</label>
                        <input
                            type="date"
                            className="ant-input"
                            style={{ width: "100%", height: "32px", borderRadius: "6px", border: "1px solid #d9d9d9", padding: "4px 11px" }}
                            value={startDate || ""}
                            // PREVENT picking a start date that is AFTER the end date
                            max={endDate || ""}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </Col>

                    {/* End Date */}
                    <Col xs={24} md={5}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#8c8c8c' }}>To</label>
                        <input
                            type="date"
                            className="ant-input"
                            style={{ width: "100%", height: "32px", borderRadius: "6px", border: "1px solid #d9d9d9", padding: "4px 11px" }}
                            value={endDate || ""}
                            // PREVENT picking an end date that is BEFORE the start date
                            min={startDate || ""}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </Col>

                    {/* Status & Reset - Pushed to the right */}
                    <Col xs={24} md={14} style={{ textAlign: 'right' }}>
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
                            <Button type="link"
                                onClick={() => {
                                    setStartDate(null);
                                    setEndDate(null);
                                    setStatus(undefined);
                                }}>
                                Reset
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