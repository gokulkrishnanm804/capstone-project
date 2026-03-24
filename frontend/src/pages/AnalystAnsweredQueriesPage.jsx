import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { getSupportQueries, updateSupportQuery } from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const VERIFIED_TAG = "[VERIFIED]";

const isQueryVerified = (queryItem) =>
  (queryItem.analyst_notes || "").startsWith(VERIFIED_TAG);

const getVisibleAnalystNote = (queryItem) => {
  const note = queryItem.analyst_notes || "";
  if (!note.startsWith(VERIFIED_TAG)) {
    return note;
  }
  return note.slice(VERIFIED_TAG.length).trim();
};

export default function AnalystAnsweredQueriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRows = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getSupportQueries({
        status: "RESOLVED",
        query_type: "ANALYST_TO_USER",
        limit: 200,
      });
      setRows(response.data || []);
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Unable to load answered fraud queries."),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  const handleMarkSatisfied = async (queryItem) => {
    const note = window.prompt(
      "Resolution message shown to user",
      queryItem.analyst_notes ||
        "Issue resolved. Your clarification was accepted.",
    );
    if (note === null) return;

    setSuccess("");
    setError("");
    try {
      const normalizedNote = note.trim();
      await updateSupportQuery(queryItem.query_id, {
        status: "RESOLVED",
        analyst_notes: `${VERIFIED_TAG} ${normalizedNote}`,
      });
      setSuccess("Marked as resolved and feedback shared with user.");
      await loadRows();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to mark query as resolved."));
    }
  };

  const handleMarkNotSatisfied = async (queryItem) => {
    const note = window.prompt(
      "Message to user when answer is not satisfactory",
      "Your answer is not clear enough. Please provide a proper clarification with more details.",
    );
    if (note === null) return;

    setSuccess("");
    setError("");
    try {
      await updateSupportQuery(queryItem.query_id, {
        status: "OPEN",
        analyst_notes: note.trim(),
      });
      setSuccess("Marked as not satisfied. Query reopened for user response.");
      await loadRows();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to reopen this query."));
    }
  };

  const handleAddAnalystNote = async (queryItem) => {
    const note = window.prompt(
      "Update analyst notes",
      queryItem.analyst_notes || "",
    );
    if (note === null) return;

    setSuccess("");
    setError("");
    try {
      await updateSupportQuery(queryItem.query_id, {
        analyst_notes: note.trim(),
      });
      setSuccess("Analyst note updated.");
      await loadRows();
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update analyst note."));
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          User Answered Fraud Queries
        </h1>
        <p className="mt-2 text-slate-300">
          View user responses to analyst questions in one separate place.
        </p>

        <div className="mt-5">
          <button type="button" className="btn-secondary" onClick={loadRows}>
            Refresh
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
          {loading ? (
            <p className="text-slate-300">Loading answered queries...</p>
          ) : (
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-3">Query ID</th>
                  <th className="pb-3">Case</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Analyst Question</th>
                  <th className="pb-3">User Answer</th>
                  <th className="pb-3">Analyst Notes</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-200">
                {rows.map((item) => (
                  <tr key={item.query_id}>
                    <td className="py-3 font-mono text-xs">{item.query_id}</td>
                    <td className="py-3 font-mono text-xs">
                      {item.case_id || "-"}
                    </td>
                    <td className="py-3">
                      <p>{item.user_name}</p>
                      <p className="text-xs text-slate-400">
                        {item.user_email}
                      </p>
                    </td>
                    <td className="py-3 max-w-[320px]">{item.message}</td>
                    <td className="py-3 max-w-[320px]">
                      {item.user_response || "-"}
                    </td>
                    <td className="py-3 max-w-[240px]">
                      {getVisibleAnalystNote(item) || "-"}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        {isQueryVerified(item) ? (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-xl border border-emerald-300/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100"
                            disabled
                          >
                            Verified
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-primary px-3 py-1.5 text-xs"
                              onClick={() => handleMarkSatisfied(item)}
                            >
                              Satisfied
                            </button>
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              onClick={() => handleMarkNotSatisfied(item)}
                            >
                              Not Satisfied
                            </button>
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1.5 text-xs"
                              onClick={() => handleAddAnalystNote(item)}
                            >
                              Add Note
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="py-6 text-slate-400" colSpan={7}>
                      No user-answered fraud queries found.
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
