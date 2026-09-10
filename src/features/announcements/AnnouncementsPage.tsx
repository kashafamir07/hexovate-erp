import { useEffect, useState } from "react";
import { ErrorBlock, LoadingBlock } from "../../components/ui/Async";
import { announcementsApi } from "../../api/announcements";
import type { Announcement } from "../../data/announcements";

/** Announcements (Employee board 41). */
export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const list = await announcementsApi.list();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load announcements");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="page">
      <div className="page-head">
        <h1>Announcements</h1>
      </div>

      {items === null && !error ? (
        <LoadingBlock rows={3} />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <div className="announce-list">
          {items?.map((a) => (
            <article key={a.id} className="card announce-card">
              <header>
                <span className="avatar" style={{ background: "#1E3A5F", width: 32, height: 32 }}>{a.authorInitials}</span>
                <span className="who">{a.author}</span>
                <span className="meta">{a.pinned ? "Pinned" : a.meta}</span>
              </header>
              <h3>{a.title}</h3>
              <p className="body">{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
