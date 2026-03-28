import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeIndianRupee,
  Gift,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { getRewards, getSimulationContext, getTransactions } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

function formatCurrency(value) {
  return `INR ${Number(value || 0).toFixed(2)}`;
}

function SnapshotCard({ icon: Icon, title, value, helper, tone = "cyan" }) {
  const toneClass = {
    cyan: "text-cyan-200 border-cyan-400/35 bg-cyan-500/10",
    emerald: "text-emerald-200 border-emerald-400/35 bg-emerald-500/10",
    rose: "text-rose-200 border-rose-400/35 bg-rose-500/10",
    indigo: "text-indigo-200 border-indigo-400/35 bg-indigo-500/10",
  };

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-400">{title}</p>
        <div
          className={`rounded-xl border p-2 ${toneClass[tone] || toneClass.cyan}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [context, setContext] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [rewards, setRewards] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSimulationContext(), getTransactions(), getRewards()])
      .then(([contextResponse, transactionResponse, rewardResponse]) => {
        setContext(contextResponse.data);
        setTransactions(transactionResponse.data || []);
        setRewards(rewardResponse.data || null);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "Failed to load UPI dashboard."));
      })
      .finally(() => setLoading(false));
  }, []);

  const overview = useMemo(() => {
    const total = transactions.length;
    const debitAmount = transactions
      .filter((tx) => tx.direction === "DEBIT")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const creditAmount = transactions
      .filter((tx) => tx.direction === "CREDIT")
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const safeRate = total
      ? (
          (transactions.filter((tx) => tx.prediction === "SAFE").length /
            total) *
          100
        ).toFixed(1)
      : "100.0";

    return {
      balance: context?.sender_account?.balance || 0,
      accountNumber: context?.sender_account?.account_number || "-",
      total,
      debitAmount,
      creditAmount,
      safeRate,
      rewardTotal: Number(rewards?.total_cashback || 0),
    };
  }, [context, transactions, rewards]);

  const recentTransactions = transactions.slice(0, 7);
  const beneficiaries = (context?.receivers || []).slice(0, 6);

  if (loading) {
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading your UPI dashboard...
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.15),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_42%),rgba(7,12,35,0.9)] p-6 sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative grid gap-6 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <p className="text-sm text-cyan-200/85">Welcome back</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">
              {user?.name || "UPI User"}
            </h1>
            <p className="mt-2 max-w-xl text-slate-300">
              Fast, secure, and reward-first payments. Track money movement,
              cashback, and account health from one UPI-style dashboard.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link to="/simulate" className="btn-primary w-full">
                Send Money
              </Link>
              <Link to="/rewards" className="btn-secondary w-full">
                View Rewards
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-300/30 bg-slate-950/55 p-5 shadow-[0_16px_45px_-20px_rgba(6,182,212,0.55)]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Main Wallet</p>
              <Wallet className="h-5 w-5 text-cyan-200" />
            </div>
            <p className="mt-3 font-display text-4xl font-bold text-white">
              {formatCurrency(overview.balance)}
            </p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
              Account {overview.accountNumber}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                <p className="text-slate-400">Spent</p>
                <p className="mt-1 font-semibold text-rose-200">
                  - {formatCurrency(overview.debitAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                <p className="text-slate-400">Received</p>
                <p className="mt-1 font-semibold text-emerald-200">
                  + {formatCurrency(overview.creditAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {error && (
        <p className="mt-5 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SnapshotCard
          icon={Gift}
          title="Cashback Earned"
          value={formatCurrency(overview.rewardTotal)}
          helper="Rewards credited from successful transfers"
          tone="emerald"
        />
        <SnapshotCard
          icon={BadgeIndianRupee}
          title="Total UPI Txns"
          value={`${overview.total}`}
          helper="Debit + credit transactions"
          tone="indigo"
        />
        <SnapshotCard
          icon={ShieldCheck}
          title="Safety Score"
          value={`${overview.safeRate}%`}
          helper="Safe predictions in your history"
          tone="cyan"
        />
        <SnapshotCard
          icon={Users}
          title="Beneficiaries"
          value={`${beneficiaries.length}`}
          helper="Saved accounts available for transfer"
          tone="rose"
        />
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-white">
              Recent Activity
            </h2>
            <Link
              to="/history"
              className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
            >
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentTransactions.map((tx) => {
              const isCredit = tx.direction === "CREDIT";
              return (
                <div
                  key={tx.transaction_id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/45 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-xl p-2 ${
                        isCredit
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {tx.counterparty || "Counterparty"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(tx.date).toLocaleString()} •{" "}
                        {tx.transaction_type}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        isCredit ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {isCredit ? "+" : "-"} {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-slate-400">{tx.prediction}</p>
                  </div>
                </div>
              );
            })}

            {!recentTransactions.length && (
              <p className="rounded-xl border border-slate-800/70 bg-slate-900/45 px-4 py-5 text-sm text-slate-400">
                No activity yet. Use Send Money to start your first transfer.
              </p>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="font-display text-xl font-semibold text-white">
            Quick Pay
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Tap a beneficiary and continue on the transfer screen.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
            {beneficiaries.map((receiver) => (
              <Link
                key={receiver.account_number}
                to="/simulate"
                className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-3 transition hover:border-cyan-300/45 hover:bg-cyan-500/10"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-200">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-slate-100">
                  {receiver.owner_name}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {receiver.account_number}
                </p>
              </Link>
            ))}
          </div>

          {!beneficiaries.length && (
            <p className="mt-4 rounded-xl border border-slate-800/70 bg-slate-900/45 px-4 py-5 text-sm text-slate-400">
              Beneficiaries will appear here as accounts are available.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
