import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { login, submitBlockedQuery } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser, logout } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [selectedLoginRole, setSelectedLoginRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blockedMode, setBlockedMode] = useState(false);
  const [blockedQuery, setBlockedQuery] = useState("");
  const [blockedSuccess, setBlockedSuccess] = useState("");
  const [submittingQuery, setSubmittingQuery] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setBlockedSuccess("");
    try {
      const response = await login(form);
      loginUser(response.data.access_token, response.data.user);
      const role = response.data.user?.role;

      if (role !== selectedLoginRole) {
        logout();
        setError(
          `This account is ${role}. Please select the correct login type and try again.`,
        );
        return;
      }

      if (role === "admin") {
        navigate("/admin");
      } else if (role === "analyst") {
        navigate("/analyst/cases");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (
        err?.response?.status === 403 &&
        detail &&
        typeof detail === "object" &&
        detail.code === "ACCOUNT_BLOCKED"
      ) {
        setBlockedMode(true);
        setError(detail.msg || "Account is blocked. Contact admin.");
      } else {
        setBlockedMode(false);
        setError(
          getApiErrorMessage(err, "Unable to login with those credentials."),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBlockedQuerySubmit = async () => {
    if (blockedQuery.trim().length < 10) {
      setError("Please enter at least 10 characters explaining your transfer.");
      return;
    }
    setSubmittingQuery(true);
    setError("");
    setBlockedSuccess("");
    try {
      const response = await submitBlockedQuery({
        email: form.email,
        password: form.password,
        message: blockedQuery.trim(),
      });
      setBlockedSuccess(
        response.data?.message || "Query submitted successfully.",
      );
      setBlockedQuery("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to submit your query."));
    } finally {
      setSubmittingQuery(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass mx-auto w-full max-w-md rounded-3xl p-8"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex rounded-xl border border-cyan-300/40 bg-cyan-500/10 p-3">
            <LogIn className="h-6 w-6 text-cyan-100" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Welcome Back
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to continue your transaction simulation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Login as
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "user", label: "User" },
                { value: "admin", label: "Admin" },
                { value: "analyst", label: "Fraud Analyst" },
              ].map((roleOption) => (
                <button
                  key={roleOption.value}
                  type="button"
                  onClick={() => setSelectedLoginRole(roleOption.value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                    selectedLoginRole === roleOption.value
                      ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800/80"
                  }`}
                >
                  {roleOption.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              type="email"
              className="input-dark"
              value={form.email}
              onChange={(event) =>
                setForm((old) => ({ ...old, email: event.target.value }))
              }
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              className="input-dark"
              value={form.password}
              onChange={(event) =>
                setForm((old) => ({ ...old, password: event.target.value }))
              }
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {blockedMode && (
            <div className="rounded-xl border border-amber-300/35 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-100">
                Account Blocked Query
              </p>
              <p className="mt-1 text-xs text-amber-200/90">
                Account is blocked. Contact admin. Submit your transfer
                explanation below.
              </p>
              <textarea
                className="input-dark mt-3 min-h-[96px]"
                value={blockedQuery}
                onChange={(event) => setBlockedQuery(event.target.value)}
                placeholder="Explain why you made that transfer..."
              />
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                disabled={submittingQuery}
                onClick={handleBlockedQuerySubmit}
              >
                {submittingQuery
                  ? "Submitting..."
                  : "Submit Query To Analyst/Admin"}
              </button>

              {blockedSuccess && (
                <p className="mt-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-200">
                  {blockedSuccess}
                </p>
              )}
            </div>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-slate-300">
          New here?{" "}
          <Link to="/register" className="font-semibold text-cyan-200">
            Create account
          </Link>
        </p>
      </motion.section>
    </main>
  );
}
