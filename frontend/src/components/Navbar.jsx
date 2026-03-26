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
import { DEFAULT_AVATAR, getAvatarUrl } from "../utils/avatarOptions";

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: Home },
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: BarChart3,
    auth: true,
    hideForRoles: ["admin"],
  },
  {
    label: "Transfer",
    path: "/simulate",
    icon: Sparkles,
    auth: true,
    hideForRoles: ["admin"],
  },
  {
    label: "History",
    path: "/history",
    icon: History,
    auth: true,
    hideForRoles: ["admin"],
  },
  {
    label: "Rewards",
    path: "/rewards",
    icon: Gift,
    auth: true,
    hideForRoles: ["admin"],
  },
  {
    label: "Admin",
    path: "/admin/dashboard",
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
    setOpen(false);
  }, [location.pathname]);

  const roleLabel = user?.role
    ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}`
    : "Member";

  const avatarSrc = getAvatarUrl(user?.profile_image || DEFAULT_AVATAR);

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
              <Link
                to="/profile"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-slate-900/45 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-slate-800/70"
              >
                <span className="flex items-center gap-2">
                  <span className="h-7 w-7 overflow-hidden rounded-full border border-cyan-300/40 bg-slate-900/70">
                    <img
                      src={avatarSrc}
                      alt="Profile avatar"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </span>
                  Profile
                </span>
              </Link>
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
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="block w-full rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-semibold text-cyan-100"
                  >
                    <span className="inline-flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4" />
                      Profile
                    </span>
                  </Link>
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
