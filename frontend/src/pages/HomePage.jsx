import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Fingerprint,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

const featureCards = [
  {
    icon: Activity,
    title: "Fusion Fraud Score",
    description:
      "Random Forest, XGBoost, and Isolation Forest blend into one live risk score tuned for UPI patterns.",
  },
  {
    icon: Wallet,
    title: "Simulation-First Transfers",
    description:
      "Send money in a UPI-like flow while the backend auto-builds model-ready feature vectors—no raw CSV columns exposed.",
  },
  {
    icon: Shield,
    title: "Explainable Decisions",
    description:
      "Every call is backed by SHAP explanations so analysts and end-users can see why a transaction was flagged.",
  },
];

const trustPillars = [
  "JWT-secured sessions with role-based routes",
  "Model fusion weights: 0.4 RF + 0.4 XGB + 0.2 ISO",
  "Rewards ledger to keep users engaged with safe behavior",
  "Admin Ops Reports for governance-grade visibility",
];

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="glass relative overflow-hidden rounded-3xl p-8 sm:p-12">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-16 left-10 h-52 w-52 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              <Fingerprint className="h-4 w-4" /> Secure by SentinelPay
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">
              AI-protected UPI journeys with transparent fraud decisions
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              Move money, earn rewards, and see why every transaction is labeled
              safe or risky. SentinelPay blends simulation, model fusion, and
              explainability so users and analysts stay aligned.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? "/dashboard" : "/login"}
                className="btn-primary"
              >
                {isAuthenticated ? "Go to your dashboard" : "Log in to start"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              {!isAuthenticated && (
                <Link to="/register" className="btn-secondary">
                  Create account
                </Link>
              )}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-cyan-200/85">Live Fusion Snapshot</p>
                <p className="text-xs text-slate-400">
                  Illustrative scoring stream
                </p>
              </div>
              <BadgeCheck className="h-6 w-6 text-cyan-200" />
            </div>

            <div className="mt-6 space-y-4">
              {[68, 52, 81, 47, 73].map((value, idx) => (
                <motion.div
                  key={idx}
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400"
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-slate-300">
              {["RF", "XGB", "ISO"].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3"
                >
                  <p className="font-semibold text-cyan-100">{label}</p>
                  <p>
                    {label === "RF"
                      ? "0.42"
                      : label === "XGB"
                        ? "0.38"
                        : "0.56"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
              <Sparkles className="mr-2 inline-block h-4 w-4" />
              Fusion decision: 0.4 RF + 0.4 XGB + 0.2 ISO → threshold 0.5
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {featureCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + idx * 0.08, duration: 0.4 }}
              className="glass rounded-2xl p-6"
            >
              <Icon className="h-7 w-7 text-cyan-200" />
              <h3 className="mt-4 font-display text-lg font-semibold text-white">
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-slate-300">{card.description}</p>
            </motion.article>
          );
        })}
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold text-white">
            Built for everyday account holders
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Simple calls-to-action for users, deeper observability for analysts
            and admins.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
              <p className="text-sm font-semibold text-white">
                Send & simulate
              </p>
              <p className="mt-1 text-sm text-slate-300">
                UPI-like flow that keeps balances, beneficiaries, and risk
                context in sync.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
              <p className="text-sm font-semibold text-white">
                Explain every flag
              </p>
              <p className="mt-1 text-sm text-slate-300">
                SHAP-backed insights so users understand why a transaction was
                blocked or cleared.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
              <p className="text-sm font-semibold text-white">
                Reward safe behavior
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Cashback tracking encourages healthy usage while keeping fraud
                rates low.
              </p>
            </div>
            <div className="rounded-xl border border-slate-700/70 bg-slate-900/50 p-4">
              <p className="text-sm font-semibold text-white">
                Govern with clarity
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Admin Ops Reports summarize totals, safe rates, and anomalies
                for governance.
              </p>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-semibold text-white">
            Trust framework
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-200">
            {trustPillars.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl border border-slate-700/70 bg-slate-900/50 p-3"
              >
                <Shield className="mt-0.5 h-4 w-4 text-cyan-200" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
