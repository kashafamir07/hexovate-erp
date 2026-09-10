import { useCallback, useEffect, useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { hrApi, type LifecycleRow } from "../../api/hr";
import { LoadingBlock, ErrorBlock } from "../../components/ui/Async";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Checkbox } from "../../components/ui/Checkbox";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHead, SectionCard } from "../widgets";
import { useToasts } from "../../lib/AppProviders";
import { errorMessage } from "../../api/client";

const STATUS_TONE: Record<string, "success" | "primary" | "warning" | "gray"> = {
  complete: "success",
  in_progress: "primary",
  not_started: "warning",
};

interface BaseProps {
  kind: "onboarding" | "offboarding";
}

/** Figma "HR Portal / Onboarding|Offboarding" — summary table + editable checklist. */
export function PortalLifecyclePage({ kind }: BaseProps) {
  const { push } = useToasts();
  const [rows, setRows] = useState<LifecycleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const isOn = kind === "onboarding";

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = isOn ? await hrApi.onboarding() : await hrApi.offboarding();
      setRows(d.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records");
    }
  }, [isOn]);
  useEffect(() => {
    void load();
  }, [load]);

  const toggleStep = async (row: LifecycleRow, stepIndex: number, done: boolean) => {
    try {
      const updater = isOn ? hrApi.updateOnboarding : hrApi.updateOffboarding;
      await updater(row.id, { stepIndex, done });
      setRows((prev) => (prev || []).map((r) => (r.id === row.id ? { ...r, steps: r.steps.map((s, i) => (i === stepIndex ? { ...s, done } : s)) } : r)));
    } catch (e) {
      push(errorMessage(e), "error");
    }
  };

  if (!rows && !error) return <LoadingBlock rows={6} />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;

  const current = rows?.find((r) => r.id === selected) || rows?.[0] || null;
  const title = isOn ? "Onboarding" : "Offboarding";
  const inProgress = rows?.filter((r) => r.status !== "complete").length ?? 0;

  return (
    <section className="page">
      <PageHead
        title={title}
        subtitle={`${inProgress} ${inProgress === 1 ? "employee" : "employees"} in ${isOn ? "onboarding" : "exit"} this cycle`}
        actions={
          <Button variant={isOn ? "primary" : "soft"} size="md" onClick={() => setShowStart(true)}>
            {isOn ? <UserPlus aria-hidden="true" style={{ width: 14, height: 14 }} /> : <UserMinus aria-hidden="true" style={{ width: 14, height: 14 }} />}
            {isOn ? "Start Onboarding" : "Initiate Offboarding"}
          </Button>
        }
      />

      <SectionCard title={isOn ? "New hires" : "Exits"}>
        {rows && rows.length > 0 ? (
          <div className="table-scroll">
            <table className="portal-table lifecycle-table">
              <thead>
                <tr>
                  <th>{isOn ? "New hire" : "Employee"}</th>
                  <th>Title</th>
                  <th>Department</th>
                  <th>{isOn ? "Start date" : "Last working day"}</th>
                  {isOn ? null : <th>Reason</th>}
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={current?.id === r.id ? "row-active" : ""} onClick={() => setSelected(r.id)}>
                    <td>
                      <span className="person-cell">
                        {r.person ? <Avatar initials={r.person.initials} color={r.person.color} title={r.person.name} /> : <Avatar initials="?" color="#6b7280" />}
                        <span>
                          <strong>{r.person?.name ?? "Unknown"}</strong>
                          <br />
                          <span className="cell-muted">{r.jobTitle}</span>
                        </span>
                      </span>
                    </td>
                    <td>{r.jobTitle || "—"}</td>
                    <td>{r.dept || "—"}</td>
                    <td>{isOn ? r.startLabel : r.lastDayLabel}</td>
                    {isOn ? null : <td>{<Badge tone="gray">{r.reason || "Other"}</Badge>}</td>}
                    <td>{r.progressLabel}</td>
                    <td>{isOn ? <Badge tone={STATUS_TONE[r.status] || "gray"}>{r.statusLabel || r.status}</Badge> : <Badge tone={STATUS_TONE[r.status] || "gray"}>{r.status === "complete" ? "Complete" : "In progress"}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={isOn ? UserPlus : UserMinus} title={`No ${kind} records`} body={isOn ? "Start onboarding for a new hire to build their checklist." : "Initiate offboarding to track an employee's exit."} />
        )}
      </SectionCard>

      {current ? (
        <SectionCard title={`${current.person?.name ?? "Employee"} — ${isOn ? "Onboarding" : "Exit"} Checklist`}>
          <ul className="portal-checklist">
            {current.steps.map((s, i) => (
              <li key={s.label}>
                <Checkbox checked={s.done} label={s.label} onClick={() => void toggleStep(current, i, !s.done)} />
              </li>
            ))}
          </ul>
          <div className="portal-check-actions">
            <Button variant="soft" size="sm" onClick={() => push(isOn ? "IT notified about the new starter" : "IT access revocation requested", "success")}>
              {isOn ? "Notify IT" : "Request IT Access Revoke"}
            </Button>
            <Button variant="soft" size="sm" onClick={() => push(isOn ? "Orientation scheduling request sent" : "Experience letter generation queued", "success")}>
              {isOn ? "Schedule Orientation" : "Generate Experience Letter"}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <StartModal open={showStart} kind={kind} onClose={() => setShowStart(false)} onDone={() => { setShowStart(false); void load(); }} />
    </section>
  );
}

function StartModal({ open, kind, onClose, onDone }: { open: boolean; kind: "onboarding" | "offboarding"; onClose: () => void; onDone: () => void }) {
  const { push } = useToasts();
  const [employees, setEmployees] = useState<{ id: string; name: string }[] | null>(null);
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("Resignation");
  const [busy, setBusy] = useState(false);
  const isOn = kind === "onboarding";

  useEffect(() => {
    if (!open) return;
    hrApi
      .people({ limit: "200" })
      .then((d) => setEmployees(d.items.map((i) => ({ id: i.id, name: i.name }))))
      .catch(() => setEmployees([]));
  }, [open]);

  const submit = async () => {
    if (!userId) {
      push("Pick an employee first", "error");
      return;
    }
    setBusy(true);
    try {
      if (isOn) {
        await hrApi.createOnboarding({ userId, startDate: date || undefined });
        push("Onboarding started", "success");
      } else {
        await hrApi.createOffboarding({ userId, lastWorkingDay: date || undefined, reason });
        push("Offboarding initiated", "success");
      }
      onDone();
    } catch (e) {
      push(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isOn ? "Start onboarding" : "Initiate offboarding"}>
      <div className="modal-form">
        <div className="field">
          <label htmlFor="lc-user">Employee</label>
          <select id="lc-user" className="field-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Select employee…</option>
            {(employees || []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lc-date">{isOn ? "Start date" : "Last working day"}</label>
          <input id="lc-date" type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!isOn ? (
          <div className="field">
            <label htmlFor="lc-reason">Reason</label>
            <select id="lc-reason" className="field-input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {["Resignation", "Contract End", "Termination", "Retirement", "Other"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="modal-actions">
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : isOn ? "Start" : "Initiate"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

