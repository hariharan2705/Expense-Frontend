import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Divider,
  Select,
  Row,
  Col,
  Steps,
  Collapse,
  Upload,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import api from "../../lib/api";
import dayjs from "dayjs";

const { Text } = Typography;
const { useBreakpoint } = Grid;

type Claim = {
  id: string;
  title: string;
  status: string;
  currency: string;
  totalAmount: number;
  employeeEmail?: string;
  rejectReason?: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  // backend may return this
  expenseFormId?: string | null;
  meta?: Record<string, any>;

  // workflow (optional from backend)
  levels?: number | null;
  currentStep?: number | null;
  currentApproverEmail?: string | null;
};

type ClaimItem = {
  id?: string;
  expenseDate: string;
  category: string;
  description?: string;
  amount: number;
  currency?: string;

  // backend may return this later
  meta?: Record<string, any>;
};

type ExpenseForm = {
  id: string;
  name: string;
  schema: any;
};

function statusTag(status: string) {
  const v = (status || "").toUpperCase();
  const color =
    v === "APPROVED"
      ? "green"
      : v === "REJECTED"
      ? "red"
      : v === "SUBMITTED" || v === "PENDING_APPROVAL"
      ? "blue"
      : "default";
  return <Tag color={color}>{v || status}</Tag>;
}

