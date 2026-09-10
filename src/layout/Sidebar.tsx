import { NavLink } from "react-router-dom";
import type { NavGroup, SessionUser } from "../types";
import { Avatar } from "../components/ui/Avatar";

interface SidebarProps {
  brand: string;
  navGroups: NavGroup[];
  user: SessionUser;
  activeId?: string;
  onNavigate?: () => void;
}

/** Left sidebar — reused by every role's page (nav config is data-driven). */
export function Sidebar({ brand, navGroups, user, activeId, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="wordmark">{brand}</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <span className="nav-section-label">{group.label}</span>
            <ul>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`.trim()}
                      onClick={onNavigate}
                      aria-current={item.id === activeId ? "page" : undefined}
                    >
                      <Icon aria-hidden="true" />
                      <span className="nav-label">{item.label}</span>
                      {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="side-user">
        <Avatar initials={user.initials} color={user.color} title={user.name} />
        <div className="u-meta">
          <span className="u-name">{user.name}</span>
          <span className="u-role">{user.role}</span>
        </div>
      </div>
    </aside>
  );
}
