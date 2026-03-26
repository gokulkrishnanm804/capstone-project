import { motion } from "framer-motion";
import { ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function readStoredPrediction() {
  try {
    const text = localStorage.getItem("last_prediction");
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export default function PredictionResultPage() {
  const location = useLocation();
  const result = location.state?.result || readStoredPrediction();

  const chartData = useMemo(() => {
    if (!result?.prediction?.feature_importance) return [];
    return result.prediction.feature_importance.map((item) => ({
      feature: item.label || item.feature,
      value: Math.abs(item.contribution),
      signed: item.contribution,
    }));
  }, [result]);

  if (!result) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-slate-300">No recent prediction found.</p>
          <Link to="/simulate" className="btn-primary mt-4 inline-flex">
            Go to Simulation <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  const isFraud = result.prediction.prediction === "FRAUD";
  const riskScore = result.prediction.final_fusion_score;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">
              Prediction Result
            </h1>
            <p className="mt-1 text-slate-300">
              Transaction ID: {result.transaction_id}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
              isFraud
                ? "bg-rose-500/20 text-rose-200"
                : "bg-emerald-500/20 text-emerald-200"
            }`}
          >
            {isFraud ? (
              <ShieldAlert className="h-4 w-4" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {result.prediction.prediction}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Fraud Probability"
            value={`${(result.prediction.fraud_probability * 100).toFixed(2)}%`}
          />
          <MetricTile
            label="Random Forest"
            value={`${(result.prediction.random_forest_probability * 100).toFixed(2)}%`}
          />
          <MetricTile
            label="XGBoost"
            value={`${(result.prediction.xgboost_probability * 100).toFixed(2)}%`}
          />
          <MetricTile
            label="Isolation Forest"
            value={`${(result.prediction.isolation_forest_score * 100).toFixed(2)}%`}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-5">
            <p className="text-sm text-slate-400">
              Risk Meter ({result.prediction.risk_band})
            </p>
            <div className="mt-3 h-3 w-full rounded-full bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(riskScore * 100, 2)}%` }}
                transition={{ duration: 0.5 }}
                className={`h-3 rounded-full ${
                  riskScore < 0.35
                    ? "bg-emerald-400"
                    : riskScore < 0.65
                      ? "bg-amber-300"
                      : "bg-rose-400"
                }`}
              />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Final Fusion Score: {(riskScore * 100).toFixed(2)}%
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-5 text-sm text-slate-200">
            <p className="text-sm text-slate-400">Rule Signals</p>
            <ul className="mt-2 space-y-1">
              <li>
                Amount Signal:{" "}
                {(result.risk_signals.amount_signal * 100).toFixed(1)}%
              </li>
              <li>
                Rapid Transfer Signal:{" "}
                {(result.risk_signals.rapid_transfer_signal * 100).toFixed(1)}%
              </li>
              <li>
                Location Signal:{" "}
                {(result.risk_signals.location_signal * 100).toFixed(1)}%
              </li>
              <li>
                Device Signal:{" "}
                {(result.risk_signals.device_signal * 100).toFixed(1)}%
              </li>
              <li>
                Night Signal:{" "}
                {(result.risk_signals.night_signal * 100).toFixed(1)}%
              </li>
            </ul>
          </div>
        </div>
      </motion.section>

      <section className="glass min-w-0 mt-6 rounded-3xl p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-white">
          SHAP Explanation Chart
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Top feature contributions from the model ensemble.
        </p>
        <div className="mt-5 h-[420px] min-w-0">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={1}
          >
            <BarChart data={chartData} layout="vertical" margin={{ left: 65 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
              <YAxis
                dataKey="feature"
                type="category"
                width={70}
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
              />
              <Tooltip formatter={(value) => Number(value).toFixed(5)} />
              <Bar dataKey="value" radius={[5, 5, 5, 5]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`${entry.feature}-${index}`}
                    fill={entry.signed >= 0 ? "#fb7185" : "#34d399"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </main>
  );
}

function MetricTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
