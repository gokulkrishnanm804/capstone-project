import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Gift,
  History,
  Home,
  LogIn,
  LogOut,
  UserCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: Home },
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: BarChart3,
    auth: true,
    hideForRoles: ["analyst", "admin"],
  },
  {
    label: "Transfer",
    path: "/simulate",
    icon: Sparkles,
    auth: true,
    hideForRoles: ["analyst", "admin"],
  },
  {
    label: "History",
    path: "/history",
    icon: History,
    auth: true,
    hideForRoles: ["analyst", "admin"],
  },
  {
    label: "Rewards",
    path: "/rewards",
    icon: Gift,
    auth: true,
    hideForRoles: ["analyst", "admin"],
  },
  {
    label: "Fraud Queries",
    path: "/my-fraud-queries",
    icon: AlertTriangle,
    auth: true,
    role: "user",
  },
  {
    label: "Admin",
    path: "/admin",
    icon: ShieldCheck,
    auth: true,
    role: "admin",
  },
  {
    label: "Transactions",
    path: "/analyst/transactions",
    icon: History,
    auth: true,
    roles: ["analyst", "admin"],
  },
  {
    label: "Fraud Queue",
    path: "/analyst/cases",
    icon: AlertTriangle,
    auth: true,
    role: "analyst",
  },
  {
    label: "Answered Queries",
    path: "/analyst/answered-queries",
    icon: AlertTriangle,
    auth: true,
    role: "analyst",
  },
  {
    label: "Pending Queries",
    path: "/analyst/pending-queries",
    icon: AlertTriangle,
    auth: true,
    role: "analyst",
  },
  {
    label: "Admin Review",
    path: "/admin/cases",
    icon: ShieldCheck,
    auth: true,
    role: "admin",
  },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const isAuthScreen =
    location.pathname === "/login" || location.pathname === "/register";

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isAuthScreen && item.path === "/") return false;
    if (item.auth && !isAuthenticated) return false;
    if (item.hideForRoles && item.hideForRoles.includes(user?.role))
      return false;
    if (item.roles && !item.roles.includes(user?.role)) return false;
    if (item.role && user?.role !== item.role) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    setProfileOpen(false);
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const roleLabel = user?.role
    ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
    : "Member";

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-200/20 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 p-2 shadow-neon">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-cyan-100">
              SentinelPay
            </p>
            <p className="text-xs text-slate-400">
              Simulation-first banking defense
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-cyan-400/15 text-cyan-100"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-slate-900/45 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-slate-800/70"
                  onClick={() => setProfileOpen((old) => !old)}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                >
                  <UserCircle2 className="h-4 w-4" />
                  Profile
                  <ChevronDown
                    className={`h-4 w-4 transition ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="absolute right-0 top-[calc(100%+10px)] w-72 rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-4 shadow-2xl backdrop-blur"
                    >
                      <p className="text-xs uppercase tracking-wide text-cyan-300/80">
                        Signed in as
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white break-words">
                        {user?.name || "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 break-all">
                        {user?.email || "-"}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-2">
                          <p className="text-slate-400">Role</p>
                          <p className="mt-0.5 font-semibold text-cyan-100">
                            {roleLabel}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-2">
                          <p className="text-slate-400">Status</p>
                          <p
                            className={`mt-0.5 font-semibold ${
                              user?.is_blocked
                                ? "text-rose-200"
                                : "text-emerald-200"
                            }`}
                          >
                            {user?.is_blocked ? "Blocked" : "Active"}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">
              <LogIn className="mr-2 h-4 w-4" /> Sign In
            </Link>
          )}
        </div>

        <button
          type="button"
          className="rounded-xl border border-cyan-300/30 px-3 py-2 text-cyan-100 md:hidden"
          onClick={() => setOpen((old) => !old)}
        >
          Menu
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-cyan-200/20 bg-slate-950/90 md:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {visibleItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  {item.label}
                </Link>
              ))}
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => setProfileOpen((old) => !old)}
                    className="flex w-full items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-semibold text-cyan-100"
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4" />
                      Profile
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition ${
                        profileOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {profileOpen && (
                    <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-200">
                      <p className="text-slate-400">Name</p>
                      <p className="mt-1 break-words font-semibold text-white">
                        {user?.name || "-"}
                      </p>
                      <p className="mt-2 text-slate-400">Email</p>
                      <p className="mt-1 break-all">{user?.email || "-"}</p>
                      <p className="mt-2 text-slate-400">Role</p>
                      <p className="mt-1 font-semibold text-cyan-100">
                        {roleLabel}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                    className="block w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm font-semibold text-slate-100"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
