import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminOpsTransactions } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const STATUS_COLORS = {
  FRAUD: "bg-rose-500/20 text-rose-200",
  SUSPICIOUS: "bg-amber-500/20 text-amber-200",
  SAFE: "bg-emerald-500/20 text-emerald-200",
};

export default function AdminOperationsTransactionMonitorPage() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    transaction_type: "",
    search: "",
    start_date: "",
    end_date: "",
    min_amount: "",
    max_amount: "",
  });
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page_size: 20, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    getAdminOpsTransactions({
      status: filters.status || undefined,
      transaction_type: filters.transaction_type || undefined,
      search: filters.search || undefined,
      start_date: filters.start_date || undefined,
      end_date: filters.end_date || undefined,
      min_amount: filters.min_amount || undefined,
      max_amount: filters.max_amount || undefined,
      page,
      page_size: meta.page_size,
    })
      .then((res) => {
        setRows(res.data.items || []);
        setMeta({
          total: res.data.total,
          page_size: res.data.page_size,
          total_pages: res.data.total_pages,
        });
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load transactions.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const onFilterChange = (key, value) => {
    setFilters((old) => ({ ...old, [key]: value }));
  };

  const applyFilters = () => {
    setPage(1);
    load();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                Operations Monitor
              </h1>
              <p className="mt-2 text-slate-300">
                Live portfolio of all transactions.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4 lg:grid-cols-6">
            <select
              className="input-dark"
              value={filters.status}
              onChange={(e) => onFilterChange("status", e.target.value)}
            >
              <option value="">All Status</option>
              <option value="FRAUD">Fraud</option>
              <option value="SUSPICIOUS">Suspicious</option>
              <option value="SAFE">Safe</option>
            </select>
            <select
              className="input-dark"
              value={filters.transaction_type}
              onChange={(e) =>
                onFilterChange("transaction_type", e.target.value)
              }
            >
              <option value="">All Types</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
              <option value="TRANSFER">Account Transfer</option>
            </select>
            <input
              className="input-dark"
              type="date"
              value={filters.start_date}
              onChange={(e) => onFilterChange("start_date", e.target.value)}
            />
            <input
              className="input-dark"
              type="date"
              value={filters.end_date}
              onChange={(e) => onFilterChange("end_date", e.target.value)}
            />
            <input
              className="input-dark"
              type="number"
              min="0"
              placeholder="Min amount"
              value={filters.min_amount}
              onChange={(e) => onFilterChange("min_amount", e.target.value)}
            />
            <input
              className="input-dark"
              type="number"
              min="0"
              placeholder="Max amount"
              value={filters.max_amount}
              onChange={(e) => onFilterChange("max_amount", e.target.value)}
            />
            <input
              className="input-dark md:col-span-2 lg:col-span-3"
              placeholder="Search txn id or username"
              value={filters.search}
              onChange={(e) => onFilterChange("search", e.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={applyFilters}
            >
              Apply Filters
            </button>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading...</div>
          ) : error ? (
            <div className="mt-6 text-rose-200">{error}</div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Sender</th>
                    <th className="px-4 py-3">Receiver</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Fraud Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.transaction_id}
                      className={`border-t border-slate-800 ${
                        row.prediction === "FRAUD"
                          ? "bg-rose-500/10"
                          : row.prediction === "SUSPICIOUS"
                            ? "bg-amber-500/10"
                            : "bg-emerald-500/5"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/operations/transactions/${row.transaction_id}`}
                          className="text-cyan-200 hover:text-cyan-100"
                        >
                          {row.transaction_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{row.sender_name}</td>
                      <td className="px-4 py-3">{row.receiver_name}</td>
                      <td className="px-4 py-3">₹ {row.amount.toFixed(2)}</td>
                      <td className="px-4 py-3">{row.transaction_type}</td>
                      <td className="px-4 py-3">
                        {(row.risk_score * 100).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${STATUS_COLORS[row.prediction] || ""}`}
                        >
                          {row.prediction}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(row.date).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td className="px-4 py-4 text-slate-500" colSpan={8}>
                        No transactions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-4 py-3 text-slate-300">
                <span>
                  Page {page} of {meta.total_pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={page >= meta.total_pages}
                    onClick={() =>
                      setPage((p) => Math.min(meta.total_pages, p + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
