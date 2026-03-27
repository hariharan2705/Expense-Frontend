import { useEffect, useMemo, useState, Dispatch, SetStateAction } from "react";
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import api from "../../lib/api";

const { Text } = Typography;

const DEBUG_EXPENSE_FORMS = true;
const dbg = (...args: any[]) => {
  if (DEBUG_EXPENSE_FORMS) console.log("[ExpenseFormsPage]", ...args);
};

type FieldType = "text" | "textarea" | "number" | "date" | "select" | "currency" | "file";

type OptionKV = { label?: string; value: string };

type BuilderField = {
  key: string;
  label?: string;
  type: FieldType;
  required?: boolean;

  min?: number;
  max?: number;

  maxLength?: number;

  default?: string;

  optionsKV?: OptionKV[];

  allowedTypes?: string[];
  maxSizeMB?: number;
};

type BuilderFieldUI = BuilderField & { _id: string };

type SubmissionCfg = {
  allowDraft: boolean;
  allowEditAfterReject: boolean;
};

type ExpenseFormRow = {
  id: string;
  name: string;
  status: string;
  schema: any;
};

function safeJson(v: any) {
  try {
    if (v == null) return null;
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch {
    return null;
  }
}

function normalizeKey(v: string) {
  return (v || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

function isCoreItemKey(k: string) {
  return ["expenseDate", "category", "description", "amount", "currency"].includes(k);
}

function fieldTypeOptions() {
  return [
    { label: "Text", value: "text" },
    { label: "Textarea", value: "textarea" },
    { label: "Number", value: "number" },
    { label: "Date", value: "date" },
    { label: "Select", value: "select" },
    { label: "Currency", value: "currency" },
    { label: "File", value: "file" },
  ] as const;
}

const DEFAULT_CATEGORY_OPTIONS = [
  "Meals",
  "Taxi",
  "Hotel",
  "Flight",
  "Fuel",
  "Internet",
  "Miscellaneous",
];

const CORE_ITEM_FIELDS = [
  { key: "expenseDate", type: "date", label: "Expense Date", required: true },
  {
    key: "category",
    type: "select",
    label: "Expense Category",
    required: true,
    // NOTE: options now overridden per form via categoryOptions state
    options: DEFAULT_CATEGORY_OPTIONS,
  },
  { key: "description", type: "textarea", label: "Description", required: false, maxLength: 500 },
  { key: "amount", type: "number", label: "Amount", required: true, min: 0 },
  { key: "currency", type: "currency", label: "Currency", required: true, default: "INR" },
] as const;

const FILE_TYPES = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "txt",
] as const;

function newFieldUI(partial?: Partial<BuilderField>): BuilderFieldUI {
  return {
    _id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
    key: partial?.key || "",
    label: partial?.label || "",
    type: (partial?.type as FieldType) || "text",
    required: !!partial?.required,
    min: partial?.min,
    max: partial?.max,
    maxLength: partial?.maxLength,
    default: partial?.default,
    optionsKV: partial?.optionsKV,
    allowedTypes: partial?.allowedTypes,
    maxSizeMB: partial?.maxSizeMB,
  };
}

type RowErrors = Record<
  string,
  Partial<Record<"key" | "label" | "type" | "optionsKV" | "minmax" | "maxLength" | "file", string>>
>;

function collectRowErrors(listName: "headerFields" | "extraItemFields", rows: BuilderFieldUI[]): RowErrors {
  const errs: RowErrors = {};
  const keys = new Map<string, string>(); // key -> _id

  for (const r of rows) {
    const e: any = {};
    const k = normalizeKey(r.key || "");
    if (!k) e.key = "Key required";
    if (k && keys.has(k) && keys.get(k) !== r._id) e.key = `Duplicate key "${k}"`;
    if (k) keys.set(k, r._id);

    if (isCoreItemKey(k)) e.key = `"${k}" is a core item field key`;
    if (!String(r.label || "").trim()) e.label = "Label required";
    if (!r.type) e.type = "Type required";

    if (r.type === "select") {
      const opts = (r.optionsKV || []).filter((x) => String(x.value || "").trim() !== "");
      if (!opts.length) e.optionsKV = "Add at least 1 option";
      const seen = new Set<string>();
      for (const o of opts) {
        const v = String(o.value || "").trim();
        if (seen.has(v)) {
          e.optionsKV = `Duplicate option value "${v}"`;
          break;
        }
        seen.add(v);
      }
    }

    if (r.type === "number") {
      if (typeof r.min === "number" && typeof r.max === "number" && r.min > r.max) {
        e.minmax = "Min cannot be > Max";
      }
    }

    if (r.type === "text" || r.type === "textarea") {
      if (typeof r.maxLength === "number" && r.maxLength <= 0) {
        e.maxLength = "Max length must be > 0";
      }
    }

    if (r.type === "file") {
      if (typeof r.maxSizeMB === "number" && r.maxSizeMB <= 0) e.file = "Max size must be > 0";
    }

    if (Object.keys(e).length) errs[r._id] = e;
  }

  dbg("collectRowErrors", { listName, errs });
  return errs;
}

function normalizeForSchema(f: BuilderFieldUI): any {
  const key = normalizeKey(f.key);
  const out: any = {
    key,
    type: f.type,
    label: (f.label || key).trim(),
    required: !!f.required,
  };

  if (f.type === "number") {
    if (typeof f.min === "number") out.min = f.min;
    if (typeof f.max === "number") out.max = f.max;
  }

  if (f.type === "text" || f.type === "textarea") {
    if (typeof f.maxLength === "number") out.maxLength = f.maxLength;
  }

  if (f.type === "currency") {
    out.default = (f.default || "INR").toString().trim() || "INR";
  }

  if (f.type === "file") {
    if (Array.isArray(f.allowedTypes) && f.allowedTypes.length) out.allowedTypes = f.allowedTypes;
    if (typeof f.maxSizeMB === "number") out.maxSizeMB = f.maxSizeMB;
  }

  if (f.type === "select") {
    const kv = (f.optionsKV || []).filter((x) => String(x.value || "").trim() !== "");
    const options = kv.map((x) => String(x.value || "").trim());
    const optionLabels: Record<string, string> = {};
    kv.forEach((x) => {
      const v = String(x.value || "").trim();
      const lbl = String(x.label || "").trim();
      if (v) optionLabels[v] = lbl || v;
    });
    out.options = options;
    out.optionLabels = optionLabels;
  }

  return out;
}

function extractCategoryOptionsFromSchema(schema: any): string[] {
  const s = safeJson(schema) || {};
  const itemFields = Array.isArray(s?.items?.fields) ? s.items.fields : [];
  const cat = itemFields.find((f: any) => f?.key === "category");
  const opts = Array.isArray(cat?.options) ? cat.options : [];
  const cleaned = opts.map((x: any) => String(x || "").trim()).filter(Boolean);
  return cleaned.length ? cleaned : DEFAULT_CATEGORY_OPTIONS.slice();
}

function schemaToUIFields(schema: any) {
  const s = safeJson(schema) || {};
  const headerFields = Array.isArray(s?.header?.fields) ? s.header.fields : [];
  const itemFields = Array.isArray(s?.items?.fields) ? s.items.fields : [];

  const headerUI: BuilderFieldUI[] = headerFields.map((f: any) => {
    let optionsKV: OptionKV[] | undefined;
    if (f?.type === "select") {
      const opts: string[] = Array.isArray(f.options) ? f.options : [];
      const labels: Record<string, string> = f.optionLabels || {};
      optionsKV = opts.map((v) => ({ value: v, label: labels[v] || v }));
    }
    return newFieldUI({
      key: f.key || "",
      label: f.label || "",
      type: f.type || "text",
      required: !!f.required,
      min: f.min,
      max: f.max,
      maxLength: f.maxLength,
      default: f.default,
      optionsKV,
      allowedTypes: f.allowedTypes,
      maxSizeMB: f.maxSizeMB,
    });
  });

  const extraItemUI: BuilderFieldUI[] = itemFields
    .filter((f: any) => f?.key && !isCoreItemKey(f.key))
    .map((f: any) => {
      let optionsKV: OptionKV[] | undefined;
      if (f?.type === "select") {
        const opts: string[] = Array.isArray(f.options) ? f.options : [];
        const labels: Record<string, string> = f.optionLabels || {};
        optionsKV = opts.map((v) => ({ value: v, label: labels[v] || v }));
      }
      return newFieldUI({
        key: f.key || "",
        label: f.label || "",
        type: f.type || "text",
        required: !!f.required,
        min: f.min,
        max: f.max,
        maxLength: f.maxLength,
        default: f.default,
        optionsKV,
        allowedTypes: f.allowedTypes,
        maxSizeMB: f.maxSizeMB,
      });
    });

  const submission: SubmissionCfg = {
    allowDraft: !!s?.submission?.allowDraft,
    allowEditAfterReject: !!s?.submission?.allowEditAfterReject,
  };

  const categoryOptions = extractCategoryOptionsFromSchema(s);

  return {
    headerUI,
    extraItemUI,
    submission,
    version: Number(s?.version || 1),
    description: s?.description || "",
    categoryOptions,
  };
}

function FieldRowEditor({
  title,
  rows,
  setRows,
  errors,
  setErrors,
}: {
  title: string;
  rows: BuilderFieldUI[];
  setRows: Dispatch<SetStateAction<BuilderFieldUI[]>>;
  errors: RowErrors;
  setErrors: Dispatch<SetStateAction<RowErrors>>;
}) {
  const updateRow = (id: string, patch: Partial<BuilderField>) => {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r._id !== id));
    setErrors((prev) => {
      const cp = { ...prev };
      delete cp[id];
      return cp;
    });
  };

  const addOption = (id: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const optionsKV = Array.isArray(r.optionsKV) ? r.optionsKV.slice() : [];
        optionsKV.push({ value: "", label: "" });
        return { ...r, optionsKV };
      })
    );
  };

  const updateOption = (id: string, idx: number, patch: Partial<OptionKV>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const optionsKV = Array.isArray(r.optionsKV) ? r.optionsKV.slice() : [];
        const cur = optionsKV[idx] || { value: "", label: "" };
        optionsKV[idx] = { ...cur, ...patch };
        return { ...r, optionsKV };
      })
    );
  };

  const removeOption = (id: string, idx: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const optionsKV = Array.isArray(r.optionsKV) ? r.optionsKV.slice() : [];
        optionsKV.splice(idx, 1);
        return { ...r, optionsKV };
      })
    );
  };

  return (
    <Card
      size="small"
      title={title}
      extra={
        <Button
          onClick={() => {
            dbg("Add field", title);
            setRows((p) => [...p, newFieldUI()]);
          }}
        >
          Add Field
        </Button>
      }
    >
      {rows.length === 0 ? <Text type="secondary">No custom fields.</Text> : null}

      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {rows.map((r) => {
          const e = errors[r._id] || {};
          return (
            <Card
              key={r._id}
              size="small"
              style={{
                borderColor: Object.keys(e).length ? "#ffccc7" : undefined,
              }}
              title={
                <Space>
                  <Tag color="blue">FIELD</Tag>
                  <Text type="secondary">({r._id.slice(0, 6)})</Text>
                </Space>
              }
              extra={
                <Button danger onClick={() => removeRow(r._id)}>
                  Remove Field
                </Button>
              }
            >
              <Row gutter={12}>
                <Col span={6}>
                  <div style={{ fontWeight: 600 }}>Key</div>
                  <Input
                    value={r.key}
                    status={e.key ? "error" : ""}
                    placeholder="e.g., projectCode"
                    onChange={(ev) => updateRow(r._id, { key: ev.target.value })}
                    onBlur={(ev) => {
                      const cleaned = normalizeKey(ev.target.value || "");
                      dbg("Key blur normalize", { id: r._id, from: ev.target.value, to: cleaned });
                      updateRow(r._id, { key: cleaned });
                    }}
                  />
                  {e.key ? <Text type="danger">{e.key}</Text> : null}
                </Col>

                <Col span={8}>
                  <div style={{ fontWeight: 600 }}>Label</div>
                  <Input
                    value={r.label}
                    status={e.label ? "error" : ""}
                    placeholder="Shown to user (e.g., Project Code)"
                    onChange={(ev) => updateRow(r._id, { label: ev.target.value })}
                  />
                  {e.label ? <Text type="danger">{e.label}</Text> : null}
                </Col>

                <Col span={6}>
                  <div style={{ fontWeight: 600 }}>Type</div>
                  <Select
                    style={{ width: "100%" }}
                    value={r.type}
                    status={e.type ? "error" : ""}
                    options={fieldTypeOptions() as any}
                    onChange={(val) => {
                      dbg("Type changed", { id: r._id, val });
                      const patch: Partial<BuilderField> = { type: val as FieldType };

                      if (val === "select" && (!r.optionsKV || r.optionsKV.length === 0)) {
                        patch.optionsKV = [{ value: "", label: "" }];
                      }
                      if (val === "currency" && !r.default) {
                        patch.default = "INR";
                      }

                      updateRow(r._id, patch);
                    }}
                  />
                  {e.type ? <Text type="danger">{e.type}</Text> : null}
                </Col>

                <Col span={4} style={{ display: "flex", alignItems: "end", gap: 8 }}>
                  <Checkbox
                    checked={!!r.required}
                    onChange={(ev) => {
                      dbg("Required toggled", { id: r._id, checked: ev.target.checked });
                      updateRow(r._id, { required: ev.target.checked });
                    }}
                  >
                    Required
                  </Checkbox>
                </Col>
              </Row>

              {r.type === "number" ? (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <Row gutter={12}>
                    <Col span={6}>
                      <div style={{ fontWeight: 600 }}>Min</div>
                      <InputNumber
                        style={{ width: "100%" }}
                        value={typeof r.min === "number" ? r.min : undefined}
                        onChange={(v) => updateRow(r._id, { min: typeof v === "number" ? v : undefined })}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontWeight: 600 }}>Max</div>
                      <InputNumber
                        style={{ width: "100%" }}
                        value={typeof r.max === "number" ? r.max : undefined}
                        onChange={(v) => updateRow(r._id, { max: typeof v === "number" ? v : undefined })}
                      />
                    </Col>
                    <Col span={12}>{e.minmax ? <Text type="danger">{e.minmax}</Text> : null}</Col>
                  </Row>
                </>
              ) : null}

              {r.type === "text" || r.type === "textarea" ? (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <Row gutter={12}>
                    <Col span={6}>
                      <div style={{ fontWeight: 600 }}>Max Length</div>
                      <InputNumber
                        style={{ width: "100%" }}
                        value={typeof r.maxLength === "number" ? r.maxLength : undefined}
                        onChange={(v) => updateRow(r._id, { maxLength: typeof v === "number" ? v : undefined })}
                        placeholder="e.g., 200"
                      />
                      {e.maxLength ? <Text type="danger">{e.maxLength}</Text> : null}
                    </Col>
                  </Row>
                </>
              ) : null}

              {r.type === "currency" ? (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <Row gutter={12}>
                    <Col span={6}>
                      <div style={{ fontWeight: 600 }}>Default Currency</div>
                      <Input
                        value={r.default || ""}
                        onChange={(ev) => updateRow(r._id, { default: ev.target.value })}
                        placeholder="INR"
                      />
                    </Col>
                  </Row>
                </>
              ) : null}

              {r.type === "file" ? (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <Row gutter={12}>
                    <Col span={10}>
                      <div style={{ fontWeight: 600 }}>Allowed Types</div>
                      <Select
                        mode="multiple"
                        style={{ width: "100%" }}
                        value={r.allowedTypes || []}
                        options={FILE_TYPES.map((t) => ({ label: t, value: t }))}
                        placeholder="Select allowed file types"
                        onChange={(vals) => updateRow(r._id, { allowedTypes: vals })}
                      />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontWeight: 600 }}>Max Size (MB)</div>
                      <InputNumber
                        style={{ width: "100%" }}
                        value={typeof r.maxSizeMB === "number" ? r.maxSizeMB : undefined}
                        onChange={(v) => updateRow(r._id, { maxSizeMB: typeof v === "number" ? v : undefined })}
                        placeholder="e.g., 5"
                      />
                      {e.file ? <Text type="danger">{e.file}</Text> : null}
                    </Col>
                  </Row>
                </>
              ) : null}

              {r.type === "select" ? (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <Row gutter={12} style={{ marginBottom: 8 }}>
                    <Col
                      span={24}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <Text strong>Options</Text>
                      <Button onClick={() => addOption(r._id)}>Add Option</Button>
                    </Col>
                  </Row>

                  {(r.optionsKV || []).length ? (
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {(r.optionsKV || []).map((opt, idx) => (
                        <Row key={`${r._id}-opt-${idx}`} gutter={12}>
                          <Col span={10}>
                            <div style={{ fontWeight: 600 }}>Label</div>
                            <Input
                              value={opt.label || ""}
                              placeholder="Shown to user (e.g., Flight)"
                              onChange={(ev) => updateOption(r._id, idx, { label: ev.target.value })}
                            />
                          </Col>
                          <Col span={10}>
                            <div style={{ fontWeight: 600 }}>Value</div>
                            <Input
                              value={opt.value || ""}
                              placeholder="Stored value (e.g., FLIGHT)"
                              onChange={(ev) => updateOption(r._id, idx, { value: ev.target.value })}
                              onBlur={(ev) => {
                                updateOption(r._id, idx, { value: (ev.target.value || "").trim() });
                              }}
                            />
                          </Col>
                          <Col span={4} style={{ display: "flex", alignItems: "end" }}>
                            <Button danger onClick={() => removeOption(r._id, idx)}>
                              Remove
                            </Button>
                          </Col>
                        </Row>
                      ))}
                    </Space>
                  ) : null}

                  {e.optionsKV ? <Text type="danger">{e.optionsKV}</Text> : null}
                </>
              ) : null}
            </Card>
          );
        })}
      </Space>
    </Card>
  );
}

