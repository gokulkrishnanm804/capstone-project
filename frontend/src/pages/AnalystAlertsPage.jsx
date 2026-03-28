import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminOpsAlerts, markAdminOpsAlertReviewed } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const STATUS_COLORS = {
  FRAUD: "bg-rose-500/20 text-rose-200",
  SUSPICIOUS: "bg-amber-500/20 text-amber-200",
};

export default function AdminOperationsAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("unreviewed");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reviewedFlag =
    filter === "reviewed" ? true : filter === "unreviewed" ? false : null;

  const load = () => {
    setLoading(true);
    getAdminOpsAlerts({
      reviewed: reviewedFlag === null ? undefined : reviewedFlag,
    })
      .then((res) => {
        const rows = (res.data.alerts || []).map((item) => ({
          ...item,
          isReviewed:
            reviewedFlag === true
              ? true
              : reviewedFlag === false
                ? false
                : false,
        }));
        setAlerts(rows);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load alerts.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const markReviewed = async (transactionId) => {
    setSubmitting(true);
    try {
      await markAdminOpsAlertReviewed(transactionId);
      setAlerts((rows) =>
        rows.map((row) =>
          row.transaction_id === transactionId
            ? { ...row, isReviewed: true }
            : row,
        ),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to mark alert."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                Alerts
              </h1>
              <p className="mt-2 text-slate-300">
                Newest fraud and suspicious events.
              </p>
            </div>
            <div className="flex gap-2">
              <select
                className="input-dark"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="reviewed">Reviewed</option>
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={load}
                disabled={loading}
              >
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading...</div>
          ) : error ? (
            <div className="mt-6 text-rose-200">{error}</div>
          ) : (
            <div className="mt-6 space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.transaction_id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm text-slate-200">
                      <Link
                        to={`/admin/operations/transactions/${alert.transaction_id}`}
                        className="text-cyan-200 hover:text-cyan-100"
                      >
                        {alert.transaction_id}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${STATUS_COLORS[alert.prediction] || "bg-slate-700 text-slate-200"}`}
                      >
                        {alert.prediction}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Sender: {alert.sender_name}
                    </p>
                    <p className="text-sm text-slate-400">
                      Amount: ₹ {alert.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Fraud Score
                      </p>
                      <p className="text-lg font-semibold text-amber-300">
                        {(alert.fraud_score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={submitting || alert.isReviewed === true}
                      onClick={() => markReviewed(alert.transaction_id)}
                    >
                      {alert.isReviewed ? "Reviewed" : "Mark Reviewed"}
                    </button>
                  </div>
                </div>
              ))}
              {!alerts.length && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-400">
                  No alerts found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
