import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Mail,
  ShieldCheck,
  Sparkles,
  User2,
  WifiOff,
} from "lucide-react";
import { getProfile, updateProfileImage } from "../api";
import { useAuth } from "../AuthContext";
import { getApiErrorMessage } from "../utils/apiError";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  getAvatarUrl,
} from "../utils/avatarOptions";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getProfile()
      .then((res) => {
        setProfile(res.data);
        updateUser(res.data);
      })
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load profile.")),
      )
      .finally(() => setLoading(false));
  }, [updateUser]);

  const avatarFilename =
    profile?.profile_image || user?.profile_image || DEFAULT_AVATAR;

  const stats = useMemo(() => {
    return [
      {
        label: "Status",
        value: profile?.status || "--",
        tone: profile?.is_blocked ? "text-rose-200" : "text-emerald-200",
      },
      {
        label: "Role",
        value: profile?.role ? profile.role.toUpperCase() : "--",
        tone: "text-cyan-200",
      },
      {
        label: "UPI Setup",
        value: profile?.has_upi_details ? "Onboarded" : "Pending",
        tone: profile?.has_upi_details ? "text-emerald-200" : "text-amber-200",
      },
      {
        label: "Card Details",
        value: profile?.has_card_details ? "Added" : "Missing",
        tone: profile?.has_card_details ? "text-emerald-200" : "text-amber-200",
      },
    ];
  }, [profile]);

  const handleAvatarChange = async (filename) => {
    setSavingAvatar(true);
    setError("");
    setSuccess("");
    try {
      const res = await updateProfileImage({ profile_image: filename });
      setProfile(res.data);
      updateUser(res.data);
      setSuccess("Profile image updated");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update profile image."));
    } finally {
      setSavingAvatar(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-8 text-center text-slate-300">
          Loading your profile…
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <section className="glass relative overflow-hidden rounded-3xl p-8 sm:p-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -bottom-16 left-10 h-52 w-52 rounded-full bg-indigo-500/15 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" /> SentinelPay Profile
            </p>
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
              Your identity across UPI, rewards, and risk decisions
            </h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Manage your avatar and see the essentials that power SentinelPay’s
              explainable fraud defenses. Admins see the same consistent
              identity controls.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
              <BadgeCheck className="h-4 w-4" /> JWT-secured session active
            </div>
          </div>

          <div className="glass rounded-2xl border border-cyan-300/25 bg-slate-950/60 p-6 shadow-lg shadow-cyan-500/10">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-cyan-300/30 bg-slate-900/70 shadow-neon">
                <img
                  src={getAvatarUrl(avatarFilename)}
                  alt="Profile avatar"
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div>
                <p className="text-sm text-slate-400">Signed in as</p>
                <p className="text-lg font-semibold text-white">
                  {profile?.name || user?.name}
                </p>
                <p className="text-xs text-slate-400 break-all">
                  {profile?.email || user?.email}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              {stats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-800/70 bg-slate-900/70 px-3 py-2"
                >
                  <p className="text-slate-400">{item.label}</p>
                  <p className={`mt-1 font-semibold ${item.tone}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      )}

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold text-white">
                Choose your SentinelPay avatar
              </h2>
              <p className="text-sm text-slate-400">
                Pick one of the curated profile logos. Applies to both user and
                admin surfaces.
              </p>
            </div>
            {savingAvatar && (
              <span className="text-xs text-cyan-200">Saving…</span>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AVATAR_OPTIONS.map((option) => {
              const active = avatarFilename === option.filename;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleAvatarChange(option.filename)}
                  className={`group rounded-2xl border bg-slate-900/60 p-3 text-left transition hover:-translate-y-1 hover:border-cyan-300/60 hover:shadow-lg hover:shadow-cyan-500/10 ${
                    active
                      ? "border-cyan-300/80 ring-2 ring-cyan-300/60"
                      : "border-slate-800/70"
                  }`}
                  disabled={savingAvatar}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-900/70">
                      <img
                        src={getAvatarUrl(option.filename)}
                        alt={option.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {option.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {option.filename}
                      </p>
                    </div>
                  </div>
                  {active && (
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                      <Sparkles className="h-3.5 w-3.5" /> Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <User2 className="h-5 w-5 text-cyan-200" />
            <h2 className="font-display text-xl font-semibold text-white">
              Identity snapshot
            </h2>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-slate-400">Name</p>
              <p className="font-semibold text-white">
                {profile?.name || "--"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-slate-400">Email</p>
              <p className="break-all font-semibold text-white">
                {profile?.email || "--"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-slate-400">Primary account</p>
              <p className="font-semibold text-white">
                {profile?.primary_account_number || "Not linked"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-slate-400">Account holder</p>
              <p className="font-semibold text-white">
                {profile?.account_holder_name || "--"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-slate-400">Mobile</p>
              <p className="font-semibold text-white">
                {profile?.mobile_number || "Not provided"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="text-slate-400">UPI ID</p>
              <p className="font-semibold text-white">
                {profile?.upi_id || "Not provided"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            <WifiOff className="mr-2 inline-block h-4 w-4" />
            Contact updates are read-only here. Use UPI setup flows to add or
            edit details.
          </div>
        </div>
      </section>
    </main>
  );
}
