import { useEffect, useState } from "react";
import { getAdminOpsReports } from "../api";
import AdminSidebar from "../components/AdminSidebar";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminOperationsReportsPage() {
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(defaultEnd());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = () => {
    setLoading(true);
    setError("");
    getAdminOpsReports({ start_date: startDate, end_date: endDate })
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load report.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                Operations Reports
              </h1>
              <p className="mt-2 text-slate-300">
                Time-bound performance summaries.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                className="input-dark"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                className="input-dark"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={fetchReport}
                disabled={loading}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => exportCsv(data)}
                disabled={!data}
              >
                Export CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading...</div>
          ) : error ? (
            <div className="mt-6 text-rose-200">{error}</div>
          ) : data ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-slate-300">
                <p className="text-sm">Window</p>
                <p className="text-lg font-semibold text-white">
                  {data.start_date} → {data.end_date}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(() => {
                  const totalTransacted = Number(
                    data.summary.total_amount_transacted ??
                      data.summary.total_amount_transactions ??
                      data.summary.total_amount ??
                      data.summary.total_value ??
                      data.summary.total_volume ??
                      0,
                  );
                  return (
                    <Card
                      label="Total Amount Transacted"
                      value={`₹ ${totalTransacted.toFixed(2)}`}
                      accent="text-cyan-200"
                    />
                  );
                })()}
                <Card
                  label="Transactions"
                  value={data.summary.total_transactions}
                  accent="text-cyan-200"
                />
                <Card
                  label="Safe Transactions"
                  value={
                    data.summary.safe_count ??
                    Math.max(
                      0,
                      data.summary.total_transactions -
                        data.summary.fraud_count,
                    )
                  }
                  accent="text-emerald-200"
                />
                <Card
                  label="Fraud Cases"
                  value={data.summary.fraud_count}
                  accent="text-rose-200"
                />
                <Card
                  label="Fraud Rate"
                  value={`${data.summary.fraud_rate.toFixed(2)}%`}
                  accent="text-amber-200"
                />
                <Card
                  label="Total Cashback Given"
                  value={`₹ ${Number(data.summary.total_cashback_given ?? 0).toFixed(2)}`}
                  accent="text-emerald-200"
                />
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  Top Flagged User
                </p>
                <p className="mt-2 text-lg text-white">
                  {data.summary.top_flagged_user || "N/A"}
                </p>
                <p className="text-sm text-slate-400">
                  Highest average fraud score across window.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-slate-400">No report data.</div>
          )}
        </div>
      </div>
    </main>
  );
}

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function defaultEnd() {
  return new Date().toISOString().slice(0, 10);
}

function exportCsv(data) {
  if (!data) return;
  const rows = [
    ["Start Date", data.start_date],
    ["End Date", data.end_date],
    ["Total Transactions", data.summary.total_transactions],
    [
      "Safe Transactions",
      data.summary.safe_count ??
        Math.max(0, data.summary.total_transactions - data.summary.fraud_count),
    ],
    ["Fraud Count", data.summary.fraud_count],
    ["Fraud Rate %", data.summary.fraud_rate],
    [
      "Total Cashback Given",
      Number(data.summary.total_cashback_given ?? 0).toFixed(2),
    ],
    [
      "Total Amount Transacted",
      Number(
        data.summary.total_amount_transacted ??
          data.summary.total_amount_transactions ??
          data.summary.total_amount ??
          data.summary.total_value ??
          data.summary.total_volume ??
          0,
      ).toFixed(2),
    ],
    ["Top Flagged User", data.summary.top_flagged_user || ""],
  ];
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `admin-ops-report-${data.start_date}-to-${data.end_date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
