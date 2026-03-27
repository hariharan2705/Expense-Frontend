import AdminSidebar from "./AdminSidebar";
import { Outlet } from "react-router-dom";

export default function AdminHome({ onLogout }: any) {
    return (
        <div style={{ display: "flex" }}>
            <AdminSidebar onLogout={onLogout} />
            <div style={{ flex: 1, padding: 16 }}>
                <Outlet />
            </div>
        </div>
    );
}