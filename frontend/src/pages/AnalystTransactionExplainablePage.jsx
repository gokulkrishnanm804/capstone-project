import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useLocation, useParams } from "react-router-dom";
import { getAnalystTransactionById } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AnalystTransactionExplainablePage() {
  const { transactionId } = useParams();
  const location = useLocation();
  const [row, setRow] = useState(location.state?.row || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!transactionId) return;

    const loadDetails = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getAnalystTransactionById(transactionId);
        const item = response.data?.[0] || null;
        if (!item) {
          setError("Transaction not found.");
        }
        setRow(item);
      } catch (err) {
        setError(
          getApiErrorMessage(err, "Unable to load transaction details."),
        );
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [transactionId]);

  if (loading) {
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading fraud and SHAP details...
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-white">
              Fraud and SHAP Explainable Details
            </h1>
            <p className="mt-2 text-slate-300">
              Detailed risk and model explainability for selected transaction.
            </p>
          </div>
          <Link to="/analyst/transactions" className="btn-secondary">
            Back to Transactions
          </Link>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        {!row ? (
          <p className="mt-4 text-slate-300">No transaction selected.</p>
        ) : (
          <>
            <section className="mt-5 rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
              <h2 className="font-semibold text-cyan-100">
                SHAP Explainability Graph
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Positive values push prediction toward FRAUD, negative values
                push toward SAFE.
              </p>

              <div className="mt-4 h-[420px] min-h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(row.shap_importance || [])
                      .slice(0, 12)
                      .map((item) => ({
                        feature: item.feature,
                        contribution: Number(item.contribution),
                      }))}
                    layout="vertical"
                    margin={{ top: 8, right: 20, left: 18, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      type="number"
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      width={170}
                      tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => Number(value).toFixed(5)}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                      }}
                    />
                    <ReferenceLine x={0} stroke="#94a3b8" strokeOpacity={0.8} />
                    <Bar dataKey="contribution" radius={[5, 5, 5, 5]}>
                      {(row.shap_importance || []).slice(0, 12).map((item) => (
                        <Cell
                          key={item.feature}
                          fill={item.contribution >= 0 ? "#fb7185" : "#34d399"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <InfoItem
                label="Transaction ID"
                value={row.transaction_id}
                mono
              />
              <InfoItem
                label="Decision"
                value={row.prediction}
                highlight={row.prediction === "FRAUD" ? "fraud" : "safe"}
              />
              <InfoItem
                label="Final Risk Score"
                value={`${(row.risk_score * 100).toFixed(2)}%`}
              />
              <InfoItem
                label="User"
                value={`${row.user_name} (${row.user_email})`}
              />
              <InfoItem
                label="From"
                value={`${row.sender_name} (${row.sender_account})`}
              />
              <InfoItem
                label="To"
                value={`${row.receiver_name} (${row.receiver_account})`}
              />
              <InfoItem label="Amount" value={`INR ${row.amount.toFixed(2)}`} />
              <InfoItem label="Transaction Type" value={row.transaction_type} />
              <InfoItem
                label="Location / Device"
                value={`${row.location} / ${row.device_type}`}
              />
              <InfoItem
                label="RF Probability"
                value={`${(row.random_forest_probability * 100).toFixed(2)}%`}
              />
              <InfoItem
                label="XGBoost Probability"
                value={`${(row.xgboost_probability * 100).toFixed(2)}%`}
              />
              <InfoItem
                label="Isolation Forest Score"
                value={`${(row.isolation_forest_score * 100).toFixed(2)}%`}
              />
              <InfoItem
                label="Rule Score"
                value={`${(row.risk_rule_score * 100).toFixed(2)}%`}
              />
              <InfoItem
                label="Context Flags"
                value={`${row.is_new_location ? "New location" : "Known location"}, ${row.is_new_device ? "New device" : "Known device"}, ${row.is_night ? "Night" : "Day"}`}
              />
              <InfoItem
                label="Rapid Count (10m)"
                value={String(row.rapid_sequence_count)}
              />
            </div>

            <p className="mt-4 text-sm text-slate-300">{row.note}</p>

            <h2 className="mt-5 font-semibold text-cyan-100">
              SHAP Feature Contributions
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="pb-2">Feature</th>
                    <th className="pb-2">Contribution</th>
                    <th className="pb-2">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-200">
                  {row.shap_importance.map((item) => (
                    <tr key={item.feature}>
                      <td className="py-2 font-mono text-xs">{item.feature}</td>
                      <td className="py-2">{item.contribution.toFixed(5)}</td>
                      <td
                        className={`py-2 font-semibold ${
                          item.contribution >= 0
                            ? "text-rose-300"
                            : "text-emerald-300"
                        }`}
                      >
                        {item.contribution >= 0
                          ? "Pushes toward FRAUD"
                          : "Pushes toward SAFE"}
                      </td>
                    </tr>
                  ))}
                  {!row.shap_importance.length && (
                    <tr>
                      <td className="py-3 text-slate-400" colSpan={3}>
                        No SHAP data available for this transaction.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.section>
    </main>
  );
}

function InfoItem({ label, value, highlight, mono = false }) {
  const tone =
    highlight === "fraud"
      ? "text-rose-200"
      : highlight === "safe"
        ? "text-emerald-200"
        : "text-slate-200";

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${tone} ${mono ? "font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}
