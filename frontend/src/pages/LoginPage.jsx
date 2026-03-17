import { motion } from "framer-motion";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { login } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await login(form);
      loginUser(response.data.access_token, response.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to login with those credentials."),
      );
    } finally {
      setLoading(false);
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
