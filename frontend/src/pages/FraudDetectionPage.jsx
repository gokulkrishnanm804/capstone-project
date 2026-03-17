import { motion } from "framer-motion";
import { AlertTriangle, SendHorizonal } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSimulationContext, runSimulationTransaction } from "../api";
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
const deviceOptions = ["Mobile", "Desktop", "Tablet", "POS"];
const transactionTypeToModelType = {
  UPI: "PAYMENT",
  CARD: "DEBIT",
  TRANSFER: "TRANSFER",
};

export default function FraudDetectionPage() {
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    sender_account: "",
    receiver_account: "",
    amount: "",
    transaction_type: "TRANSFER",
    location: "Delhi",
    device_type: "Mobile",
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
        setError(getApiErrorMessage(err, "Unable to load simulation context."));
      })
      .finally(() => setLoadingContext(false));
  }, []);

  const validateForm = () => {
    if (!form.sender_account) {
      return "Sender account is missing. Please refresh simulation context.";
    }
    if (!form.receiver_account) {
      return "Please select a receiver account.";
    }
    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return "Please enter an amount greater than 0.";
    }
    return null;
  };

  const onSubmit = async (mode) => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await runSimulationTransaction({
        ...form,
        amount: Number(form.amount),
        transaction_type:
          transactionTypeToModelType[form.transaction_type] ||
          form.transaction_type,
        mode,
      });
      localStorage.setItem("last_prediction", JSON.stringify(response.data));
      navigate("/result", { state: { result: response.data } });
    } catch (err) {
      setError(getApiErrorMessage(err, "Transaction simulation failed."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingContext) {
    return (
      <div className="px-6 py-16 text-center text-slate-300">
        Loading simulation engine...
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
          Transaction Simulation
        </h1>
        <p className="mt-2 text-slate-300">
          Execute a normal transfer or trigger fraud simulation rules from one
          controlled workflow.
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
            <label className="mb-1 block text-sm text-slate-300">Device</label>
            <select
              className="input-dark"
              value={form.device_type}
              onChange={(event) =>
                setForm((old) => ({ ...old, device_type: event.target.value }))
              }
            >
              {[
                ...new Set([
                  ...(context?.known_devices || []),
                  ...deviceOptions,
                ]),
              ].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 mt-2 flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={submitting}>
              <SendHorizonal className="mr-2 h-4 w-4" />
              {submitting ? "Processing..." : "Send Money"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onSubmit("simulate")}
              disabled={submitting}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              {submitting ? "Simulating..." : "Simulate Fraud"}
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
