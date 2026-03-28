import { NavLink, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/reports", label: "Ops Reports" },
  { to: "/admin/users", label: "User Management" },
  { to: "/admin/transactions", label: "Transactions" },
  { to: "/admin/user-queries", label: "User Queries" },
  { to: "/admin/models", label: "ML Models" },
  { to: "/admin/rewards", label: "Cashback & Rewards" },
];

export default function AdminSidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="w-64 shrink-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">Admin</p>
      <nav className="mt-3 space-y-2">
        {LINKS.map((link) => {
          const isActive = pathname.startsWith(link.to);
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={`block rounded-xl px-3 py-2 text-sm font-semibold transition hover:bg-slate-800/80 ${
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
