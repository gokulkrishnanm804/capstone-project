import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAnalystTransactions } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AnalystTransactionsPage() {
  const PAGE_SIZE = 20;
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [predictionFilter, setPredictionFilter] = useState("ALL");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchRows = async ({ keepLoading = false } = {}) => {
    if (keepLoading) setLoading(true);
    setError("");
    try {
      const response = await getAnalystTransactions({
        limit: 100,
        prediction: predictionFilter === "ALL" ? undefined : predictionFilter,
      });
      const nextRows = response.data || [];
      setRows(nextRows);
      setLastUpdated(new Date());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load live transactions."));
    } finally {
      if (keepLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows({ keepLoading: true });
    setCurrentPage(1);
    const intervalId = window.setInterval(() => {
      fetchRows({ keepLoading: false });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [predictionFilter]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const paginatedRows = rows.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleSelectRow = (row) => {
    navigate(`/analyst/transactions/${row.transaction_id}`, { state: { row } });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          Live Transactions Monitor
        </h1>
        <p className="mt-2 text-slate-300">
          Real-time feed of user transactions with fraud or safe decision and
          SHAP explanation on selection.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <select
            className="input-dark max-w-[200px]"
            value={predictionFilter}
            onChange={(event) => setPredictionFilter(event.target.value)}
          >
            <option value="ALL">All Decisions</option>
            <option value="FRAUD">Fraud Only</option>
            <option value="SAFE">Safe Only</option>
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fetchRows({ keepLoading: true })}
          >
            Refresh Now
          </button>
          <p className="text-xs text-slate-400">
            Auto refresh: every 10 seconds
            {lastUpdated
              ? ` | Last update: ${lastUpdated.toLocaleTimeString()}`
              : ""}
          </p>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <p className="mt-4 text-sm text-slate-300">
          Tap any transaction row to view fraud and SHAP details.
        </p>

        {!loading && !!rows.length && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <p>
              Showing {startIndex + 1}-{Math.min(endIndex, rows.length)} of{" "}
              {rows.length} transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {safeCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          {loading ? (
            <p className="text-slate-300">Loading live transactions...</p>
          ) : (
            <table className="w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Time</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">From</th>
                  <th className="pb-3">To</th>
                  <th className="pb-3">Amount</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Risk</th>
                  <th className="pb-3">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {paginatedRows.map((row) => {
                  return (
                    <tr
                      key={row.transaction_id}
                      className="cursor-pointer transition hover:bg-slate-900/50"
                      onClick={() => handleSelectRow(row)}
                      onTouchStart={() => handleSelectRow(row)}
                    >
                      <td className="py-3">
                        {new Date(row.date).toLocaleString()}
                      </td>
                      <td className="py-3">
                        <p>{row.user_name}</p>
                        <p className="text-xs text-slate-400">
                          {row.user_email}
                        </p>
                      </td>
                      <td className="py-3 font-mono text-xs">
                        {row.sender_name} ({row.sender_account})
                      </td>
                      <td className="py-3 font-mono text-xs">
                        {row.receiver_name} ({row.receiver_account})
                      </td>
                      <td className="py-3 font-semibold">
                        INR {row.amount.toFixed(2)}
                      </td>
                      <td className="py-3">{row.transaction_type}</td>
                      <td className="py-3">
                        {(row.risk_score * 100).toFixed(1)}%
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.prediction === "FRAUD"
                              ? "bg-rose-500/20 text-rose-200"
                              : "bg-emerald-500/20 text-emerald-200"
                          }`}
                        >
                          {row.prediction}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!paginatedRows.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={8}>
                      No transactions available for this filter.
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
