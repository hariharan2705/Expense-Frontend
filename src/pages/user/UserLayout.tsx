import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function UserLayout() {
    return (
        <div style={{ display: "flex", minHeight: "100vh" }}>

            {/* Sidebar */}
            <Sidebar />

            {/* Right Side */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

                <div
                    style={{
                        flex: 1,
                        padding: 20,
                        background: "linear-gradient(135deg, #eef2ff, #f8fafc)",
                    }}
                >
                    <Outlet />
                </div>

            </div>
        </div>
    );
}