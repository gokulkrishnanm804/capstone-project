import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getMyFraudQueries, respondMyFraudQuery } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function UserFraudQueriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("OPEN");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMyFraudQueries({
        status: statusFilter || undefined,
      });
      setRows(response.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load fraud queries."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [statusFilter]);

  const handleAnswerQuery = async (queryItem) => {
    const answer = window.prompt(
      "Provide your clarification for this fraud query",
      queryItem.user_response || "",
    );
    if (answer === null) return;
    if (answer.trim().length < 10) {
      setError("Your response must be at least 10 characters.");
      return;
    }

    setSuccess("");
    setError("");
    try {
      await respondMyFraudQuery(queryItem.query_id, {
        user_response: answer.trim(),
      });
      setSuccess("Response sent to analyst successfully.");
      await loadRows();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to send your response."));
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          Fraud Queries From Analyst
        </h1>
        <p className="mt-2 text-slate-300">
          Answer analyst questions about flagged fraud transactions.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <select
            className="input-dark max-w-[220px]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="OPEN">Open Queries</option>
            <option value="RESOLVED">Answered Queries</option>
            <option value="">All Queries</option>
          </select>
          <button type="button" className="btn-secondary" onClick={loadRows}>
            Refresh
          </button>
        </div>

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

        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          {loading ? (
            <p className="text-slate-300">Loading queries...</p>
          ) : (
            <table className="w-full min-w-[1320px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Query ID</th>
                  <th className="pb-3">Case</th>
                  <th className="pb-3">Analyst Question</th>
                  <th className="pb-3">Analyst Feedback</th>
                  <th className="pb-3">Admin Warning</th>
                  <th className="pb-3">Your Response</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {rows.map((item) => (
                  <tr key={item.query_id}>
                    <td className="py-3 font-mono text-xs">{item.query_id}</td>
                    <td className="py-3 font-mono text-xs">
                      {item.case_id || "-"}
                    </td>
                    <td className="py-3 max-w-[380px]">{item.message}</td>
                    <td className="py-3 max-w-[320px]">
                      {item.analyst_notes || "-"}
                    </td>
                    <td className="py-3 max-w-[320px]">
                      {item.admin_notes || "-"}
                    </td>
                    <td className="py-3 max-w-[380px]">
                      {item.user_response || "-"}
                    </td>
                    <td className="py-3">{item.status}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        className="btn-primary px-3 py-1.5 text-xs"
                        onClick={() => handleAnswerQuery(item)}
                        disabled={item.status === "RESOLVED"}
                      >
                        {item.status === "RESOLVED"
                          ? "Answered"
                          : item.user_response
                            ? "Answer Again"
                            : "Answer Query"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={8}>
                      No fraud queries available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </motion.section>
    </main>
  );
}
