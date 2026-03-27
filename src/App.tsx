import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/Login";
import AdminHome from "./pages/admin/AdminHome";
import UserApp from "./pages/user/UserApp";

import EmployeesPage from "./pages/admin/EmployeesPage";
import ExpenseFormsPage from "./pages/admin/ExpenseFormsPage";
import WorkflowsPage from "./pages/admin/WorkflowsPage";
import PoliciesPage from "./pages/admin/PoliciesPage";
import TenantConfigPage from "./pages/admin/TenantConfigPage";

import CalendarView from "./pages/events/Calendar";
import Beats from "./pages/admin/Beats";
import EventDetail from "./pages/admin/Events";

import { setAuthToken, setTenant } from "./lib/api";

export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [role, setRole] = useState<string | null>(
    localStorage.getItem("role")
  );
  const [tenant, setTenantState] = useState<string>(
    localStorage.getItem("tenant") ||
    import.meta.env.VITE_DEFAULT_TENANT ||
    "acme"
  );

  useEffect(() => {
    setTenant(tenant);
    setAuthToken(token || undefined);
  }, [tenant, token]);

  const isLoggedIn = useMemo(() => !!token, [token]);
  const isAdmin = role === "TENANT_ADMIN";

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <BrowserRouter>
      <Routes>

        {/* 🔐 LOGIN */}
        <Route
          path="/login"
          element={
            <Login
              onLogin={(r, t, ten) => {
                setRole(r);
                setToken(t);
                setTenantState(ten);
              }}
            />
          }
        />

        {/* 🔁 ROOT REDIRECT */}
        <Route
          path="/"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : isAdmin ? (
              <Navigate to="/admin/employees" replace />
            ) : (
              <Navigate to="/app" replace />
            )
          }
        />

        {/* 🔥 ADMIN (WITH SIDEBAR LAYOUT) */}
        <Route
          path="/admin/*"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : (
              <AdminHome onLogout={handleLogout} />
            )
          }
        >
          {/* default */}
          <Route path="" element={<Navigate to="employees" />} />

          {/* pages */}
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="forms" element={<ExpenseFormsPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="tenant" element={<TenantConfigPage />} />

          <Route path="calendar" element={<CalendarView />} />

          <Route path="beats" element={<Beats />} />
          <Route path="beats/:id" element={<EventDetail />} />
        </Route>

        {/* 👤 USER APP */}
        <Route
          path="/app/*"
          element={
            !isLoggedIn ? (
              <Navigate to="/login" replace />
            ) : (
              <UserApp onLogout={handleLogout} />
            )
          }
        />

        {/* ❌ REMOVE OLD ROUTES */}
        {/* /events */}
        {/* /beats */}
        {/* /beats/:id */}

      </Routes>
    </BrowserRouter>
  );
}