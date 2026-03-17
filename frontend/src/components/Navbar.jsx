import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  BrainCircuit,
  History,
  Home,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const NAV_ITEMS = [
  { label: "Home", path: "/", icon: Home },
  { label: "Dashboard", path: "/dashboard", icon: BarChart3, auth: true },
  { label: "Simulation", path: "/simulate", icon: Sparkles, auth: true },
  { label: "History", path: "/history", icon: History, auth: true },
  {
    label: "Model Insight",
    path: "/model-insight",
    icon: BrainCircuit,
    auth: true,
  },
  {
    label: "Admin",
    path: "/admin",
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

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.auth && !isAuthenticated) return false;
    if (item.role && user?.role !== item.role) return false;
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-cyan-200/20 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-300/40 bg-cyan-400/10 p-2 shadow-neon">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-cyan-100">
              FraudGuard AI
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
              <span className="text-sm text-slate-300">
                {user?.name || user?.email}
              </span>
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
