import { Layout, Menu } from "antd";
import {
    DashboardOutlined,
    FileTextOutlined,
    TeamOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Sider } = Layout;

export default function Sidebar() {
    const nav = useNavigate();

    return (
        <Sider width={220} style={{ background: "#0f172a", minHeight: "100vh" }}>
            <div style={{ color: "#fff", padding: 20, fontWeight: 700 }}>
                💼 ExpensePro
            </div>

            <Menu
                theme="dark"
                mode="inline"
                defaultSelectedKeys={["dashboard"]}
                onClick={(e) => nav(`/app/${e.key}`)}
                items={[
                    { key: "dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
                    { key: "claims", icon: <FileTextOutlined />, label: "Claims" },
                    { key: "team", icon: <TeamOutlined />, label: "Team" },
                ]}
            />
        </Sider>
    );
}