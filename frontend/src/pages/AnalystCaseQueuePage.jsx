import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createUserFraudQuery, getFraudCases, reviewFraudCase } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

export default function AnalystCaseQueuePage() {
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");

  const loadCases = async () => {
    setCasesLoading(true);
    setError("");
    try {
      const caseRes = await getFraudCases({
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        limit: 100,
      });
      setCases(caseRes.data || []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load analyst queue."));
    } finally {
      setCasesLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  const applyFilters = () => {
    loadCases();
  };

  const handleCaseAction = async (caseId, payload, message) => {
    setSuccess("");
    setError("");
    try {
      await reviewFraudCase(caseId, payload);
      setSuccess(message);
      await loadCases();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update fraud case."));
    }
  };

  const handleAskUserQuery = async (caseItem) => {
    const question = window.prompt(
      "Ask user to clarify this fraud transaction",
      `Please explain transaction ${caseItem.transaction_id} and its purpose.`,
    );
    if (question === null) return;
    if (question.trim().length < 10) {
      setError("Query message should be at least 10 characters.");
      return;
    }

    setSuccess("");
    setError("");
    try {
      await createUserFraudQuery(caseItem.case_id, {
        message: question.trim(),
      });
      setSuccess("Fraud clarification query sent to user.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to send query to user."));
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
          Analyst Fraud Queue
        </h1>
        <p className="mt-2 text-slate-300">
          Review suspicious transfers, annotate risk, and escalate vulnerable
          cases to admin.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <select
            className="input-dark"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="NEW">NEW</option>
            <option value="UNDER_REVIEW">UNDER_REVIEW</option>
            <option value="ESCALATED_TO_ADMIN">ESCALATED_TO_ADMIN</option>
            <option value="ACTION_TAKEN">ACTION_TAKEN</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select
            className="input-dark"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
          >
            <option value="">All Severities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <button type="button" className="btn-primary" onClick={applyFilters}>
            Apply Filters
          </button>
        </div>

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
          {casesLoading ? (
            <p className="text-slate-300">Loading fraud cases...</p>
          ) : (
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Case</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Transaction</th>
                  <th className="pb-3">Severity</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {cases.map((item) => (
                  <tr key={item.case_id}>
                    <td className="py-3 font-mono text-xs">{item.case_id}</td>
                    <td className="py-3">
                      <p>{item.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.user_email}
                      </p>
                    </td>
                    <td className="py-3 font-mono text-xs">
                      {item.transaction_id}
                    </td>
                    <td className="py-3">{item.severity}</td>
                    <td className="py-3">{item.status}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => handleAskUserQuery(item)}
                        >
                          Ask User
                        </button>
                        <button
                          type="button"
                          className={
                            item.status === "ESCALATED_TO_ADMIN"
                              ? "inline-flex items-center justify-center rounded-xl border border-amber-300/45 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-100"
                              : "btn-primary px-3 py-1.5 text-xs"
                          }
                          onClick={() =>
                            handleCaseAction(
                              item.case_id,
                              { escalate_to_admin: true, severity: "HIGH" },
                              "Case escalated to admin.",
                            )
                          }
                          disabled={item.status === "ESCALATED_TO_ADMIN"}
                        >
                          {item.status === "ESCALATED_TO_ADMIN"
                            ? "Escalated"
                            : "Escalate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!cases.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={6}>
                      No fraud cases found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </motion.section>
    </main>
  );
}
