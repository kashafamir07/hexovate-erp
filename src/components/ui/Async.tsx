import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

/** Gray placeholder block shown while a page's data is loading. */
export function LoadingBlock({ rows = 3, card = true }: { rows?: number; card?: boolean }) {
  const cls = card ? "card loading-block" : "loading-block";
  return (
    <div className={cls} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel" style={{ height: i === 0 ? 18 : 14, width: `${[82, 64, 90][i % 3]}%` }} />
      ))}
    </div>
  );
}

/** Error panel with retry (existing card + empty-state styles). */
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Couldn't load this data"
      body={message}
      action={
        onRetry ? (
          <div style={{ marginTop: 6 }}>
            <Button variant="soft" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}

export function useErrorRetry(reload: () => Promise<void>) {
  return { onRetry: () => void reload() };
}
