import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock, Plus, Receipt, X } from "lucide-react";
import { quickActions } from "../../data/dashboard";
import type { DashboardPayload } from "../../api/dashboard";
import { ProjectList, TaskList } from "./widgets";
import { quickActionTo } from "./DashboardDesktop";

const dockIcons = { plus: Plus, clock: Clock, calendar: CalendarDays, receipt: Receipt } as const;

/** Employee Dashboard — mobile (~390px Figma board), fed by /api/dashboard. */
export function DashboardMobile({ dash }: { dash: DashboardPayload }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tasks, setTasks] = useState(dash.todaysTasks);
  const navigate = useNavigate();
  const { welcome, activeProjects, mobileStats } = dash;

  return (
    <section className="dash-mobile">
      {/* Compact welcome hero */}
      <div className="welcome-card">
        <div>
          <p className="greeting">{welcome.greeting}</p>
          <p className="greeting-sub">{welcome.dateMobile}</p>
        </div>
      </div>

      {tasks.length > 0 ? (
        <>
          <h2 className="m-section-title">Today's Tasks</h2>
          <section className="card m-task-card">
            <TaskList
              tasks={tasks.slice(0, 2)}
              onToggle={(title, checked) => setTasks((prev) => prev.map((t) => (t.title === title ? { ...t, checked } : t)))}
            />
          </section>
        </>
      ) : null}

      <div className="m-stats">
        {mobileStats.map((stat) => (
          <section className="card m-stat" key={stat.label}>
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </section>
        ))}
      </div>

      {activeProjects.length > 0 ? (
        <>
          <h2 className="m-section-title">Active Projects</h2>
          <section className="card m-projects">
            <ProjectList projects={activeProjects.slice(0, 1)} variant="mobile" />
          </section>
        </>
      ) : null}

      {/* Quick-create FAB */}
      <button type="button" className="fab" aria-label="New quick action" aria-expanded={sheetOpen} onClick={() => setSheetOpen((v) => !v)}>
        {sheetOpen ? <X aria-hidden="true" /> : <Plus aria-hidden="true" />}
      </button>

      {sheetOpen ? (
        <div className="fab-sheet card" role="menu" aria-label="Quick actions">
          {quickActions.map((a) => {
            const Icon = dockIcons[a.icon];
            return (
              <button key={a.id} type="button" className="fab-sheet-item" onClick={() => navigate(quickActionTo[a.id])}>
                <Icon aria-hidden="true" />
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
