import { Search } from "lucide-react";
import type { SessionUser } from "../types";
import { NotificationsPopover, ProfileMenu } from "./Popovers";

interface TopbarProps {
  crumb: string;
  detail?: boolean;
  searchPlaceholder?: string;
  onSearch: () => void;
  user: SessionUser;
  /** where the profile menu's Account Settings links to (per-role) */
  settingsTo?: string;
}

/** Desktop top bar: breadcrumb · search (opens ⌘K palette) · bell · profile. */
export function Topbar({ crumb, detail, searchPlaceholder = "Search (Cmd+K)", onSearch, user, settingsTo = "/account" }: TopbarProps) {
  void user;
  return (
    <header className="topbar">
      <nav className={`breadcrumb ${detail ? "crumb-detail" : ""}`.trim()} aria-label="Breadcrumb">
        {crumb}
      </nav>

      <button type="button" className="top-search" onClick={onSearch} aria-haspopup="dialog" aria-label="Search (Command K)">
        <Search aria-hidden="true" />
        <span>{searchPlaceholder}</span>
      </button>

      <div className="topbar-right">
        <NotificationsPopover />
        <ProfileMenu settingsTo={settingsTo} />
      </div>
    </header>
  );
}
