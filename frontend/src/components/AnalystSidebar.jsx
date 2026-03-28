import { NavLink, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/analyst/dashboard", label: "Dashboard" },
  { to: "/analyst/transactions", label: "Transaction Monitor" },
  { to: "/analyst/alerts", label: "Alerts" },
  { to: "/analyst/reports", label: "Reports" },
];

export default function AnalystSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-56 shrink-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Fraud Analyst
      </p>
      <nav className="mt-3 space-y-2">
        {LINKS.map((link) => {
          const isActive = pathname.startsWith(link.to);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`block rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-slate-800/80 ${
                isActive ? "bg-slate-800/80 text-white" : "text-slate-300"
              }`}
            >
              {link.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
