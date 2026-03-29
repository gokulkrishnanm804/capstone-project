import { useEffect, useState } from "react";
import {
  executeMyHighRiskTransaction,
  getMyHighRiskTransactions,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const STATUS_STYLES = {
  PENDING: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
  DENIED: "bg-rose-500/15 text-rose-200 border border-rose-500/30",
  EXECUTED: "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30",
};

const HIGH_RISK_STATUS = {
  ALL: "ALL",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  EXECUTED: "EXECUTED",
};

const STATUS_OPTIONS = [
  { value: HIGH_RISK_STATUS.ALL, label: "All" },
  { value: HIGH_RISK_STATUS.PENDING, label: "Pending" },
  { value: HIGH_RISK_STATUS.APPROVED, label: "Approved" },
  { value: HIGH_RISK_STATUS.DENIED, label: "Denied" },
  { value: HIGH_RISK_STATUS.EXECUTED, label: "Executed" },
];

function formatDate(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UserFraudQueriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [executingId, setExecutingId] = useState("");
  const [statusFilter, setStatusFilter] = useState(HIGH_RISK_STATUS.ALL);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
      };
      if (statusFilter !== HIGH_RISK_STATUS.ALL) {
        params.status = statusFilter;
      }
      const res = await getMyHighRiskTransactions(params);
      setRows(res.data || []);
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to load high-risk transactions."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const executeTransfer = async (transactionId) => {
    setError("");
    setSuccess("");
    setExecutingId(transactionId);
    try {
      const res = await executeMyHighRiskTransaction(transactionId);
      const cashback = Number(res.data?.cashback_earned || 0);
      setSuccess(
        `Transfer completed. Cashback credited: INR ${cashback.toFixed(2)}.`,
      );
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to execute transfer."));
    } finally {
      setExecutingId("");
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-white">
        High-Risk Transaction Approvals
      </h1>
      <p className="mt-1 text-slate-300">
        Track admin decisions for high-risk transfers. Execute only approved
        transactions.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-200">
        <label className="text-slate-300" htmlFor="status-filter">
          Status
        </label>
        <select
          id="status-filter"
          className="input-dark"
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value);
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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

      <section className="glass mt-6 overflow-x-auto rounded-2xl p-5">
        {loading ? (
          <p className="text-slate-300">Loading high-risk transactions...</p>
        ) : (
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-3">Transaction ID</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Receiver</th>
                <th className="pb-3">Risk</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Admin Message</th>
                <th className="pb-3">Created</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-slate-200">
              {rows.map((row) => {
                const canExecute = row.status === HIGH_RISK_STATUS.APPROVED;
                const busy = executingId === row.transaction_id;
                return (
                  <tr key={row.query_id}>
                    <td className="py-3 font-mono text-xs text-cyan-100">
                      {row.transaction_id}
                    </td>
                    <td className="py-3">INR {Number(row.amount).toFixed(2)}</td>
                    <td className="py-3 text-slate-300">
                      {row.receiver_name || "-"}
                      {row.receiver_account ? ` (${row.receiver_account})` : ""}
                    </td>
                    <td className="py-3">{row.risk_percentage}%</td>
                    <td className="py-3">{row.transaction_type}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[row.status] || "bg-slate-700 text-slate-200"}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 max-w-[360px] text-slate-300">
                      {row.admin_message || row.transaction_note || "-"}
                    </td>
                    <td className="py-3 text-slate-300">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="py-3">
                      {canExecute ? (
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => executeTransfer(row.transaction_id)}
                        >
                          {busy ? "Executing..." : "Transfer Now"}
                        </button>
                      ) : row.status === HIGH_RISK_STATUS.PENDING ? (
                        <span className="text-xs text-amber-300">Waiting approval</span>
                      ) : row.status === HIGH_RISK_STATUS.DENIED ? (
                        <span className="text-xs text-rose-300">Transaction denied</span>
                      ) : (
                        <span className="text-xs text-cyan-300">Transferred</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={9}>
                    No high-risk transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>Page {page}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary px-3 py-1"
              disabled={page === 1 || loading}
              onClick={() => setPage((old) => Math.max(1, old - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary px-3 py-1"
              disabled={rows.length < PAGE_SIZE || loading}
              onClick={() => setPage((old) => old + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