export default function ExpenseFormsPage() {
  const [rows, setRows] = useState<ExpenseFormRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseFormRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Static form fields (name/status/version/description/submission)
  const [form] = Form.useForm();

  // State-driven editors (no Form.List)
  const [headerFields, setHeaderFields] = useState<BuilderFieldUI[]>([]);
  const [extraItemFields, setExtraItemFields] = useState<BuilderFieldUI[]>([]);
  const [headerErrors, setHeaderErrors] = useState<RowErrors>({});
  const [itemErrors, setItemErrors] = useState<RowErrors>({});

  // ✅ per-form category options
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS.slice());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/expense-forms");
      dbg("GET /api/expense-forms response", res?.data);
      const items = res.data?.items || res.data || [];
      setRows(items);
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load expense forms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showCreate = () => {
    setEditing(null);
    setOpen(true);
    setHeaderFields([]);
    setExtraItemFields([]);
    setHeaderErrors({});
    setItemErrors({});
    setCategoryOptions(DEFAULT_CATEGORY_OPTIONS.slice());

    form.resetFields();
    form.setFieldsValue({
      name: "",
      status: "ACTIVE",
      version: 1,
      description: "Employee expense claim form",
      submission: { allowDraft: true, allowEditAfterReject: true },
    });
  };

  const showEdit = (r: ExpenseFormRow) => {
    setEditing(r);
    setOpen(true);

    const s = schemaToUIFields(r.schema);
    setHeaderFields(s.headerUI);
    setExtraItemFields(s.extraItemUI);
    setHeaderErrors({});
    setItemErrors({});
    setCategoryOptions((s.categoryOptions && s.categoryOptions.length ? s.categoryOptions : DEFAULT_CATEGORY_OPTIONS).slice());

    form.resetFields();
    form.setFieldsValue({
      name: r.name,
      status: r.status || "ACTIVE",
      version: s.version || 1,
      description: s.description || "Employee expense claim form",
      submission: s.submission || { allowDraft: true, allowEditAfterReject: true },
    });
  };

  const onDelete = async (id: string) => {
    try {
      await api.delete(`/api/expense-forms/${id}`);
      message.success("Deleted");
      await load();
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Delete failed");
    }
  };

  const buildSchema = (v: any) => {
    const submission: SubmissionCfg =
      v.submission || ({ allowDraft: true, allowEditAfterReject: true } as SubmissionCfg);

    // Unique key across BOTH lists
    const allKeys = new Set<string>();
    for (const r of [...headerFields, ...extraItemFields]) {
      const k = normalizeKey(r.key);
      if (allKeys.has(k)) throw new Error(`Duplicate key "${k}" across header/items. Keys must be unique.`);
      allKeys.add(k);
    }

    const cleanedCategoryOptions = (categoryOptions || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean);

    if (!cleanedCategoryOptions.length) {
      throw new Error("At least 1 Expense Category must be configured.");
    }

    const coreFieldsWithCategoryOverride = CORE_ITEM_FIELDS.map((f: any) => {
      if (f.key !== "category") return { ...f };
      return {
        ...f,
        options: cleanedCategoryOptions,
        optionLabels: cleanedCategoryOptions.reduce((acc: any, k: string) => {
          acc[k] = k;
          return acc;
        }, {}),
      };
    });

    return {
      type: "EXPENSE_CLAIM",
      version: Number(v.version || 1),
      submission,
      description: v.description || "Employee expense claim form",
      header: { fields: headerFields.map(normalizeForSchema) },
      items: {
        repeatable: true,
        fields: [...coreFieldsWithCategoryOverride, ...extraItemFields.map(normalizeForSchema)],
      },
    };
  };

  const validateRowsAndSetErrors = () => {
    const he = collectRowErrors("headerFields", headerFields);
    const ie = collectRowErrors("extraItemFields", extraItemFields);
    setHeaderErrors(he);
    setItemErrors(ie);
    const hasErrors = Object.keys(he || {}).length > 0 || Object.keys(ie || {}).length > 0;
    return { he, ie, hasErrors };
  };

  const onSave = async () => {
    const v = await form.validateFields();

    // quick category validation (better UX than throwing)
    const cleanedCategoryOptions = (categoryOptions || [])
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (!cleanedCategoryOptions.length) {
      message.error("Please add at least 1 Expense Category for this form.");
      return;
    }

    const { hasErrors } = validateRowsAndSetErrors();
    if (hasErrors) {
      message.error("Fix field definition errors before saving");
      return;
    }

    setSaving(true);
    try {
      const schema = buildSchema(v);
      const payload: any = { name: v.name, status: v.status || "ACTIVE", schema };

      if (!editing) {
        await api.post("/api/expense-forms", payload);
        message.success("Expense form created");
      } else {
        await api.patch(`/api/expense-forms/${editing.id}`, payload);
        message.success("Expense form updated");
      }

      setOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      message.error(e?.message || e?.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const cols = useMemo(
    () => [
      { title: "Name", dataIndex: "name" },
      {
        title: "Status",
        dataIndex: "status",
        width: 120,
        render: (v: string) => <Tag color={v === "ACTIVE" ? "green" : "default"}>{v}</Tag>,
      },
      {
        title: "Actions",
        width: 220,
        render: (_: any, r: ExpenseFormRow) => (
          <Space>
            <Button onClick={() => showEdit(r)}>Edit</Button>
            <Popconfirm title="Delete this form?" onConfirm={() => onDelete(r.id)}>
              <Button danger>Delete</Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [rows]
  );

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Expense Forms"
        extra={
          <Button type="primary" onClick={showCreate}>
            Create Expense Form
          </Button>
        }
      >
        <Table rowKey="id" loading={loading} dataSource={rows} columns={cols as any} />
      </Card>

      <Modal
        open={open}
        title={editing ? "Edit Expense Form" : "Create Expense Form"}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
        }}
        onOk={onSave}
        confirmLoading={saving}
        width={1040}
        okText={editing ? "Update" : "Create"}
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item name="name" label="Form Name" rules={[{ required: true, message: "Name required" }]}>
                <Input placeholder="Standard form" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "ACTIVE", value: "ACTIVE" },
                    { label: "INACTIVE", value: "INACTIVE" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="version" label="Version" rules={[{ required: true }]}>
                <InputNumber style={{ width: "100%" }} min={1} />
              </Form.Item>
            </Col>
            <Col span={4} style={{ display: "flex", alignItems: "end" }}>
              <Tag color="purple">EXPENSE_CLAIM</Tag>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input placeholder="Employee expense claim form" />
          </Form.Item>

          <Card size="small" title="Submission Settings">
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name={["submission", "allowDraft"]} valuePropName="checked" initialValue={true}>
                  <Checkbox>Allow Draft</Checkbox>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name={["submission", "allowEditAfterReject"]} valuePropName="checked" initialValue={true}>
                  <Checkbox>Allow Edit After Reject</Checkbox>
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Form>

        <Divider />

        <Card size="small" title="Core Item Fields (Fixed)">
          <Text type="secondary">
            These are always present for employees and cannot be removed: expenseDate, category, description, amount,
            currency.
          </Text>

          <Divider style={{ margin: "12px 0" }} />

          {/* ✅ NEW: Configure allowed category values per form */}
          <Card size="small" title="Expense Category Options (per form)">
            <Text type="secondary">
              Only these category values will be shown to employees when adding claim items for this form.
            </Text>
            <div style={{ marginTop: 10 }}>
              <Select
                mode="tags"
                style={{ width: "100%" }}
                placeholder="Add categories (press Enter)"
                value={categoryOptions}
                onChange={(vals) => {
                  const cleaned = (vals || []).map((x) => String(x || "").trim()).filter(Boolean);
                  setCategoryOptions(cleaned);
                }}
                options={DEFAULT_CATEGORY_OPTIONS.map((x) => ({ label: x, value: x }))}
              />
              <div style={{ marginTop: 8 }}>
                <Button
                  size="small"
                  onClick={() => setCategoryOptions(DEFAULT_CATEGORY_OPTIONS.slice())}
                >
                  Reset to Default Categories
                </Button>
              </div>
            </div>
          </Card>

          <Divider style={{ margin: "12px 0" }} />

          <Table
            style={{ marginTop: 8 }}
            rowKey="key"
            pagination={false}
            dataSource={CORE_ITEM_FIELDS as any}
            columns={[
              { title: "Key", dataIndex: "key", width: 160 },
              { title: "Label", dataIndex: "label" },
              { title: "Type", dataIndex: "type", width: 120 },
              { title: "Required", dataIndex: "required", width: 100, render: (v: boolean) => (v ? "Yes" : "No") },
            ]}
          />
        </Card>

        <Divider />

        <FieldRowEditor
          title="Header Custom Fields (saved in expense_claims.meta)"
          rows={headerFields}
          setRows={setHeaderFields}
          errors={headerErrors}
          setErrors={setHeaderErrors}
        />

        <Divider />

        <FieldRowEditor
          title="Item Custom Fields (saved in expense_claim_items.meta)"
          rows={extraItemFields}
          setRows={setExtraItemFields}
          errors={itemErrors}
          setErrors={setItemErrors}
        />

        <Divider />

        {/* <Card size="small" title="Schema Preview (JSON)">
          <pre style={{ maxHeight: 260, overflow: "auto", background: "#fafafa", padding: 12, borderRadius: 8 }}>
            {(() => {
              try {
                const v = form.getFieldsValue(true);
                const schema = buildSchema(v);
                return JSON.stringify(schema, null, 2);
              } catch (e: any) {
                return `Schema preview pending: ${e?.message || "fix validation errors"}`;
              }
            })()}
          </pre>
        </Card> */}
      </Modal>
    </div>
  );
}
