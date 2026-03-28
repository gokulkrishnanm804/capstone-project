import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminTransactions } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const STATUS_COLORS = {
  FRAUD: "bg-rose-500/20 text-rose-200",
  SUSPICIOUS: "bg-amber-500/20 text-amber-200",
  SAFE: "bg-emerald-500/20 text-emerald-200",
};

export default function AdminTransactionManagementPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    transaction_type: "",
    search: "",
  });
  const [meta, setMeta] = useState({ total: 0, page_size: 20, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    getAdminTransactions({
      status: filters.status || undefined,
      transaction_type: filters.transaction_type || undefined,
      search: filters.search || undefined,
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
                Transaction Management
              </h1>
              <p className="mt-1 text-slate-300">
                Override fraud decisions with full visibility.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <select
              className="input-dark"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
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
                setFilters({ ...filters, transaction_type: e.target.value })
              }
            >
              <option value="">All Types</option>
              <option value="UPI">UPI</option>
              <option value="CARD">CARD</option>
              <option value="ACCOUNT_TRANSFER">Account Transfer</option>
            </select>
            <input
              className="input-dark md:col-span-2"
              placeholder="Search txn id or user"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
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
            <div className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70">
              <table className="min-w-full text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.transaction_id}
                      className="border-t border-slate-800"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-cyan-200 hover:text-cyan-100"
                          onClick={() =>
                            navigate(
                              `/admin/transactions/${row.transaction_id}`,
                            )
                          }
                        >
                          {row.transaction_id}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p>{row.user_name}</p>
                        <p className="text-xs text-slate-400">
                          {row.user_email}
                        </p>
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
