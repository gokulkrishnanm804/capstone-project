import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getModelInsights } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function ModelInsightPage() {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getModelInsights()
      .then((res) => setInsight(res.data))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load model insights.")),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading model insights...
      </div>
    );
  if (error) return <div className="px-6 py-6 text-rose-200">{error}</div>;
  if (!insight) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          Model Insight
        </h1>
        <p className="mt-1 text-slate-300">
          How supervised and unsupervised intelligence combine in FraudGuard AI.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <InfoCard
            title="Supervised Models"
            values={insight.supervised_models}
          />
          <InfoCard
            title="Unsupervised Models"
            values={insight.unsupervised_models}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/45 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-400">
            Fusion Layer
          </p>
          <p className="mt-2 font-display text-xl font-semibold text-cyan-100">
            {insight.fusion_formula}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Decision Threshold: {(insight.threshold * 100).toFixed(0)}%
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/45 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-400">
            SHAP Explainability
          </p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {insight.explanation.map((line) => (
              <li key={line}>- {line}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/45 p-5">
          <p className="text-sm uppercase tracking-wide text-slate-400">
            Model Metadata Snapshot
          </p>
          <pre className="mt-2 overflow-auto rounded-lg bg-slate-950/60 p-4 text-xs text-slate-200">
            {JSON.stringify(insight.model_metadata, null, 2)}
          </pre>
        </div>
      </motion.section>
    </main>
  );
}

function InfoCard({ title, values }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-5">
      <p className="text-sm uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-200">
        {values.map((value) => (
          <li key={value}>- {value}</li>
        ))}
      </ul>
    </div>
  );
}
