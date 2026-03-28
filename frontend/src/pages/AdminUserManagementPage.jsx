import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../components/AdminSidebar";
import {
  getAdminUsers,
  getAdminUserProfile,
  updateAdminUserStatus,
  updateAdminUserProfileImage,
} from "../api";
import { getApiErrorMessage } from "../utils/apiError";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  getAvatarUrl,
} from "../utils/avatarOptions";

export default function AdminUserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [filters, setFilters] = useState({
    name: "",
    status: "",
    joinDate: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const PAGE_SIZE = 6;

  const statusStyles = {
    ACTIVE: "bg-emerald-900/60 text-emerald-200 border border-emerald-700/50",
    SUSPENDED: "bg-amber-900/60 text-amber-200 border border-amber-700/50",
    DEACTIVATED: "bg-rose-900/60 text-rose-200 border border-rose-700/50",
  };

  const loadUsers = () => {
    setLoading(true);
    getAdminUsers()
      .then((res) => setUsers(res.data || []))
      .catch((err) =>
        setError(getApiErrorMessage(err, "Unable to load users.")),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchName = filters.name
        ? user.name.toLowerCase().includes(filters.name.toLowerCase())
        : true;
      const matchStatus = filters.status
        ? user.status === filters.status
        : true;
      const matchJoin = filters.joinDate
        ? user.join_date?.startsWith(filters.joinDate)
        : true;
      return matchName && matchStatus && matchJoin;
    });
  }, [users, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE) || 1);
  const pagedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const closeProfile = () => {
    setIsProfileOpen(false);
    setSelectedUser(null);
    setProfile(null);
  };

  const handleView = async (userId) => {
    setSelectedUser(userId);
    setIsProfileOpen(true);
    setProfile(null);
    setError("");
    try {
      const res = await getAdminUserProfile(userId);
      setProfile(res.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load user profile."));
      setIsProfileOpen(false);
    }
  };

  const handleStatus = async (userId, status) => {
    setActionLoading(true);
    setError("");
    try {
      await updateAdminUserStatus(userId, { status });
      loadUsers();
      if (selectedUser === userId) {
        const res = await getAdminUserProfile(userId);
        setProfile(res.data);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update user status."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAvatarUpdate = async (filename) => {
    if (!selectedUser) return;
    setAvatarSaving(true);
    setError("");
    try {
      const res = await updateAdminUserProfileImage(selectedUser, {
        profile_image: filename,
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === selectedUser
            ? { ...u, profile_image: res.data.profile_image }
            : u,
        ),
      );
      const profileRes = await getAdminUserProfile(selectedUser);
      setProfile(profileRes.data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to update profile image."));
    } finally {
      setAvatarSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        <AdminSidebar />
        <div className="flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-white">
                User Management
              </h1>
              <p className="mt-1 text-slate-300">
                Review user accounts, balances, and status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <input
                className="input-dark w-48"
                placeholder="Search name"
                value={filters.name}
                onChange={(e) =>
                  setFilters({ ...filters, name: e.target.value })
                }
              />
              <select
                className="input-dark w-40"
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="">Any status</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DEACTIVATED">Deactivated</option>
              </select>
              <input
                className="input-dark w-40"
                type="date"
                value={filters.joinDate}
                onChange={(e) =>
                  setFilters({ ...filters, joinDate: e.target.value })
                }
              />
            </div>
          </div>

          {loading ? (
            <div className="mt-6 text-slate-300">Loading users...</div>
          ) : error ? (
            <div className="mt-6 rounded-xl bg-rose-500/15 px-4 py-3 text-rose-200">
              {error}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 shadow-lg shadow-black/10">
              <div className="max-h-[640px] overflow-auto rounded-xl border border-slate-800/80">
                <table className="min-w-full table-fixed text-sm text-slate-200">
                  <thead className="bg-slate-900/80 text-left text-slate-400">
                    <tr>
                      <th className="w-2/5 px-4 py-3">User</th>
                      <th className="w-1/5 px-4 py-3">Account</th>
                      <th className="w-1/6 px-4 py-3">Status</th>
                      <th className="w-1/4 px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((user) => (
                      <tr
                        key={user.user_id}
                        className="border-t border-slate-800/80"
                      >
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 h-9 w-9 overflow-hidden rounded-full border border-slate-800/70 bg-slate-900/70">
                              <img
                                src={getAvatarUrl(
                                  user.profile_image || DEFAULT_AVATAR,
                                )}
                                alt={user.name}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </span>
                            <div>
                              <p className="font-semibold leading-tight">
                                {user.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          <div className="font-semibold text-slate-100">
                            {user.account_number || "-"}
                          </div>
                          <div className="text-slate-400">
                            ₹ {user.balance?.toLocaleString() || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                              statusStyles[user.status] ||
                              "bg-slate-800 text-slate-100"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1 text-xs"
                              onClick={() => handleView(user.user_id)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn-primary px-3 py-1 text-xs"
                              disabled={actionLoading}
                              onClick={() =>
                                handleStatus(user.user_id, "SUSPENDED")
                              }
                            >
                              Suspend
                            </button>
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1 text-xs"
                              disabled={actionLoading}
                              onClick={() =>
                                handleStatus(user.user_id, "ACTIVE")
                              }
                            >
                              Activate
                            </button>
                            <button
                              type="button"
                              className="btn-secondary px-3 py-1 text-xs"
                              disabled={actionLoading}
                              onClick={() =>
                                handleStatus(user.user_id, "DEACTIVATED")
                              }
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between px-1 text-sm text-slate-300">
                <span>
                  Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <span className="text-slate-400">
                    Page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-1 text-xs"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isProfileOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-950/90 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="h-12 w-12 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  <img
                    src={getAvatarUrl(
                      profile?.user?.profile_image || DEFAULT_AVATAR,
                    )}
                    alt={profile?.user?.name || "User avatar"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
                <div>
                  <p className="text-sm text-slate-400">User Profile</p>
                  <p className="text-lg font-semibold text-white">
                    {profile?.user?.name || "Loading..."}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile?.user?.email || "--"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary px-3 py-1 text-xs"
                onClick={closeProfile}
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-1">
                {selectedUser && !profile && (
                  <p className="text-sm text-slate-300">Loading profile...</p>
                )}
                {profile && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-400">
                        {profile.user.email}
                      </p>
                      <p className="text-xl font-semibold text-white">
                        {profile.user.name}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                          statusStyles[profile.user.status] ||
                          "bg-slate-800 text-slate-100"
                        }`}
                      >
                        {profile.user.status}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Profile image
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {AVATAR_OPTIONS.map((option) => {
                          const active =
                            profile.user.profile_image === option.filename;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                handleAvatarUpdate(option.filename)
                              }
                              className={`flex items-center gap-2 rounded-lg border bg-slate-900/60 p-2 text-left text-xs transition hover:border-cyan-300/50 ${
                                active
                                  ? "border-cyan-300/80 ring-1 ring-cyan-300/50"
                                  : "border-slate-800/70"
                              }`}
                              disabled={avatarSaving}
                            >
                              <span className="h-9 w-9 overflow-hidden rounded-md border border-slate-800/70 bg-slate-900">
                                <img
                                  src={getAvatarUrl(option.filename)}
                                  alt={option.label}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </span>
                              <div className="flex-1">
                                <p className="font-semibold text-white">
                                  {option.label}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {option.filename}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {avatarSaving && (
                        <p className="mt-2 text-[11px] text-cyan-200">
                          Updating avatar...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-2">
                <p className="text-sm font-semibold text-white">Transactions</p>
                <div className="mt-3 h-64 overflow-y-auto rounded-lg border border-slate-800/60 bg-slate-950/60 text-xs text-slate-200">
                  {profile ? (
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-900/80 text-slate-400">
                        <tr>
                          <th className="px-3 py-2">ID</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {profile.transactions.map((tx) => (
                          <tr key={tx.transaction_id}>
                            <td className="px-3 py-2 font-mono text-[11px] leading-tight break-all">
                              {tx.transaction_id}
                            </td>
                            <td className="px-3 py-2">
                              ₹ {tx.amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">{tx.prediction}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      Loading...
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-3">
                <p className="text-sm font-semibold text-white">
                  Known Locations
                </p>
                {profile ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.known_locations.map((loc) => (
                      <span
                        key={loc}
                        className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-200"
                      >
                        {loc}
                      </span>
                    ))}
                    {!profile.known_locations.length && (
                      <span className="text-xs text-slate-400">
                        No locations recorded
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">Loading...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
