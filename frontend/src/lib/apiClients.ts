// src/lib/apiClient.ts
import axios from "axios";
const instance = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem("tenantId");
  if (tenantId) config.headers["X-Tenant-Id"] = tenantId;
  return config;
});

export default instance;