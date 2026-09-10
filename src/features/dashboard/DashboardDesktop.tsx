import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock, Plus, Receipt } from "lucide-react";
import { quickActions } from "../../data/dashboard";
import type { DashboardPayload } from "../../api/dashboard";
import {
  ActivityList,
  AvatarStack,
  DeadlineList,
  ProjectList,
  StatTiles,
  TaskList,
} from "./widgets";

const dockIcons = {
  plus: Plus,
  clock: Clock,
  calendar: CalendarDays,
  receipt: Receipt,
} as const;

/** Quick-create target routes (design boards exist for each flow). */
export const quickActionTo: Record<string, string> = {
  "new-task": "/my-tasks?new=1",
  "log-time": "/time-tracker?manual=1",
  leave: "/my-requests?new=leave",
  expense: "/my-requests?new=expense",
};

function QuickDock() {
  const navigate = useNavigate();
  return (
    <div className="quick-dock" role="toolbar" aria-label="Quick actions">
      {quickActions.map((action) => {
        const Icon = dockIcons[action.icon];
        return (
          <button key={action.id} type="button" className="dock-item" onClick={() => navigate(quickActionTo[action.id])}>
            <Icon aria-hidden="true" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Employee Dashboard — desktop (1280px Figma board), fed by /api/dashboard. */
export function DashboardDesktop({ dash }: { dash: DashboardPayload }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState(dash.todaysTasks);
  const { welcome, activeProjects, recentActivity, statItems, upcomingDeadlines, teamOnline } = dash;

  return (
    <section className="dash-desktop">
      {/* Welcome hero */}
      <div className="welcome-card">
        <div>
          <p className="greeting">{welcome.greeting}</p>
          <p className="greeting-sub">{welcome.subtitle}</p>
        </div>
        <div className="h-right">
          <p className="h-date">{welcome.dateDesktop}</p>
          <p className="h-meta">{welcome.weatherDesktop}</p>
        </div>
      </div>

      <div className="dash-grid">
        {/* Left column */}
        <div className="dash-col">
          {tasks.length > 0 ? (
            <section className="card section-card tasks-card">
              <header className="card-head">
                <h2>Today's Tasks</h2>
                <button type="button" className="link-btn" onClick={() => navigate("/my-tasks")}>
                  View All
                </button>
              </header>
              <TaskList
                tasks={tasks}
                onToggle={(title, checked) => setTasks((prev) => prev.map((t) => (t.title === title ? { ...t, checked } : t)))}
              />
            </section>
          ) : null}

          {activeProjects.length > 0 ? (
            <section className="card section-card projects-card">
              <header className="card-head">
                <h2>Active Projects</h2>
              </header>
              <ProjectList projects={activeProjects} />
            </section>
          ) : null}

          {recentActivity.length > 0 ? (
            <section className="card section-card activity-card">
              <header className="card-head">
                <h2>Recent Activity</h2>
              </header>
              <ActivityList items={recentActivity} />
            </section>
          ) : null}
        </div>

        {/* Right column */}
        <div className="dash-col">
          <StatTiles items={statItems} />

          {upcomingDeadlines.length > 0 ? (
            <section className="card section-card deadlines-card">
              <header className="card-head">
                <h2>Upcoming Deadlines</h2>
              </header>
              <DeadlineList items={upcomingDeadlines} />
            </section>
          ) : null}

          {teamOnline.length > 0 ? (
            <section className="card team-card">
              <h2>Team Online</h2>
              <AvatarStack members={teamOnline} />
            </section>
          ) : null}
        </div>
      </div>

      <QuickDock />
    </section>
  );
}
