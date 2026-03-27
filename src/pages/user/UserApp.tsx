import { useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Layout,
  Menu,
  Button,
  Space,
  Typography,
  Grid,
  Drawer,
  Avatar,
  Dropdown,
} from "antd";
import {
  MenuOutlined,
  HomeOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  DollarOutlined,
} from "@ant-design/icons";

import api from "../../lib/api";

// Branding assets
import exproIcon from "../../assets/expro-icon-32.png";
import exproLogo from "../../assets/expro-logo-h28.png";
import UserHome from "./UserHome";
import ClaimsPage from "./ClaimsPage";
import ProfilePage from "./ProfilePage";
import FinancePaymentsPage from "./FinancePaymentsPage";

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

type MeResponse = {
  tenantId: string;
  user: { id: string; email: string; role: string; status: string };
  employee?: { id: string; email: string; name: string } | null;
};

function initialsFrom(nameOrEmail?: string) {
  const v = (nameOrEmail || "").trim();
  if (!v) return "U";
  const parts = v.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserApp({ onLogout }: { onLogout: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const screens = useBreakpoint();

  const [collapsed, setCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  const selectedKey = useMemo(() => {
    if (loc.pathname.startsWith("/app/claims")) return "claims";
    if (loc.pathname.startsWith("/app/finance")) return "finance";
    return "home";
  }, [loc.pathname]);

  const tenant = me?.tenantId || localStorage.getItem("tenant") || "";
  const role = me?.user?.role || localStorage.getItem("role") || "USER";
  const email = me?.user?.email || localStorage.getItem("email") || "";

  const displayName = me?.employee?.name || email || role;
  const avatarText = initialsFrom(displayName);

  const isMobile = !screens.md;

  const logout = () => {
    onLogout();
    nav("/login", { replace: true });
  };

  const loadMe = async () => {
    try {
      const res = await api.get("/api/me");
      setMe(res.data);
    } catch {
      // Not fatal for shell rendering
    }
  };

  useEffect(() => {
    loadMe();
  }, []);

  const navItems = useMemo(
    () => [
      { key: "home", icon: <HomeOutlined />, label: "Home" },
      { key: "claims", icon: <FileTextOutlined />, label: "Expense Claims" },
      ...(role === "FINANCE"
        ? [{ key: "finance", icon: <DollarOutlined />, label: "Finance Payments" }]
        : []),
    ],
    [role]
  );

  const onMenuClick = (key: string) => {
    if (key === "home") nav("/app");
    if (key === "claims") nav("/app/claims");
    if (key === "finance") nav("/app/finance");
    setMobileNavOpen(false);
  };

  const avatarMenu = {
    items: [
      {
        key: "profile",
        icon: <UserOutlined />,
        label: "Profile",
        onClick: () => nav("/app/profile"),
      },
      { type: "divider" as const },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "Logout",
        onClick: logout,
      },
    ],
  };

  const sider = (
    <Sider
      collapsible={!isMobile}
      collapsed={isMobile ? true : collapsed}
      onCollapse={(v) => setCollapsed(v)}
      width={240}
      style={{ position: "sticky", top: 0, height: "100vh" }}
    >
      <div
        style={{
          padding: collapsed ? 12 : 16,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
        }}
      >
        <img
          src={collapsed ? exproIcon : exproLogo}
          alt="ExPro"
          style={{
            height: collapsed ? 32 : 28,
            width: "auto",
            display: "block",
          }}
        />
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={(e) => onMenuClick(e.key)}
        items={navItems}
      />
    </Sider>
  );

  // NOTE:
  // Prefer responsive Layout sizing over hard 100vw/100vh.
  // 100vw can introduce horizontal scroll due to scrollbar width; 100% + minHeight is safer.
  return (
    <Layout style={{ minHeight: "100vh" }}>
      {isMobile ? null : sider}

      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: isMobile ? "0 12px" : "0 16px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Space size="middle">
              <img src={exproIcon} alt="ExPro" style={{ height: 24, width: 24 }} />
              {isMobile ? (
                <Button icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label="Open menu" />
              ) : null}

              <div style={{ display: "flex", flexDirection: "column" }}>
                <Text strong style={{ lineHeight: 1.1 }}>
                  {role}
                </Text>
                <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.1 }}>
                  {email || "—"}
                </Text>
              </div>
            </Space>

            <Dropdown menu={avatarMenu} trigger={["click"]} placement="bottomRight">
              <Space style={{ cursor: "pointer", userSelect: "none" }}>
                <Avatar style={{ background: "#1677ff" }}>{avatarText}</Avatar>
                {!isMobile ? (
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                    <Text style={{ maxWidth: 220 }} ellipsis>
                      {displayName}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      " "
                    </Text>
                  </div>
                ) : null}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          placement="left"
          width={280}
          styles={{ body: { padding: 0 } }}
          title={
            <div style={{ paddingRight: 8 }}>
              <div style={{ fontWeight: 700 }}>Expense Platform</div>
              {tenant ? <Text type="secondary">{tenant}</Text> : null}
            </div>
          }
        >
          <Menu mode="inline" selectedKeys={[selectedKey]} onClick={(e) => onMenuClick(e.key)} items={navItems} />
        </Drawer>

        <Content style={{ padding: isMobile ? 12 : 16 }}>
          <div style={{ maxWidth: 1280, margin: "0 auto" }}>
            <Routes>
              <Route index element={<UserHome />} />
              <Route path="claims" element={<ClaimsPage />} />
              <Route path="finance" element={<FinancePaymentsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
