import { Badge } from "../../components/ui/Badge";
import { Checkbox } from "../../components/ui/Checkbox";
import { Avatar } from "../../components/ui/Avatar";
import type { BadgeTone } from "../../types";
import type {
  ActivityItem,
  DeadlineItem,
  ProjectItem,
  StatItem,
  TaskItem,
  TeamMember,
} from "../../data/dashboard";

/* ---------- shared bits ------------------------------------ */

export function PriorityBadge({ tone, label }: { tone: BadgeTone; label: string }) {
  return <Badge tone={tone}>{label}</Badge>;
}

export function TaskList({ tasks, onToggle }: { tasks: TaskItem[]; onToggle?: (title: string, checked: boolean) => void }) {
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.title} className="task-row">
          <Checkbox checked={task.checked} label={task.title} onClick={onToggle ? () => onToggle(task.title, !task.checked) : undefined} />
          <span className="task-info">
            <span className="task-title">{task.title}</span>
            <span className="task-meta">{task.meta}</span>
          </span>
          <PriorityBadge tone={task.priority} label={task.priorityLabel} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Project rows. Desktop shows time + "% complete" label under the bar;
 * mobile shows the bare % on the name row and no label below.
 */
export function ProjectList({ projects, variant = "desktop" }: { projects: ProjectItem[]; variant?: "desktop" | "mobile" }) {
  return (
    <ul className="project-list">
      {projects.map((project) => (
        <li key={project.name} className="project">
          <div className="project-top">
            <span className="project-name">{project.name}</span>
            <span className="project-meta">{variant === "mobile" ? project.mobilePct : project.meta}</span>
          </div>
          <div className="progress project-progress" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${project.name}: ${project.progress}% complete`}>
            <span style={{ width: `${project.progress}%` }} />
          </div>
          {variant === "desktop" ? <span className="pct-label">{project.pctLabel}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="activity-list">
      {items.map((item) => (
        <li key={item.time} className="activity-row">
          <Avatar initials={item.initials} color={item.color} title={item.text} />
          <span>
            <span className="activity-main">
              {item.text}
              {item.accent ? <> <strong>{item.accent}</strong></> : null}
            </span>
            <br />
            <span className="activity-time">{item.time}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function StatTiles({ items }: { items: StatItem[] }) {
  return (
    <>
      {items.map((stat) => (
        <section className="card stat-card" key={stat.label}>
          <span className="stat-value">{stat.value}</span>
          <span className="stat-label">{stat.label}</span>
          {stat.badge ? <Badge tone="success">{stat.badge}</Badge> : null}
        </section>
      ))}
    </>
  );
}

export function DeadlineList({ items }: { items: DeadlineItem[] }) {
  return (
    <ul className="dl-list">
      {items.map((item) => (
        <li key={item.task} className="deadline-row">
          <span>
            <span className="deadline-task">{item.task}</span>
            <br />
            <span className="deadline-proj">{item.project}</span>
          </span>
          <span className="deadline-due">{item.due}</span>
        </li>
      ))}
    </ul>
  );
}

export function AvatarStack({ members }: { members: TeamMember[] }) {
  return (
    <span className="avatar-stack">
      {members.map((m) => (
        <Avatar key={m.initials} initials={m.initials} color={m.color} />
      ))}
    </span>
  );
}
