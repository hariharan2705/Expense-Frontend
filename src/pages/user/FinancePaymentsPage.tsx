import { useEffect, useState } from "react";
import {
  Table, Button, message, Modal, Form, Input, Select,
  Tag, Space, Typography, Drawer, Descriptions, Steps, Divider, Card, Grid,
} from "antd";
import { DollarOutlined, CheckCircleOutlined, PaperClipOutlined, EyeOutlined } from "@ant-design/icons";
import api from "../../lib/api";
import dayjs from "dayjs";

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

type ApprovedClaim = {
  id: string;
  employeeEmail: string;
  title: string;
  currency: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentComment?: string;
  paidAt?: string;
  paidByEmail?: string;
};

function statusTag(status: string) {
  const v = (status || "").toUpperCase();
  const color =
    v === "APPROVED" ? "green" :
    v === "REJECTED" ? "red" :
    v === "SUBMITTED" || v === "PENDING_APPROVAL" ? "blue" : "default";
  return <Tag color={color}>{v}</Tag>;
}

function safeJson(v: any) {
  try {
    if (!v) return null;
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch { return null; }
}

function mapWfStatusToStep(st?: string) {
  const v = (st || "").toUpperCase();
  if (v === "APPROVED" || v === "COMPLETED") return "finish";
  if (v === "REJECTED") return "error";
  if (v === "PENDING") return "process";
  return "wait";
}

export default function FinancePaymentsPage() {
  const screens = useBreakpoint();
  const [loading, setLoading] = useState(false);
  const [claims, setClaims] = useState<ApprovedClaim[]>([]);

  // Mark as Paid modal
  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [selectedForPay, setSelectedForPay] = useState<ApprovedClaim | null>(null);
  const [form] = Form.useForm();

  // Details drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [claimDetails, setClaimDetails] = useState<any | null>(null);
  const [drawerReceipts, setDrawerReceipts] = useState<any[]>([]);
  const [previewReceipt, setPreviewReceipt] = useState<{ url: string; name: string; mime: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const openReceiptPreview = async (r: any) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/api/receipts/${r.id}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setPreviewReceipt({ url, name: r.fileName, mime: r.mimeType });
    } catch {
      message.error("Failed to load receipt");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewReceipt) URL.revokeObjectURL(previewReceipt.url);
    setPreviewReceipt(null);
  };

  const loadClaims = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/finance/approved-claims");
      setClaims(res.data.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load approved claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClaims(); }, []);

  const openDetails = async (id: string) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/api/claims/${id}`);
      setClaimDetails(res.data);
      const rRes = await api.get(`/api/claims/${id}/receipts`);
      setDrawerReceipts(rRes.data.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load claim details");
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const showMarkPaidModal = (claim: ApprovedClaim) => {
    setSelectedForPay(claim);
    form.resetFields();
    setPaidModalOpen(true);
  };

  const handleMarkPaid = async () => {
    if (!selectedForPay) return;
    try {
      const values = await form.validateFields();
      await api.post(`/api/finance/claims/${selectedForPay.id}/mark-paid`, {
        paymentMethod: values.paymentMethod,
        paymentComment: values.paymentComment || "",
      });
      message.success("Claim marked as paid successfully");
      setPaidModalOpen(false);
      setSelectedForPay(null);
      form.resetFields();
      loadClaims();
      // refresh drawer if open for same claim
      if (detailsOpen && claimDetails?.claim?.id === selectedForPay.id) {
        openDetails(selectedForPay.id);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to mark as paid");
    }
  };

  const drawerWidth = screens.xs ? "100%" : screens.lg ? 980 : 860;

  const claim = claimDetails?.claim;
  const selectedItems = claimDetails?.items || [];
  const expenseForm = claimDetails?.expenseForm || null;
  const workflowSteps = claimDetails?.workflowSteps || [];
  const workflowInstance = claimDetails?.workflowInstance || null;

  // find matching row for payment info
  const payRow = claim ? claims.find((c) => c.id === claim.id) : null;

  const renderSchemaReadOnly = () => {
    if (!expenseForm?.schema || !claim) return null;
    const schema = safeJson(expenseForm.schema);
    const headerFields = schema?.header?.fields || [];
    const claimMeta = claim.meta || {};
    if (!headerFields.length) return null;
    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <Text strong>Form: {expenseForm.name}</Text>
        <Divider style={{ margin: "8px 0" }} />
        <Descriptions size="small" bordered column={screens.xs ? 1 : 2}>
          {headerFields.map((f: any) => (
            <Descriptions.Item key={f.key} label={f.label || f.key}>
              {claimMeta?.[f.key] ?? "-"}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
    );
  };

  const columns = [
    { title: "Employee", dataIndex: "employeeEmail", width: 200, ellipsis: true },
    { title: "Title", dataIndex: "title", width: 220, ellipsis: true },
    {
      title: "Amount", key: "amount", width: 140,
      render: (_: any, r: ApprovedClaim) => (
        <Text strong>{r.currency} {r.totalAmount.toFixed(2)}</Text>
      ),
    },
    {
      title: "Approved At", dataIndex: "approvedAt", width: 160,
      render: (v: string) => v ? dayjs(v).format("DD MMM YYYY HH:mm") : "—",
    },
    {
      title: "Payment Status", dataIndex: "paymentStatus", width: 140,
      render: (s: string) => s === "PAID"
        ? <Tag color="success" icon={<CheckCircleOutlined />}>PAID</Tag>
        : <Tag color="warning">PENDING</Tag>,
    },
    { title: "Method", dataIndex: "paymentMethod", width: 120, render: (v: string) => v || "—" },
    {
      title: "Paid At", dataIndex: "paidAt", width: 160,
      render: (v: string) => v ? dayjs(v).format("DD MMM YYYY HH:mm") : "—",
    },
    {
      title: "Actions", key: "action", width: 160, fixed: "right" as const,
      render: (_: any, r: ApprovedClaim) => (
        <Space>
          <Button size="small" onClick={() => openDetails(r.id)}>View</Button>
          {r.paymentStatus !== "PAID" && (
            <Button size="small" type="primary" icon={<DollarOutlined />} onClick={() => showMarkPaidModal(r)}>
              Mark Paid
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Finance — Approved Claims</div>
          <Text type="secondary">View and process approved expense claims for payment</Text>
        </div>
        <Button onClick={loadClaims} loading={loading}>Refresh</Button>
      </div>

      <Table
        dataSource={claims}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} claims` }}
        scroll={{ x: 1200 }}
        size={screens.xs ? "small" : "middle"}
      />

      {/* ── Details Drawer ── */}
      <Drawer
        open={detailsOpen}
        onClose={() => { setDetailsOpen(false); setClaimDetails(null); setDrawerReceipts([]); }}
        title="Claim Details"
        width={drawerWidth}
        extra={
          payRow && payRow.paymentStatus !== "PAID" ? (
            <Button type="primary" icon={<DollarOutlined />} onClick={() => showMarkPaidModal(payRow)}>
              Mark Paid
            </Button>
          ) : null
        }
        styles={{ body: { padding: screens.xs ? 12 : 24 } }}
      >
        {detailsLoading ? (
          <Text>Loading...</Text>
        ) : !claim ? (
          <Text type="secondary">No claim selected</Text>
        ) : (
          <>
            <Descriptions bordered size="small" column={screens.xs ? 1 : 2}>
              <Descriptions.Item label="Employee">{claim.employeeEmail || "—"}</Descriptions.Item>
              <Descriptions.Item label="Title">{claim.title}</Descriptions.Item>
              {/* <Descriptions.Item label="Status">{statusTag(claim.status)}</Descriptions.Item> */}
              <Descriptions.Item label="Status"><Tag color="success" icon={<CheckCircleOutlined />}>APPROVED</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Currency">{claim.currency}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">{Number(claim.totalAmount).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {claim.submittedAt ? dayjs(claim.submittedAt).format("YYYY-MM-DD HH:mm") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Approved">
                {claim.approvedAt ? dayjs(claim.approvedAt).format("YYYY-MM-DD HH:mm") : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {claim.createdAt ? dayjs(claim.createdAt).format("YYYY-MM-DD HH:mm") : "—"}
              </Descriptions.Item>

              {/* Payment info */}
              <Descriptions.Item label="Payment Status">
                {payRow?.paymentStatus === "PAID"
                  ? <Tag color="success" icon={<CheckCircleOutlined />}>PAID</Tag>
                  : <Tag color="warning">PENDING</Tag>}
              </Descriptions.Item>
              {payRow?.paymentMethod && (
                <Descriptions.Item label="Payment Method">{payRow.paymentMethod}</Descriptions.Item>
              )}
              {payRow?.paidAt && (
                <Descriptions.Item label="Paid At">
                  {dayjs(payRow.paidAt).format("YYYY-MM-DD HH:mm")}
                </Descriptions.Item>
              )}
              {payRow?.paidByEmail && (
                <Descriptions.Item label="Paid By">{payRow.paidByEmail}</Descriptions.Item>
              )}
              {payRow?.paymentComment && (
                <Descriptions.Item label="Payment Comment" span={2}>
                  {payRow.paymentComment}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Workflow Steps */}
            {workflowSteps.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>Approval Timeline</Text>
                <Steps
                  direction="vertical"
                  size="small"
                  style={{ marginTop: 8 }}
                  current={(workflowInstance?.currentStep || 1) - 1}
                  items={workflowSteps.map((st: any) => {
                    const stepNo = Number(st.stepNo ?? st.step_no ?? 0);
                    const approverEmail = (st.approverEmail ?? st.approver_email ?? "").toString().trim();
                    const approverRole = (st.approverRole ?? st.approver_role ?? "").toString().trim();
                    const approverLabel = approverEmail || (approverRole ? `ROLE:${approverRole.toUpperCase()}` : "—");
                    const rawStatus = (st.status ?? "").toString().trim().toUpperCase();

                    return {
                      title: `Step ${stepNo} • ${approverLabel}`,
                      status: mapWfStatusToStep(rawStatus) as any,
                      description: (
                        <div style={{ fontSize: 12, opacity: 0.85 }}>
                          <div>Status: <b>{rawStatus || "WAITING"}</b></div>
                          {st.actedByEmail && <div>By: {st.actedByEmail}</div>}
                          {st.actedAt && <div>At: {dayjs(st.actedAt).format("YYYY-MM-DD HH:mm")}</div>}
                          {st.comments && <div>Comments: {st.comments}</div>}
                        </div>
                      ),
                    };
                  })}
                />
              </div>
            )}

            {/* Schema header fields */}
            {renderSchemaReadOnly()}

            {/* Items */}
            <div style={{ marginTop: 16 }}>
              <Text strong>Expense Items</Text>
              <Table
                style={{ marginTop: 8 }}
                rowKey={(r: any) => r.id || `${r.expenseDate}-${r.category}`}
                dataSource={selectedItems}
                pagination={false}
                size="small"
                scroll={{ x: "max-content" }}
                columns={[
                  { title: "Date", dataIndex: "expenseDate", width: 120 },
                  { title: "Category", dataIndex: "category", width: 160, ellipsis: true },
                  { title: "Description", dataIndex: "description", ellipsis: true },
                  { title: "Amount", dataIndex: "amount", width: 110 },
                  { title: "Currency", dataIndex: "currency", width: 90 },
                ]}
              />
            </div>

            {/* Receipts */}
            <div style={{ marginTop: 16 }}>
              <Text strong>Receipts ({drawerReceipts.length})</Text>
              {drawerReceipts.length === 0 ? (
                <div style={{ marginTop: 4 }}><Text type="secondary">No receipts attached.</Text></div>
              ) : (
                <Table
                  style={{ marginTop: 8 }}
                  size="small"
                  pagination={false}
                  dataSource={drawerReceipts}
                  rowKey="id"
                  scroll={{ x: "max-content" }}
                  columns={[
                    {
                      title: "File",
                      dataIndex: "fileName",
                      ellipsis: true,
                      render: (name: string) => <Space><PaperClipOutlined />{name}</Space>,
                    },
                    {
                      title: "Size",
                      dataIndex: "fileSize",
                      width: 90,
                      render: (s: number) => `${(s / 1024).toFixed(1)} KB`,
                    },
                    {
                      title: "Uploaded By",
                      dataIndex: "uploadedBy",
                      width: 180,
                      ellipsis: true,
                    },
                    {
                      title: "View",
                      width: 70,
                      render: (_: any, r: any) => (
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          loading={previewLoading}
                          onClick={() => openReceiptPreview(r)}
                        />
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* ── Mark as Paid Modal ── */}
      <Modal
        title="Mark Claim as Paid"
        open={paidModalOpen}
        onOk={handleMarkPaid}
        onCancel={() => { setPaidModalOpen(false); form.resetFields(); setSelectedForPay(null); }}
        okText="Mark as Paid"
        width={480}
      >
        {selectedForPay && (
          <Descriptions size="small" bordered column={1} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Employee">{selectedForPay.employeeEmail}</Descriptions.Item>
            <Descriptions.Item label="Title">{selectedForPay.title}</Descriptions.Item>
            <Descriptions.Item label="Amount">
              {selectedForPay.currency} {selectedForPay.totalAmount.toFixed(2)}
            </Descriptions.Item>
          </Descriptions>
        )}

        <Form form={form} layout="vertical">
          <Form.Item
            name="paymentMethod"
            label="Payment Method"
            rules={[{ required: true, message: "Please select payment method" }]}
          >
            <Select placeholder="Select payment method">
              {["NetBanking", "GPay", "PhonePe", "Paytm", "Bank Transfer", "Cheque", "Cash", "Other"].map((m) => (
                <Select.Option key={m} value={m}>{m}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="paymentComment" label="Comment (Optional)">
            <TextArea rows={3} placeholder="Transaction ID, reference number, notes…" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
      {/* ── Receipt Preview Modal ── */}
      <Modal
        open={!!previewReceipt}
        onCancel={closePreview}
        title={previewReceipt?.name || "Receipt"}
        width={screens.xs ? "100%" : 800}
        footer={
          <Space>
            <Button
              type="primary"
              onClick={() => {
                if (!previewReceipt) return;
                const a = document.createElement("a");
                a.href = previewReceipt.url;
                a.download = previewReceipt.name;
                a.click();
              }}
            >
              Download
            </Button>
            <Button onClick={closePreview}>Close</Button>
          </Space>
        }
        styles={{ body: { padding: 8, textAlign: "center", maxHeight: "75vh", overflowY: "auto" } }}
      >
        {previewReceipt?.mime?.startsWith("image/") ? (
          <img src={previewReceipt.url} alt={previewReceipt.name} style={{ maxWidth: "100%", maxHeight: "70vh" }} />
        ) : previewReceipt?.mime === "application/pdf" ? (
          <iframe src={previewReceipt.url} style={{ width: "100%", height: "70vh", border: "none" }} />
        ) : (
          <Text>Preview not available. <Button type="link" onClick={() => { const a = document.createElement("a"); a.href = previewReceipt!.url; a.download = previewReceipt!.name; a.click(); }}>Download</Button></Text>
        )}
      </Modal>
    </div>
  );
}
