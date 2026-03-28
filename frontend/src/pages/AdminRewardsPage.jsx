import { useEffect, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import {
  getAdminRewards,
  updateAdminCashbackRule,
  updateAdminCashbackCap,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminRewardsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingRule, setSavingRule] = useState("");
  const [capInput, setCapInput] = useState("");
  const [ruleInputs, setRuleInputs] = useState({});
  const [ruleErrors, setRuleErrors] = useState({});
  const [simAmount, setSimAmount] = useState("1000");
  const [simChannel, setSimChannel] = useState("ACCOUNT_TRANSFER");
  const [simResult, setSimResult] = useState(null);
  const [distPage, setDistPage] = useState(1);

  const formatCurrency = (value) =>
    `₹ ${Number(value || 0)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

  const presets = [0.5, 1, 2];
  const DISTRIBUTION_PAGE_SIZE = 6;

  const sanitizeDecimalInput = (raw) => {
    if (raw === undefined || raw === null) return "";
    const cleaned = String(raw).replace(/[^0-9.]/g, "");
    if (!cleaned) return "";
    const [intPart, ...rest] = cleaned.split(".");
    const decimalPart = rest.join("");
    if (rest.length > 0) {
      return `${intPart || "0"}.${decimalPart}`;
    }
    return intPart;
  };

  const sanitizePercentageInput = (raw) => {
    const sanitized = sanitizeDecimalInput(raw);
    if (sanitized === "") return "";
    const numeric = Number(sanitized);
    if (Number.isNaN(numeric)) return "";
    const clamped = Math.min(100, Math.max(0, numeric));
    return clamped.toString();
  };

  const load = () => {
    setLoading(true);
    setError("");
    setSuccess("");
    getAdminRewards()
      .then((res) => {
        setData(res.data);
        const firstCap = res.data.rules?.[0]?.cap_per_txn;
        setCapInput(firstCap ? firstCap.toString() : "");
        const nextInputs = res.data.rules.reduce((acc, rule) => {
          acc[rule.channel] = rule.percentage.toString();
          return acc;
        }, {});
        setRuleInputs(nextInputs);
        setSimChannel(res.data.rules?.[0]?.channel || "ACCOUNT_TRANSFER");
        setDistPage(1);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load rewards.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRuleSave = async (channel) => {
    if (!ruleInputs[channel]) return;
    const pct = parseFloat(ruleInputs[channel]);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      setRuleErrors((prev) => ({ ...prev, [channel]: "Enter 0-100%." }));
      return;
    }
    setRuleErrors((prev) => ({ ...prev, [channel]: "" }));
    setSavingRule(channel);
    try {
      const percentage = parseFloat(ruleInputs[channel]);
      const res = await updateAdminCashbackRule({ channel, percentage });
      setData((prev) => ({ ...prev, rules: res.data }));
      setRuleInputs((prev) => ({ ...prev, [channel]: percentage.toString() }));
      setSuccess(`${channel} rule updated`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update rule."));
    } finally {
      setSavingRule("");
    }
  };

  const handleCapSave = async () => {
    const capValue = parseFloat(capInput);
    if (Number.isNaN(capValue) || capValue < 0)
      return setError("Enter a valid cap amount.");
    try {
      const res = await updateAdminCashbackCap({ cap_per_txn: capValue });
      setData((prev) => ({ ...prev, rules: res.data }));
      setSuccess("Per-transaction cap updated");
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update cap."));
    }
  };

  const runSimulator = () => {
    const channelRule = data?.rules?.find((r) => r.channel === simChannel);
    if (!channelRule) return setSimResult(null);
    const pct = Number(channelRule.percentage || 0) / 100;
    const raw = Number(simAmount || 0) * pct;
    const capped = Math.min(raw, Number(channelRule.cap_per_txn || raw));
    setSimResult({ raw, capped });
  };

  const handlePreset = (channel, delta) => {
    setRuleInputs((prev) => {
      const current = parseFloat(prev[channel] || 0);
      const next = Math.min(
        100,
        Math.max(0, Number.isNaN(current) ? delta : current + delta),
      );
      return { ...prev, [channel]: next.toString() };
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                Cashback & Rewards
              </h1>
              <p className="mt-1 text-slate-300">
                Tune cashback rules, caps, and review payout impact.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryCard
                label="Total Cashback Paid"
                value={formatCurrency(data?.total_cashback ?? 0)}
                tone="emerald"
              />
              <SummaryCard
                label="Per-transaction Cap"
                value={formatCurrency(data?.rules?.[0]?.cap_per_txn ?? 0)}
                tone="cyan"
              />
              <SummaryCard
                label="Last Updated"
                value={
                  data?.last_updated
                    ? new Date(data.last_updated).toLocaleString()
                    : "—"
                }
                tone="slate"
              />
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading…</div>
          ) : error ? (
            <div className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : success ? (
            <div className="mt-6 rounded-xl bg-emerald-500/15 px-4 py-3 text-emerald-200">
              {success}
            </div>
          ) : data ? (
            <div className="mt-6 space-y-6">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Cashback Rules
                    </h2>
                    <p className="text-sm text-slate-400">
                      Adjust per-channel percentages and caps. Values must be
                      between 0% and 100%.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                      Cap per transaction
                    </span>
                    <input
                      type="text"
                      className="input-dark w-28"
                      value={capInput}
                      onChange={(e) =>
                        setCapInput(sanitizeDecimalInput(e.target.value))
                      }
                      inputMode="decimal"
                    />
                    <button className="btn-secondary" onClick={handleCapSave}>
                      Update Cap
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {data.rules.map((rule) => (
                    <div
                      key={rule.channel}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-[0_12px_32px_-18px_rgba(0,0,0,0.55)]"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">
                          {rule.channel.replace(/_/g, " ")}
                        </p>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                          Cap {formatCurrency(rule.cap_per_txn)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Set payout % for this channel.
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="text"
                          className="input-dark w-24"
                          value={ruleInputs[rule.channel] ?? ""}
                          onChange={(e) =>
                            setRuleInputs((prev) => ({
                              ...prev,
                              [rule.channel]: sanitizePercentageInput(
                                e.target.value,
                              ),
                            }))
                          }
                          inputMode="decimal"
                        />
                        <span className="text-slate-300">%</span>
                        <div className="flex gap-2">
                          {presets.map((step) => (
                            <button
                              key={step}
                              type="button"
                              className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                              onClick={() => handlePreset(rule.channel, step)}
                            >
                              +{step}
                            </button>
                          ))}
                        </div>
                        <button
                          className="btn-primary"
                          onClick={() => handleRuleSave(rule.channel)}
                          disabled={savingRule === rule.channel}
                        >
                          {savingRule === rule.channel ? "Saving…" : "Save"}
                        </button>
                      </div>
                      {ruleErrors[rule.channel] && (
                        <p className="mt-1 text-xs text-rose-300">
                          {ruleErrors[rule.channel]}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        Current cap {formatCurrency(rule.cap_per_txn)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Payout Simulator
                    </h2>
                    <p className="text-sm text-slate-400">
                      Estimate cashback for a sample amount using current rules
                      and caps.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
                    <input
                      type="text"
                      className="input-dark w-32"
                      value={simAmount}
                      inputMode="decimal"
                      onChange={(e) =>
                        setSimAmount(sanitizeDecimalInput(e.target.value))
                      }
                    />
                    <select
                      className="input-dark"
                      value={simChannel}
                      onChange={(e) => setSimChannel(e.target.value)}
                    >
                      {data.rules.map((r) => (
                        <option key={r.channel} value={r.channel}>
                          {r.channel.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <button className="btn-secondary" onClick={runSimulator}>
                      Calculate
                    </button>
                  </div>
                </div>
                {simResult && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm text-slate-200">
                    <SimCard
                      label="Raw cashback"
                      value={formatCurrency(simResult.raw)}
                    />
                    <SimCard
                      label="After cap"
                      value={formatCurrency(simResult.capped)}
                      highlight
                    />
                    <SimCard
                      label="Applied %"
                      value={`${(Number(ruleInputs[simChannel]) || data.rules.find((r) => r.channel === simChannel)?.percentage || 0).toFixed(2)} %`}
                    />
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Distribution
                  </h2>
                  <p className="text-sm text-slate-400">
                    Top recipients by cumulative cashback
                  </p>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm text-slate-200">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="pb-2">#</th>
                        <th className="pb-2">User</th>
                        <th className="pb-2">Total Cashback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {data.distributions
                        .slice(
                          (distPage - 1) * DISTRIBUTION_PAGE_SIZE,
                          distPage * DISTRIBUTION_PAGE_SIZE,
                        )
                        .map((item, idx) => (
                          <tr key={item.user_id}>
                            <td className="py-2 text-slate-500">
                              {(distPage - 1) * DISTRIBUTION_PAGE_SIZE +
                                idx +
                                1}
                            </td>
                            <td className="py-2">{item.name}</td>
                            <td className="py-2">
                              {formatCurrency(item.total_cashback)}
                            </td>
                          </tr>
                        ))}
                      {!data.distributions.length && (
                        <tr>
                          <td className="py-3 text-slate-400" colSpan={3}>
                            No cashback paid yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {data.distributions.length > DISTRIBUTION_PAGE_SIZE && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
                    <span>
                      Showing {(distPage - 1) * DISTRIBUTION_PAGE_SIZE + 1}-
                      {Math.min(
                        distPage * DISTRIBUTION_PAGE_SIZE,
                        data.distributions.length,
                      )}{" "}
                      of {data.distributions.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1 text-xs"
                        onClick={() =>
                          setDistPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={distPage === 1}
                      >
                        Previous
                      </button>
                      <span className="text-xs text-slate-400">
                        Page {distPage} /{" "}
                        {Math.max(
                          1,
                          Math.ceil(
                            data.distributions.length / DISTRIBUTION_PAGE_SIZE,
                          ),
                        )}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1 text-xs"
                        onClick={() =>
                          setDistPage((prev) =>
                            Math.min(
                              Math.max(
                                1,
                                Math.ceil(
                                  data.distributions.length /
                                    DISTRIBUTION_PAGE_SIZE,
                                ),
                              ),
                              prev + 1,
                            ),
                          )
                        }
                        disabled={
                          distPage >=
                          Math.ceil(
                            data.distributions.length / DISTRIBUTION_PAGE_SIZE,
                          )
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, tone = "slate" }) {
  const toneMap = {
    emerald: "text-emerald-200 border-emerald-500/40",
    cyan: "text-cyan-200 border-cyan-500/40",
    slate: "text-slate-200 border-slate-700/70",
  };
  return (
    <div
      className={`rounded-2xl border bg-slate-950/70 px-4 py-3 text-sm ${toneMap[tone] || toneMap.slate}`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SimCard({ label, value, highlight = false }) {
  return (
    <div
      className={`rounded-xl border ${highlight ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-800 bg-slate-950/70"} p-3`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
