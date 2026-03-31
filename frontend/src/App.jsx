import { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

const AdminOperationsReportsPage = lazy(
  () => import("./pages/AnalystReportsPage"),
);
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminUserManagementPage = lazy(
  () => import("./pages/AdminUserManagementPage"),
);
const AdminTransactionManagementPage = lazy(
  () => import("./pages/AdminTransactionManagementPage"),
);
const AdminTransactionDetailPage = lazy(
  () => import("./pages/AdminTransactionDetailPage"),
);
const AdminModelManagementPage = lazy(
  () => import("./pages/AdminModelManagementPage"),
);
const AdminRewardsPage = lazy(() => import("./pages/AdminRewardsPage"));
const AdminUserQueriesPage = lazy(() => import("./pages/AdminUserQueriesPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const FraudDetectionPage = lazy(() => import("./pages/FraudDetectionPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const PredictionResultPage = lazy(() => import("./pages/PredictionResultPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const RewardsPage = lazy(() => import("./pages/RewardsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const TransactionHistoryPage = lazy(
  () => import("./pages/TransactionHistoryPage"),
);

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
                <Suspense fallback={<PageFallback />}>
                  <HomePage />
                </Suspense>
              </AnimatedPage>
            }
          />
          <Route
            path="/login"
            element={
              <AnimatedPage>
                <Suspense fallback={<PageFallback />}>
                  <LoginPage />
                </Suspense>
              </AnimatedPage>
            }
          />
          <Route
            path="/register"
            element={
              <AnimatedPage>
                <Suspense fallback={<PageFallback />}>
                  <RegisterPage />
                </Suspense>
              </AnimatedPage>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <ProfilePage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute blockedRoles={["admin"]}>
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <DashboardPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulate"
            element={
              <ProtectedRoute blockedRoles={["admin"]}>
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <FraudDetectionPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/result"
            element={
              <ProtectedRoute blockedRoles={["admin"]}>
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <PredictionResultPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute blockedRoles={["admin"]}>
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <TransactionHistoryPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute blockedRoles={["admin"]}>
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <RewardsPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminOperationsReportsPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminDashboardPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminDashboardPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminUserManagementPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/transactions"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminTransactionManagementPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/transactions/:transactionId"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminTransactionDetailPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/models"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminModelManagementPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/rewards"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminRewardsPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/user-queries"
            element={
              <ProtectedRoute requiredRole="admin">
                <AnimatedPage>
                  <Suspense fallback={<PageFallback />}>
                    <AdminUserQueriesPage />
                  </Suspense>
                </AnimatedPage>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
    </div>
  );
}

function PageFallback() {
  return <div className="px-4 py-10 text-slate-300">Loading…</div>;
}
