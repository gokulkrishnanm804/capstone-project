import { AnimatePresence, motion } from "framer-motion";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AdminCaseReviewPage from "./pages/AdminCaseReviewPage";
import AnalystAnsweredQueriesPage from "./pages/AnalystAnsweredQueriesPage";
import AnalystCaseQueuePage from "./pages/AnalystCaseQueuePage";
import AnalystPendingQueriesPage from "./pages/AnalystPendingQueriesPage";
import AnalystTransactionExplainablePage from "./pages/AnalystTransactionExplainablePage";
import AnalystTransactionsPage from "./pages/AnalystTransactionsPage";
import DashboardPage from "./pages/DashboardPage";
import FraudDetectionPage from "./pages/FraudDetectionPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PredictionResultPage from "./pages/PredictionResultPage";
import RegisterPage from "./pages/RegisterPage";
import RewardsPage from "./pages/RewardsPage";
import TransactionHistoryPage from "./pages/TransactionHistoryPage";
import UserFraudQueriesPage from "./pages/UserFraudQueriesPage";

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

function AnimatedPage({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="min-h-[calc(100vh-72px)]"
    >
      {children}
    </motion.div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-mesh">
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <AnimatedPage>
                <HomePage />
              </AnimatedPage>
            }
          />
          <Route
            path="/login"
            element={
              <AnimatedPage>
                <LoginPage />
              </AnimatedPage>
            }
          />
          <Route
            path="/register"
            element={
              <AnimatedPage>
                <RegisterPage />
              </AnimatedPage>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute blockedRoles={["analyst", "admin"]}>
                <AnimatedPage>
                  <DashboardPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulate"
            element={
              <ProtectedRoute blockedRoles={["analyst", "admin"]}>
                <AnimatedPage>
                  <FraudDetectionPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/result"
            element={
              <ProtectedRoute blockedRoles={["analyst", "admin"]}>
                <AnimatedPage>
                  <PredictionResultPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute blockedRoles={["analyst", "admin"]}>
                <AnimatedPage>
                  <TransactionHistoryPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute blockedRoles={["analyst", "admin"]}>
                <AnimatedPage>
                  <RewardsPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-fraud-queries"
            element={
              <ProtectedRoute requiredRole="user">
                <AnimatedPage>
                  <UserFraudQueriesPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <AdminDashboardPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyst/cases"
            element={
              <ProtectedRoute requiredRole="analyst">
                <AnimatedPage>
                  <AnalystCaseQueuePage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyst/answered-queries"
            element={
              <ProtectedRoute requiredRole="analyst">
                <AnimatedPage>
                  <AnalystAnsweredQueriesPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyst/pending-queries"
            element={
              <ProtectedRoute requiredRole="analyst">
                <AnimatedPage>
                  <AnalystPendingQueriesPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyst/transactions"
            element={
              <ProtectedRoute requiredRole={["analyst", "admin"]}>
                <AnimatedPage>
                  <AnalystTransactionsPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyst/transactions/:transactionId"
            element={
              <ProtectedRoute requiredRole={["analyst", "admin"]}>
                <AnimatedPage>
                  <AnalystTransactionExplainablePage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cases"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <AdminCaseReviewPage />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
    </div>
  );
}
