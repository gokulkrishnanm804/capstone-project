import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminOverview } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminOverview()
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load admin overview.")),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="font-display text-3xl font-bold text-white">
              Admin Command Center
            </h1>
            <p className="mt-1 text-slate-300">
              Observe system health, model posture, and recent actions.
            </p>
          </motion.div>

          {loading ? (
            <div className="mt-10 text-slate-300">Loading dashboard...</div>
          ) : error ? (
            <div className="mt-10 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard label="Total Users" value={data.total_users} />
                <KpiCard
                  label="Total Transactions"
                  value={data.total_transactions}
                />
                <KpiCard label="Fraud Rate" value={`${data.fraud_rate}%`} />
                <KpiCard
                  label="Total Cashback Given"
                  value={`₹ ${data.total_cashback.toLocaleString()}`}
                />
                <KpiCard
                  label="System Status"
                  value={data.system_status}
                  highlight={data.system_status === "ONLINE" ? "ok" : "alert"}
                />
              </section>

              <section className="grid gap-4 xl:grid-cols-2">
                <div className="glass min-w-0 rounded-2xl p-5">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Transactions Trend (Last 7 Days)
                  </h2>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={0}
                      minHeight={1}
                    >
                      <LineChart data={data.fraud_trend || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                          tickFormatter={(value) =>
                            new Date(value).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <YAxis
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#1e293b",
                          }}
                          labelFormatter={(value) =>
                            new Date(value).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          }
                        />
                        <Legend />
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

                <div className="glass min-w-0 rounded-2xl p-5">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Transactions by Type
                  </h2>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={0}
                      minHeight={1}
                    >
                      <BarChart data={data.transaction_types || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey="type"
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                        />
                        <YAxis
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#1e293b",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="count"
                          fill="#38bdf8"
                          radius={[6, 6, 0, 0]}
                          name="Transactions"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>

              <section className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Recent Activity
                    </h2>
                    <p className="text-sm text-slate-400">
                      Last 10 actions across all roles.
                    </p>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="pb-2">Timestamp</th>
                        <th className="pb-2">Actor</th>
                        <th className="pb-2">Action</th>
                        <th className="pb-2">Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {data.recent_activity.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 text-xs text-slate-400">
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2">
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">
                              {item.actor_role}
                            </span>
                            <span className="ml-2 text-slate-200">
                              {item.actor_name}
                            </span>
                          </td>
                          <td className="py-2">{item.action}</td>
                          <td className="py-2 text-slate-300">{item.target}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function KpiCard({ label, value, highlight }) {
  const tone = highlight === "alert" ? "text-amber-200" : "text-emerald-200";
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p
        className={`mt-2 font-display text-3xl font-semibold text-white ${highlight ? tone : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
