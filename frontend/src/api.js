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
export const updateContactInfo = (data) => API.post("/me/contact", data);
export const updateProfileImage = (data) => API.post("/me/profile-image", data);
export const getSimulationContext = () => API.get("/simulation/context");
export const runSimulationTransaction = (data) =>
  API.post("/simulation/transaction", data);
export const setUpiPin = (data) => API.post("/set-upi-pin", data);
export const getIpCity = () => API.get("/geo/ip-city");
export const getTransactions = (params) => API.get("/transactions", { params });
export const getAdminOpsDashboard = () =>
  API.get("/admin/operations/dashboard");
export const getAdminOpsTransactions = (params) =>
  API.get("/admin/operations/transactions", { params });
export const getAdminOpsTransactionById = (transactionId) =>
  API.get(`/admin/operations/transactions/${transactionId}`);
export const postAdminOpsTransactionAction = (transactionId, data) =>
  API.post(`/admin/operations/transactions/${transactionId}/action`, data);
export const getAdminOpsAlerts = (params) =>
  API.get("/admin/operations/alerts", { params });
export const markAdminOpsAlertReviewed = (transactionId) =>
  API.post(`/admin/operations/alerts/${transactionId}/review`);
export const getAdminOpsReports = (params) =>
  API.get("/admin/operations/reports", { params });
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
export const decideHighRiskTransaction = (queryId, data) =>
  API.patch(`/support-queries/${queryId}/high-risk-decision`, data);
export const createUserFraudQuery = (caseId, data) =>
  API.post(`/fraud-cases/${caseId}/admin-query`, data);
export const getMyFraudQueries = (params) =>
  API.get("/my-fraud-queries", { params });
export const respondMyFraudQuery = (queryId, data) =>
  API.patch(`/my-fraud-queries/${queryId}/respond`, data);
export const getMyHighRiskTransactions = (params) =>
  API.get("/my/high-risk-transactions", { params });
export const executeMyHighRiskTransaction = (transactionId) =>
  API.post(`/my/high-risk-transactions/${transactionId}/execute`);
export const getFraudAnalytics = () => API.get("/fraud-analytics");
export const getModelInsights = () => API.get("/model-insights");
export const getAdminOverview = () => API.get("/admin/overview");
export const getAdminUsers = () => API.get("/admin/users");
export const getAdminUserProfile = (userId) =>
  API.get(`/admin/users/${userId}`);
export const updateAdminUserStatus = (userId, data) =>
  API.patch(`/admin/users/${userId}/status`, data);
export const updateAdminUserProfileImage = (userId, data) =>
  API.patch(`/admin/users/${userId}/profile-image`, data);
export const getAdminTransactions = (params) =>
  API.get("/admin/transactions", { params });
export const overrideAdminTransaction = (transactionId, data) =>
  API.post(`/admin/transactions/${transactionId}/override`, data);
export const getAdminModels = () => API.get("/admin/models");
export const retrainAdminModels = () => API.post("/admin/models/retrain");
export const getAdminRewards = () => API.get("/admin/rewards");
export const updateAdminCashbackRule = (data) =>
  API.patch("/admin/rewards/rules", data);
export const updateAdminCashbackCap = (data) =>
  API.patch("/admin/rewards/cap", data);
export const getAdminSettings = () => API.get("/admin/settings");
export const updateAdminThresholds = (data) =>
  API.post("/admin/settings/thresholds", data);
export const updateAdminVelocity = (data) =>
  API.post("/admin/settings/velocity", data);
export const addAdminBlacklist = (data) =>
  API.post("/admin/settings/blacklist", data);
export const removeAdminBlacklist = (value) =>
  API.delete(`/admin/settings/blacklist?value=${encodeURIComponent(value)}`);
export const getAdminAuditLog = () => API.get("/admin/audit-log");

export default API;
