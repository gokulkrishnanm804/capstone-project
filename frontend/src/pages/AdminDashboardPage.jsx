import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getFraudAnalytics } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const riskColors = ["#34d399", "#facc15", "#fb7185"];

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getFraudAnalytics()
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load admin analytics.")),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading analytics...
      </div>
    );
  if (error) return <div className="px-6 py-6 text-rose-200">{error}</div>;
  if (!data) return null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-display text-3xl font-bold text-white">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-slate-300">
          System-wide risk posture and transaction intelligence.
        </p>
      </motion.div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Users" value={data.total_users} />
        <KpiCard label="Transactions" value={data.total_transactions} />
        <KpiCard label="Fraud Detected" value={data.fraud_detected} />
        <KpiCard label="Fraud Percentage" value={`${data.fraud_percentage}%`} />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="glass min-w-0 rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">
            Fraud Trend
          </h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={1}
            >
              <BarChart data={data.fraud_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#cbd5e1", fontSize: 11 }}
                />
                <YAxis tick={{ fill: "#cbd5e1", fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="normal" fill="#22c55e" />
                <Bar dataKey="fraud" fill="#f43f5e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass min-w-0 rounded-2xl p-5">
          <h2 className="font-display text-lg font-semibold text-white">
            Risk Distribution
          </h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={1}
            >
              <PieChart>
                <Pie
                  data={data.risk_distribution}
                  dataKey="value"
                  nameKey="label"
                  outerRadius={95}
                  label
                >
                  {data.risk_distribution.map((_, index) => (
                    <Cell
                      key={index}
                      fill={riskColors[index % riskColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="glass min-w-0 mt-6 rounded-2xl p-5">
        <h2 className="font-display text-lg font-semibold text-white">
          Transaction Volume by Type
        </h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={1}
          >
            <BarChart data={data.transaction_volume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
              <YAxis
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip />
              <Bar dataKey="count" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
