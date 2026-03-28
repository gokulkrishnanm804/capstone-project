import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getAdminOpsTransactionById,
  postAdminOpsTransactionAction,
} from "../api";
import AdminSidebar from "../components/AdminSidebar";
import { getApiErrorMessage } from "../utils/apiError";

const FRIENDLY_LABELS = {
  amount: "Transaction Amount",
  is_new_beneficiary: "New Beneficiary",
  is_new_location: "New Location",
  is_night_transaction: "Night Transaction",
  amount_vs_balance_ratio: "Balance Drain %",
};

export default function AdminOperationsInvestigationPage() {
  const { transactionId } = useParams();
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionNote, setActionNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    getAdminOpsTransactionById(transactionId)
      .then((res) => setRow(res.data))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load transaction.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const act = (action) => {
    setSubmitting(true);
    postAdminOpsTransactionAction(transactionId, {
      action,
      note: actionNote || undefined,
    })
      .then((res) => setRow(res.data))
      .catch((err) => setError(getApiErrorMessage(err, "Action failed.")))
      .finally(() => setSubmitting(false));
  };

  if (loading)
    return <div className="px-6 py-10 text-slate-300">Loading...</div>;
  if (error) return <div className="px-6 py-10 text-rose-200">{error}</div>;
  if (!row) return null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-white">
            Fraud Investigation
          </h1>
          <p className="mt-2 text-slate-300">
            Transaction {row.transaction_id}
          </p>

          <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
            <Info label="Amount" value={`₹ ${row.amount.toFixed(2)}`} />
            <Info label="Type" value={row.transaction_type} />
            <Info
              label="Sender"
              value={`${row.sender_name} (${row.sender_account})`}
            />
            <Info
              label="Receiver"
              value={`${row.receiver_name} (${row.receiver_account})`}
            />
            <Info label="Location" value={row.location} />
            <Info label="Device" value={row.device_type} />
            <Info label="Time" value={new Date(row.date).toLocaleString()} />
            <Info label="Status" value={row.prediction} />
          </section>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-slate-200">Fraud Score</p>
            <div className="mt-3 h-3 w-full rounded-full bg-slate-800">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-rose-500"
                style={{
                  width: `${Math.min(100, Math.round(row.risk_score * 100))}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {(row.risk_score * 100).toFixed(1)}%
            </p>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-slate-200">
              SHAP Explanation
            </p>
            <div className="mt-3 space-y-2">
              {(row.shap_importance || []).slice(0, 5).map((item) => {
                const label = FRIENDLY_LABELS[item.feature] || item.feature;
                return (
                  <div key={item.feature} className="flex items-center gap-2">
                    <div className="w-48 text-xs text-slate-300">{label}</div>
                    <div className="h-2 flex-1 rounded-full bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-cyan-400"
                        style={{
                          width: `${Math.min(100, Math.abs(item.contribution) * 150)}%`,
                        }}
                      />
                    </div>
                    <div className="w-16 text-right text-xs text-slate-400">
                      {item.contribution.toFixed(3)}
                    </div>
                  </div>
                );
              })}
              {!row.shap_importance?.length && (
                <p className="text-slate-500 text-sm">
                  No explanation available.
                </p>
              )}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-slate-200">Model Scores</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm text-slate-200">
              <Info
                label="XGBoost"
                value={(row.xgboost_probability * 100).toFixed(1) + "%"}
              />
              <Info
                label="Random Forest"
                value={(row.random_forest_probability * 100).toFixed(1) + "%"}
              />
              <Info
                label="Isolation Forest"
                value={(row.isolation_forest_score * 100).toFixed(1) + "%"}
              />
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <p className="text-sm font-semibold text-slate-200">Actions</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                className="btn-primary bg-rose-600 hover:bg-rose-500"
                disabled={submitting}
                onClick={() => act("confirm_fraud")}
              >
                Confirm Fraud
              </button>
              <button
                type="button"
                className="btn-primary bg-emerald-600 hover:bg-emerald-500"
                disabled={submitting}
                onClick={() => act("mark_safe")}
              >
                Mark as Safe
              </button>
              <button
                type="button"
                className="btn-primary bg-amber-600 hover:bg-amber-500"
                disabled={submitting}
                onClick={() => act("escalate_admin")}
              >
                Escalate to Admin
              </button>
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-sm text-slate-300">
                Note (optional)
              </label>
              <input
                className="input-dark"
                placeholder="Add context for this action"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  );
}
