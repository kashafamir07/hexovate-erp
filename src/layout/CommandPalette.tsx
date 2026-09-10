import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, FileText, FolderKanban, ListTodo, Plus, Search, Timer } from "lucide-react";
import { employeeNav } from "../data/session";
import type { LucideIcon } from "lucide-react";

interface PaletteEntry {
  group: "GO TO" | "TASKS" | "ACTIONS";
  label: string;
  icon: LucideIcon;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

/** Employee command palette (Figma boards 45/46): GO TO / TASKS / ACTIONS. */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const entries: PaletteEntry[] = useMemo(() => {
    const goTo: PaletteEntry[] = employeeNav.flatMap((g) =>
      g.items.map((item) => ({
        group: "GO TO" as const,
        label: item.label,
        icon: item.icon,
        run: () => navigate(item.to),
      }))
    );
    const tasks: PaletteEntry[] = [
      { group: "TASKS", label: "Design pricing page", icon: CheckSquare, run: () => navigate("/my-tasks?task=design-pricing-page") },
      { group: "TASKS", label: "Update FAQ copy", icon: CheckSquare, run: () => navigate("/my-tasks") },
    ];
    const actions: PaletteEntry[] = [
      { group: "ACTIONS", label: "Create new task", icon: Plus, run: () => navigate("/my-tasks?new=1") },
      { group: "ACTIONS", label: "Start timer on Design pricing page", icon: Timer, run: () => navigate("/time-tracker?start=1") },
      { group: "ACTIONS", label: "Submit leave request", icon: FileText, run: () => navigate("/my-requests?new=leave") },
      { group: "ACTIONS", label: "Submit expense", icon: FileText, run: () => navigate("/my-requests?new=expense") },
      { group: "ACTIONS", label: "Open Projects board", icon: FolderKanban, run: () => navigate("/projects/website-redesign/board") },
    ];
    return [...goTo, ...tasks, ...actions];
  }, [navigate]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFocus(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  // global hotkey
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(entry: PaletteEntry) {
    onClose();
    entry.run();
  }

  if (!open) return null;

  const groups = ["GO TO", "TASKS", "ACTIONS"] as const;
  let flatIndex = -1;

  return (
    <div className="overlay palette-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setFocus((f) => Math.min(f + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setFocus((f) => Math.max(f - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const active = results[Math.min(focus, results.length - 1)];
            if (active) pick(active);
          }
        }}
      >
        <div className="palette-input">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Search pages, tasks, actions…"
            aria-label="Search"
            onChange={(e) => {
              setQuery(e.target.value);
              setFocus(0);
            }}
          />
        </div>
        <div className="palette-results">
          {results.length === 0 ? (
            <div className="palette-empty">No results for “{query}”.</div>
          ) : (
            groups.map((group) => {
              const inGroup = results.filter((r) => r.group === group);
              if (inGroup.length === 0) return null;
              return (
                <div key={group}>
                  <div className="palette-group-label">{group}</div>
                  {inGroup.map((entry) => {
                    flatIndex += 1;
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.label}
                        type="button"
                        className={`palette-item ${flatIndex === focus ? "focused" : ""}`.trim()}
                        onMouseEnter={() => setFocus(flatIndex)}
                        onClick={() => pick(entry)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{entry.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** Convenience: opens the palette on Cmd/Ctrl+K — hosted by AppShell. */
export function usePaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
