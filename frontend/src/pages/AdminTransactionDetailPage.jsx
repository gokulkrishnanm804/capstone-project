import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminOpsTransactionById } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const FRAUD_COLOR = "#f97316"; // orangish-red for fraud-pushing features
const SAFE_COLOR = "#22c55e"; // green for safe-pushing features

export default function AdminTransactionDetailPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!transactionId) return;
    setLoading(true);
    setError("");
    getAdminOpsTransactionById(transactionId)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load transaction.")),
      )
      .finally(() => setLoading(false));
  }, [transactionId]);

  const shapData = useMemo(() => {
    if (!row?.shap_importance?.length) return [];
    return row.shap_importance.slice(0, 8).map((item) => {
      const label = item.feature || "feature";
      const contribution = Number(item.contribution || 0);
      return {
        feature: label,
        label: label.length > 26 ? `${label.slice(0, 24)}…` : label,
        contribution,
        signClass: contribution >= 0 ? "text-amber-200" : "text-emerald-200",
      };
    });
  }, [row]);

  const maxAbsContribution = useMemo(() => {
    if (!shapData.length) return 0;
    return Math.max(...shapData.map((item) => Math.abs(item.contribution)));
  }, [shapData]);

  const reasonText = useMemo(() => {
    if (!row) return "";
    if (row.note?.trim()) return row.note.trim();
    const top = (row.shap_importance || []).slice(0, 3);
    const parts = top.map((f) => f.feature).filter(Boolean);
    if (parts.length) {
      return `Top drivers: ${parts.join(", ")}. Prediction ${row.prediction} at ${(row.risk_score * 100).toFixed(1)}%.`;
    }
    return `Prediction ${row.prediction} at ${(row.risk_score * 100).toFixed(1)}%.`;
  }, [row]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Transaction
              </p>
              <h1 className="font-display text-2xl font-bold text-white break-all">
                {transactionId}
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(-1)}
              >
                Back
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading transaction…</div>
          ) : error ? (
            <div className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : !row ? (
            <div className="mt-6 text-slate-300">No transaction found.</div>
          ) : (
            <div className="mt-6 space-y-5">
              <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
                <InfoBlock
                  label="Amount"
                  value={`₹ ${row.amount?.toFixed(2) || "0.00"}`}
                />
                <InfoBlock label="Type" value={row.transaction_type} />
                <InfoBlock label="Status" value={row.prediction} badge />
                <InfoBlock
                  label="Fraud Score"
                  value={`${(row.risk_score * 100).toFixed(1)}%`}
                />
                <InfoBlock
                  label="Date/Time"
                  value={new Date(row.date).toLocaleString()}
                />
                <InfoBlock label="Location" value={row.location || "—"} />
              </section>

              <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-200">
                    Counterparty
                  </p>
                  <Party
                    label="Sender"
                    name={row.sender_name}
                    account={row.sender_account}
                  />
                  <Party
                    label="Receiver"
                    name={row.receiver_name}
                    account={row.receiver_account}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-200">
                    Decision rationale
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {reasonText}
                  </p>
                  <p className="text-xs text-slate-500">
                    Prediction {row.prediction} · Score{" "}
                    {(row.risk_score * 100).toFixed(1)}%
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-sm font-semibold text-slate-200">
                  SHAP Explanation
                </p>
                {shapData.length ? (
                  <div className="mt-4 space-y-3">
                    {shapData.map((item) => {
                      const abs = Math.abs(item.contribution);
                      const width = maxAbsContribution
                        ? Math.min(100, (abs / maxAbsContribution) * 100)
                        : 0;
                      return (
                        <div
                          key={item.feature}
                          className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                        >
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-slate-200">{item.label}</span>
                            <span
                              className={`font-mono text-xs ${item.signClass}`}
                            >
                              {item.contribution >= 0 ? "+" : ""}
                              {item.contribution.toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-2 h-2 w-full rounded-full bg-slate-800">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${width}%`,
                                backgroundColor:
                                  item.contribution >= 0
                                    ? FRAUD_COLOR
                                    : SAFE_COLOR,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    No SHAP explanation available for this transaction.
                  </p>
                )}
              </section>

              <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-3">
                <InfoBlock
                  label="XGBoost Probability"
                  value={`${(row.xgboost_probability * 100).toFixed(1)}%`}
                />
                <InfoBlock
                  label="Random Forest Probability"
                  value={`${(row.random_forest_probability * 100).toFixed(1)}%`}
                />
                <InfoBlock
                  label="Isolation Forest Score"
                  value={`${(row.isolation_forest_score * 100).toFixed(1)}%`}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function InfoBlock({ label, value, badge = false }) {
  const badgeClass =
    value === "FRAUD"
      ? "bg-rose-500/20 text-rose-200"
      : value === "SUSPICIOUS"
        ? "bg-amber-500/20 text-amber-200"
        : value === "SAFE"
          ? "bg-emerald-500/20 text-emerald-200"
          : "bg-slate-800 text-slate-200";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      {badge ? (
        <span
          className={`mt-1 inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}
        >
          {value}
        </span>
      ) : (
        <p className="mt-1 text-sm text-slate-100">{value || "—"}</p>
      )}
    </div>
  );
}

function Party({ label, name, account }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{name || "—"}</p>
      <p className="text-xs text-slate-400">Acct {account || "—"}</p>
    </div>
  );
}
