import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE, // use Vite proxy (/api -> backend)
});

export function setAuthToken(token?: string) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export function setTenant(tenant: string) {
  api.defaults.headers.common["x-tenant"] = tenant;
}

/** Make axios pick up saved tenant/token even after refresh */
export function initApiFromStorage() {
  const tenant = localStorage.getItem("tenant");
  const token = localStorage.getItem("token");
  if (tenant) setTenant(tenant);
  if (token) setAuthToken(token);
}

// Response interceptor to handle invalid token
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.error === "invalid token") {
      localStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Initialize immediately on module load (safe)
initApiFromStorage();

export default api;
