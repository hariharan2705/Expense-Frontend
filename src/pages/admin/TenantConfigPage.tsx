import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Switch, message } from "antd";
import api from "../../lib/api";

export default function TenantConfigPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/tenant/config");
      const { branding, features, employeeSchema } = res.data;

      form.setFieldsValue({
        appName: branding?.appName || "",
        primaryColor: branding?.primaryColor || "",
        welcomeBanner: branding?.welcomeBanner || "",
        workflowBuilder: !!features?.workflowBuilder,
        policyRules: !!features?.policyRules,
        cashAdvance: !!features?.cashAdvance,
        employeeSchemaJson: JSON.stringify(employeeSchema || {}, null, 2),
      });
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Failed to load tenant config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const v = await form.validateFields();
    try {
      await api.put("/api/tenant/config", {
        branding: {
          appName: v.appName,
          primaryColor: v.primaryColor,
          welcomeBanner: v.welcomeBanner,
        },
        features: {
          workflowBuilder: !!v.workflowBuilder,
          policyRules: !!v.policyRules,
          cashAdvance: !!v.cashAdvance,
        },
        employeeSchema: JSON.parse(v.employeeSchemaJson || "{}"),
      });
      message.success("Tenant config updated");
    } catch (e: any) {
      message.error(e?.response?.data?.error || "Save failed");
    }
  };

  return (
    <Card title="Tenant Config" loading={loading}>
      <Form form={form} layout="vertical">
        <Form.Item name="appName" label="App Name">
          <Input />
        </Form.Item>
        <Form.Item name="primaryColor" label="Primary Color (hex)">
          <Input placeholder="#1677ff" />
        </Form.Item>
        <Form.Item name="welcomeBanner" label="Welcome Banner">
          <Input />
        </Form.Item>

        <Card title="Features" style={{ marginBottom: 12 }}>
          <Form.Item name="workflowBuilder" label="Workflow Builder" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="policyRules" label="Policy Rules" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="cashAdvance" label="Cash Advance" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        <Form.Item
          name="employeeSchemaJson"
          label="Employee Schema (JSON)"
          rules={[
            {
              validator: async (_, value) => {
                try { JSON.parse(value || "{}"); return Promise.resolve(); }
                catch { return Promise.reject(new Error("Invalid JSON")); }
              }
            }
          ]}
        >
          <Input.TextArea rows={12} />
        </Form.Item>

        <Button type="primary" onClick={save}>Save</Button>
      </Form>
    </Card>
  );
}
