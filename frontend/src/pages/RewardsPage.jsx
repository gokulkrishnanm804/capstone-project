import { motion } from "framer-motion";
import { Coins, Gift, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { getRewards } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function RewardsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRewards = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getRewards();
        setData(response.data);
      } catch (err) {
        setError(getApiErrorMessage(err, "Unable to load rewards."));
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">
              Rewards
            </h1>
            <p className="mt-2 text-slate-300">
              Earn cashback on every successful transfer.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-3 text-cyan-100">
            <p className="text-xs uppercase tracking-wide text-cyan-200/80">
              Program Rule
            </p>
            <p className="mt-1 text-sm font-semibold">
              1st transfer: INR 21-100
            </p>
            <p className="text-sm font-semibold">
              Every next transfer: INR 1-10
            </p>
          </div>
        </div>

        {loading && <p className="mt-6 text-slate-300">Loading rewards...</p>}

        {error && (
          <p className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        {!loading && !error && data && (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <KpiCard
                icon={Coins}
                label="Total Cashback"
                value={`INR ${Number(data.total_cashback || 0).toFixed(2)}`}
              />
              <KpiCard
                icon={Gift}
                label="Rewarded Transfers"
                value={`${data.transaction_count || 0}`}
              />
              <KpiCard
                icon={Trophy}
                label="Welcome Bonus"
                value={data.first_bonus_awarded ? "Unlocked" : "Pending"}
              />
            </div>

            <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/40 p-4">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-3">Date</th>
                    <th className="pb-3">Transaction ID</th>
                    <th className="pb-3">Counterparty</th>
                    <th className="pb-3">Transfer</th>
                    <th className="pb-3">Cashback</th>
                    <th className="pb-3">Reward Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {(data.rewards || []).map((item) => (
                    <tr key={item.transaction_id}>
                      <td className="py-3">
                        {new Date(item.date).toLocaleString()}
                      </td>
                      <td className="py-3 font-mono text-xs">
                        {item.transaction_id}
                      </td>
                      <td className="py-3">{item.counterparty}</td>
                      <td className="py-3">
                        INR {Number(item.transfer_amount).toFixed(2)}
                      </td>
                      <td className="py-3 font-semibold text-emerald-300">
                        + INR {Number(item.cashback_amount).toFixed(2)}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-cyan-500/20 px-2 py-1 text-xs font-semibold text-cyan-100">
                          {item.reward_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.rewards?.length && (
                    <tr>
                      <td className="py-7 text-slate-400" colSpan={6}>
                        No cashback entries yet. Complete a Send Money transfer
                        to earn rewards.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </motion.section>
    </main>
  );
}

function KpiCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon className="h-5 w-5 text-cyan-200" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
