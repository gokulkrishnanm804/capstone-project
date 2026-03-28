import { useEffect, useRef, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminModels, retrainAdminModels } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminModelManagementPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrainStatus, setRetrainStatus] = useState("");
  const pollTimer = useRef(null);

  const load = () => {
    setLoading(true);
    getAdminModels()
      .then((res) => {
        setData(res.data);
        setRetrainStatus(res.data.retrain_status);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load model stats.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (retrainStatus === "running") {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(() => {
        getAdminModels()
          .then((res) => {
            setData(res.data);
            setRetrainStatus(res.data.retrain_status);
            if (res.data.retrain_status !== "running" && pollTimer.current) {
              clearInterval(pollTimer.current);
              pollTimer.current = null;
            }
          })
          .catch((err) =>
            setError(getApiErrorMessage(err, "Unable to refresh model stats.")),
          );
      }, 2000);
    }
  }, [retrainStatus]);

  const handleRetrain = async () => {
    setRetrainStatus("running");
    try {
      await retrainAdminModels();
      setRetrainStatus("running");
      setTimeout(load, 2000);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to trigger retraining."));
      setRetrainStatus("failed");
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                ML Model Management
              </h1>
              <p className="mt-1 text-slate-300">
                Monitor performance, inspect feature importance, and retrain.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRetrain}
              disabled={retrainStatus === "running"}
            >
              {retrainStatus === "running" ? "Retraining..." : "Retrain Models"}
            </button>
          </div>

          {retrainStatus === "running" && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-sm text-slate-200">Training in progress…</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-slate-800">
                <div className="h-full w-1/2 animate-pulse bg-cyan-400/70" />
              </div>
            </div>
          )}

          {loading ? (
            <div className="mt-6 text-slate-300">Loading...</div>
          ) : error ? (
            <div className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : data ? (
            <div className="mt-6 space-y-6">
              <section className="grid gap-4 md:grid-cols-3">
                {data.metrics.map((item) => (
                  <div
                    key={item.model}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                  >
                    <p className="text-sm text-slate-400">{item.model}</p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {(item.accuracy * 100).toFixed(1)}% accuracy
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Precision {(item.precision * 100).toFixed(1)}% · Recall{" "}
                      {(item.recall * 100).toFixed(1)}% · F1{" "}
                      {(item.f1 * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="font-display text-lg font-semibold text-white">
                  Global SHAP Importance
                </h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  {data.shap_global.map((item) => (
                    <div
                      key={item.feature}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
                    >
                      <span className="font-semibold text-cyan-100">
                        {item.feature}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {item.contribution.toFixed(4)}
                      </span>
                    </div>
                  ))}
                  {!data.shap_global.length && (
                    <p className="text-sm text-slate-400">
                      No importance data yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="font-display text-lg font-semibold text-white">
                  Model Version History
                </h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm text-slate-200">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="pb-2">Model</th>
                        <th className="pb-2">Version</th>
                        <th className="pb-2">Accuracy</th>
                        <th className="pb-2">Precision</th>
                        <th className="pb-2">Recall</th>
                        <th className="pb-2">F1</th>
                        <th className="pb-2">Trained At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.history.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2">{item.model_name}</td>
                          <td className="py-2">{item.version_label}</td>
                          <td className="py-2">
                            {(item.accuracy * 100).toFixed(2)}%
                          </td>
                          <td className="py-2">
                            {(item.precision * 100).toFixed(2)}%
                          </td>
                          <td className="py-2">
                            {(item.recall * 100).toFixed(2)}%
                          </td>
                          <td className="py-2">
                            {(item.f1 * 100).toFixed(2)}%
                          </td>
                          <td className="py-2 text-xs text-slate-400">
                            {new Date(item.trained_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
