import { useEffect, useState } from "react";
import { getTransactions } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function TransactionHistoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    fraud_only: false,
    start_date: "",
    direction: "ALL",
  });

  const fetchRows = async (params) => {
    setLoading(true);
    setError("");
    try {
      const response = await getTransactions(params);
      setRows(response.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load history."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows({});
  }, []);

  const applyFilters = () => {
    fetchRows({
      fraud_only: filters.fraud_only,
      start_date: filters.start_date || undefined,
      direction: filters.direction === "ALL" ? undefined : filters.direction,
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-white">
        Transaction History
      </h1>
      <p className="mt-1 text-slate-300">
        Filter your transactions by fraud status, date, and money flow.
      </p>

      <section className="glass mt-6 rounded-2xl p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-2 rounded-xl border border-slate-700/70 bg-slate-900/45 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={filters.fraud_only}
              onChange={(event) =>
                setFilters((old) => ({
                  ...old,
                  fraud_only: event.target.checked,
                }))
              }
            />
            Fraud Only
          </label>
          <input
            type="date"
            className="input-dark"
            value={filters.start_date}
            onChange={(event) =>
              setFilters((old) => ({ ...old, start_date: event.target.value }))
            }
          />
          <select
            className="input-dark"
            value={filters.direction}
            onChange={(event) =>
              setFilters((old) => ({ ...old, direction: event.target.value }))
            }
          >
            <option value="ALL">All Transactions</option>
            <option value="CREDIT">Money Added (+)</option>
            <option value="DEBIT">Money Debited (-)</option>
          </select>
          <button type="button" className="btn-primary" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>
      </section>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <section className="glass mt-4 overflow-x-auto rounded-2xl p-5">
        {loading ? (
          <p className="text-slate-300">Loading history...</p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-3">Date</th>
                <th className="pb-3">Counterparty</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Location</th>
                <th className="pb-3">Device</th>
                <th className="pb-3">Risk</th>
                <th className="pb-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {rows.map((row) => (
                <tr key={row.transaction_id}>
                  <td className="py-3">
                    {new Date(row.date).toLocaleString()}
                  </td>
                  <td className="py-3">{row.counterparty}</td>
                  <td className="py-3">
                    <p
                      className={`font-semibold ${
                        row.direction === "CREDIT"
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }`}
                    >
                      {row.direction === "CREDIT" ? "+" : "-"} INR{" "}
                      {row.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {row.direction === "CREDIT"
                        ? "Money Added"
                        : "Money Debited"}
                    </p>
                  </td>
                  <td className="py-3">{row.transaction_type}</td>
                  <td className="py-3">{row.location}</td>
                  <td className="py-3">{row.device_type}</td>
                  <td className="py-3">{(row.risk_score * 100).toFixed(1)}%</td>
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
              ))}
              {!rows.length && (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={8}>
                    No transactions match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
