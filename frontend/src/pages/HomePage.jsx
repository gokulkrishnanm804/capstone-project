import { motion } from "framer-motion";
import { ArrowRight, Brain, Shield, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

const cards = [
  {
    icon: Brain,
    title: "Explainable Fusion Intelligence",
    description:
      "Random Forest, XGBoost, and Isolation Forest combine into one transparent fraud score.",
  },
  {
    icon: TrendingUp,
    title: "Simulation-Centric Banking",
    description:
      "Execute realistic account transfers while backend maps behavior to model-ready feature vectors.",
  },
  {
    icon: Shield,
    title: "Risk Signals in Real Time",
    description:
      "Track suspicious velocity, location changes, new devices, and night transactions with live analytics.",
  },
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
            <p className="mb-3 inline-flex rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
              SentinelPay
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl">
              Simulation-Based Explainable Multi-Model Fraud Detection
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
              Build, test, and explain banking fraud risk through realistic
              account transfers. No raw dataset columns exposed to users, only
              intuitive fintech workflows.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to={isAuthenticated ? "/simulate" : "/login"}
                className="btn-primary"
              >
                Start Simulation <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="font-display text-xl font-semibold text-cyan-100">
              Live Risk Pulse
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Illustrative decision pipeline
            </p>
            <div className="mt-6 space-y-4">
              {[42, 68, 55, 81, 33, 72].map((value, idx) => (
                <motion.div
                  key={idx}
                  initial={{ width: 0 }}
                  animate={{ width: `${value}%` }}
                  transition={{ delay: idx * 0.1, duration: 0.45 }}
                  className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-indigo-400"
                />
              ))}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-slate-300">
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3">
                <p className="font-semibold text-cyan-100">RF</p>
                <p>0.41</p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3">
                <p className="font-semibold text-cyan-100">XGB</p>
                <p>0.37</p>
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-slate-900/50 p-3">
                <p className="font-semibold text-cyan-100">ISO</p>
                <p>0.58</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.08, duration: 0.4 }}
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
    </main>
  );
}
