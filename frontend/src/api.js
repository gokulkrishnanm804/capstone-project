import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const API = axios.create({ baseURL: API_BASE_URL });

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
export const setUpiPin = (data) => API.post("/set-upi-pin", data);
export const getTransactions = (params) => API.get("/transactions", { params });
export const getAnalystTransactions = (params) =>
  API.get("/analyst/transactions", { params });
export const getAnalystTransactionById = (transactionId) =>
  API.get("/analyst/transactions", {
    params: {
      transaction_id: transactionId,
      limit: 1,
      include_explanations: true,
    },
  });
export const getRewards = () => API.get("/rewards");
export const getFraudCases = (params) => API.get("/fraud-cases", { params });
export const reviewFraudCase = (caseId, data) =>
  API.patch(`/fraud-cases/${caseId}/review`, data);
export const adminActionFraudCase = (caseId, data) =>
  API.patch(`/fraud-cases/${caseId}/admin-action`, data);
export const submitBlockedQuery = (data) => API.post("/blocked-query", data);
export const getSupportQueries = (params) =>
  API.get("/support-queries", { params });
export const updateSupportQuery = (queryId, data) =>
  API.patch(`/support-queries/${queryId}`, data);
export const createUserFraudQuery = (caseId, data) =>
  API.post(`/fraud-cases/${caseId}/user-query`, data);
export const getMyFraudQueries = (params) =>
  API.get("/my-fraud-queries", { params });
export const respondMyFraudQuery = (queryId, data) =>
  API.patch(`/my-fraud-queries/${queryId}/respond`, data);
export const getFraudAnalytics = () => API.get("/fraud-analytics");
export const getModelInsights = () => API.get("/model-insights");

export default API;
