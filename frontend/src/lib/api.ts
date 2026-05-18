import axios from "axios";

// Local dev: VITE_API_URL unset → "/api" (proxied by Vite to :4000).
// Production (Vercel): set VITE_API_URL to the backend deployment URL.
const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const api = axios.create({ baseURL: `${base}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && location.pathname !== "/login") {
      localStorage.removeItem("token");
      location.href = "/login";
    }
    return Promise.reject(err);
  },
);
