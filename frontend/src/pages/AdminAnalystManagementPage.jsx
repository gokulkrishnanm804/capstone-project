import { useEffect, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import { addAdminAnalyst, getAdminAnalysts, removeAdminAnalyst } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminAnalystManagementPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    getAdminAnalysts()
      .then((res) => setRows(res.data || []))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load analysts.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await addAdminAnalyst(form);
      setForm({ name: "", email: "", password: "" });
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to add analyst."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm("Remove analyst?")) return;
    setSubmitting(true);
    try {
      await removeAdminAnalyst(id);
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to remove analyst."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                Fraud Analyst Management
              </h1>
              <p className="mt-1 text-slate-300">
                Add or remove analysts and track their review workload.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
              {loading ? (
                <p className="text-slate-300">Loading analysts...</p>
              ) : error ? (
                <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
                  {error}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-slate-200">
                    <thead className="bg-slate-900/70 text-left text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Cases Reviewed</th>
                        <th className="px-4 py-3">Confirmed Fraud</th>
                        <th className="px-4 py-3">Escalated</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.user_id}
                          className="border-t border-slate-800"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold">{row.name}</p>
                            <p className="text-xs text-slate-400">
                              {row.email}
                            </p>
                          </td>
                          <td className="px-4 py-3">{row.cases_reviewed}</td>
                          <td className="px-4 py-3">{row.confirmed_fraud}</td>
                          <td className="px-4 py-3">{row.escalated}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1 text-xs"
                              disabled={submitting}
                              onClick={() => handleRemove(row.user_id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <form
              onSubmit={handleAdd}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
            >
              <h2 className="font-display text-lg font-semibold text-white">
                Add New Analyst
              </h2>
              <div className="mt-4 space-y-3">
                <input
                  className="input-dark"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <input
                  className="input-dark"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <input
                  className="input-dark"
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={submitting}
                >
                  {submitting ? "Adding..." : "Add Analyst"}
                </button>
                {error && (
                  <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                    {error}
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
