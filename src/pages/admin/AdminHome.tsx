import { Button } from "antd";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

export default function AdminHome({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* ✅ Sidebar */}
      <AdminSidebar onLogout={onLogout} />
      <div style={{ flex: 1, background: "#f8fafc" }}>
        <div style={{ padding: 16 }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}