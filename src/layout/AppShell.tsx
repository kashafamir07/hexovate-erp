import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { useMediaQuery } from "../lib/useMediaQuery";
import { useAuth } from "../lib/AppProviders";
import { employeeMobileTabs, employeeNav, employeeUser } from "../data/session";
import type { MobileTab } from "../types";
import { findRouteMeta } from "../data/pages";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { NotificationsPopover } from "./Popovers";
import { CommandPalette } from "./CommandPalette";

const BRAND = "HEXOVATE";

interface ShellContext {
  variant: "desktop" | "mobile";
}

function MobileTabs({ tabs, activeId }: { tabs: MobileTab[]; activeId?: string }) {
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

/**
 * Shared chrome for every Employee page: desktop shell (sidebar + top bar)
 * or mobile shell (menu + title + bottom tabs) chosen by viewport width.
 * Page content renders through <Outlet/> with a variant in context.
 */
export function AppShell() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const meta = findRouteMeta(location.pathname);
  const shellUser = session ?? employeeUser;

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const context: ShellContext = { variant: isDesktop ? "desktop" : "mobile" };

  if (isDesktop) {
    return (
      <div className="desktop-layout">
        <Sidebar brand={BRAND} navGroups={employeeNav} user={shellUser} activeId={meta.activeId} />
        <div className="app-main">
          <Topbar crumb={meta.crumb} detail={meta.detail} onSearch={() => setPaletteOpen(true)} user={shellUser} />
          <main className="app-content">
            <Outlet context={context} />
          </main>
        </div>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
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
          <span className={`wordmark ${meta.mobileTitle === "HEXOVATE" ? "brand" : ""}`.trim()}>{meta.mobileTitle}</span>
        </span>
        <NotificationsPopover />
      </header>
      <div className="mobile-scroll">
        <Outlet context={context} />
      </div>
      <MobileTabs tabs={employeeMobileTabs} activeId={meta.activeId} />

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
              <Sidebar brand="" navGroups={employeeNav} user={shellUser} activeId={meta.activeId} onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="side-user" style={{ flexDirection: "column", alignItems: "stretch", height: "auto", gap: 4, padding: "10px 16px 16px" }}>
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/account");
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

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
