import { useEffect, useMemo, useState, useRef } from "react";
import {
  Button, Col, Row, Space, Spin, Typography, message, Table, Avatar, Badge, Tooltip, Progress, Dropdown,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, DollarOutlined, TeamOutlined, UserOutlined, PlusOutlined, ReloadOutlined,
  ArrowRightOutlined, RiseOutlined, FallOutlined, ExclamationCircleOutlined,
  ThunderboltOutlined, CalendarOutlined, TrophyOutlined, WarningOutlined,
  BankOutlined, FireOutlined, EllipsisOutlined, SendOutlined,
} from "@ant-design/icons";
import api from "../../lib/api";

const { Title, Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────

type MeResponse = {
  tenantId: string;
  user: { id: string; email: string; role: string; status: string };
  employee?: {
    id: string; email: string; name: string;
    department?: string; grade?: string; mobile?: string;
    status?: string; customFields?: any;
  } | null;
};

type ClaimRow = {
  id: string; status: string; title?: string;
  totalAmount: number; currency: string;
  createdAt?: string; category?: string;
  submittedAt?: string; approvedAt?: string;
  paymentStatus?: string;
};

// ─── Design System ────────────────────────────────────────────────────────────

const ds = {
  // Core palette
  ink: "#0D0D0D",
  inkMid: "#2D2D2D",
  inkLight: "#6B7280",
  inkFaint: "#9CA3AF",
  inkGhost: "#E5E7EB",
  paper: "#FFFFFF",
  paperTint: "#F9FAFB",
  paperSoft: "#F3F4F6",

  // Semantic
  emerald: "#059669",
  emeraldBg: "#ECFDF5",
  emeraldMid: "#34D399",
  amber: "#D97706",
  amberBg: "#FFFBEB",
  amberMid: "#FCD34D",
  ruby: "#DC2626",
  rubyBg: "#FEF2F2",
  rubyMid: "#F87171",
  sapphire: "#2563EB",
  sapphireBg: "#EFF6FF",
  sapphireMid: "#93C5FD",
  violet: "#7C3AED",
  violetBg: "#F5F3FF",
  violetMid: "#A78BFA",
  slate: "#475569",
  slateBg: "#F8FAFC",
  slateMid: "#94A3B8",

  // Accent
  accent: "#111827",
  accentHover: "#1F2937",

  // Radii
  rXs: "6px", rSm: "10px", rMd: "14px", rLg: "18px", rXl: "24px",

  // Shadows
  shadowXs: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowSm: "0 4px 12px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04)",
  shadowMd: "0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)",
  shadowLg: "0 20px 40px rgba(0,0,0,0.10), 0 8px 16px rgba(0,0,0,0.06)",

  // Fonts
  fontDisplay: "'Instrument Serif', 'Georgia', serif",
  fontMono: "'JetBrains Mono', 'Fira Code', monospace",
};

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; dot: string }> = {
  DRAFT: { label: "Draft", color: ds.inkLight, bg: ds.paperSoft, border: ds.inkGhost, icon: <EditOutlined />, dot: "#9CA3AF" },
  PENDING_APPROVAL: { label: "Pending", color: ds.amber, bg: ds.amberBg, border: "#FDE68A", icon: <ClockCircleOutlined />, dot: ds.amber },
  SUBMITTED: { label: "Submitted", color: ds.sapphire, bg: ds.sapphireBg, border: ds.sapphireMid, icon: <SendOutlined />, dot: ds.sapphire },
  APPROVED: { label: "Approved", color: ds.emerald, bg: ds.emeraldBg, border: "#6EE7B7", icon: <CheckCircleOutlined />, dot: ds.emerald },
  REJECTED: { label: "Rejected", color: ds.ruby, bg: ds.rubyBg, border: "#FCA5A5", icon: <CloseCircleOutlined />, dot: ds.ruby },
  PAID: { label: "Paid", color: ds.violet, bg: ds.violetBg, border: ds.violetMid, icon: <BankOutlined />, dot: ds.violet },
};

