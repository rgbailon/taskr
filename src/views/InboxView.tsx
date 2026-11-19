import { useState } from "react";
import { Task } from "../domain/models";
import { ESTIMATE_OPTIONS } from "../domain/types";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import {
  addDaysISO,
  formatActivityMoment,
  formatDuration,
  formatRelativeMoment,
  nextPlanStart,
  todayISO,
} from "../lib/date";
import { CheckCircle } from "../components/CheckCircle";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ProjectDot } from "../components/ProjectMark";

export function InboxView({
  onOpenTask,
  onNewTask,
}: {
  onOpenTask: (taskId: string) => void;
  onNewTask: () => void;
}) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const [capture, setCapture] = useState("");

  if (!workspace) return null;

  const inboxTasks = workspace.inboxTasks;
  const sorted = workspace.activities
    .filter((activity) => activity.kind === "sorted" || activity.kind === "schedule")
    .slice(0, 4);

  const captureTask = () => {
    const title = capture.trim();
    if (!title) return;
    const task = Task.create({ title, status: "inbox", estimateMin: 15 });
    update((current) => current.addTask(task));
    setCapture("");
    pushToast({
      title: "Captured",
      detail: `${task.title} · waiting in your inbox`,
      tone: "success",
    });
  };

  const scheduleFor = (taskId: string, date: string, time: string) => {
    update((current) => current.scheduleTask(taskId, date, time));
    pushToast({
      title: date === todayISO() ? "Moved to today" : "Moved to tomorrow",
      detail: `Scheduled for ${date === todayISO() ? "today" : "tomorrow"} at ${time}`,
      tone: "success",
    });
  };

  return (
    <>
      <main className="main">
        <div className="view inbox-view">
          <header className="view-head">
            <div>
              <h1 className="page-title">Inbox</h1>
              <p className="subtitle">Quickly capture ideas, then give each one a next step.</p>
            </div>
            <button type="button" className="button button-primary" onClick={onNewTask}>
              <Icon name="plus" size={15} />
              Add task
            </button>
          </header>

          <form
            className="capture-bar"
            onSubmit={(event) => {
              event.preventDefault();
              captureTask();
            }}
          >
            <span className="capture-icon" aria-hidden="true">
              <Icon name="plus" size={18} />
            </span>
            <div className="capture-field">
              <input
                type="text"
                value={capture}
                placeholder="Capture a task or thought…"
                aria-label="Capture a task or thought"
                onChange={(event) => setCapture(event.target.value)}
              />
              <span className="capture-hint">Press Enter to keep it in your inbox.</span>
            </div>
            <kbd className="capture-enter">Enter ↵</kbd>
          </form>

          <div className="section-head inbox-section-head">
            <h2>Needs a home</h2>
            <span className="muted-small">
              {inboxTasks.length} {inboxTasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>

          {inboxTasks.length > 0 ? (
            <div className="stack-list inbox-list">
              {inboxTasks.map((task) => {
                const project = workspace.projectById(task.projectId);
                return (
                  <div className="inbox-row" key={task.id}>
                    <CheckCircle
                      checked={false}
                      size="sm"
                      label={`Complete ${task.title}`}
                      onClick={() => {
                        update((current) => current.completeTask(task.id));
                        pushToast({ title: "Task finished", detail: task.title, tone: "success" });
                      }}
                    />
                    <button type="button" className="inbox-copy" onClick={() => onOpenTask(task.id)}>
                      <strong>{task.title}</strong>
                      <span>Captured {formatRelativeMoment(task.createdAt)} · quick add</span>
                    </button>

                    <label className="inline-select-wrap">
                      <span className="sr-only">Project for {task.title}</span>
                      {project ? <ProjectDot color={project.color} size={8} /> : null}
                      <select
                        className="inline-select"
                        value={task.projectId ?? ""}
                        onChange={(event) => {
                          const projectId = event.target.value || null;
                          update((current) => {
                            let next = current.setTaskProject(task.id, projectId);
                            if (projectId && task.status === "inbox") {
                              next = next.setStatus(task.id, "todo");
                            }
                            return next;
                          });
                        }}
                      >
                        <option value="">No project</option>
                        {workspace.projects.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="inline-select-wrap is-short">
                      <span className="sr-only">Estimate for {task.title}</span>
                      <select
                        className="inline-select"
                        value={task.estimateMin}
                        onChange={(event) =>
                          update((current) =>
                            current.setTaskEstimate(task.id, Number(event.target.value)),
                          )
                        }
                      >
                        {ESTIMATE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {formatDuration(option)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="row-actions">
                      <button
                        type="button"
                        className="mini-action"
                        onClick={() => scheduleFor(task.id, todayISO(), nextPlanStart())}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className="mini-action"
                        onClick={() => scheduleFor(task.id, addDaysISO(todayISO(), 1), "09:30")}
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-small"
                        aria-label={`Open ${task.title}`}
                        title="Open task details"
                        onClick={() => onOpenTask(task.id)}
                      >
                        <Icon name="chevron-right" size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Inbox is clear"
              description="Nothing is waiting to be sorted. Capture the next idea when it shows up."
            />
          )}
        </div>
      </main>

      <aside className="rail" aria-label="Inbox triage">
        <div className="rail-block">
          <h2 className="rail-title">Quick triage</h2>
          <p className="rail-subtitle">A small next step is enough.</p>
        </div>

        <div className="triage-list">
          <div className="triage-step">
            <span className="triage-number triage-teal">1</span>
            <div>
              <strong>Choose a project</strong>
              <span>Give it a useful home.</span>
            </div>
          </div>
          <div className="triage-step">
            <span className="triage-number triage-blue">2</span>
            <div>
              <strong>Pick a day</strong>
              <span>Schedule it when it matters.</span>
            </div>
          </div>
          <div className="triage-step">
            <span className="triage-number triage-amber">3</span>
            <div>
              <strong>Keep it here</strong>
              <span>If it isn’t ready yet.</span>
            </div>
          </div>
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <div className="rail-row">
            <h3>Recently sorted</h3>
            <span className="muted-tiny">Now</span>
          </div>
          {sorted.length > 0 ? (
            <ul className="sorted-list">
              {sorted.map((activity) => {
                const project = workspace.projectById(activity.projectId ?? null);
                return (
                  <li key={activity.id}>
                    <ProjectDot color={project?.color ?? "#B6C0CA"} size={8} />
                    <span className="sorted-title">{activity.subject}</span>
                    <span className="sorted-time">{formatActivityMoment(activity.at)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rail-note">Sorted tasks will show up here.</p>
          )}
        </div>

        <div className="tip-card">
          <strong>Keep the list light</strong>
          <p>Move only tasks you can name a next step for.</p>
        </div>

        <p className="rail-quote">Inbox zero is optional.</p>
      </aside>
    </>
  );
}
