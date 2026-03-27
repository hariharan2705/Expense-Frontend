import { Sidebar, Menu, MenuItem } from "react-pro-sidebar";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";

import {
    FaUsers,
    FaFileInvoice,
    FaProjectDiagram,
    FaCalendar,
} from "react-icons/fa";
import { MdPolicy } from "react-icons/md";
import { GoProjectRoadmap } from "react-icons/go";

import "./AdminSidebar.css";

export default function AdminSidebar({ onLogout }: any) {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="sidebar-wrapper">

            {/* TOGGLE BUTTON */}
            <div className="sidebar-header">
                <span className="logo">{collapsed ? "A" : "Admin"}</span>
                <button onClick={() => setCollapsed(!collapsed)}>☰</button>
            </div>

            <Sidebar collapsed={collapsed} className="custom-sidebar">

                <Menu>

                    <MenuItem
                        icon={<FaUsers />}
                        active={location.pathname === "/admin/employees"}
                        onClick={() => navigate("/admin/employees")}
                    >
                        Employees
                    </MenuItem>

                    <MenuItem
                        icon={<FaFileInvoice />}
                        active={location.pathname === "/admin/forms"}
                        onClick={() => navigate("/admin/forms")}
                    >
                        Expense Forms
                    </MenuItem>

                    <MenuItem
                        icon={<FaProjectDiagram />}
                        active={location.pathname === "/admin/workflows"}
                        onClick={() => navigate("/admin/workflows")}
                    >
                        Workflows
                    </MenuItem>

                    <MenuItem
                        icon={<MdPolicy />}
                        active={location.pathname === "/admin/policies"}
                        onClick={() => navigate("/admin/policies")}
                    >
                        Policies
                    </MenuItem>

                    <MenuItem
                        icon={<FaCalendar />}
                        active={location.pathname === "/admin/calendar"}
                        onClick={() => navigate("/admin/calendar")}
                    >
                        Calendar
                    </MenuItem>

                    <MenuItem
                        icon={<GoProjectRoadmap />}
                        active={location.pathname.includes("/admin/beats")}
                        onClick={() => navigate("/admin/beats")}
                    >
                        Beats
                    </MenuItem>

                </Menu>

                {/* LOGOUT */}
                <div className="sidebar-footer">
                    <button onClick={onLogout}>Logout</button>
                </div>

            </Sidebar>
        </div>
    );
}