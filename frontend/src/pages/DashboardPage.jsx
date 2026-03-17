import { motion } from "framer-motion";
import { Activity, Landmark, ShieldAlert, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getSimulationContext, getTransactions } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

function StatCard({ icon: Icon, label, value, tone = "cyan" }) {
  const toneClasses = {
    cyan: "text-cyan-200",
    rose: "text-rose-200",
    mint: "text-emerald-200",
    violet: "text-indigo-200",
  };
  return (
    <div className="glass rounded-2xl p-5">
      <Icon className={`h-5 w-5 ${toneClasses[tone] || toneClasses.cyan}`} />
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [context, setContext] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSimulationContext(), getTransactions()])
      .then(([contextResponse, transactionResponse]) => {
        setContext(contextResponse.data);
        setTransactions(transactionResponse.data || []);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "Failed to load dashboard data."));
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = transactions.length;
    const fraudCount = transactions.filter(
      (item) => item.prediction === "FRAUD",
    ).length;
    const avgRisk = total
      ? (
          (transactions.reduce((sum, item) => sum + item.risk_score, 0) /
            total) *
          100
        ).toFixed(1)
      : "0.0";
    return {
      total,
      fraudCount,
      avgRisk,
      balance: context?.sender_account?.balance?.toFixed(2) || "0.00",
      accountNumber: context?.sender_account?.account_number || "-",
    };
  }, [transactions, context]);

  if (loading) {
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading dashboard...
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-6"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          User Dashboard
        </h1>
        <p className="mt-1 text-slate-300">
          Monitor account health, transaction outcomes, and fraud exposure.
        </p>
      </motion.div>

      {error && (
        <p className="mb-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Account Balance"
          value={`INR ${stats.balance}`}
          tone="mint"
        />
        <StatCard
          icon={Landmark}
          label="Primary Account"
          value={stats.accountNumber}
          tone="violet"
        />
        <StatCard
          icon={ShieldAlert}
          label="Fraud Flagged"
          value={stats.fraudCount}
          tone="rose"
        />
        <StatCard
          icon={Activity}
          label="Avg Risk Score"
          value={`${stats.avgRisk}%`}
          tone="cyan"
        />
      </section>

      <section className="glass mt-7 rounded-2xl p-5">
        <h2 className="font-display text-xl font-semibold text-white">
          Recent Transactions
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-3">Date</th>
                <th className="pb-3">Receiver</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Amount</th>
                <th className="pb-3">Risk</th>
                <th className="pb-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {transactions.slice(0, 8).map((row) => (
                <tr key={row.transaction_id} className="text-slate-200">
                  <td className="py-3">
                    {new Date(row.date).toLocaleString()}
                  </td>
                  <td className="py-3">{row.receiver}</td>
                  <td className="py-3">{row.transaction_type}</td>
                  <td className="py-3">INR {row.amount.toFixed(2)}</td>
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
              {!transactions.length && (
                <tr>
                  <td className="py-6 text-slate-400" colSpan={6}>
                    No transactions available yet. Start with the Simulation
                    page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
