import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getSupportQueries } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AnalystPendingQueriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getSupportQueries({
        status: "OPEN",
        query_type: "ANALYST_TO_USER",
        limit: 300,
      });
      setRows(response.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load pending queries."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          Pending Queries
        </h1>
        <p className="mt-2 text-slate-300">
          Open analyst queries, including reopened user responses that need
          another clarification.
        </p>

        <div className="mt-5">
          <button type="button" className="btn-secondary" onClick={loadRows}>
            Refresh
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          {loading ? (
            <p className="text-slate-300">Loading pending queries...</p>
          ) : (
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Query ID</th>
                  <th className="pb-3">Case ID</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Question</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {rows.map((item) => (
                  <tr key={item.query_id}>
                    <td className="py-3 font-mono text-xs">{item.query_id}</td>
                    <td className="py-3 font-mono text-xs">
                      {item.case_id || "-"}
                    </td>
                    <td className="py-3">
                      <p>{item.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.user_email}
                      </p>
                    </td>
                    <td className="py-3 max-w-[420px]">{item.message}</td>
                    <td className="py-3">
                      {!item.user_response || !item.user_response.trim()
                        ? "OPEN"
                        : "REOPENED"}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={5}>
                      No pending query IDs at this time.
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
