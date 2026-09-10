import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useAuth } from "../lib/AppProviders";
import { employeeUser } from "../data/session";
import type { MobileTab, SessionUser } from "../types";
import { Sidebar } from "../layout/Sidebar";
import { Topbar } from "../layout/Topbar";
import { NotificationsPopover } from "../layout/Popovers";
import type { RoleConfig } from "./nav";
import { resolveRouteMeta } from "./nav";

const BRAND = "HEXOVATE";

export interface ShellContext {
  variant: "desktop" | "mobile";
  cfg: RoleConfig;
}

function Tabs({ tabs, activeId }: { tabs: MobileTab[]; activeId?: string }) {
  return (
    <nav className="mobile-tabs" aria-label="Primary">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeId;
        return (
          <NavLink key={tab.id} to={tab.to} className={`tab ${isActive ? "active" : ""}`.trim()} aria-current={isActive ? "page" : undefined}>
            <Icon aria-hidden="true" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/** Shared chrome for Executive / Department Head / Manager experiences. */
export function LeaderShell({ cfg }: { cfg: RoleConfig }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const shellUser: SessionUser = session ?? employeeUser;
  const meta = resolveRouteMeta(cfg, location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const context: ShellContext = { variant: isDesktop ? "desktop" : "mobile", cfg };

  if (isDesktop) {
    return (
      <div className="desktop-layout">
        <Sidebar brand={BRAND} navGroups={cfg.groups} user={shellUser} activeId={meta.activeId} />
        <div className="app-main">
          <Topbar crumb={meta.crumb} onSearch={() => navigate(cfg.peoplePath)} user={shellUser} searchPlaceholder={`Find people (${cfg.orgWide ? "company" : "team"})`} settingsTo={cfg.settingsTo} />
          <main className="app-content">
            <Outlet context={context} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-layout">
      <header className="mobile-topbar">
        <span className="mobile-topbar-left">
          <button type="button" className="icon-btn" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu aria-hidden="true" />
          </button>
          <span className="wordmark">{meta.title}</span>
        </span>
        <NotificationsPopover />
      </header>
      <div className="mobile-scroll">
        <Outlet context={context} />
      </div>
      <Tabs tabs={cfg.tabs} activeId={meta.activeId} />

      {menuOpen ? (
        <div className="menu-drawer" role="presentation" onMouseDown={() => setMenuOpen(false)}>
          <div className="panel" onMouseDown={(e) => e.stopPropagation()}>
            <div className="brand">
              <span className="wordmark">{BRAND}</span>
              <button type="button" className="icon-btn-flat" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="groups">
              <Sidebar brand="" navGroups={cfg.groups} user={shellUser} activeId={meta.activeId} onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="side-user" style={{ flexDirection: "column", alignItems: "stretch", height: "auto", gap: 4, padding: "10px 16px 16px" }}>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate(cfg.settingsTo);
                }}
              >
                <Settings aria-hidden="true" />
                <span>Account Settings</span>
              </button>
              <button
                type="button"
                className="menu-item danger"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
              >
                <LogOut aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
