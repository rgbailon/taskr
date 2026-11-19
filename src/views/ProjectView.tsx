import { useState } from "react";
import type { TaskStatus } from "../domain/types";
import { TASK_STATUS_LABELS } from "../domain/types";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import {
  formatActivityMoment,
  formatDuration,
  formatMonthDay,
  todayISO,
} from "../lib/date";
import { CheckCircle } from "../components/CheckCircle";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { ProjectMark } from "../components/ProjectMark";
import { StatusPill } from "../components/StatusPill";
import { ProjectModal } from "../components/ProjectModal";
import { ConfirmDialog } from "../components/Modal";

type ProjectFilter = "all" | TaskStatus;

export function ProjectView({
  projectId,
  onOpenTask,
  onNewTaskForProject,
  onProjectDeleted,
}: {
  projectId: string;
  onOpenTask: (taskId: string) => void;
  onNewTaskForProject: (projectId: string) => void;
  onProjectDeleted: () => void;
}) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!workspace) return null;
  const project = workspace.projectById(projectId);
  if (!project) {
    return (
      <main className="main">
        <EmptyState
          title="Project not found"
          description="This project is no longer part of the workspace."
        />
      </main>
    );
  }

  const tasks = workspace.tasksForProject(project.id).filter((task) => task.status !== "inbox");
  const counts = {
    todo: tasks.filter((task) => task.status === "todo").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    done: tasks.filter((task) => task.status === "done").length,
  };
  const doneCount = counts.done;
  const percent = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);
  const visibleTasks = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);
  const projectActivity = workspace.activitiesForProject(project.id, 4);
  const overdue = tasks.filter(
    (task) => !task.isDone && task.dueDate && task.dueDate < todayISO(),
  ).length;

  const health =
    tasks.length === 0
      ? { label: "A fresh start", detail: "Add the first task to give this project shape." }
      : overdue > 0
        ? { label: "Needs a look", detail: `${overdue} ${overdue === 1 ? "task is" : "tasks are"} past due.` }
        : percent >= 50
          ? { label: "Moving steadily", detail: "The milestone is within reach." }
          : { label: "Gaining traction", detail: "A few focused blocks will move it on." };

  const finishTask = (taskId: string, title: string, isDone: boolean) => {
    if (isDone) {
      update((current) => current.reopenTask(taskId));
      return;
    }
    update((current) => current.completeTask(taskId));
    pushToast({ title: "Task finished", detail: title, tone: "success" });
  };

  const setStatusFilter = (status: TaskStatus) => {
    setFilter((current) => (current === status ? "all" : status));
  };

  return (
    <>
      <main className="main">
        <div className="view project-view">
          <header className="view-head project-head">
            <div>
              <p className="eyebrow">Projects / {project.name}</p>
              <h1 className="page-title">{project.name}</h1>
              <p className="subtitle">{project.description || "A place for related work."}</p>
            </div>
            <div className="project-head-actions">
              <button
                type="button"
                className="button button-quiet"
                onClick={() => setEditOpen(true)}
              >
                Edit project
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={() => onNewTaskForProject(project.id)}
              >
                <Icon name="plus" size={15} />
                Add task
              </button>
            </div>
          </header>

          <section className="card project-progress-card">
            <div className="project-progress-head">
              <ProjectMark color={project.color} size={30} />
              <div className="project-progress-copy">
                <span className="muted-small">Project progress</span>
                <strong>{project.milestone || "Next milestone"}</strong>
                <span>
                  {project.milestoneDue
                    ? `Milestone · ${formatMonthDay(project.milestoneDue)}`
                    : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} in this project`}
                </span>
              </div>
              <span className="project-percent">{percent}%</span>
            </div>
            <ProgressBar value={percent / 100} color={project.color} height={5} label="Project progress" />
            <div className="project-progress-foot">
              <span className="muted-tiny">
                {doneCount} of {tasks.length} tasks done
              </span>
              <span className="muted-tiny">
                {project.milestoneDue ? `Due ${formatMonthDay(project.milestoneDue)}` : "No milestone date"}
              </span>
            </div>
          </section>

          <div className="project-status-grid">
            {(["todo", "in_progress", "done"] as const).map((status) => (
              <button
                type="button"
                key={status}
                className={`status-card${filter === status ? " is-active" : ""}`}
                onClick={() => setStatusFilter(status)}
                aria-pressed={filter === status}
              >
                <span className={`status-card-dot dot-${status}`} aria-hidden="true" />
                <span className="status-card-label">{TASK_STATUS_LABELS[status]}</span>
                <span className="status-card-value">{counts[status]}</span>
              </button>
            ))}
          </div>

          <div className="section-head project-tasks-head">
            <h2>Project tasks</h2>
            {filter !== "all" ? (
              <button type="button" className="text-button" onClick={() => setFilter("all")}>
                Show all
              </button>
            ) : (
              <span className="muted-small">
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </span>
            )}
          </div>

          {visibleTasks.length > 0 ? (
            <div className="stack-list project-task-list">
              {visibleTasks.map((task) => (
                <div className={`project-task-row${task.isDone ? " is-done" : ""}`} key={task.id}>
                  <CheckCircle
                    checked={task.isDone}
                    size="sm"
                    label={task.isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    onClick={() => finishTask(task.id, task.title, task.isDone)}
                  />
                  <button
                    type="button"
                    className="project-task-copy"
                    onClick={() => onOpenTask(task.id)}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {formatDuration(task.estimateMin)}
                      {task.dueDate ? ` · Due ${formatMonthDay(task.dueDate)}` : ""}
                    </span>
                  </button>
                  <StatusPill status={task.status} subtle />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={filter === "all" ? "No active tasks yet" : "Nothing in this state"}
              description={
                filter === "all"
                  ? "Add a task to start moving the milestone."
                  : "Try another status filter or add a new task."
              }
              action={
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => onNewTaskForProject(project.id)}
                >
                  <Icon name="plus" size={14} />
                  Add task
                </button>
              }
            />
          )}

          <p className="view-footnote">
            {counts.todo + counts.in_progress} open · {counts.done} done in this project.
          </p>
        </div>
      </main>

      <aside className="rail" aria-label="Project details">
        <div className="card rail-card milestone-card">
          <div className="rail-row">
            <h2 className="rail-title">Next milestone</h2>
            <span className="muted-tiny">{percent}%</span>
          </div>
          <div className="milestone-row">
            <span className="milestone-icon" aria-hidden="true">
              <Icon name="flag" size={15} />
            </span>
            <div>
              <strong>{project.milestone || "Set the next milestone"}</strong>
              <span>{project.milestoneDue ? `Due ${formatMonthDay(project.milestoneDue)}` : "No date yet"}</span>
            </div>
          </div>
          <ProgressBar value={percent / 100} color={project.color} height={5} label="Milestone progress" />
        </div>

        <div className="rail-block">
          <div className="rail-row">
            <h3>Project activity</h3>
            <span className="muted-tiny">Recent</span>
          </div>
          {projectActivity.length > 0 ? (
            <ul className="project-activity-list">
              {projectActivity.map((activity) => (
                <li key={activity.id}>
                  <span className="activity-node" aria-hidden="true" />
                  <div>
                    <strong>{activity.subject}</strong>
                    <span>
                      {activity.text} · {formatActivityMoment(activity.at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rail-note">Activity for this project will show up here.</p>
          )}
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <div className="rail-row">
            <h3>Project note</h3>
            <span className="muted-tiny">Saved</span>
          </div>
          <textarea
            className="notes-box notes-box-short"
            value={project.notes}
            placeholder="Add a note for this project…"
            aria-label={`Notes for ${project.name}`}
            onChange={(event) =>
              update((current) => current.setProjectNotes(project.id, event.target.value))
            }
          />
        </div>

        <div className="health-card">
          <span className="rail-label">PROJECT HEALTH</span>
          <strong>{health.label}</strong>
          <p>{health.detail}</p>
          <span className="health-dot" style={{ background: project.color }} aria-hidden="true" />
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <button
            type="button"
            className="text-link text-link-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <Icon name="trash" size={15} />
            Delete project
          </button>
        </div>
      </aside>

      <ProjectModal
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
        onCreated={() => setEditOpen(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this project?"
        description={`“${project.name}” will be removed. Open tasks move to the Inbox and keep their details. This cannot be undone.`}
        confirmLabel="Delete project"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          update((current) => current.deleteProject(project.id));
          pushToast({ title: "Project deleted", detail: project.name });
          onProjectDeleted();
        }}
      />
    </>
  );
}