function safeJson(v: any) {
  try {
    if (!v) return null;
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch {
    return null;
  }
}

export default function ClaimsPage() {
  const screens = useBreakpoint();

  const mapWfStatusToStep = (st?: string) => {
    const v = (st || "").toUpperCase();
    if (v === "APPROVED" || v === "COMPLETED") return "finish";
    if (v === "REJECTED") return "error";
    if (v === "PENDING") return "process";
    return "wait"; // WAITING / unknown
  };

  const [rows, setRows] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(false);

  const [me, setMe] = useState<any>(null);

  // Create/Edit claim modal
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();

  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [originalItemIds, setOriginalItemIds] = useState<string[]>([]);

  // Details drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedItems, setSelectedItems] = useState<ClaimItem[]>([]);
  const [selectedExpenseForm, setSelectedExpenseForm] = useState<ExpenseForm | null>(null);

  // Full response from GET /api/claims/:id (includes optional workflowInstance/workflowSteps)
  const [claimDetails, setClaimDetails] = useState<any | null>(null);
  const [expenseForms, setExpenseForms] = useState<any[]>([]);
  const [editForm] = Form.useForm();
  const [addItemForm] = Form.useForm();
  const [selectedFormSchema, setSelectedFormSchema] = useState<any>(null);

  const roleUpper = (me?.user?.role || "").toString().trim().toUpperCase();

  // Approver-like users can switch between:
  // - Team Claims (approval inbox + history)
  // - My Claims (their own expenses as an employee)
  const canApproveLike =
    roleUpper === "APPROVER" ||
    roleUpper === "FINANCE" ||
    roleUpper === "TENANT_ADMIN" ||
    roleUpper === "MANAGER";

  const isManager = roleUpper === "MANAGER";

  // Scope toggle (default to Team for approver-like to preserve existing approver landing behavior)
  const [viewScope, setViewScope] = useState<"my" | "team">("team");

  // Team view => approver workflow view; My view => employee view
  const isApproverView = canApproveLike && viewScope === "team";

  // -----------------------
  // Filters (UI-level; keeps backend & workflow logic intact)
  // -----------------------
  type AmountOp = "" | "eq" | "gt" | "lt" | "between";

  // Default: Team Claims => Pending approvals first; My Claims => All
  // Multi-select filters (empty = no filter)
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [employeeFilter, setEmployeeFilter] = useState<string[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<string[]>([]);

  const [amountOp, setAmountOp] = useState<AmountOp>("");
  const [amountVal1, setAmountVal1] = useState<number | null>(null);
  const [amountVal2, setAmountVal2] = useState<number | null>(null);

  // When user flips between My/Team, reset filters conservatively
  useEffect(() => {
    if (isApproverView) {
      setStatusFilter(["PENDING_APPROVAL"]);
    } else {
      setStatusFilter([]);
    }
    setEmployeeFilter([]);
    setCurrencyFilter([]);
    setAmountOp("");
    setAmountVal1(null);
    setAmountVal2(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScope]);

  const normEmail = (x?: string | null) => (x || "").trim().toLowerCase();

  const loadMe = async () => {
    const res = await api.get("/api/me");
    setMe(res.data);
    return res.data;
  };

  const loadExpenseForms = async () => {
    const res = await api.get("/api/expense-forms");
    const active = (res.data.items || []).filter((f: any) => f.status === "ACTIVE");
    setExpenseForms(active);
    return active;
  };

  useEffect(() => {
    loadExpenseForms().catch(() => {});
  }, []);

  // Reload when approver-like toggles My/Team
  useEffect(() => {
    if (canApproveLike) {
      load({ scope: viewScope, canApproveLike: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewScope, canApproveLike]);

  const load = async (opts?: { scope?: "my" | "team"; canApproveLike?: boolean }) => {
    setLoading(true);
    try {
      const mode = typeof opts?.canApproveLike === "boolean" ? opts?.canApproveLike : canApproveLike;

      // For approver-like users, always pass scope so backend can return "my" vs "team"
      const params: any = {};
      let hasParams = false;

      if (mode) {
        params.scope = opts?.scope || viewScope;
        hasParams = true;
      }

      const res = await api.get("/api/claims", hasParams ? { params } : undefined);
      setRows(res.data.items || []);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const meData = await loadMe();
        const ru = (meData?.user?.role || "").toString().trim().toUpperCase();
        const approveLike =
          ru === "APPROVER" || ru === "FINANCE" || ru === "TENANT_ADMIN" || ru === "MANAGER";

        // Preserve existing behavior:
        // - APPROVER/FINANCE/ADMIN land on Team Claims
        // - MANAGER lands on My Claims
        const initialScope: "my" | "team" = approveLike && ru !== "MANAGER" ? "team" : "my";
        if (approveLike) setViewScope(initialScope);

        await load({ canApproveLike: approveLike, scope: initialScope });
      } catch (e: any) {
        message.error(e?.response?.data?.error || "Failed to initialize");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCreate = async () => {
    setModalMode("create");
    setEditingClaimId(null);
    setOriginalItemIds([]);

    form.resetFields();
    form.setFieldsValue({ currency: "INR" });

    // set default expenseFormId to first ACTIVE form (if any)
    if (expenseForms?.length) {
      const first = expenseForms[0];
      form.setFieldsValue({ expenseFormId: first.id });

      // also set schema so headerFields/itemFields render immediately
      const schema = safeJson(first.schema);
      setSelectedFormSchema(schema);

      const defaultCurrency =
        schema?.items?.fields?.find((x: any) => x.key === "currency")?.default || "INR";
      form.setFieldsValue({ currency: defaultCurrency });
    } else {
      // try load once more
      try {
        const active = await loadExpenseForms();
        if (active?.length) form.setFieldsValue({ expenseFormId: active[0].id });
      } catch {}
    }

    itemForm.resetFields();
    itemForm.setFieldsValue({ expenseDate: dayjs() });

    setItems([]);
    setOpen(true);
  };

  const showEdit = async (claimId: string) => {
    if (isApproverView) return;

    setModalMode("edit");
    setEditingClaimId(claimId);

    try {
      const res = await api.get(`/api/claims/${claimId}`);
      const claim: Claim = res.data.claim;
      const its: ClaimItem[] = res.data.items || [];

      if (claim.status !== "DRAFT") {
        message.warning("Only DRAFT claims can be edited");
        return;
      }

      // Resolve schema for the claim's expenseFormId
      // Prefer expenseForm returned by GET /claims/:id (if backend sends it),
      // else fall back to locally loaded expenseForms list.
      let schema: any = null;

      if (res.data.expenseForm?.schema) {
        schema = safeJson(res.data.expenseForm.schema);
      } else {
        const f = expenseForms.find((x: any) => x.id === claim.expenseFormId);
        schema = safeJson(f?.schema);
      }

      setSelectedFormSchema(schema);

      // Apply defaults if schema defines currency default
      const schemaDefaultCurrency =
        schema?.items?.fields?.find((x: any) => x.key === "currency")?.default || "INR";

      form.resetFields();
      form.setFieldsValue({
        expenseFormId: claim.expenseFormId,
        title: claim.title,
        currency: claim.currency || schemaDefaultCurrency || "INR",

        // Populate header custom fields into claim.meta.<key>
        meta: claim.meta || {},
      });

      // Reset item form (used only for adding a new item)
      itemForm.resetFields();
      itemForm.setFieldsValue({ expenseDate: dayjs() });

      // Load existing items into the list/table
      setItems(its);
      setOriginalItemIds(its.filter((x) => !!x.id).map((x) => String(x.id)));

      setOpen(true);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load claim for edit");
    }
  };

  const ITEM_CORE_KEYS = new Set(["expenseDate", "category", "description", "amount", "currency"]);

  const addItem = async () => {
    const v = await itemForm.validateFields();

    const next: any = { ...v };
    if (next.expenseDate?.format) next.expenseDate = next.expenseDate.format("YYYY-MM-DD");

    // pack dynamic fields into meta
    const meta: any = {};
    Object.keys(next).forEach((k) => {
      if (!ITEM_CORE_KEYS.has(k)) {
        meta[k] = next[k];
        delete next[k];
      }
    });
    next.meta = meta;

    setItems((prev) => [...prev, next]);
    itemForm.resetFields();
    itemForm.setFieldsValue({ expenseDate: dayjs() });
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const create = async () => {
    const v = await form.validateFields();
    if (items.length === 0) {
      message.error("Add at least 1 claim item");
      return;
    }
    try {
      // expenseFormId should be top-level (NOT inside each item)
      await api.post("/api/claims", {
        title: v.title,
        currency: v.currency || "INR",
        expenseFormId: v.expenseFormId,
        meta: v.meta || {}, // claim header custom fields
        items: items.map((x) => ({
          expenseDate: x.expenseDate,
          category: x.category,
          description: x.description || "",
          amount: x.amount,
          currency: x.currency || v.currency || "INR",
          meta: x.meta || {}, // item-level custom fields (future)
        })),
      });
      message.success("Claim created");
      setOpen(false);
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Create failed");
    }
  };

  const updateClaim = async () => {
    if (!editingClaimId) return;

    const v = await form.validateFields();
    if (items.length === 0) {
      message.error("Add at least 1 claim item");
      return;
    }

    try {
      // 1) update header
      await api.patch(`/api/claims/${editingClaimId}`, {
        title: v.title,
        currency: v.currency || "INR",
        meta: v.meta || {},
      });

      // 2) delete removed existing items
      const currentExistingIds = items.filter((x) => !!x.id).map((x) => String(x.id));
      const toDelete = originalItemIds.filter((id) => !currentExistingIds.includes(id));

      for (const id of toDelete) {
        await api.delete(`/api/claims/${editingClaimId}/items/${id}`);
      }

      // 3) add newly added items (no id)
      const toAdd = items.filter((x) => !x.id);
      for (const it of toAdd) {
        await api.post(`/api/claims/${editingClaimId}/items`, {
          expenseDate: it.expenseDate,
          category: it.category,
          description: it.description || "",
          amount: it.amount,
          currency: it.currency || v.currency || "INR",
          meta: it.meta || {},
        });
      }

      message.success("Claim updated");
      setOpen(false);

      await load();

      if (detailsOpen && selectedClaim?.id === editingClaimId) {
        await openDetails(editingClaimId);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Update failed");
    }
  };

  const onModalOk = async () => {
    if (modalMode === "create") return create();
    return updateClaim();
  };

  const renderStops = (items: string[]) => (
    <div style={{ maxHeight: 240, overflow: "auto" }}>
      <ul style={{ paddingLeft: 18, margin: 0 }}>
        {items.map((x, idx) => (
          <li key={idx} style={{ marginBottom: 6 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );

  const submitClaim = async (id: string) => {
    try {
      const res = await api.post(`/api/claims/${id}/submit`);
      const softStops: string[] = res?.data?.softStops || [];

      // If policy produced soft stops, show them as a warning but continue (submit succeeded).
      if (softStops.length > 0) {
        Modal.warning({
          title: "Submitted with warnings",
          content: (
            <>
              <div style={{ marginBottom: 8 }}>
                Your claim was submitted successfully, but policy produced the following warnings:
              </div>
              {renderStops(softStops)}
            </>
          ),
          okText: "OK",
        });
      } else {
        message.success("Submitted");
      }

      await load();
      if (detailsOpen && selectedClaim?.id === id) {
        await openDetails(id);
      }
    } catch (e: any) {
      const data = e?.response?.data;
      const hardStops: string[] = data?.hardStops || [];
      const softStops: string[] = data?.softStops || [];
      const err = data?.error || "Submit failed";

      // Policy hard stop: show a rich modal with the details
      if (err === "policy_hard_stop" || hardStops.length > 0) {
        Modal.error({
          title: "Cannot submit claim",
          content: (
            <>
              <div style={{ marginBottom: 8 }}>Policy validation blocked submission:</div>
              {hardStops.length > 0 ? renderStops(hardStops) : null}
              {softStops.length > 0 ? (
                <>
                  <div style={{ marginTop: 12, marginBottom: 6 }}>Other warnings (non-blocking):</div>
                  {renderStops(softStops)}
                </>
              ) : null}
            </>
          ),
          okText: "OK",
        });
        return;
      }

      message.error(data?.error || "Submit failed");
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/api/claims/${id}/approve`);
      message.success("Approved");
      await load();
      if (detailsOpen && selectedClaim?.id === id) {
        await openDetails(id);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Approve failed");
    }
  };

  const reject = async (id: string) => {
    const reason = prompt("Reject reason?");
    try {
      await api.post(`/api/claims/${id}/reject`, { reason: reason || "" });
      message.success("Rejected");
      await load();
      if (detailsOpen && selectedClaim?.id === id) {
        await openDetails(id);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Reject failed");
    }
  };

  const openDetails = async (id: string) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/api/claims/${id}`);

      // Keep full response for optional workflow blocks
      setClaimDetails(res.data || null);

      setSelectedClaim(res.data.claim);
      setSelectedItems(res.data.items || []);
      setSelectedExpenseForm(res.data.expenseForm || null);

      editForm.setFieldsValue({
        title: res.data.claim?.title,
        currency: res.data.claim?.currency,
      });
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load claim details");
      setClaimDetails(null);
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const addDraftItem = async () => {
    if (!selectedClaim) return;
    const v = await addItemForm.validateFields();
    try {
      await api.post(`/api/claims/${selectedClaim.id}/items`, {
        expenseDate: v.expenseDate.format("YYYY-MM-DD"),
        category: v.category,
        description: v.description || "",
        amount: v.amount,
        currency: v.currency || selectedClaim.currency,
      });
      message.success("Item added");
      addItemForm.resetFields();
      await load();
      await openDetails(selectedClaim.id);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Add item failed");
    }
  };

  const deleteDraftItem = async (itemId: string) => {
    if (!selectedClaim) return;
    try {
      await api.delete(`/api/claims/${selectedClaim.id}/items/${itemId}`);
      message.success("Item removed");
      await load();
      await openDetails(selectedClaim.id);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Remove failed");
    }
  };

  const employeeOptions = useMemo(() => {
    const set = new Set<string>();
    (rows || []).forEach((r) => {
      if ((r as any).employeeEmail) set.add(String((r as any).employeeEmail));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>();
    (rows || []).forEach((r) => {
      if (r.currency) set.add(String(r.currency));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let data = (rows || []).slice();

    if (Array.isArray(statusFilter) && statusFilter.length > 0) {
      const allowed = new Set(statusFilter.map((s) => String(s || "").toUpperCase()));
      data = data.filter((r) => allowed.has(String(r.status || "").toUpperCase()));
    }

    if (Array.isArray(employeeFilter) && employeeFilter.length > 0) {
      const allowed = new Set(employeeFilter.map((s) => String(s || "")));
      data = data.filter((r) => allowed.has(String((r as any).employeeEmail || "")));
    }

    if (Array.isArray(currencyFilter) && currencyFilter.length > 0) {
      const allowed = new Set(currencyFilter.map((s) => String(s || "")));
      data = data.filter((r) => allowed.has(String(r.currency || "")));
    }

    const amt = (r: Claim) => {
      const n = Number((r as any).totalAmount);
      return Number.isFinite(n) ? n : 0;
    };

    if (amountOp && amountOp !== "") {
      if (amountOp === "between") {
        if (amountVal1 !== null && amountVal2 !== null) {
          const lo = Math.min(amountVal1, amountVal2);
          const hi = Math.max(amountVal1, amountVal2);
          data = data.filter((r) => {
            const v = amt(r);
            return v >= lo && v <= hi;
          });
        }
      } else {
        if (amountVal1 !== null) {
          if (amountOp === "eq") data = data.filter((r) => amt(r) === amountVal1);
          if (amountOp === "gt") data = data.filter((r) => amt(r) > amountVal1);
          if (amountOp === "lt") data = data.filter((r) => amt(r) < amountVal1);
        }
      }
    }

    return data;
  }, [rows, statusFilter, employeeFilter, currencyFilter, amountOp, amountVal1, amountVal2]);

  const cols = useMemo(
    () => [
      ...(isApproverView ? [{ title: "Employee", dataIndex: "employeeEmail", width: 220 }] : []),
      { title: "Title", dataIndex: "title", width: 260, ellipsis: true },
      { title: "Currency", dataIndex: "currency", width: 90 },
      { title: "Total", dataIndex: "totalAmount", width: 120 },
      {
        title: "Status",
        dataIndex: "status",
        width: 200,
        render: (v: string, r: Claim) => (
          <Space wrap>
            {statusTag(v)}
            {String(v || "").toUpperCase() === "REJECTED" && r.rejectReason ? (
              <Tag color="red">{r.rejectReason}</Tag>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Approval",
        key: "approval",
        width: 260,
        render: (_: any, r: Claim) => {
          const levels = (r as any).levels as number | undefined;
          const currentStep = (r as any).currentStep as number | undefined;
          const currentApproverEmail = (r as any).currentApproverEmail as string | undefined;

          if (!levels) return <span style={{ color: "#999" }}>—</span>;

          if (r.status === "APPROVED") {
            return <Tag color="green">Completed ({levels}/{levels})</Tag>;
          }
          if (r.status === "REJECTED") {
            return <Tag color="red">Rejected</Tag>;
          }

          const cs = currentStep || 1;
          return (
            <Space direction="vertical" size={2}>
              <Tag color="blue">Step {cs}/{levels}</Tag>
              {currentApproverEmail ? (
                <span style={{ fontSize: 12, color: "#666" }}>Current: {currentApproverEmail}</span>
              ) : (
                <span style={{ fontSize: 12, color: "#999" }}>Current: —</span>
              )}
            </Space>
          );
        },
      },
      {
        title: "Actions",
        fixed: screens.lg ? "right" : undefined,
        width: screens.lg ? 260 : 220,
        render: (_: any, r: Claim) => {
          const canEdit = !isApproverView && r.status === "DRAFT";
          const canApproveReject =
            isApproverView &&
            ["SUBMITTED", "PENDING_APPROVAL"].includes(r.status) &&
            (normEmail(r.currentApproverEmail) === normEmail(me?.user?.email) ||
              (!r.currentApproverEmail &&
                (r as any).currentApproverRole &&
                (r as any).currentApproverRole === roleUpper));

          return (
            <Space wrap>
              <Button size="small" onClick={() => openDetails(r.id)}>
                View
              </Button>

              {canEdit ? (
                <Button size="small" onClick={() => showEdit(r.id)}>
                  Edit
                </Button>
              ) : null}

              {!isApproverView && r.status === "DRAFT" ? (
                <Button size="small" type="primary" onClick={() => submitClaim(r.id)}>
                  Submit
                </Button>
              ) : null}

              {canApproveReject ? (
                <>
                  <Button size="small" type="primary" onClick={() => approve(r.id)}>
                    Approve
                  </Button>
                  <Button size="small" danger onClick={() => reject(r.id)}>
                    Reject
                  </Button>
                </>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [isApproverView, me, roleUpper, screens.lg]
  );

  const drawerActions = useMemo(() => {
    if (!selectedClaim) return null;

    const st = selectedClaim.status;

    if (!isApproverView && st === "DRAFT") {
      return (
        <Button type="primary" onClick={() => submitClaim(selectedClaim.id)}>
          Submit Claim
        </Button>
      );
    }

    if (isApproverView && st === "SUBMITTED") {
      return (
        <Space>
          <Button type="primary" onClick={() => approve(selectedClaim.id)}>
            Approve
          </Button>
          <Button danger onClick={() => reject(selectedClaim.id)}>
            Reject
          </Button>
        </Space>
      );
    }

    return null;
  }, [selectedClaim, isApproverView]);

  const headerFields = selectedFormSchema?.header?.fields || [];
  const itemFields = selectedFormSchema?.items?.fields || [];

  const renderHeaderField = (f: any) => {
    const name = ["meta", f.key]; // store under claim.meta.<key>
    const rules = f.required ? [{ required: true, message: `${f.label || f.key} is required` }] : [];

    if (f.type === "select") {
      const options = (f.options || []).map((v: string) => ({ label: v, value: v }));
      return (
        <Form.Item key={f.key} name={name} label={f.label || f.key} rules={rules}>
          <Select options={options} placeholder={`Select ${f.label || f.key}`} />
        </Form.Item>
      );
    }

    if (f.type === "textarea") {
      return (
        <Form.Item key={f.key} name={name} label={f.label || f.key} rules={rules}>
          <Input.TextArea maxLength={f.maxLength || 500} showCount rows={3} />
        </Form.Item>
      );
    }

    return (
      <Form.Item key={f.key} name={name} label={f.label || f.key} rules={rules}>
        <Input maxLength={f.maxLength || 200} />
      </Form.Item>
    );
  };

  const canEditDraft = !isApproverView && !!selectedClaim && selectedClaim.status === "DRAFT";

  const renderSchemaReadOnly = () => {
    if (!selectedExpenseForm?.schema || !selectedClaim) return null;

    const schema = safeJson(selectedExpenseForm.schema);
    if (!schema) return null;

    const headerFields = schema?.header?.fields || [];
    const claimMeta = selectedClaim.meta || {};

    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text strong>Expense Form</Text>
          <Text>
            {selectedExpenseForm.name} <Text type="secondary">({selectedExpenseForm.id})</Text>
          </Text>

          <Divider style={{ margin: "8px 0" }} />

          {headerFields.length ? (
            <>
              <Text strong>Form Header</Text>
              <Descriptions size="small" bordered column={screens.xs ? 1 : 2}>
                {headerFields.map((f: any) => {
                  const key = f.key;
                  const label = f.label || key;
                  const val = claimMeta?.[key];
                  return (
                    <Descriptions.Item key={key} label={label}>
                      {val === undefined || val === null || val === "" ? "-" : String(val)}
                    </Descriptions.Item>
                  );
                })}
              </Descriptions>
            </>
          ) : (
            <Text type="secondary">No header fields in schema.</Text>
          )}
        </Space>
      </Card>
    );
  };

  const pagePad = screens.xs ? 12 : 24;
  const modalWidth = screens.xs ? "100%" : screens.md ? 980 : 760;
  const modalBodyMaxH = screens.xs ? "calc(100vh - 170px)" : "72vh";
  const drawerWidth = screens.xs ? "100%" : screens.lg ? 980 : 860;

  const filtersNode = (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Row gutter={[12, 12]} align="middle">
        <Col xs={24} sm={12} md={6}>
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Text type="secondary">Status</Text>
            <Select
              mode="multiple"
              allowClear
              placeholder="Select status"
              maxTagCount="responsive"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as string[])}
              style={{ width: "100%" }}
              options={[
                { label: "Pending Approval", value: "PENDING_APPROVAL" },
                { label: "Approved", value: "APPROVED" },
                { label: "Rejected", value: "REJECTED" },
                { label: "Draft", value: "DRAFT" },
              ]}
            />
          </Space>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Text type="secondary">Employee</Text>
            <Select
              mode="multiple"
              allowClear
              placeholder={isApproverView ? "Select employee(s)" : "(Team view only)"}
              maxTagCount="responsive"
              value={employeeFilter}
              onChange={(v) => setEmployeeFilter(v as string[])}
              style={{ width: "100%" }}
              disabled={!isApproverView}
              showSearch
              optionFilterProp="label"
              options={employeeOptions.map((e) => ({ label: e, value: e }))}
            />
          </Space>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Text type="secondary">Currency</Text>
            <Select
              mode="multiple"
              allowClear
              placeholder="Select currency"
              maxTagCount="responsive"
              value={currencyFilter}
              onChange={(v) => setCurrencyFilter(v as string[])}
              style={{ width: "100%" }}
              options={currencyOptions.map((c) => ({ label: c, value: c }))}
            />
          </Space>
        </Col>

        <Col xs={24} sm={24} md={6}>
          <Space direction="vertical" size={4} style={{ width: "100%" }}>
            <Text type="secondary">Amount</Text>
            <Space.Compact style={{ width: "100%" }}>
              <Select
                value={amountOp}
                onChange={(v: any) => {
                  setAmountOp(v);
                  setAmountVal1(null);
                  setAmountVal2(null);
                }}
                style={{ width: 130 }}
                options={[
                  { label: "Any", value: "" },
                  { label: "=", value: "eq" },
                  { label: ">", value: "gt" },
                  { label: "<", value: "lt" },
                  { label: "Between", value: "between" },
                ]}
              />
              <InputNumber
                value={amountVal1}
                onChange={(v) => setAmountVal1(v as any)}
                style={{ width: amountOp === "between" ? "40%" : "100%" }}
                placeholder={amountOp === "between" ? "Min" : "Amount"}
                min={0}
              />
              {amountOp === "between" ? (
                <InputNumber
                  value={amountVal2}
                  onChange={(v) => setAmountVal2(v as any)}
                  style={{ width: "40%" }}
                  placeholder="Max"
                  min={0}
                />
              ) : null}
            </Space.Compact>
          </Space>
        </Col>

        <Col xs={24}>
          <Space wrap>
            <Button
              onClick={() => {
                setStatusFilter(isApproverView ? ["PENDING_APPROVAL"] : []);
                setEmployeeFilter([]);
                setCurrencyFilter([]);
                setAmountOp("");
                setAmountVal1(null);
                setAmountVal2(null);
              }}
            >
              Reset Filters
            </Button>
            <Text type="secondary">
              Showing {filteredRows.length} of {(rows || []).length}
            </Text>
          </Space>
        </Col>
      </Row>
    </Card>
  );

  const showFiltersInline = !!screens.md;

  const itemColProps = { xs: 24, sm: 12, lg: 12 };

  return (
    <div style={{ padding: pagePad }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <Card
          title={isApproverView ? "Claims (Approver View)" : "My Expense Claims"}
          bodyStyle={{ padding: screens.xs ? 12 : 24 }}
          extra={
            <Space wrap>
              {canApproveLike ? (
                <Space.Compact>
                  <Button
                    size="small"
                    type={viewScope === "my" ? "primary" : "default"}
                    onClick={() => setViewScope("my")}
                  >
                    My Claims
                  </Button>
                  <Button
                    size="small"
                    type={viewScope === "team" ? "primary" : "default"}
                    onClick={() => setViewScope("team")}
                  >
                    Team Claims
                  </Button>
                </Space.Compact>
              ) : null}

              {/* Create is allowed in My scope (employee view). Managers can always create. */}
              {!isApproverView || isManager ? (
                <Button type="primary" onClick={showCreate}>
                  Create Claim
                </Button>
              ) : null}
            </Space>
          }
        >
          {/* Filters: inline for md+, collapsible for mobile */}
          {showFiltersInline ? (
            filtersNode
          ) : (
            <Collapse
              style={{ marginBottom: 12 }}
              items={[
                {
                  key: "filters",
                  label: "Filters",
                  children: filtersNode,
                },
              ]}
            />
          )}

          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredRows}
            columns={cols as any}
            size={screens.xs ? "small" : "middle"}
            sticky
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: screens.xs ? 5 : 10,
              showSizeChanger: !screens.xs,
            }}
          />
        </Card>

        {/* Details Drawer */}
        <Drawer
          open={detailsOpen}
          onClose={() => {
            setDetailsOpen(false);
            setClaimDetails(null);
          }}
          title="Claim Details"
          width={drawerWidth}
          extra={drawerActions}
          styles={{
            body: { padding: screens.xs ? 12 : 24 },
          }}
        >
          {detailsLoading ? (
            <Text>Loading...</Text>
          ) : !selectedClaim ? (
            <Text type="secondary">No claim selected</Text>
          ) : (
            <>
              <Descriptions bordered size="small" column={screens.xs ? 1 : 2}>
                {isApproverView ? (
                  <Descriptions.Item label="Employee">{selectedClaim.employeeEmail || "-"}</Descriptions.Item>
                ) : null}
                <Descriptions.Item label="Title">{selectedClaim.title}</Descriptions.Item>
                <Descriptions.Item label="Status">{statusTag(selectedClaim.status)}</Descriptions.Item>
                {(selectedClaim as any).levels ? (
                  <Descriptions.Item label="Approval Progress">
                    <Space direction="vertical" size={2}>
                      {selectedClaim.status === "APPROVED" ? (
                        <Tag color="green">
                          Completed ({(selectedClaim as any).levels}/{(selectedClaim as any).levels})
                        </Tag>
                      ) : selectedClaim.status === "REJECTED" ? (
                        <Tag color="red">Rejected</Tag>
                      ) : (
                        <Tag color="blue">
                          Step {(selectedClaim as any).currentStep || 1}/{(selectedClaim as any).levels}
                        </Tag>
                      )}
                      {(selectedClaim as any).currentApproverEmail ? (
                        <span style={{ fontSize: 12, color: "#666" }}>
                          Current: {(selectedClaim as any).currentApproverEmail}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#999" }}>Current: —</span>
                      )}
                    </Space>
                  </Descriptions.Item>
                ) : null}
                <Descriptions.Item label="Currency">{selectedClaim.currency}</Descriptions.Item>
                <Descriptions.Item label="Total Amount">{selectedClaim.totalAmount}</Descriptions.Item>
                <Descriptions.Item label="Created">
                  {selectedClaim.createdAt ? dayjs(selectedClaim.createdAt).format("YYYY-MM-DD HH:mm") : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Updated">
                  {selectedClaim.updatedAt ? dayjs(selectedClaim.updatedAt).format("YYYY-MM-DD HH:mm") : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Submitted">
                  {selectedClaim.submittedAt ? dayjs(selectedClaim.submittedAt).format("YYYY-MM-DD HH:mm") : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Approved">
                  {selectedClaim.approvedAt ? dayjs(selectedClaim.approvedAt).format("YYYY-MM-DD HH:mm") : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Rejected">
                  {selectedClaim.rejectedAt ? dayjs(selectedClaim.rejectedAt).format("YYYY-MM-DD HH:mm") : "-"}
                </Descriptions.Item>

                {selectedClaim.status === "REJECTED" ? (
                  <Descriptions.Item label="Reject Reason" span={screens.xs ? 1 : 2}>
                    {selectedClaim.rejectReason || "-"}
                  </Descriptions.Item>
                ) : null}
              </Descriptions>

              {claimDetails?.workflowSteps?.length ? (
                <div style={{ marginTop: 16 }}>
                  <h4 style={{ marginBottom: 8 }}>Approval Timeline</h4>
                  <Steps
                    direction="vertical"
                    size="small"
                    current={(claimDetails?.workflowInstance?.currentStep || 1) - 1}
                    items={(claimDetails.workflowSteps || []).map((st: any) => {
                      const stepNo = Number(st.stepNo ?? st.step_no ?? st.step ?? 0) || 0;

                      const approverEmail = (st.approverEmail ?? st.approver_email ?? "")
                        .toString()
                        .trim();
                      const approverRole = (st.approverRole ?? st.approver_role ?? "").toString().trim();

                      const approverLabel =
                        approverEmail || (approverRole ? `ROLE:${approverRole.toUpperCase()}` : "—");

                      const rawStatus = (st.status ?? "").toString().trim().toUpperCase();
                      const displayStatus = rawStatus || "WAITING";

                      const title = approverLabel.startsWith("ROLE:")
                        ? `Step ${stepNo} • ${approverRole.toUpperCase()} Queue`
                        : `Step ${stepNo} • ${approverLabel}`;

                      return {
                        title,
                        status: mapWfStatusToStep(displayStatus) as any,
                        description: (
                          <div style={{ fontSize: 12, opacity: 0.85 }}>
                            <div>
                              Status: <b>{displayStatus}</b>
                            </div>

                            {!approverEmail && approverRole ? (
                              <div>
                                Approver: <b>ROLE:{approverRole.toUpperCase()}</b>
                              </div>
                            ) : null}

                            {st.actedByEmail ? <div>By: {st.actedByEmail}</div> : null}
                            {st.actedAt ? <div>At: {new Date(st.actedAt).toLocaleString()}</div> : null}
                            {st.comments ? <div>Comments: {st.comments}</div> : null}
                          </div>
                        ),
                      };
                    })}
                  />
                </div>
              ) : null}

              {/* Schema-driven read-only view */}
              {renderSchemaReadOnly()}

              <div style={{ marginTop: 16 }}>
                <Text strong>Items</Text>
                <Table
                  style={{ marginTop: 8 }}
                  rowKey={(r: any) => (r.id ? r.id : `${r.expenseDate}-${r.category}-${r.amount}`)}
                  dataSource={selectedItems}
                  pagination={false}
                  size={screens.xs ? "small" : "middle"}
                  scroll={{ x: "max-content" }}
                  columns={[
                    { title: "Date", dataIndex: "expenseDate", width: 120 },
                    { title: "Category", dataIndex: "category", width: 180, ellipsis: true },
                    { title: "Description", dataIndex: "description", ellipsis: true },
                    { title: "Amount", dataIndex: "amount", width: 120 },
                    { title: "Currency", dataIndex: "currency", width: 100 },
                    ...(canEditDraft
                      ? [
                          {
                            title: "Action",
                            width: 120,
                            render: (_: any, r: any) =>
                              r.id ? (
                                <Popconfirm title="Remove this item?" onConfirm={() => deleteDraftItem(r.id)}>
                                  <Button size="small" danger>
                                    Remove
                                  </Button>
                                </Popconfirm>
                              ) : null,
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </>
          )}
        </Drawer>

        {/* Create/Edit Claim Modal */}
        <Modal
          open={open}
          title={modalMode === "create" ? "Create Expense Claim" : "Edit Expense Claim"}
          onCancel={() => setOpen(false)}
          onOk={onModalOk}
          okText={modalMode === "create" ? "Create" : "Update"}
          width={modalWidth}
          style={{ top: screens.xs ? 0 : 16 }}
          centered={!screens.xs}
          destroyOnClose={false}
          styles={{
            body: { maxHeight: modalBodyMaxH, overflowY: "auto" },
          }}
        >
          <Form form={form} layout="vertical">
            <Row gutter={[12, 12]}>
              {/* Left column: Form + Currency */}
              <Col xs={24} lg={12}>
                <Card size="small" title="Claim" bodyStyle={{ padding: screens.xs ? 12 : 16 }}>
                  <Row gutter={[12, 12]}>
                    <Col xs={24}>
                      <Form.Item
                        name="expenseFormId"
                        label="Expense Form"
                        rules={[{ required: true, message: "Select expense form" }]}
                      >
                        <Select
                          placeholder="Select expense form"
                          disabled={modalMode === "edit"}
                          onChange={(id) => {
                            const f = expenseForms.find((x) => x.id === id);
                            const schema = safeJson(f?.schema);
                            setSelectedFormSchema(schema);

                            const defaultCurrency =
                              schema?.items?.fields?.find((x: any) => x.key === "currency")?.default || "INR";
                            form.setFieldsValue({
                              currency: form.getFieldValue("currency") || defaultCurrency,
                            });
                          }}
                        >
                          {expenseForms.map((f) => (
                            <Select.Option key={f.id} value={f.id}>
                              {f.name}
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>

                    <Col xs={24}>
                      <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
                        <Input placeholder="INR" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </Col>

              {/* Right column: Title + (optional) header fields */}
              <Col xs={24} lg={12}>
                <Card size="small" title="Details" bodyStyle={{ padding: screens.xs ? 12 : 16 }}>
                  <Row gutter={[12, 12]}>
                    <Col xs={24}>
                      <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                        <Input placeholder="Business trip Dec 2025" />
                      </Form.Item>
                    </Col>

                    {/* Dynamic header fields (2-column on desktop for faster entry) */}
                    {headerFields.length ? (
                      headerFields.map((f: any) => (
                        <Col key={f.key} xs={24} md={12}>
                          {renderHeaderField(f)}
                        </Col>
                      ))
                    ) : (
                      <Col xs={24}>
                        <Text type="secondary">No additional header fields for this form.</Text>
                      </Col>
                    )}
                  </Row>
                </Card>
              </Col>
            </Row>
          </Form>

          <Card title="Add Items" style={{ marginTop: 12 }} bodyStyle={{ padding: screens.xs ? 12 : 16 }}>
            <Form form={itemForm} layout="vertical">
              <Row gutter={[12, 12]}>
                {itemFields.map((f: any) => {
                  const rules = f.required
                    ? [{ required: true, message: `${f.label || f.key} is required` }]
                    : [];
                  const key = f.key;

                  if (f.type === "date") {
                    return (
                      <Col key={key} {...itemColProps}>
                        <Form.Item name={key} label={f.label || key} rules={rules}>
                          <DatePicker style={{ width: "100%" }} />
                        </Form.Item>
                      </Col>
                    );
                  }

                  if (f.type === "select") {
                    const options = (f.options || []).map((v: string) => ({ label: v, value: v }));
                    return (
                      <Col key={key} {...itemColProps}>
                        <Form.Item name={key} label={f.label || key} rules={rules}>
                          <Select options={options} placeholder={`Select ${f.label || key}`} />
                        </Form.Item>
                      </Col>
                    );
                  }

                  if (f.type === "textarea") {
                    return (
                      <Col key={key} xs={24}>
                        <Form.Item name={key} label={f.label || key} rules={rules}>
                          <Input.TextArea maxLength={f.maxLength || 500} showCount rows={screens.xs ? 3 : 4} />
                        </Form.Item>
                      </Col>
                    );
                  }

                  if (f.type === "number") {
                    return (
                      <Col key={key} {...itemColProps}>
                        <Form.Item name={key} label={f.label || key} rules={rules}>
                          <InputNumber style={{ width: "100%" }} min={f.min ?? 0} />
                        </Form.Item>
                      </Col>
                    );
                  }

                  if (f.type === "currency") {
                    return (
                      <Col key={key} {...itemColProps}>
                        <Form.Item name={key} label={f.label || key} rules={rules}>
                          <Input placeholder={f.default || "INR"} />
                        </Form.Item>
                      </Col>
                    );
                  }

                  if (f.type === "file") {
                    return (
                      <Col key={key} {...itemColProps}>
                        <Form.Item name={key} label={f.label || key}>
                          <Upload>
                            <Button icon={<UploadOutlined />}>Upload File</Button>
                          </Upload>
                        </Form.Item>
                      </Col>
                    );
                  }

                  return (
                    <Col key={key} {...itemColProps}>
                      <Form.Item name={key} label={f.label || key} rules={rules}>
                        <Input />
                      </Form.Item>
                    </Col>
                  );
                })}

                {/* Upload field positioned after amount/currency fields */}
                <Col {...itemColProps}>
                  <Form.Item name="receipt" label="Upload Receipt">
                    <Upload>
                      <Button icon={<UploadOutlined />}>Upload Receipt</Button>
                    </Upload>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Space wrap>
                    <Button type="primary" onClick={addItem}>
                      Add Item
                    </Button>
                    <Text type="secondary">Items: {items.length}</Text>
                  </Space>
                </Col>
              </Row>
            </Form>

            <Table
              style={{ marginTop: 12 }}
              rowKey={(r: any, i) => (r.id ? String(r.id) : `new-${i}`)}
              dataSource={items}
              pagination={false}
              size={screens.xs ? "small" : "middle"}
              scroll={{ x: "max-content" }}
              columns={[
                { title: "Date", dataIndex: "expenseDate", width: 120 },
                { title: "Category", dataIndex: "category", width: 200, ellipsis: true },
                { title: "Desc", dataIndex: "description", ellipsis: true },
                { title: "Amount", dataIndex: "amount", width: 120 },
                { title: "Currency", dataIndex: "currency", width: 100 },
                {
                  title: "Action",
                  width: 110,
                  render: (_: any, __: any, idx: number) => (
                    <Popconfirm title="Remove item?" onConfirm={() => removeItem(idx)}>
                      <Button size="small" danger>
                        Remove
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        </Modal>
      </div>
    </div>
  );
}
