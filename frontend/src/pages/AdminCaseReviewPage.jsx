import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  adminActionFraudCase,
  getFraudCases,
  getSupportQueries,
  updateSupportQuery,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AdminCaseReviewPage() {
  const [cases, setCases] = useState([]);
  const [blockedQueries, setBlockedQueries] = useState([]);
  const [notSatisfiedQueries, setNotSatisfiedQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [escalatedRes, actionTakenRes, blockedRes, analystOpenRes] =
        await Promise.all([
          getFraudCases({ status: "ESCALATED_TO_ADMIN" }),
          getFraudCases({ status: "ACTION_TAKEN" }),
          getSupportQueries({ status: "OPEN", query_type: "USER_TO_TEAM" }),
          getSupportQueries({ status: "OPEN", query_type: "ANALYST_TO_USER" }),
        ]);

      // Keep blocked cases visible for unblocking after status moves to ACTION_TAKEN.
      const mergedCases = [
        ...(escalatedRes.data || []),
        ...(actionTakenRes.data || []),
      ];
      const uniqueCases = Array.from(
        new Map(mergedCases.map((item) => [item.case_id, item])).values(),
      ).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      setCases(uniqueCases);
      setBlockedQueries(blockedRes.data || []);
      setNotSatisfiedQueries(
        (analystOpenRes.data || []).filter(
          (item) => item.user_response && item.user_response.trim().length > 0,
        ),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load admin review data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCaseAction = async (caseId, payload, message) => {
    setSuccess("");
    setError("");
    try {
      await adminActionFraudCase(caseId, payload);
      setSuccess(message);
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to apply admin action."));
    }
  };

  const handleBlock = (caseId) => {
    const reason = window.prompt("Block reason", "Blocked after fraud review");
    if (reason === null) return;
    handleCaseAction(
      caseId,
      {
        block_user: true,
        block_reason: reason,
        status: "ACTION_TAKEN",
      },
      "User has been blocked and case marked ACTION_TAKEN.",
    );
  };

  const handleSupportQuery = async (queryId) => {
    const note = window.prompt(
      "Admin note for this query",
      "Reviewed by admin",
    );
    if (note === null) return;
    setSuccess("");
    setError("");
    try {
      await updateSupportQuery(queryId, {
        status: "RESOLVED",
        admin_notes: note,
      });
      setSuccess("Support query resolved by admin.");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to resolve support query."));
    }
  };

  const handleWarnUser = async (queryId) => {
    const warning = window.prompt(
      "Warning message to user",
      "Please provide a proper explanation for this query, or your account may be blocked shortly.",
    );
    if (warning === null) return;
    if (warning.trim().length < 10) {
      setError("Warning message should be at least 10 characters.");
      return;
    }

    setSuccess("");
    setError("");
    try {
      await updateSupportQuery(queryId, {
        admin_notes: warning.trim(),
      });
      setSuccess("Warning sent to user successfully.");
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to send warning to user."));
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          Admin Case Review
        </h1>
        <p className="mt-2 text-slate-300">
          Review escalated fraud cases and enforce account-level actions.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-4 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
            {success}
          </p>
        )}

        <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          {loading ? (
            <p className="text-slate-300">Loading admin review cases...</p>
          ) : (
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Case</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Severity</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Analyst Notes</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {cases.map((item) => (
                  <tr key={item.case_id}>
                    <td className="py-3">
                      <p className="font-mono text-xs">{item.case_id}</p>
                      <p className="font-mono text-xs text-slate-400">
                        {item.transaction_id}
                      </p>
                    </td>
                    <td className="py-3">
                      <p>{item.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.user_email}
                      </p>
                    </td>
                    <td className="py-3">{item.severity}</td>
                    <td className="py-3">{item.status}</td>
                    <td className="py-3 max-w-[320px]">
                      {item.analyst_notes || "-"}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {!item.user_is_blocked && (
                          <button
                            type="button"
                            className="btn-primary px-3 py-1.5 text-xs"
                            onClick={() => handleBlock(item.case_id)}
                          >
                            Block User
                          </button>
                        )}
                        {item.user_is_blocked && (
                          <button
                            type="button"
                            className="btn-secondary px-3 py-1.5 text-xs"
                            onClick={() =>
                              handleCaseAction(
                                item.case_id,
                                { unblock_user: true, status: "ACTION_TAKEN" },
                                "User account unblocked.",
                              )
                            }
                          >
                            Unblock User
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() =>
                            handleCaseAction(
                              item.case_id,
                              { status: "CLOSED" },
                              "Case closed by admin.",
                            )
                          }
                        >
                          Close Case
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!cases.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={6}>
                      No admin review cases pending action.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-7 rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          <h2 className="font-display text-xl font-semibold text-white">
            Not Satisfied User Answers
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Open analyst queries where the user has responded but needs better
            clarification.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="w-36 pb-3">Query ID</th>
                  <th className="w-44 pb-3">User</th>
                  <th className="w-40 pb-3">Case</th>
                  <th className="w-64 pb-3">Analyst Question</th>
                  <th className="w-64 pb-3">User Response</th>
                  <th className="w-64 pb-3">Analyst Feedback</th>
                  <th className="w-36 pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {notSatisfiedQueries.map((item) => (
                  <tr key={item.query_id}>
                    <td className="py-3 align-top font-mono text-xs break-all">
                      {item.query_id}
                    </td>
                    <td className="py-3 align-top">
                      <p>{item.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.user_email}
                      </p>
                    </td>
                    <td className="py-3 align-top font-mono text-xs break-all">
                      {item.case_id || "-"}
                    </td>
                    <td className="py-3 align-top break-words leading-relaxed">
                      {item.message}
                    </td>
                    <td className="py-3 align-top break-words leading-relaxed">
                      {item.user_response || "-"}
                    </td>
                    <td className="py-3 align-top break-words leading-relaxed">
                      {item.analyst_notes || "-"}
                    </td>
                    <td className="py-3 align-top">
                      <button
                        type="button"
                        className="btn-primary w-full px-3 py-2 text-xs"
                        onClick={() => handleWarnUser(item.query_id)}
                      >
                        Send Warning
                      </button>
                    </td>
                  </tr>
                ))}
                {!notSatisfiedQueries.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={7}>
                      No analyst-reopened user answers pending admin warning.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-slate-700/70 bg-slate-950/45 p-4">
          <h2 className="font-display text-xl font-semibold text-white">
            Blocked User Query Inbox
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Resolve user explanations submitted after blocked login attempts.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Query ID</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Case</th>
                  <th className="pb-3">Message</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {blockedQueries.map((item) => (
                  <tr key={item.query_id}>
                    <td className="py-3 font-mono text-xs">{item.query_id}</td>
                    <td className="py-3">
                      <p>{item.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.user_email}
                      </p>
                    </td>
                    <td className="py-3 font-mono text-xs">
                      {item.case_id || "-"}
                    </td>
                    <td className="py-3 max-w-[430px]">{item.message}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        className="btn-secondary px-3 py-1.5 text-xs"
                        onClick={() => handleSupportQuery(item.query_id)}
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
                {!blockedQueries.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={5}>
                      No open blocked-user queries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </motion.section>
    </main>
  );
}