function upper(v?: string) { return (v || "").toString().trim().toUpperCase(); }

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS[upper(status)] ?? STATUS.DRAFT;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: ds.rXl,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function fmtCompact(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtRelative(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return fmtDate(iso);
}
function daysSince(iso?: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accentColor: string; accentBg: string;
  trend?: { value: number; label: string };
  urgent?: boolean;
  onClick?: () => void;
}
function KpiCard({ label, value, sub, icon, accentColor, accentBg, trend, urgent, onClick }: KpiCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: ds.paper,
        border: urgent ? `1.5px solid ${ds.amber}` : `1px solid ${ds.inkGhost}`,
        borderRadius: ds.rLg,
        padding: "20px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? ds.shadowMd : ds.shadowXs,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {urgent && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "3px",
          background: `linear-gradient(90deg, ${ds.amber}, ${ds.amberMid})`,
        }} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: ds.inkFaint, textTransform: "uppercase", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: ds.ink, lineHeight: 1, marginBottom: 6, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </div>
          {sub && <div style={{ fontSize: 12, color: ds.inkLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: ds.rMd, background: accentBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: accentColor, flexShrink: 0, marginLeft: 12,
        }}>
          {icon}
        </div>
      </div>
      {trend && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${ds.inkGhost}` }}>
          {trend.value >= 0
            ? <RiseOutlined style={{ fontSize: 11, color: ds.emerald }} />
            : <FallOutlined style={{ fontSize: 11, color: ds.ruby }} />
          }
          <span style={{ fontSize: 11, color: trend.value >= 0 ? ds.emerald : ds.ruby, fontWeight: 600 }}>
            {trend.value >= 0 ? "+" : ""}{trend.value}%
          </span>
          <span style={{ fontSize: 11, color: ds.inkFaint }}>{trend.label}</span>
        </div>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHead({ title, sub, action, onAction }: { title: string; sub?: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: ds.ink, letterSpacing: "-0.01em" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: ds.inkFaint, marginTop: 2 }}>{sub}</div>}
      </div>
      {action && (
        <button onClick={onAction} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: ds.sapphire, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
          borderRadius: ds.rSm, transition: "background 0.15s",
        }}>
          {action} <ArrowRightOutlined style={{ fontSize: 10 }} />
        </button>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: ds.paper, border: `1px solid ${ds.inkGhost}`,
      borderRadius: ds.rLg, boxShadow: ds.shadowXs,
      padding: "20px 22px", ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Timeline Item ────────────────────────────────────────────────────────────

function TimelineItem({ claim, isLast, onNav }: { claim: ClaimRow; isLast: boolean; onNav: (id: string) => void }) {
  const cfg = STATUS[upper(claim.status)] ?? STATUS.DRAFT;
  const isOld = upper(claim.status) === "PENDING_APPROVAL" && daysSince(claim.createdAt) > 5;
  return (
    <div style={{ display: "flex", gap: 12, position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: cfg.bg, border: `1.5px solid ${cfg.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: cfg.color, flexShrink: 0,
        }}>
          {cfg.icon}
        </div>
        {!isLast && <div style={{ width: 1, flex: 1, background: ds.inkGhost, marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: ds.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                {claim.title || `Claim ${claim.id.slice(0, 8)}`}
              </Text>
              {isOld && (
                <Tooltip title="Awaiting approval for 5+ days">
                  <WarningOutlined style={{ fontSize: 11, color: ds.amber }} />
                </Tooltip>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
              <StatusChip status={claim.status} />
              <span style={{ fontSize: 11, color: ds.inkFaint }}>{fmtRelative(claim.createdAt)}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Text style={{ fontSize: 13, fontWeight: 700, color: ds.ink, fontVariantNumeric: "tabular-nums" }}>
              {fmt(claim.totalAmount, claim.currency)}
            </Text>
            <button onClick={() => onNav(claim.id)} style={{
              background: ds.paperSoft, border: `1px solid ${ds.inkGhost}`,
              borderRadius: ds.rSm, padding: "4px 8px", cursor: "pointer",
              fontSize: 11, color: ds.inkLight, display: "flex", alignItems: "center", gap: 3,
              transition: "all 0.15s",
            }}>
              View <ArrowRightOutlined style={{ fontSize: 9 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Donut mini ───────────────────────────────────────────────────────────────

function DonutBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return null;
  return (
    <div style={{ display: "flex", gap: 3, borderRadius: 99, overflow: "hidden", height: 8 }}>
      {segments.filter(s => s.value > 0).map((s, i) => (
        <Tooltip key={i} title={`${s.label}: ${s.value} (${Math.round(s.value / total * 100)}%)`}>
          <div style={{ flex: s.value, background: s.color, minWidth: 4, transition: "flex 0.6s ease", cursor: "default" }} />
        </Tooltip>
      ))}
    </div>
  );
}

// ─── Insights panel ───────────────────────────────────────────────────────────

function InsightBadge({ icon, text, color, bg }: { icon: React.ReactNode; text: string; color: string; bg: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "12px 14px", borderRadius: ds.rMd,
      background: bg, border: `1px solid ${color}22`,
    }}>
      <span style={{ fontSize: 14, color, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, color: ds.inkMid, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ─── Aging Table ─────────────────────────────────────────────────────────────

function AgingRow({ label, count, amount, days, color }: { label: string; count: number; amount: number; days: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${ds.inkGhost}` }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: ds.ink }}>{label}</div>
        <div style={{ fontSize: 11, color: ds.inkFaint }}>{days}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: ds.ink, fontVariantNumeric: "tabular-nums" }}>{fmtCompact(amount)}</div>
        <div style={{ fontSize: 11, color: ds.inkFaint }}>{count} claim{count !== 1 ? "s" : ""}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserHome() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [myClaims, setMyClaims] = useState<ClaimRow[]>([]);
  const [teamClaims, setTeamClaims] = useState<ClaimRow[]>([]);

  const roleUpper = useMemo(() => upper(me?.user?.role), [me]);
  const canApproveLike = ["APPROVER", "FINANCE", "TENANT_ADMIN", "MANAGER"].includes(roleUpper);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/me");
      const meData: MeResponse = res.data;
      setMe(meData);

      const isApprover = ["APPROVER", "FINANCE", "TENANT_ADMIN", "MANAGER"].includes(upper(meData.user.role));
      const myReq = isApprover
        ? api.get("/api/claims", { params: { scope: "my" } })
        : api.get("/api/claims");
      const teamReq = isApprover
        ? api.get("/api/claims", { params: { scope: "team" } })
        : Promise.resolve({ data: { items: [] } });

      const [myRes, teamRes] = await Promise.all([myReq, teamReq]);
      const transform = (items: any[]) => items.map((c) => ({ ...c, totalAmount: parseFloat(c.totalAmount ?? "0") }));
      setMyClaims(transform(myRes.data?.items || []));
      setTeamClaims(transform(teamRes.data?.items || []));
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── Computed stats ────────────────────────────────────────────────────────

  const my = useMemo(() => {
    const by = (st: string) => myClaims.filter((c) => upper(c.status) === st);
    const sum = (st: string) => by(st).reduce((s, c) => s + c.totalAmount, 0);
    const sumArr = (arr: ClaimRow[]) => arr.reduce((s, c) => s + c.totalAmount, 0);

    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const me2 = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const prevMs = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

    const thisMonth = myClaims.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= ms && new Date(c.createdAt).getTime() < me2);
    const lastMonth = myClaims.filter(c => c.createdAt && new Date(c.createdAt).getTime() >= prevMs && new Date(c.createdAt).getTime() < ms);

    const thisMonthAmt = sumArr(thisMonth);
    const lastMonthAmt = sumArr(lastMonth);
    const monthTrend = lastMonthAmt > 0 ? Math.round(((thisMonthAmt - lastMonthAmt) / lastMonthAmt) * 100) : 0;

    const approved = by("APPROVED");
    const pending = by("PENDING_APPROVAL");
    const draft = by("DRAFT");
    const rejected = by("REJECTED");
    const paid = by("PAID");
    const submitted = by("SUBMITTED");

    // Aging buckets for pending
    const aging0_2 = pending.filter(c => daysSince(c.createdAt) <= 2);
    const aging3_5 = pending.filter(c => daysSince(c.createdAt) > 2 && daysSince(c.createdAt) <= 5);
    const aging6Plus = pending.filter(c => daysSince(c.createdAt) > 5);

    const approvedAmt = sum("APPROVED");
    const currency = myClaims[0]?.currency || "INR";

    // Submitted claims awaiting payment
    const awaitingPayment = [...approved, ...paid].filter(c => c.paymentStatus === "PENDING");

    return {
      total: myClaims.length,
      draft: draft.length, draftAmt: sum("DRAFT"),
      pending: pending.length, pendingAmt: sum("PENDING_APPROVAL"),
      approved: approved.length, approvedAmt,
      rejected: rejected.length, rejectedAmt: sum("REJECTED"),
      paid: paid.length, paidAmt: sum("PAID"),
      submitted: submitted.length,
      thisMonthAmt, lastMonthAmt, monthTrend, thisMonthCount: thisMonth.length,
      avg: myClaims.length > 0 ? approvedAmt / Math.max(approved.length, 1) : 0,
      approvalRate: myClaims.length > 0 ? Math.round((approved.length / myClaims.length) * 100) : 0,
      aging0_2, aging3_5, aging6Plus,
      awaitingPayment, awaitingPaymentAmt: sumArr(awaitingPayment),
      currency,
    };
  }, [myClaims]);

  const team = useMemo(() => {
    const by = (st: string) => teamClaims.filter((c) => upper(c.status) === st).length;
    const pendingTeam = teamClaims.filter(c => ["PENDING_APPROVAL", "SUBMITTED"].includes(upper(c.status)));
    const overdue = pendingTeam.filter(c => daysSince(c.createdAt) > 5);
    return {
      total: teamClaims.length,
      pending: pendingTeam.length,
      pendingAmt: pendingTeam.reduce((s, c) => s + c.totalAmount, 0),
      approved: by("APPROVED"),
      rejected: by("REJECTED"),
      overdue: overdue.length,
      overdueAmt: overdue.reduce((s, c) => s + c.totalAmount, 0),
      currency: teamClaims[0]?.currency || "INR",
    };
  }, [teamClaims]);

  // Smart insights
  const insights = useMemo(() => {
    const list: { icon: React.ReactNode; text: string; color: string; bg: string }[] = [];

    if (my.aging6Plus.length > 0) {
      list.push({ icon: <FireOutlined />, text: `${my.aging6Plus.length} claim${my.aging6Plus.length > 1 ? "s" : ""} pending for 6+ days — consider following up with your approver.`, color: ds.ruby, bg: ds.rubyBg });
    }
    if (my.awaitingPayment.length > 0) {
      list.push({ icon: <BankOutlined />, text: `${my.awaitingPayment.length} approved claim${my.awaitingPayment.length > 1 ? "s" : ""} (${fmt(my.awaitingPaymentAmt, my.currency)}) awaiting payment disbursement.`, color: ds.violet, bg: ds.violetBg });
    }
    if (my.draft > 3) {
      list.push({ icon: <ExclamationCircleOutlined />, text: `You have ${my.draft} draft claims. Submit them to begin the approval process.`, color: ds.amber, bg: ds.amberBg });
    }
    if (my.approvalRate >= 80 && my.approved >= 3) {
      list.push({ icon: <TrophyOutlined />, text: `Great track record! ${my.approvalRate}% of your submitted claims have been approved.`, color: ds.emerald, bg: ds.emeraldBg });
    }
    if (my.monthTrend > 20) {
      list.push({ icon: <ThunderboltOutlined />, text: `Your expense claims this month are ${my.monthTrend}% higher than last month.`, color: ds.sapphire, bg: ds.sapphireBg });
    }
    return list.slice(0, 3);
  }, [my]);

  const recentClaims = useMemo(() =>
    [...myClaims].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8),
    [myClaims]
  );

  // ─── Table Columns ─────────────────────────────────────────────────────────

  const cols = [
    {
      title: "Title / ID", key: "title", width: 220,
      render: (_: any, row: ClaimRow) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: ds.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {row.title || "Untitled"}
          </div>
          <Text copyable={{ text: row.id }} style={{ fontSize: 11, color: ds.inkFaint, fontFamily: ds.fontMono }}>
            {row.id.slice(0, 8)}
          </Text>
        </div>
      ),
    },
    {
      title: "Status", dataIndex: "status", key: "status", width: 120,
      render: (v: string) => <StatusChip status={v} />,
    },
    {
      title: "Amount", dataIndex: "totalAmount", key: "amount", align: "right" as const, width: 120,
      render: (v: number, row: ClaimRow) => (
        <Text style={{ fontSize: 13, fontWeight: 700, color: ds.ink, fontVariantNumeric: "tabular-nums" }}>{fmt(v, row.currency)}</Text>
      ),
    },
    {
      title: "Created", dataIndex: "createdAt", key: "date", width: 110,
      render: (v: string) => (
        <Tooltip title={fmtDate(v)}>
          <Text style={{ fontSize: 12, color: ds.inkLight }}>{fmtRelative(v)}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Payment", dataIndex: "paymentStatus", key: "payment", width: 100,
      render: (v: string, row: ClaimRow) => {
        if (upper(row.status) === "PAID") return <span style={{ fontSize: 11, color: ds.violet, fontWeight: 600 }}>✓ Paid</span>;
        if (upper(row.status) === "APPROVED" && v === "PENDING") return <span style={{ fontSize: 11, color: ds.amber, fontWeight: 600 }}>Awaiting</span>;
        return <span style={{ fontSize: 11, color: ds.inkFaint }}>—</span>;
      },
    },
    {
      title: "", key: "go", width: 48, align: "right" as const,
      render: (_: any, row: ClaimRow) => (
        <button onClick={() => nav(`/app/claims/${row.id}`)} style={{
          background: ds.paperSoft, border: `1px solid ${ds.inkGhost}`,
          borderRadius: ds.rSm, padding: "5px 10px", cursor: "pointer",
          fontSize: 11, color: ds.inkLight, display: "flex", alignItems: "center", gap: 4,
        }}>
          View <ArrowRightOutlined style={{ fontSize: 9 }} />
        </button>
      ),
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return <Spin fullscreen tip="Loading dashboard…" />;
  if (!me) return <Text type="danger">Failed to load user profile.</Text>;

  const { user, employee } = me;
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";
  const firstName = employee?.name?.split(" ")[0] || "there";

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100vh", padding: "28px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        .claim-table .ant-table { background: transparent !important; }
        .claim-table .ant-table-thead > tr > th { background: #F9FAFB !important; border-bottom: 1px solid #E5E7EB !important; font-size: 11px !important; font-weight: 700 !important; color: #9CA3AF !important; letter-spacing: 0.06em !important; text-transform: uppercase !important; padding: 10px 12px !important; }
        .claim-table .ant-table-tbody > tr > td { padding: 12px 12px !important; border-bottom: 1px solid #F3F4F6 !important; }
        .claim-table .ant-table-tbody > tr:hover > td { background: #F9FAFB !important; }
        .claim-table .ant-table-tbody > tr:last-child > td { border-bottom: none !important; }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 14, marginBottom: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: ds.rMd,
              background: `linear-gradient(135deg, ${ds.ink}, #374151)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: 20, flexShrink: 0,
            }}>
              <UserOutlined />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: ds.ink, letterSpacing: "-0.03em", lineHeight: 1.1, fontFamily: ds.fontDisplay }}>
                {greeting}, <span style={{ fontStyle: "italic" }}>{firstName}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                <Badge status={user.status === "ACTIVE" ? "success" : "error"} />
                <Text style={{ fontSize: 12, color: ds.inkLight }}>{user.role}</Text>
                <span style={{ color: ds.inkGhost }}>·</span>
                <Text style={{ fontSize: 12, color: ds.inkFaint }}>{user.email}</Text>
                {employee?.department && <>
                  <span style={{ color: ds.inkGhost }}>·</span>
                  <Text style={{ fontSize: 12, color: ds.inkFaint }}>{employee.department}</Text>
                </>}
              </div>
            </div>
          </div>

          <Space size={8} wrap>
            <Button icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: ds.rSm, height: 36, borderColor: ds.inkGhost, color: ds.inkLight }} />
            <Button icon={<FileTextOutlined />} onClick={() => nav("/app/claims")} style={{ borderRadius: ds.rSm, height: 36 }}>
              All Claims
            </Button>
            <Button type="primary" icon={<PlusOutlined />}
              onClick={() => nav("/app/claims?create=1")}
              style={{ background: ds.ink, borderColor: ds.ink, borderRadius: ds.rSm, height: 36, fontWeight: 600 }}>
              New Claim
            </Button>
          </Space>
        </div>

        {/* ── My KPIs ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: 700, color: ds.inkFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>My Claims Overview</Text>
        </div>
        <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
          {[
            { label: "Total Claims", value: my.total, sub: `${my.thisMonthCount} submitted this month`, icon: <FileTextOutlined />, accentColor: ds.sapphire, accentBg: ds.sapphireBg, onClick: () => nav("/app/claims"), trend: { value: my.monthTrend, label: "vs last month" } },
            { label: "Pending Approval", value: my.pending, sub: my.pending > 0 ? fmt(my.pendingAmt, my.currency) : "None pending", icon: <ClockCircleOutlined />, accentColor: ds.amber, accentBg: ds.amberBg, onClick: () => nav("/app/claims?status=pending"), urgent: my.aging6Plus.length > 0 },
            { label: "Approved", value: my.approved, sub: fmt(my.approvedAmt, my.currency), icon: <CheckCircleOutlined />, accentColor: ds.emerald, accentBg: ds.emeraldBg, onClick: () => nav("/app/claims?status=approved") },
            { label: "Awaiting Payment", value: my.awaitingPayment.length, sub: my.awaitingPayment.length > 0 ? fmt(my.awaitingPaymentAmt, my.currency) : "All settled", icon: <BankOutlined />, accentColor: ds.violet, accentBg: ds.violetBg, urgent: my.awaitingPayment.length > 0 },
          ].map((m) => (
            <Col xs={12} sm={12} md={6} key={m.label}>
              <KpiCard {...m} />
            </Col>
          ))}
        </Row>
        <Row gutter={[14, 14]} style={{ marginBottom: 24 }}>
          {[
            { label: "Draft Claims", value: my.draft, sub: fmt(my.draftAmt, my.currency), icon: <EditOutlined />, accentColor: ds.slate, accentBg: ds.slateBg },
            { label: "Rejected", value: my.rejected, sub: my.rejected > 0 ? fmt(my.rejectedAmt, my.currency) : "None rejected", icon: <CloseCircleOutlined />, accentColor: ds.ruby, accentBg: ds.rubyBg },
            { label: "Approval Rate", value: `${my.approvalRate}%`, sub: `${my.approved} of ${my.total} claims`, icon: <TrophyOutlined />, accentColor: my.approvalRate >= 70 ? ds.emerald : ds.amber, accentBg: my.approvalRate >= 70 ? ds.emeraldBg : ds.amberBg },
            { label: "Avg Approved Claim", value: fmtCompact(my.avg), sub: `Based on ${my.approved} claims`, icon: <RiseOutlined />, accentColor: ds.sapphire, accentBg: ds.sapphireBg },
          ].map((m) => (
            <Col xs={12} sm={12} md={6} key={m.label}>
              <KpiCard {...m} />
            </Col>
          ))}
        </Row>

        {/* ── Team KPIs ───────────────────────────────────────────────────── */}
        {canApproveLike && (
          <>
            <div style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: ds.inkFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>Team Overview</Text>
            </div>
            <Row gutter={[14, 14]} style={{ marginBottom: 24 }}>
              {[
                { label: "Team Total", value: team.total, sub: "All team claims", icon: <TeamOutlined />, accentColor: ds.sapphire, accentBg: ds.sapphireBg },
                { label: "Needs Action", value: team.pending, sub: fmt(team.pendingAmt, team.currency), icon: <ClockCircleOutlined />, accentColor: ds.amber, accentBg: ds.amberBg, urgent: team.overdue > 0, onClick: () => nav("/app/claims?scope=team&status=pending") },
                { label: "Overdue (5d+)", value: team.overdue, sub: team.overdue > 0 ? fmt(team.overdueAmt, team.currency) : "All on time", icon: <WarningOutlined />, accentColor: ds.ruby, accentBg: ds.rubyBg, urgent: team.overdue > 0 },
                { label: "Team Approved", value: team.approved, sub: undefined, icon: <CheckCircleOutlined />, accentColor: ds.emerald, accentBg: ds.emeraldBg },
              ].map((m) => (
                <Col xs={12} sm={12} md={6} key={m.label}>
                  <KpiCard {...m} />
                </Col>
              ))}
            </Row>
          </>
        )}

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>

          {/* Recent Claims Table */}
          <Col xs={24} xl={16}>
            <Card style={{ padding: 0 }}>
              <div style={{ padding: "18px 22px 12px" }}>
                <SectionHead
                  title="Recent Claims"
                  sub={`Showing last ${recentClaims.length} of ${my.total} claims`}
                  action="View all"
                  onAction={() => nav("/app/claims")}
                />
              </div>
              {recentClaims.length === 0 ? (
                <div style={{ padding: "48px 22px", textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                  <Text style={{ color: ds.inkLight, display: "block", marginBottom: 12 }}>No claims yet</Text>
                  <Button type="primary" icon={<PlusOutlined />}
                    onClick={() => nav("/app/claims?create=1")}
                    style={{ background: ds.ink, borderColor: ds.ink, borderRadius: ds.rSm }}>
                    Create your first claim
                  </Button>
                </div>
              ) : (
                <Table
                  className="claim-table"
                  dataSource={recentClaims}
                  columns={cols}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                  scroll={{ x: 700 }}
                />
              )}
            </Card>
          </Col>

          {/* Right column */}
          <Col xs={24} xl={8}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Status Distribution */}
              <Card>
                <SectionHead title="Status Distribution" sub="All time breakdown" />
                <DonutBar segments={[
                  { value: my.approved, color: ds.emerald, label: "Approved" },
                  { value: my.paid, color: ds.violet, label: "Paid" },
                  { value: my.pending, color: ds.amber, label: "Pending" },
                  { value: my.draft, color: ds.slateMid, label: "Draft" },
                  { value: my.rejected, color: ds.ruby, label: "Rejected" },
                ]} />
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Approved", count: my.approved, amt: my.approvedAmt, color: ds.emerald },
                    { label: "Pending", count: my.pending, amt: my.pendingAmt, color: ds.amber },
                    { label: "Draft", count: my.draft, amt: my.draftAmt, color: ds.slateMid },
                    { label: "Rejected", count: my.rejected, amt: my.rejectedAmt, color: ds.ruby },
                  ].filter(r => r.count > 0).map(row => (
                    <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color }} />
                        <Text style={{ fontSize: 13, color: ds.ink }}>{row.label}</Text>
                        <Text style={{ fontSize: 12, color: ds.inkFaint }}>({row.count})</Text>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: 600, color: ds.inkLight, fontVariantNumeric: "tabular-nums" }}>{fmtCompact(row.amt)}</Text>
                        <Text style={{ fontSize: 11, color: ds.inkFaint, minWidth: 28, textAlign: "right" }}>{my.total > 0 ? Math.round(row.count / my.total * 100) : 0}%</Text>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Pending Aging */}
              {my.pending > 0 && (
                <Card>
                  <SectionHead title="Pending Aging" sub="Time in approval queue" />
                  <AgingRow label="Fresh" count={my.aging0_2.length} amount={my.aging0_2.reduce((s, c) => s + c.totalAmount, 0)} days="0–2 days" color={ds.emerald} />
                  <AgingRow label="In Progress" count={my.aging3_5.length} amount={my.aging3_5.reduce((s, c) => s + c.totalAmount, 0)} days="3–5 days" color={ds.amber} />
                  <div style={{ paddingBottom: 0 }}>
                    <AgingRow label="Overdue" count={my.aging6Plus.length} amount={my.aging6Plus.reduce((s, c) => s + c.totalAmount, 0)} days="6+ days" color={ds.ruby} />
                  </div>
                </Card>
              )}

              {/* Smart Insights */}
              {insights.length > 0 && (
                <Card>
                  <SectionHead title="Smart Insights" sub="Actionable nudges" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {insights.map((ins, i) => (
                      <InsightBadge key={i} {...ins} />
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </Col>
        </Row>

        {/* ── Activity Timeline + Profile ──────────────────────────────────── */}
        <Row gutter={[14, 14]}>
          <Col xs={24} lg={14}>
            <Card>
              <SectionHead title="Activity Timeline" sub="Latest claim movements" action="View all" onAction={() => nav("/app/claims")} />
              {recentClaims.length === 0
                ? <Text style={{ color: ds.inkFaint, fontSize: 13 }}>No activity yet.</Text>
                : recentClaims.slice(0, 6).map((c, i) => (
                  <TimelineItem key={c.id} claim={c} isLast={i === Math.min(5, recentClaims.length - 1)} onNav={(id) => nav(`/app/claims/${id}`)} />
                ))
              }
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* User Card */}
              <Card>
                <SectionHead title="Account" />
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: ds.rMd,
                    background: `linear-gradient(135deg, ${ds.ink}, #374151)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 18, flexShrink: 0,
                  }}>
                    <UserOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: ds.ink }}>{employee?.name || "—"}</div>
                    <div style={{ fontSize: 12, color: ds.inkFaint }}>{user.email}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                  {[
                    { label: "Role", value: user.role },
                    { label: "Status", value: user.status, highlight: user.status === "ACTIVE" ? ds.emerald : ds.ruby },
                    { label: "Department", value: employee?.department || "—" },
                    { label: "Grade", value: employee?.grade || "—" },
                    { label: "Mobile", value: employee?.mobile || "—" },
                  ].map(({ label, value, highlight }) => (
                    <div key={label}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: ds.inkFaint, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: highlight || ds.ink }}>{value}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick Stats */}
              <Card>
                <SectionHead title="Financial Summary" />
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { label: "Total Approved", value: fmt(my.approvedAmt, my.currency), color: ds.emerald },
                    { label: "Pending Disbursement", value: fmt(my.awaitingPaymentAmt, my.currency), color: ds.violet },
                    { label: "This Month", value: fmt(my.thisMonthAmt, my.currency), color: ds.sapphire },
                    { label: "Last Month", value: fmt(my.lastMonthAmt, my.currency), color: ds.inkLight },
                  ].map(({ label, value, color }, i, arr) => (
                    <div key={label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 0",
                      borderBottom: i < arr.length - 1 ? `1px solid ${ds.inkGhost}` : "none",
                    }}>
                      <Text style={{ fontSize: 12, color: ds.inkLight }}>{label}</Text>
                      <Text style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</Text>
                    </div>
                  ))}
                </div>
                {my.monthTrend !== 0 && (
                  <div style={{
                    marginTop: 12, padding: "10px 12px", borderRadius: ds.rSm,
                    background: my.monthTrend > 0 ? ds.amberBg : ds.emeraldBg,
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    {my.monthTrend > 0 ? <RiseOutlined style={{ color: ds.amber }} /> : <FallOutlined style={{ color: ds.emerald }} />}
                    <Text style={{ fontSize: 12, color: ds.inkMid }}>
                      {Math.abs(my.monthTrend)}% {my.monthTrend > 0 ? "more" : "less"} claimed vs last month
                    </Text>
                  </div>
                )}
              </Card>
            </div>
          </Col>
        </Row>

      </div>
    </div>
  );
}