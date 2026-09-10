import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import type { SessionUser } from "../types";
import type { NotificationItem } from "../data/session";
import type { ApiUser } from "../api/auth";
import { authApi } from "../api/auth";
import { notificationsApi } from "../api/notifications";
import { getToken, setToken } from "../api/client";

/* ---------------- Auth ---------------- */
export const ROLE_LABEL: Record<ApiUser["role"], string> = {
  employee: "Employee",
  manager: "Manager",
  admin: "Admin",
  hr: "HR",
  executive: "Executive",
  ceo: "CEO",
  company_admin: "Company Admin",
  super_admin: "Super Admin",
};

interface AuthCtx {
  user: ApiUser | null;
  /** Shape the shell renders (initials avatar + role chip). */
  session: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const authCtx = createContext<AuthCtx | null>(null);

export function useAuth(): AuthCtx {
  const ctx = useContext(authCtx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}

/* ---------------- Notifications ---------------- */
interface NotificationsCtx {
  items: NotificationItem[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => Promise<void>;
}

const notificationsCtx = createContext<NotificationsCtx | null>(null);

export function useNotifications(): NotificationsCtx {
  const ctx = useContext(notificationsCtx);
  if (!ctx) throw new Error("useNotifications outside provider");
  return ctx;
}

/* ---------------- Toasts ---------------- */
export interface Toast {
  id: number;
  text: string;
  tone: "success" | "error";
}

interface ToastCtx {
  push: (text: string, tone?: Toast["tone"]) => void;
}

const toastCtx = createContext<ToastCtx | null>(null);

export function useToasts(): ToastCtx {
  const ctx = useContext(toastCtx);
  if (!ctx) throw new Error("useToasts outside provider");
  return ctx;
}

let toastId = 0;

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ---- session bootstrap: token → /auth/me ---- */
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }
    let cancelled = false;
    authApi
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // Invalid token was already cleared by the client; network errors keep the UI bootable.
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    setToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* the local session is cleared regardless */
    }
    setToken(null);
    setUser(null);
    setItems([]);
    setUnread(0);
  }, []);

  const session = useMemo<SessionUser | null>(
    () =>
      user
        ? {
            name: user.name,
            role: ROLE_LABEL[user.role] ?? user.role,
            initials: user.initials || user.name.slice(0, 2).toUpperCase(),
            color: user.color,
          }
        : null,
    [user]
  );

  /* ---- notifications: fetch for the signed-in user ---- */
  const refresh = useCallback(async () => {
    try {
      const data = await notificationsApi.list();
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      /* offline bell keeps its previous state */
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(timer);
  }, [user, refresh]);

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      void notificationsApi.markRead(id).catch(() => undefined);
    },
    []
  );

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    void notificationsApi.markAllRead().catch(() => undefined);
  }, []);

  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const authValue = useMemo(() => ({ user, session, loading: authLoading, login, logout }), [user, session, authLoading, login, logout]);
  const notifValue = useMemo(() => ({ items, unread, markRead, markAllRead, refresh }), [items, unread, markRead, markAllRead, refresh]);
  const toastValue = useMemo(() => ({ push }), [push]);

  return (
    <authCtx.Provider value={authValue}>
      <toastCtx.Provider value={toastValue}>
        <notificationsCtx.Provider value={notifValue}>
          {children}
          <div className="toast-host" aria-live="polite" role="status">
            {toasts.map((t) => (
              <div key={t.id} className={`toast toast--${t.tone}`}>
                {t.tone === "success" ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                <span>{t.text}</span>
                <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => removeToast(t.id)}>
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </notificationsCtx.Provider>
      </toastCtx.Provider>
    </authCtx.Provider>
  );
}
