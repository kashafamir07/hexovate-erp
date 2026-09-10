import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AtSign,
  Bell,
  CalendarCheck,
  LogOut,
  Megaphone,
  Settings,
  ClipboardList,
} from "lucide-react";
import { useAuth, useNotifications } from "../lib/AppProviders";
import { useClickOutside } from "../lib/useClickOutside";
import { employeeUser } from "../data/session";
import { Avatar } from "../components/ui/Avatar";
import type { NotificationItem } from "../data/session";

const notifIcons = {
  task: ClipboardList,
  approval: CalendarCheck,
  mention: AtSign,
  announcement: Megaphone,
} as const;

export function NotificationsPopover() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell aria-hidden="true" />
        {unread > 0 ? <span className="count-badge">{unread}</span> : null}
      </button>
      {open ? (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <h3>Notifications</h3>
            <button type="button" className="link-btn" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          <div className="popover-list">
            {items.map((n: NotificationItem) => {
              const Icon = notifIcons[n.icon];
              const isUnread = !n.read;
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item ${isUnread ? "unread" : ""}`.trim()}
                  onClick={() => markRead(n.id)}
                >
                  <span className="notif-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <span className="nt">{n.title}</span>
                    <br />
                    <span className="nb">{n.body}</span>
                    <br />
                    <span className="na">{n.time}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProfileMenu({ settingsTo = "/account" }: { settingsTo?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const me = session ?? employeeUser;

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" aria-label="Profile menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Avatar initials={me.initials} color={me.color} title={me.name} />
      </button>
      {open ? (
        <div className="menu-card" role="menu" aria-label="Profile">
          <div className="menu-head">
            <div className="mn">{me.name}</div>
            <div className="mr">{me.role}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              navigate(settingsTo);
            }}
          >
            <Settings aria-hidden="true" />
            <span>Account Settings</span>
          </button>
          <button type="button" role="menuitem" className="menu-item danger" onClick={() => { setOpen(false); void signOut(); }}>
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
