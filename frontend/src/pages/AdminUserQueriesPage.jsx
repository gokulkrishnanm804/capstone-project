import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { decideHighRiskTransaction, getSupportQueries } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminUserQueriesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getSupportQueries({
        query_type: "HIGH_RISK_TRANSFER",
      });
      setRows(res.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load user queries."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const takeDecision = async (queryId, decision) => {
    setError("");
    setSuccess("");
    const defaultNote =
      decision === "ALLOW"
        ? "APPROVED: Transaction allowed by admin"
        : "DENIED: Permission denied";
    const note = window.prompt("Admin note", defaultNote);
    if (note === null) return;

    setSubmittingId(queryId);
    try {
      await decideHighRiskTransaction(queryId, {
        decision,
        admin_notes: note.trim() || defaultNote,
      });
      setSuccess(
        decision === "ALLOW"
          ? "Transaction permission granted."
          : "Transaction permission denied.",
      );
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update decision."));
    } finally {
      setSubmittingId("");
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-white">
            User Queries
          </h1>
          <p className="mt-1 text-slate-300">
            Review high-risk transfer requests and allow or deny execution.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
              {success}
            </p>
          )}

          {loading ? (
            <div className="mt-6 text-slate-300">Loading user queries...</div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Query ID</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Transaction</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const riskPercent = Number.isFinite(row.transaction_risk_score)
                      ? Math.round(row.transaction_risk_score * 100)
                      : null;
                    const busy = submittingId === row.query_id;
                    return (
                      <tr key={row.query_id} className="border-t border-slate-800">
                        <td className="px-4 py-3 font-mono text-xs">
                          {row.query_id}
                        </td>
                        <td className="px-4 py-3">
                          <p>{row.user_name}</p>
                          <p className="text-xs text-slate-400">{row.user_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          {row.transaction_id ? (
                            <button
                              type="button"
                              className="text-cyan-200 hover:text-cyan-100"
                              onClick={() =>
                                navigate(`/admin/transactions/${row.transaction_id}`)
                              }
                            >
                              {row.transaction_id}
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {typeof row.transaction_amount === "number"
                            ? `INR ${row.transaction_amount.toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {riskPercent !== null ? `${riskPercent}%` : "-"}
                        </td>
                        <td className="px-4 py-3 max-w-[320px]">{row.message}</td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">
                          {row.status === "OPEN" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-primary px-3 py-1.5 text-xs"
                                disabled={busy}
                                onClick={() => takeDecision(row.query_id, "ALLOW")}
                              >
                                Allow Transaction
                              </button>
                              <button
                                type="button"
                                className="btn-secondary px-3 py-1.5 text-xs"
                                disabled={busy}
                                onClick={() => takeDecision(row.query_id, "DENY")}
                              >
                                Not Allow Transaction
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {row.admin_notes || "Resolved"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-slate-400">
                        No user queries available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
