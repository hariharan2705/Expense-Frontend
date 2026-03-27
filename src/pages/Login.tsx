import { useState } from "react";
import { Button, Card, Form, Input, message, Typography } from "antd";
import api, { setAuthToken, setTenant } from "../lib/api";
import { useNavigate } from "react-router-dom";

// Branding
//import exproLogo from "../../assets/expro-logo-h36.png";
import exproLogo from "../assets/expro-logo-h32.png";
const { Text } = Typography;

export default function Login({
  onLogin,
}: {
  onLogin: (role: string, token: string, tenant: string) => void;
}) {
  const [tenant, setTenantState] = useState(
    import.meta.env.VITE_DEFAULT_TENANT || "acme"
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (v: any) => {
    try {
      setLoading(true);
      setTenant(tenant);

      const res = await api.post("/api/auth/login", {
        email: v.email,
        password: v.password,
      });

      const { token, role } = res.data;

      setAuthToken(token);
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      localStorage.setItem("tenant", tenant);

      onLogin(role, token, tenant);
      navigate("/", { replace: true });
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
      }}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 12,
        }}
        bodyStyle={{ padding: 24 }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <img
            src={exproLogo}
            alt="ExPro"
            style={{ height: 36, width: "auto" }}
          />
        </div>

        <Text
          type="secondary"
          style={{
            display: "block",
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Sign in to manage your expenses
        </Text>

        <Form layout="vertical" onFinish={submit}>
          {/* Tenant is intentionally hidden for now */}
          {/* <Form.Item label="Tenant">
            <Input value={tenant} onChange={(e) => setTenantState(e.target.value)} />
          </Form.Item> */}

          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: "Please enter your email" }]}
          >
            <Input autoFocus />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
          >
            Login
          </Button>
        </Form>
      </Card>
    </div>
  );
}
