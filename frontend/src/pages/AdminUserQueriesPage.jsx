import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getSupportQueries } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminUserQueriesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-white">
            User Queries
          </h1>
          <p className="mt-1 text-slate-300">
            High-risk transaction history with OTP verification outcomes.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
              {error}
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
                    <th className="px-4 py-3">OTP</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const riskPercent = Number.isFinite(row.transaction_risk_score)
                      ? Math.round(row.transaction_risk_score * 100)
                      : null;
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
                          {row.otp_status || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {typeof row.otp_attempt_count === "number"
                            ? `${row.otp_attempt_count}/${row.otp_max_attempts || 3}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 max-w-[320px]">
                          {row.admin_notes || row.transaction_note || "-"}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-slate-400">
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
