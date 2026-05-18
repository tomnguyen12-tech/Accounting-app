import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Upload,
  ReceiptText,
  PieChart,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/format";

const NAV = [
  { to: "/", label: "Dashboard", ko: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/transactions", label: "Transactions", ko: "거래내역", icon: ReceiptText },
  { to: "/import", label: "Import", ko: "데이터 가져오기", icon: Upload },
  { to: "/report", label: "Monthly Report", ko: "월별 리포트", icon: PieChart },
  { to: "/users", label: "Users", ko: "사용자", icon: Users },
  { to: "/cards", label: "Cards", ko: "법인카드", icon: CreditCard },
  { to: "/settings", label: "Category Rules", ko: "분류 규칙", icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white font-bold">
            E
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Expense Assistant</p>
            <p className="text-[11px] text-slate-400">AI 경비 관리</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-600"
                    : "text-slate-600 hover:bg-slate-50",
                )
              }
            >
              <n.icon className="h-4 w-4" />
              <span>
                {n.ko} <span className="text-[11px] text-slate-400">· {n.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 px-2">
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-[11px] text-slate-400">
              {user?.email} · {user?.role}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" /> 로그아웃 / Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 md:hidden">
          <p className="font-bold">Expense Assistant</p>
          <button onClick={() => navigate("/")} className="text-sm text-brand-600">
            메뉴
          </button>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
