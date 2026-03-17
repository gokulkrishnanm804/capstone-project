import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:8000" });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export const register = (data) => API.post("/register", data);
export const login = (data) => API.post("/login", data);
export const getProfile = () => API.get("/me");
export const getSimulationContext = () => API.get("/simulation/context");
export const runSimulationTransaction = (data) =>
  API.post("/simulation/transaction", data);
export const getTransactions = (params) => API.get("/transactions", { params });
export const getFraudAnalytics = () => API.get("/fraud-analytics");
export const getModelInsights = () => API.get("/model-insights");

export default API;
