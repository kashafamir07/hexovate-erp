import { useCallback, useEffect, useState } from "react";
import { Activity, CheckSquare, ClipboardList, Clock, Search } from "lucide-react";
import { hrApi } from "../../api/hr";
import { errorMessage } from "../../api/client";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Avatar } from "../../components/ui/Avatar";
import { Select } from "../../components/ui/Select";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHead, SectionCard } from "../widgets";
import type { RoleConfig } from "../nav";

type FeedItem = { id: string; type: "task" | "request" | "time"; initials: string; color: string; name: string; jobTitle: string; text: string; time: string };

const TYPE_ICON = { task: CheckSquare, request: ClipboardList, time: Clock } as const;
const TYPE_LABEL = { task: "Task", request: "Request", time: "Time" } as const;

export function LeaderActivityPage({ cfg }: { cfg: RoleConfig }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const data = await hrApi.teamActivity();
      setItems(data.items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <ErrorBlock message={error} onRetry={() => void reload()} />;
  if (!items) return <LoadingBlock rows={6} />;

  const visible = items.filter((i) => {
    if (type && i.type !== type) return false;
    if (q && !`${i.name} ${i.text}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <section className="page">
      <PageHead title="Activity Monitoring" subtitle="Task, request and time activity across your team over the last 30 days." />

      <div className="ldr-toolbar">
        <span className="search-input">
          <Search aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people or activity…" aria-label="Search activity" />
        </span>
        <Select
          ariaLabel="Activity type filter"
          value={type}
          onChange={setType}
          options={[{ value: "", label: "All activity" }, { value: "task", label: "Tasks" }, { value: "request", label: "Requests" }, { value: "time", label: "Time" }]}
        />
        <span className="ldr-spacer" />
        <span className="ldr-count">{visible.length} of {items.length} events</span>
      </div>

      {visible.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Activity} title="No activity found" body="Widen the filters or wait for new team activity." />
        </SectionCard>
      ) : (
        <SectionCard>
          <ul className="mgr-list">
            {visible.map((a) => {
              const Icon = TYPE_ICON[a.type];
              return (
                <li key={a.id} className="mgr-activity">
                  <span className={`act-type act-type--${a.type}`}>
                    <Icon aria-hidden="true" />
                  </span>
                  <Avatar initials={a.initials} color={a.color} title={a.name} />
                  <span className="mgr-activity-body">
                    <span className="mgr-activity-text">{a.text}</span>
                    <br />
                    <span className="mgr-activity-time">{a.name} · {a.jobTitle || TYPE_LABEL[a.type]} · {a.time}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </section>
  );
}