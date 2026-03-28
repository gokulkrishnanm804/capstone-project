import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, Activity, ShieldCheck, ShieldOff } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminOpsDashboard } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminOperationsDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminOpsDashboard()
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(
          getApiErrorMessage(err, "Unable to load operations dashboard."),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Today", value: data?.total_today ?? 0, icon: Activity },
    { label: "Flagged", value: data?.flagged_today ?? 0, icon: AlertTriangle },
    { label: "Blocked", value: data?.blocked_today ?? 0, icon: ShieldOff },
    { label: "Safe", value: data?.safe_today ?? 0, icon: ShieldCheck },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                Admin Operations Dashboard
              </h1>
              <p className="mt-2 text-slate-300">
                Operational view for admin-led fraud response.
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setLoading(true);
                setError("");
                getAdminOpsDashboard()
                  .then((res) => setData(res.data))
                  .catch((err) =>
                    setError(
                      getApiErrorMessage(
                        err,
                        "Unable to load operations dashboard.",
                      ),
                    ),
                  )
                  .finally(() => setLoading(false));
              }}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">
              Loading operations dashboard...
            </div>
          ) : error ? (
            <div className="mt-6 text-rose-200">{error}</div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow"
                    >
                      <div className="flex items-center justify-between text-slate-200">
                        <p className="text-sm text-slate-400">{card.label}</p>
                        <Icon className="h-5 w-5 text-cyan-300" />
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {card.value}
                      </p>
                    </div>
                  );
                })}
              </div>

              <section className="mt-8 grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">
                      Fraud Trend (7 days)
                    </p>
                  </div>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data?.fraud_trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                          dataKey="label"
                          stroke="#94a3b8"
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#1e293b",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="fraud"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name="Fraud"
                        />
                        <Line
                          type="monotone"
                          dataKey="normal"
                          stroke="#22d3ee"
                          strokeWidth={2}
                          dot={false}
                          name="Safe"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-sm font-semibold text-slate-200">
                    Live Alerts
                  </p>
                  <div className="mt-3 space-y-3">
                    {(data?.alerts || []).map((alert) => (
                      <div
                        key={alert.transaction_id}
                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{alert.transaction_id}</span>
                          <span>
                            {new Date(alert.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-white">
                          ₹ {alert.amount.toFixed(2)} • {alert.sender_name}
                        </p>
                        <p className="text-xs text-orange-300">
                          Fraud Score: {(alert.fraud_score * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                    {!data?.alerts?.length && (
                      <p className="text-slate-500 text-sm">No alerts.</p>
                    )}
                  </div>
                </div>
              </section>

              <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  Top 5 Risky Users
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm text-slate-200">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Txns</th>
                        <th className="py-2 pr-4">Avg Fraud Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.risky_users || []).map((row) => (
                        <tr
                          key={row.user_id}
                          className="border-t border-slate-800"
                        >
                          <td className="py-2 pr-4">{row.user_name}</td>
                          <td className="py-2 pr-4">{row.transaction_count}</td>
                          <td className="py-2 pr-4">
                            {(row.avg_fraud_score * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                      {!data?.risky_users?.length && (
                        <tr>
                          <td className="py-3 text-slate-500" colSpan={3}>
                            No data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
