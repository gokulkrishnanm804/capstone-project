import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock3,
  MapPin,
  SendHorizonal,
  UserCheck,
  X,
} from "lucide-react";
import {
  getSimulationContext,
  runSimulationTransaction,
  setUpiPin,
  getIpCity,
  getProfile,
  updateContactInfo,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";

const transactionTypes = [
  { value: "TRANSFER", label: "Bank Transfer" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
];

const transactionTypeToModelType = {
  TRANSFER: "ACCOUNT_TRANSFER",
};

export default function FraudDetectionPage() {
  const [context, setContext] = useState(null);
  const [beneficiaryStatus, setBeneficiaryStatus] = useState({});
  const [form, setForm] = useState({
    sender_account: "",
    receiver_account: "",
    amount: "",
    transaction_type: "TRANSFER",
    upi_id: "",
    mobile_number: "",
    device_type: "Mobile",
    card_number: "",
    ifsc_code: "",
    bank_name: "",
    receiver_mobile_number: "",
    receiver_upi_id: "",
    receiver_card_number: "",
    receiver_card_holder_name: "",
    receiver_account_holder_name: "",
  });
  const [geoLocation, setGeoLocation] = useState({
    city: "",
    latitude: null,
    longitude: null,
    source: "",
  });
  const [serverTime, setServerTime] = useState(null);
  const tickerStartRef = useRef(null);
  const tickerIdRef = useRef(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReceiver, setSelectedReceiver] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [upiPinInput, setUpiPinInput] = useState("");
  const [error, setError] = useState("");
  const [pinError, setPinError] = useState("");
  const [success, setSuccess] = useState("");
  const [requiresSuspiciousConfirm, setRequiresSuspiciousConfirm] =
    useState(false);
  const [requiresHighRiskQuery, setRequiresHighRiskQuery] = useState(false);
  const [highRiskQueryMessage, setHighRiskQueryMessage] = useState("");
  const [profile, setProfile] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    mobile_number: "",
    upi_id: "",
    card_number: "",
    card_holder_name: "",
    account_holder_name: "",
  });
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState("");

  const fetchIpFallback = async () => {
    try {
      const res = await getIpCity();
      const city = res.data?.city || "";
      if (city) {
        setGeoLocation((prev) => ({ ...prev, city, source: "ip" }));
      }
    } catch (err) {
      console.warn("IP city lookup failed", err);
    }
  };

  const saveContactInfo = async () => {
    setContactSaving(true);
    setContactError("");
    try {
      const payload = {
        mobile_number: contactForm.mobile_number
          .replace(/\D/g, "")
          .slice(0, 10),
        upi_id: contactForm.upi_id.trim(),
        account_holder_name: contactForm.account_holder_name.trim(),
        // Card details are optional; only send when present.
        card_number:
          contactForm.card_number.replace(/\D/g, "").length > 0
            ? contactForm.card_number.replace(/\D/g, "")
            : null,
        card_holder_name:
          contactForm.card_number.replace(/\D/g, "").length > 0
            ? contactForm.card_holder_name.trim()
            : null,
      };
      const res = await updateContactInfo(payload);
      setProfile(res.data);
      setContactModalOpen(false);
      setForm((old) => ({
        ...old,
        mobile_number: payload.mobile_number,
        receiver_account_holder_name:
          old.receiver_account_holder_name || payload.account_holder_name,
      }));
    } catch (err) {
      setContactError(
        getApiErrorMessage(err, "Unable to save contact details."),
      );
    } finally {
      setContactSaving(false);
    }
  };

  useEffect(() => {
    getProfile()
      .then((res) => {
        setProfile(res.data);
        const accountHolder =
          res.data.account_holder_name || res.data.name || "";
        if (res.data.mobile_number) {
          setForm((old) => ({ ...old, mobile_number: res.data.mobile_number }));
        }
        if (res.data.registered_card_number) {
          setForm((old) => ({
            ...old,
            card_number: res.data.registered_card_number || old.card_number,
          }));
        }
        if (accountHolder) {
          setForm((old) => ({
            ...old,
            receiver_account_holder_name:
              old.receiver_account_holder_name || accountHolder,
          }));
        }
        if (
          !res.data.has_upi_details ||
          !res.data.has_card_details ||
          !res.data.has_account_details
        ) {
          setContactModalOpen(true);
        }
        setContactForm((old) => ({
          mobile_number: res.data.mobile_number || old.mobile_number,
          upi_id: res.data.upi_id || old.upi_id,
          card_number: res.data.registered_card_number || old.card_number,
          card_holder_name:
            res.data.card_holder_name || res.data.name || old.card_holder_name,
          account_holder_name: accountHolder || old.account_holder_name,
        }));
      })
      .catch(() => {
        /* profile fetch is best-effort; context load will still run */
      });
  }, []);

  useEffect(() => {
    getSimulationContext()
      .then((res) => {
        const data = res.data;
        setContext(data);
        if (data.server_time_ist) {
          const serverNow = new Date(data.server_time_ist);
          setServerTime(serverNow);
          tickerStartRef.current = {
            serverEpochMs: serverNow.getTime(),
            clientEpochMs: Date.now(),
          };
          if (tickerIdRef.current) {
            clearInterval(tickerIdRef.current);
          }
          tickerIdRef.current = setInterval(() => {
            const start = tickerStartRef.current;
            if (!start) return;
            const elapsed = Date.now() - start.clientEpochMs;
            setServerTime(new Date(start.serverEpochMs + elapsed));
          }, 1000);
        }
        const firstReceiver = data.receivers?.[0];
        setForm((old) => ({
          ...old,
          sender_account: data.sender_account?.account_number || "",
          receiver_account: firstReceiver?.account_number || "",
          receiver_account_holder_name:
            old.receiver_account_holder_name || firstReceiver?.owner_name || "",
          device_type: data.known_devices?.[0] || "Mobile",
        }));
        if (firstReceiver) {
          setSelectedReceiver(firstReceiver);
        }
        setBeneficiaryStatus(data.beneficiary_status || {});
        if (data.ip_city_guess) {
          setGeoLocation((prev) => ({
            ...prev,
            city: data.ip_city_guess,
            source: "ip",
          }));
        }
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "Unable to load transfer context."));
      })
      .finally(() => setLoadingContext(false));
  }, []);

  useEffect(() => {
    return () => {
      if (tickerIdRef.current) {
        clearInterval(tickerIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (selectedReceiver) {
      setForm((old) => ({
        ...old,
        receiver_account: selectedReceiver.account_number,
        receiver_account_holder_name:
          selectedReceiver.owner_name || old.receiver_account_holder_name,
      }));
    } else {
      setForm((old) => ({
        ...old,
        receiver_account: "",
        receiver_account_holder_name: "",
      }));
    }
  }, [selectedReceiver]);

  useEffect(() => {
    const controller = new AbortController();
    if (!navigator.geolocation) {
      setGeoLocation((prev) => ({ ...prev, source: "unsupported" }));
      fetchIpFallback();
      return undefined;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setGeoLocation((prev) => ({
          ...prev,
          latitude,
          longitude,
          source: "gps",
        }));

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { signal: controller.signal },
          );
          const data = await response.json();
          const cityName =
            data?.address?.city ||
            data?.address?.state_district ||
            data?.address?.town ||
            data?.address?.village ||
            "";
          setGeoLocation((prev) => ({
            ...prev,
            city: cityName || prev.city,
          }));
          if (!cityName) {
            fetchIpFallback();
          }
        } catch (fetchErr) {
          console.warn("Reverse geocode failed", fetchErr);
          fetchIpFallback();
        }
      },
      (geoErr) => {
        console.warn("Geolocation permission declined", geoErr);
        setGeoLocation((prev) => ({ ...prev, source: "denied" }));
        fetchIpFallback();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 },
    );

    return () => controller.abort();
  }, []);

  const validateForm = () => {
    const receiverAccount = form.receiver_account;
    const type = form.transaction_type;
    const isUpi = type === "UPI";
    const isCard = type === "CARD";
    const isAccountTransfer = type === "TRANSFER";

    if (!form.sender_account) {
      return "Sender account is missing. Please refresh transfer context.";
    }
    if (isAccountTransfer && !receiverAccount) {
      return "Select a receiver account to continue.";
    }
    const amountValue = Number(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return "Please enter an amount greater than 0.";
    }

    if (isUpi) {
      if (!form.receiver_upi_id || !form.receiver_upi_id.includes("@")) {
        return "Enter receiver UPI ID (must include @).";
      }
      if (!/^\d{10}$/.test(form.receiver_mobile_number)) {
        return "Receiver mobile number must be exactly 10 digits.";
      }
    }

    if (isCard) {
      const cardDigits = form.receiver_card_number.replace(/\s+/g, "");
      if (!/^\d{12,19}$/.test(cardDigits)) {
        return "Receiver card number must be between 12 and 19 digits.";
      }
      if (!form.receiver_card_holder_name.trim()) {
        return "Enter receiver card holder name.";
      }
    }

    if (isAccountTransfer) {
      if (!form.ifsc_code || !/^([A-Z]{4}0[A-Z0-9]{6})$/.test(form.ifsc_code)) {
        return "IFSC must be 11 characters (format: AAAA0XXXXXX).";
      }
      if (!receiverAccount) {
        return "Receiver account number is required.";
      }
      if (!form.receiver_account_holder_name.trim()) {
        return "Receiver account holder name is required.";
      }
    }

    return null;
  };

  const executeTransaction = async (mode, upiPin, options = {}) => {
    setSubmitting(true);
    setError("");
    setPinError("");
    setSuccess("");
    const txType = form.transaction_type;
    const isUpiTx = txType === "UPI";
    const isCardTx = txType === "CARD";
    const locationCity =
      geoLocation.city || context?.ip_city_guess || "Unknown";
    const receiverAccount = form.receiver_account;
    const backendTransactionType =
      transactionTypeToModelType[form.transaction_type] ||
      form.transaction_type;
    const payload = {
      sender_account: form.sender_account,
      receiver_account: isAccountTransfer ? receiverAccount : undefined,
      amount: Number(form.amount),
      transaction_type: backendTransactionType,
      location: locationCity,
      device_type: form.device_type,
      geo_latitude: geoLocation.latitude,
      geo_longitude: geoLocation.longitude,
      geo_city: locationCity,
      receiver_mobile_number: isUpiTx ? form.receiver_mobile_number : undefined,
      receiver_upi_id: isUpiTx ? form.receiver_upi_id : undefined,
      receiver_card_number: isCardTx
        ? form.receiver_card_number.replace(/[^0-9]/g, "").slice(0, 19)
        : undefined,
      receiver_card_holder_name: isCardTx
        ? form.receiver_card_holder_name.trim()
        : undefined,
      receiver_account_holder_name: isAccountTransfer
        ? form.receiver_account_holder_name.trim()
        : undefined,
      transaction_time: serverTime ? serverTime.toISOString() : null,
      suspicious_acknowledged: Boolean(options.suspiciousAcknowledged),
      high_risk_query_message: options.highRiskQueryMessage || undefined,
      mode,
      upi_pin: mode === "send" ? upiPin : undefined,
    };

    try {
      const response = await runSimulationTransaction(payload);
      localStorage.setItem("last_prediction", JSON.stringify(response.data));

      if (mode === "send") {
        if (response.data.action_required === "SUSPICIOUS_CONFIRMATION") {
          setRequiresSuspiciousConfirm(true);
          setRequiresHighRiskQuery(false);
          setHighRiskQueryMessage("");
          setPinError("Suspicious transaction detected. Confirm again to continue.");
          return;
        }

        if (response.data.action_required === "CONTACT_ADMIN") {
          setRequiresSuspiciousConfirm(false);
          setRequiresHighRiskQuery(true);
          setPinError(
            "High fraud risk detected. Enter your query for admin approval.",
          );
          return;
        }

        if (response.data.transfer_state === "PENDING_ADMIN_APPROVAL") {
          setShowPinModal(false);
          setRequiresSuspiciousConfirm(false);
          setRequiresHighRiskQuery(false);
          setHighRiskQueryMessage("");
          setUpiPinInput("");
          setForm((old) => ({ ...old, amount: "" }));
          setSuccess(
            "High-risk transfer submitted to admin for approval. Check Approvals page for admin decision and transfer action.",
          );
          return;
        }

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
        setRequiresSuspiciousConfirm(false);
        setRequiresHighRiskQuery(false);
        setHighRiskQueryMessage("");
        setUpiPinInput("");
        setSuccess("Transaction Successful");
        return;
      }
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
          setRequiresSuspiciousConfirm(false);
          setRequiresHighRiskQuery(false);
          setHighRiskQueryMessage("");
          setUpiPinInput("");
          setSuccess("Transaction Successful");
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
      setRequiresSuspiciousConfirm(false);
      setRequiresHighRiskQuery(false);
      setHighRiskQueryMessage("");
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
    if (requiresHighRiskQuery && highRiskQueryMessage.trim().length < 10) {
      setPinError("Query must be at least 10 characters for admin review.");
      return;
    }
    executeTransaction("send", trimmedPin, {
      suspiciousAcknowledged: requiresSuspiciousConfirm,
      highRiskQueryMessage: requiresHighRiskQuery
        ? highRiskQueryMessage.trim()
        : undefined,
    });
  };

  const receiverAccount = form.receiver_account;
  const isUpi = form.transaction_type === "UPI";
  const isCard = form.transaction_type === "CARD";
  const isAccountTransfer = form.transaction_type === "TRANSFER";

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

        {success && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle className="h-4 w-4" />
            {success}
          </p>
        )}

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
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {isAccountTransfer && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-300">
                To Account
              </label>
              <select
                className="input-dark"
                value={selectedReceiver?.account_number || ""}
                onChange={(event) => {
                  const next = context?.receivers?.find(
                    (item) => item.account_number === event.target.value,
                  );
                  setSelectedReceiver(next || null);
                }}
                disabled={!context?.receivers?.length}
              >
                <option value="" disabled>
                  {context?.receivers?.length
                    ? "Select receiver account"
                    : "No receiver accounts available"}
                </option>
                {context?.receivers?.map((receiver) => (
                  <option
                    key={receiver.account_number}
                    value={receiver.account_number}
                  >
                    {`${receiver.owner_name} — ${receiver.account_number}`}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          {isUpi && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Receiver UPI ID
                </label>
                <input
                  className="input-dark"
                  type="text"
                  placeholder="example@upi"
                  value={form.receiver_upi_id}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      receiver_upi_id: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Receiver Mobile Number
                </label>
                <input
                  className="input-dark"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{10}"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={form.receiver_mobile_number}
                  onChange={(event) => {
                    const digits = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setForm((old) => ({
                      ...old,
                      receiver_mobile_number: digits,
                    }));
                  }}
                />
              </div>
            </>
          )}

          {isCard && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Card Number
                </label>
                <input
                  className="input-dark"
                  type="text"
                  inputMode="numeric"
                  placeholder="Receiver card number"
                  value={form.receiver_card_number}
                  onChange={(event) => {
                    const digits = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 19);
                    const spaced = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
                    setForm((old) => ({
                      ...old,
                      receiver_card_number: spaced,
                    }));
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Receiver Card Holder Name
                </label>
                <input
                  className="input-dark"
                  type="text"
                  placeholder="As printed on card"
                  value={form.receiver_card_holder_name}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      receiver_card_holder_name: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          )}

          {isAccountTransfer && (
            <>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  IFSC Code
                </label>
                <input
                  className="input-dark"
                  type="text"
                  maxLength={11}
                  value={form.ifsc_code}
                  onChange={(event) => {
                    const value = event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 11);
                    setForm((old) => ({ ...old, ifsc_code: value }));
                  }}
                  placeholder="SBIN0123456"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Receiver Account Holder Name
                </label>
                <input
                  className="input-dark"
                  type="text"
                  value={form.receiver_account_holder_name}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      receiver_account_holder_name: event.target.value,
                    }))
                  }
                  placeholder="As per bank records"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Bank Name
                </label>
                <input
                  className="input-dark"
                  type="text"
                  value={form.bank_name}
                  onChange={(event) =>
                    setForm((old) => ({
                      ...old,
                      bank_name: event.target.value,
                    }))
                  }
                  placeholder="e.g., State Bank of India"
                />
              </div>
            </>
          )}

          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
              Context used for fraud checks (read-only)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoBarItem
                icon={<MapPin className="h-4 w-4 text-cyan-300" />}
                label="Location"
                value={geoLocation.city || context?.ip_city_guess || "Unknown"}
                badge="auto-detected"
              />
              <InfoBarItem
                icon={<Clock3 className="h-4 w-4 text-amber-300" />}
                label="Time"
                value={
                  serverTime
                    ? serverTime.toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                      })
                    : "Syncing..."
                }
                badge="system"
              />
              <InfoBarItem
                icon={<UserCheck className="h-4 w-4 text-emerald-300" />}
                label="Beneficiary"
                value={
                  (beneficiaryStatus[receiverAccount] ?? true)
                    ? "First Transfer"
                    : "Returning"
                }
                badge={
                  (beneficiaryStatus[receiverAccount] ?? true) ? "NEW" : "KNOWN"
                }
                badgeColor={
                  (beneficiaryStatus[receiverAccount] ?? true)
                    ? "badge-warn"
                    : "badge-safe"
                }
              />
            </div>
          </div>

          <div className="md:col-span-2 mt-2 flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={submitting}>
              <SendHorizonal className="mr-2 h-4 w-4" />
              {submitting ? "Processing..." : "Send Money"}
            </button>
          </div>
        </form>
      </motion.section>

      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-slate-950/95 p-6 shadow-[0_20px_80px_-20px_rgba(6,182,212,0.45)]"
          >
            <h2 className="font-display text-xl font-semibold text-white">
              Add Contact & Card Details
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              For UPI and card payments, register your mobile number and card
              once. These stay on your account and are required for future
              transfers.
            </p>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Registered Mobile Number
                </label>
                <input
                  className="input-dark"
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={contactForm.mobile_number}
                  onChange={(event) => {
                    const digits = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setContactForm((old) => ({
                      ...old,
                      mobile_number: digits,
                    }));
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  UPI ID
                </label>
                <input
                  className="input-dark"
                  type="text"
                  placeholder="example@bank"
                  value={contactForm.upi_id}
                  onChange={(event) =>
                    setContactForm((old) => ({
                      ...old,
                      upi_id: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Registered Card Number
                </label>
                <input
                  className="input-dark"
                  type="text"
                  inputMode="numeric"
                  maxLength={19}
                  placeholder="Enter full card number"
                  value={contactForm.card_number}
                  onChange={(event) => {
                    const digits = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 19);
                    setContactForm((old) => ({ ...old, card_number: digits }));
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Card Holder Name
                </label>
                <input
                  className="input-dark"
                  type="text"
                  placeholder="As printed on card"
                  value={contactForm.card_holder_name}
                  onChange={(event) =>
                    setContactForm((old) => ({
                      ...old,
                      card_holder_name: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Account Holder Name
                </label>
                <input
                  className="input-dark"
                  type="text"
                  placeholder="As per bank records"
                  value={contactForm.account_holder_name}
                  onChange={(event) =>
                    setContactForm((old) => ({
                      ...old,
                      account_holder_name: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {contactError && (
              <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                {contactError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setContactModalOpen(false)}
                disabled={contactSaving}
              >
                Later
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={saveContactInfo}
                disabled={
                  contactSaving ||
                  contactForm.mobile_number.length !== 10 ||
                  !contactForm.upi_id.includes("@") ||
                  contactForm.account_holder_name.trim().length < 2 ||
                  (contactForm.card_number.replace(/\D/g, "").length > 0 &&
                    (contactForm.card_number.replace(/\D/g, "").length < 12 ||
                      contactForm.card_holder_name.trim().length < 2))
                }
              >
                {contactSaving ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
                  {requiresHighRiskQuery
                    ? "High-risk transfer blocked. Share your query to contact admin."
                    : requiresSuspiciousConfirm
                      ? "Suspicious transfer detected. Confirm again to continue."
                      : "Authorize this transfer securely using your UPI PIN."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setShowPinModal(false);
                  setRequiresSuspiciousConfirm(false);
                  setRequiresHighRiskQuery(false);
                  setHighRiskQueryMessage("");
                }}
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

            {requiresHighRiskQuery && (
              <div className="mt-4">
                <label className="mb-1 block text-sm text-slate-300">
                  Contact Admin Query
                </label>
                <textarea
                  className="input-dark min-h-[90px]"
                  value={highRiskQueryMessage}
                  onChange={(event) => setHighRiskQueryMessage(event.target.value)}
                  placeholder="Explain why this transaction is valid."
                />
              </div>
            )}

            {pinError && (
              <p className="mt-3 rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                {pinError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setShowPinModal(false);
                  setRequiresSuspiciousConfirm(false);
                  setRequiresHighRiskQuery(false);
                  setHighRiskQueryMessage("");
                }}
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
                {submitting
                  ? "Processing..."
                  : requiresHighRiskQuery
                    ? "Submit Query"
                    : requiresSuspiciousConfirm
                      ? "Confirm Anyway"
                      : "Confirm Transfer"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function InfoBarItem({ icon, label, value, badge, badgeColor }) {
  const badgeClass =
    badgeColor === "badge-safe"
      ? "bg-emerald-900/60 text-emerald-200 border border-emerald-700/60"
      : badgeColor === "badge-warn"
        ? "bg-amber-900/60 text-amber-200 border border-amber-700/60"
        : "bg-slate-800 text-cyan-200 border border-slate-700/70";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
      <div className="mt-1 h-8 w-8 rounded-full bg-slate-800/70 flex items-center justify-center">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
          <span>{label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${badgeClass}`}
          >
            {badge}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-100">
          {value || "Unknown"}
        </p>
      </div>
    </div>
  );
}
