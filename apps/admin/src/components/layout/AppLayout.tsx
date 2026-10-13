import clsx from "clsx";
import {
  Activity,
  ArrowLeftRight,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Plane,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import type { Lang } from "../../lib/i18n";

const navItems = [
  { to: "/", key: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/fans", key: "nav.fans", icon: Users, end: false },
  { to: "/subscriptions", key: "nav.subscriptions", icon: CreditCard, end: false },
  { to: "/campaigns", key: "nav.campaigns", icon: Megaphone, end: false },
  { to: "/home-games", key: "nav.homeGames", icon: Home, end: false },
  { to: "/away-games", key: "nav.awayGames", icon: Plane, end: false },
  { to: "/behavior", key: "nav.behavior", icon: Activity, end: false },
  { to: "/comparisons", key: "nav.comparisons", icon: ArrowLeftRight, end: false },
  { to: "/store", key: "nav.store", icon: ShoppingBag, end: false },
  { to: "/settings", key: "nav.settings", icon: Settings, end: false },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const langs: { code: Lang; label: string }[] = [
    { code: "he", label: "עברית" },
    { code: "en", label: "English" },
  ];
  return (
    <div className="flex rounded-lg bg-white/5 p-1">
      {langs.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => void i18n.changeLanguage(code)}
          className={clsx(
            "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
            i18n.language === code
              ? "bg-brand text-white"
              : "text-gray-400 hover:text-white",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen">
      {/* First flex child renders on the start side — right in RTL, left in LTR */}
      <aside className="w-64 shrink-0 bg-sidebar text-white flex flex-col sticky top-0 h-screen overflow-y-auto">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
          {user?.clubLogoUrl && (
            <img
              src={user.clubLogoUrl}
              alt=""
              className="size-11 shrink-0 rounded-lg bg-white/10 object-contain p-1"
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-brand">
              {user?.clubName ?? t("nav.clubName")}
            </h1>
            <p className="text-sm text-gray-400 mt-1">{t("nav.crm")}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, key, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand text-white"
                    : "text-gray-300 hover:bg-sidebar-hover hover:text-white",
                )
              }
            >
              <Icon className="size-5" />
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <LanguageSwitcher />
          <div className="flex items-center gap-3">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-9 rounded-full shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="size-9 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold shrink-0">
                {user?.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-400 truncate" dir="ltr">
                {user?.email}
              </p>
            </div>
            <button
              onClick={() => void logout()}
              title={t("nav.logout")}
              className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-sidebar-hover hover:text-white transition-colors"
            >
              <LogOut className="size-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">{t("nav.season")}</p>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
