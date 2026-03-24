import { motion } from "framer-motion";
import { CheckCircle2, SendHorizonal, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getSimulationContext,
  runSimulationTransaction,
  setUpiPin,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const transactionTypes = ["UPI", "CARD", "TRANSFER"];
const locationOptions = [
  "Delhi",
  "Mumbai",
  "Bengaluru",
  "Kolkata",
  "Hyderabad",
  "Chennai",
  "Jaipur",
];
const transactionTypeToModelType = {
  UPI: "PAYMENT",
  CARD: "DEBIT",
  TRANSFER: "TRANSFER",
};

function getCurrentTime12Hour() {
  const now = new Date();
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const period = now.getHours() >= 12 ? "PM" : "AM";
  const hour12 = now.getHours() % 12 || 12;
  const hours = String(hour12).padStart(2, "0");
  return {
    transaction_time: `${hours}:${minutes}`,
    transaction_period: period,
  };
}

export default function FraudDetectionPage() {
  const currentTime = getCurrentTime12Hour();
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [upiPinInput, setUpiPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [completedTransfer, setCompletedTransfer] = useState(null);
  const [form, setForm] = useState({
    sender_account: "",
    receiver_account: "",
    amount: "",
    transaction_type: "TRANSFER",
    location: "Delhi",
    device_type: "Mobile",
    transaction_time: currentTime.transaction_time,
    transaction_period: currentTime.transaction_period,
  });

  useEffect(() => {
    getSimulationContext()
      .then((res) => {
        const data = res.data;
        setContext(data);
        setForm((old) => ({
          ...old,
          sender_account: data.sender_account.account_number,
          receiver_account: data.receivers[0]?.account_number || "",
          location: data.known_locations[0] || "Delhi",
          device_type: data.known_devices[0] || "Mobile",
        }));
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "Unable to load transfer context."));
      })
      .finally(() => setLoadingContext(false));
  }, []);

  const validateForm = () => {
    if (!form.sender_account) {
      return "Sender account is missing. Please refresh transfer context.";
    }
    if (!form.receiver_account) {
      return "Please select a receiver account.";
    }
    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return "Please enter an amount greater than 0.";
    }
    if (!/^(0[1-9]|1[0-2]):[0-5][0-9]$/.test(form.transaction_time)) {
      return "Please enter time in hh:mm format.";
    }
    return null;
  };

  const executeTransaction = async (mode, upiPin) => {
    setSubmitting(true);
    setError("");
    setPinError("");
    const payload = {
      sender_account: form.sender_account,
      receiver_account: form.receiver_account,
      amount: Number(form.amount),
      transaction_type:
        transactionTypeToModelType[form.transaction_type] ||
        form.transaction_type,
      location: form.location,
      device_type: form.device_type,
      transaction_time: `${form.transaction_time} ${form.transaction_period}`,
      mode,
      upi_pin: mode === "send" ? upiPin : undefined,
    };

    try {
      const response = await runSimulationTransaction(payload);
      localStorage.setItem("last_prediction", JSON.stringify(response.data));

      if (mode === "send") {
        setContext((old) =>
          old
            ? {
                ...old,
                sender_account: response.data.sender_account,
              }
            : old,
        );
        setForm((old) => ({ ...old, amount: "" }));
        setShowPinModal(false);
        setUpiPinInput("");
        setCompletedTransfer(response.data);
        return;
      }

      setCompletedTransfer(response.data);
    } catch (err) {
      const message = getApiErrorMessage(err, "Transaction failed.");
      if (
        mode === "send" &&
        message.toLowerCase().includes("upi pin is not set")
      ) {
        try {
          await setUpiPin({ upi_pin: upiPin });
          const retryResponse = await runSimulationTransaction(payload);
          localStorage.setItem(
            "last_prediction",
            JSON.stringify(retryResponse.data),
          );
          setContext((old) =>
            old
              ? {
                  ...old,
                  sender_account: retryResponse.data.sender_account,
                }
              : old,
          );
          setForm((old) => ({ ...old, amount: "" }));
          setShowPinModal(false);
          setUpiPinInput("");
          setCompletedTransfer(retryResponse.data);
          return;
        } catch (pinErr) {
          setPinError(
            getApiErrorMessage(pinErr, "Unable to initialize UPI PIN."),
          );
          return;
        }
      }
      const fallback = getApiErrorMessage(err, "Transaction failed.");
      if (mode === "send") {
        setPinError(fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (mode) => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (mode === "send") {
      setError("");
      setPinError("");
      setUpiPinInput("");
      setShowPinModal(true);
      return;
    }

    executeTransaction(mode);
  };

  const confirmSendWithPin = () => {
    const trimmedPin = upiPinInput.trim();
    if (!/^\d{4,6}$/.test(trimmedPin)) {
      setPinError("UPI PIN must be 4 to 6 digits.");
      return;
    }
    executeTransaction("send", trimmedPin);
  };

  if (loadingContext) {
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading transfer context...
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 sm:p-8"
      >
        <h1 className="font-display text-3xl font-bold text-white">
          Money Transfer
        </h1>
        <p className="mt-2 text-slate-300">
          Send money from one account to another in a secure workflow.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
            {error}
          </p>
        )}

        <form
          className="mt-6 grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit("send");
          }}
        >
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              From Account
            </label>
            <input
              className="input-dark"
              value={form.sender_account}
              disabled
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              To Account
            </label>
            <select
              className="input-dark"
              value={form.receiver_account}
              required
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  receiver_account: event.target.value,
                }))
              }
            >
              {!context?.receivers?.length && (
                <option value="">No receivers available</option>
              )}
              {context?.receivers?.map((receiver) => (
                <option
                  key={receiver.account_number}
                  value={receiver.account_number}
                >
                  {receiver.owner_name} ({receiver.account_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Amount (INR)
            </label>
            <input
              className="input-dark"
              type="number"
              min="1"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) =>
                setForm((old) => ({ ...old, amount: event.target.value }))
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Transaction Type
            </label>
            <select
              className="input-dark"
              value={form.transaction_type}
              onChange={(event) =>
                setForm((old) => ({
                  ...old,
                  transaction_type: event.target.value,
                }))
              }
            >
              {transactionTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">
              Location
            </label>
            <select
              className="input-dark"
              value={form.location}
              onChange={(event) =>
                setForm((old) => ({ ...old, location: event.target.value }))
              }
            >
              {[
                ...new Set([
                  ...(context?.known_locations || []),
                  ...locationOptions,
                ]),
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Time</label>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <input
                className="input-dark"
                type="text"
                placeholder="hh:mm"
                maxLength={5}
                value={form.transaction_time}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    transaction_time: event.target.value,
                  }))
                }
              />
              <select
                className="input-dark"
                value={form.transaction_period}
                onChange={(event) =>
                  setForm((old) => ({
                    ...old,
                    transaction_period: event.target.value,
                  }))
                }
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <div className="md:col-span-2 mt-2 flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={submitting}>
              <SendHorizonal className="mr-2 h-4 w-4" />
              {submitting ? "Processing..." : "Send Money"}
            </button>
          </div>
        </form>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <InfoTile
            label="Balance"
            value={`INR ${context?.sender_account?.balance?.toFixed(2) || "0.00"}`}
          />
          <InfoTile
            label="Known Devices"
            value={(context?.known_devices || []).join(", ") || "Mobile"}
          />
          <InfoTile
            label="Known Locations"
            value={(context?.known_locations || []).join(", ")}
          />
        </div>
      </motion.section>

      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-5 shadow-[0_20px_80px_-20px_rgba(6,182,212,0.45)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-white">
                  Confirm UPI PIN
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Authorize this transfer securely using your UPI PIN.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setShowPinModal(false)}
                className="rounded-lg border border-slate-700 p-1.5 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Close UPI PIN modal"
                disabled={submitting}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-sm text-slate-300">
                UPI PIN
              </label>
              <input
                type="password"
                className="input-dark"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                minLength={4}
                maxLength={6}
                autoFocus
                value={upiPinInput}
                onChange={(event) => setUpiPinInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    confirmSendWithPin();
                  }
                }}
                placeholder="Enter 4-6 digit PIN"
              />
            </div>

            {pinError && (
              <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                {pinError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setShowPinModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={confirmSendWithPin}
                disabled={submitting}
              >
                {submitting ? "Verifying..." : "Confirm Transfer"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {completedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-slate-950/95 p-6 text-center shadow-[0_20px_80px_-20px_rgba(16,185,129,0.45)]"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/50 bg-emerald-500/20">
              <CheckCircle2 className="h-9 w-9 text-emerald-300" />
            </div>

            <h2 className="mt-4 font-display text-2xl font-bold text-white">
              Transaction Completed
            </h2>
            <p className="mt-2 text-emerald-200">
              Transaction completed successfully.
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Transaction ID: {completedTransfer.transaction_id}
            </p>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-primary w-full"
                onClick={() => setCompletedTransfer(null)}
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/45 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}
