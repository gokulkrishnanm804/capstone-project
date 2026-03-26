import { useEffect, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import {
  getAdminSettings,
  updateAdminThresholds,
  updateAdminVelocity,
  addAdminBlacklist,
  removeAdminBlacklist,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminSettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thresholds, setThresholds] = useState({
    fraud_cutoff: 0.6,
    suspicious_cutoff: 0.3,
  });
  const [velocity, setVelocity] = useState({
    max_transactions: 8,
    window_minutes: 10,
  });
  const [saving, setSaving] = useState("");
  const [blacklistValue, setBlacklistValue] = useState("");
  const [blacklistType, setBlacklistType] = useState("account_id");

  const load = () => {
    setLoading(true);
    setError("");
    getAdminSettings()
      .then((res) => {
        setData(res.data);
        setThresholds(res.data.thresholds);
        setVelocity(res.data.velocity);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load settings.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleThresholdSave = async () => {
    if (thresholds.suspicious_cutoff > thresholds.fraud_cutoff) {
      return setError("Suspicious cutoff must be <= fraud cutoff.");
    }
    setSaving("thresholds");
    try {
      const res = await updateAdminThresholds(thresholds);
      setData((prev) => ({ ...prev, thresholds: res.data }));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update thresholds."));
    } finally {
      setSaving("");
    }
  };

  const handleVelocitySave = async () => {
    setSaving("velocity");
    try {
      const res = await updateAdminVelocity(velocity);
      setData((prev) => ({ ...prev, velocity: res.data }));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update velocity."));
    } finally {
      setSaving("");
    }
  };

  const handleAddBlacklist = async () => {
    if (!blacklistValue.trim()) return;
    setSaving("blacklist");
    try {
      const res = await addAdminBlacklist({
        value: blacklistValue.trim(),
        type: blacklistType,
      });
      setData((prev) => ({ ...prev, blacklist: res.data }));
      setBlacklistValue("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to add blacklist entry."));
    } finally {
      setSaving("");
    }
  };

  const handleRemoveBlacklist = async (value) => {
    setSaving(`remove-${value}`);
    try {
      const res = await removeAdminBlacklist(value);
      setData((prev) => ({ ...prev, blacklist: res.data }));
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to remove blacklist entry."));
    } finally {
      setSaving("");
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
                System Settings
              </h1>
              <p className="mt-1 text-slate-300">
                Adjust decision thresholds, velocity rules, and blacklists.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Audit log entries
              </p>
              <p className="text-lg font-semibold text-cyan-200">
                {data?.audit_logs?.length ?? 0}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading…</div>
          ) : error ? (
            <div className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : data ? (
            <div className="mt-6 space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Decision Thresholds
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Control fraud vs. suspicious cutoffs.
                  </p>
                  <div className="mt-4 space-y-3">
                    <label className="flex flex-col text-sm text-slate-300">
                      Fraud cutoff
                      <input
                        type="number"
                        className="input mt-1"
                        step="0.01"
                        min="0"
                        max="1"
                        value={thresholds.fraud_cutoff}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            fraud_cutoff: parseFloat(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col text-sm text-slate-300">
                      Suspicious cutoff
                      <input
                        type="number"
                        className="input mt-1"
                        step="0.01"
                        min="0"
                        max="1"
                        value={thresholds.suspicious_cutoff}
                        onChange={(e) =>
                          setThresholds({
                            ...thresholds,
                            suspicious_cutoff: parseFloat(e.target.value),
                          })
                        }
                      />
                    </label>
                    <button
                      className="btn-primary"
                      onClick={handleThresholdSave}
                      disabled={saving === "thresholds"}
                    >
                      {saving === "thresholds" ? "Saving…" : "Save thresholds"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Velocity Rules
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Rate limit high-frequency transfers.
                  </p>
                  <div className="mt-4 space-y-3">
                    <label className="flex flex-col text-sm text-slate-300">
                      Max transactions in window
                      <input
                        type="number"
                        className="input mt-1"
                        min="1"
                        value={velocity.max_transactions}
                        onChange={(e) =>
                          setVelocity({
                            ...velocity,
                            max_transactions: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col text-sm text-slate-300">
                      Window (minutes)
                      <input
                        type="number"
                        className="input mt-1"
                        min="1"
                        value={velocity.window_minutes}
                        onChange={(e) =>
                          setVelocity({
                            ...velocity,
                            window_minutes: parseInt(e.target.value, 10) || 0,
                          })
                        }
                      />
                    </label>
                    <button
                      className="btn-primary"
                      onClick={handleVelocitySave}
                      disabled={saving === "velocity"}
                    >
                      {saving === "velocity" ? "Saving…" : "Save velocity"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Blacklist
                    </h2>
                    <p className="text-sm text-slate-400">
                      Block high-risk account IDs, device IDs, or IPs.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                    <select
                      className="input"
                      value={blacklistType}
                      onChange={(e) => setBlacklistType(e.target.value)}
                    >
                      <option value="account_id">Account ID</option>
                      <option value="device_id">Device ID</option>
                      <option value="ip">IP</option>
                    </select>
                    <input
                      className="input"
                      placeholder="Value to block"
                      value={blacklistValue}
                      onChange={(e) => setBlacklistValue(e.target.value)}
                    />
                    <button
                      className="btn-secondary"
                      onClick={handleAddBlacklist}
                      disabled={saving === "blacklist"}
                    >
                      {saving === "blacklist" ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.blacklist.map((item) => (
                    <div
                      key={`${item.type}-${item.value}`}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
                    >
                      <div>
                        <p className="font-semibold text-white">{item.value}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          {item.type}
                        </p>
                      </div>
                      <button
                        className="btn-ghost text-rose-300"
                        onClick={() => handleRemoveBlacklist(item.value)}
                        disabled={saving === `remove-${item.value}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {!data.blacklist.length && (
                    <p className="text-sm text-slate-400">
                      No blacklist entries.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <h2 className="font-display text-lg font-semibold text-white">
                  Audit Log
                </h2>
                <p className="text-sm text-slate-400">
                  Recent admin actions across settings and overrides.
                </p>
                <div className="mt-4 space-y-3">
                  {data.audit_logs.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        <span className="uppercase tracking-wide">
                          {item.actor_role}
                        </span>
                      </div>
                      <p className="mt-1 font-semibold text-white">
                        {item.action}
                      </p>
                      <p className="text-xs text-slate-400">
                        Target: {item.target}
                      </p>
                      {item.details && Object.keys(item.details).length > 0 && (
                        <pre className="mt-1 overflow-x-auto rounded bg-slate-900/80 p-2 text-xs text-slate-300">
                          {JSON.stringify(item.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                  {!data.audit_logs.length && (
                    <p className="text-sm text-slate-400">
                      No audit entries yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
