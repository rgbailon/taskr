import { useEffect, useRef, useState } from "react";
import type { TaskPriority, TaskStatus } from "../domain/types";
import { ESTIMATE_OPTIONS } from "../domain/types";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import {
  formatActivityMoment,
  formatDuration,
  formatTimeLabel,
  formatMonthDay,
  relativeDayLabel,
} from "../lib/date";
import { CheckCircle } from "../components/CheckCircle";
import { ConfirmDialog } from "../components/Modal";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { ProjectMark } from "../components/ProjectMark";
import { StatusPill } from "../components/StatusPill";

export function TaskDetailView({
  taskId,
  onBack,
  onOpenProject,
  onStartFocus,
}: {
  taskId: string;
  onBack: () => void;
  onOpenProject: (projectId: string) => void;
  onStartFocus: () => void;
}) {
  const { workspace, update, beginFocus } = useWorkspace();
  const { pushToast } = useToast();
  const [criterionText, setCriterionText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleCancelRef = useRef(false);
  const task = workspace ? workspace.taskById(taskId) : null;
  const [titleDraft, setTitleDraft] = useState(task?.title ?? "");

  useEffect(() => {
    setTitleDraft(task?.title ?? "");
    // Only re-sync when navigating to a different task; local typing owns the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!workspace) return null;

  if (!task) {
    return (
      <main className="main">
        <div className="view detail-view">
          <div className="quiet-empty detail-missing">
            <Icon name="note" size={18} />
            <span>This task is no longer in the workspace.</span>
            <button type="button" className="text-button" onClick={onBack}>
              Go back
            </button>
          </div>
        </div>
      </main>
    );
  }

  const project = workspace.projectById(task.projectId);
  const activity = workspace.activitiesForTask(task.id, 5);
  const remaining = task.criteria.length - task.criteriaDone;

  const addStep = () => {
    const text = criterionText.trim();
    if (!text) return;
    update((current) => current.addCriterion(task.id, text));
    setCriterionText("");
  };

  const startFocus = () => {
    beginFocus(task.id);
    onStartFocus();
  };

  return (
    <>
      <main className="main">
        <div className="view detail-view">
          <header className="view-head detail-head">
            <div>
              <button type="button" className="back-link" onClick={onBack}>
                <Icon name="chevron-left" size={15} />
                {project ? project.name : "Back"}
              </button>
              <input
                className="detail-title-input"
                type="text"
                value={titleDraft}
                aria-label="Task title"
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  if (titleCancelRef.current) {
                    titleCancelRef.current = false;
                    return;
                  }
                  const next = titleDraft.trim();
                  if (!next) {
                    setTitleDraft(task.title);
                    return;
                  }
                  setTitleDraft(next);
                  update((current) => current.setTaskTitle(task.id, next));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === "Escape") {
                    titleCancelRef.current = true;
                    setTitleDraft(task.title);
                    event.currentTarget.blur();
                  }
                }}
              />
              {task.description ? <p className="subtitle">{task.description}</p> : null}
            </div>
            <div className="detail-head-actions">
              {task.isDone ? (
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => {
                    update((current) => current.reopenTask(task.id));
                    pushToast({ title: "Task reopened", detail: task.title });
                  }}
                >
                  <Icon name="refresh" size={14} />
                  Reopen task
                </button>
              ) : (
                <button type="button" className="button button-primary" onClick={startFocus}>
                  <Icon name="play" size={13} />
                  Start focus
                </button>
              )}
              <button
                type="button"
                className="icon-button"
                title="Delete task"
                aria-label="Delete task"
                onClick={() => setConfirmDelete(true)}
              >
                <Icon name="trash" size={17} />
              </button>
            </div>
          </header>

          <section className="card detail-card">
            <h2>Description</h2>
            <textarea
              className="detail-description"
              value={task.description}
              rows={3}
              placeholder="What does done look like?"
              aria-label="Task description"
              onChange={(event) =>
                update((current) => current.setTaskDescription(task.id, event.target.value))
              }
            />
          </section>

          <div className="section-head detail-criteria-head">
            <h2>Acceptance criteria</h2>
            <span className="muted-small">
              {task.criteria.length === 0
                ? "No steps yet"
                : `${task.criteriaDone} of ${task.criteria.length} complete`}
            </span>
          </div>

          <section className="card detail-card criteria-card">
            {task.criteria.length > 0 ? (
              <ul className="criteria-list">
                {task.criteria.map((criterion) => (
                  <li key={criterion.id} className={criterion.done ? "is-done" : ""}>
                    <CheckCircle
                      checked={criterion.done}
                      size="sm"
                      label={
                        criterion.done ? `Reopen ${criterion.text}` : `Complete ${criterion.text}`
                      }
                      onClick={() =>
                        update((current) => current.toggleCriterion(task.id, criterion.id))
                      }
                    />
                    <span className="criterion-text">{criterion.text}</span>
                    <button
                      type="button"
                      className="icon-button icon-small criterion-remove"
                      aria-label={`Remove ${criterion.text}`}
                      title="Remove step"
                      onClick={() =>
                        update((current) => current.removeCriterion(task.id, criterion.id))
                      }
                    >
                      <Icon name="close" size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="criteria-empty">Break the task into a few checkable steps.</p>
            )}

            <form
              className="criterion-add"
              onSubmit={(event) => {
                event.preventDefault();
                addStep();
              }}
            >
              <Icon name="plus" size={15} />
              <input
                type="text"
                value={criterionText}
                placeholder="Add a step…"
                aria-label="Add an acceptance criterion"
                onChange={(event) => setCriterionText(event.target.value)}
              />
              <button
                type="submit"
                className="button button-quiet button-small"
                disabled={!criterionText.trim()}
              >
                Add
              </button>
            </form>
          </section>

          <section className="card detail-card">
            <h2>Working notes</h2>
            <textarea
              className="notes-box detail-notes"
              value={task.notes}
              placeholder="Keep decisions, constraints, and links here…"
              aria-label="Working notes"
              onChange={(event) =>
                update((current) => current.setTaskNotes(task.id, event.target.value))
              }
            />
          </section>

          <p className="view-footnote">
            Created {formatMonthDay(task.createdAt)} · Updated{" "}
            {formatActivityMoment(task.updatedAt)}
            {task.focusedMinutes > 0
              ? ` · ${formatDuration(task.focusedMinutes)} of focus logged`
              : ""}
          </p>
        </div>
      </main>

      <aside className="rail" aria-label="Task details">
        <section className="card rail-card detail-meta-card">
          <div className="rail-row">
            <h2 className="rail-title">Task details</h2>
            <StatusPill status={task.status} subtle />
          </div>

          <div className="meta-rows">
            <label className="meta-row">
              <span>Status</span>
              <select
                className="meta-select"
                value={task.status}
                onChange={(event) => {
                  const status = event.target.value as TaskStatus;
                  update((current) =>
                    status === "done"
                      ? current.completeTask(task.id)
                      : current.setStatus(task.id, status),
                  );
                  if (status === "done") {
                    pushToast({ title: "Task finished", detail: task.title, tone: "success" });
                  }
                }}
              >
                <option value="inbox">Inbox</option>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </label>

            <label className="meta-row">
              <span>Project</span>
              <select
                className="meta-select"
                value={task.projectId ?? ""}
                onChange={(event) =>
                  update((current) =>
                    current.setTaskProject(task.id, event.target.value || null),
                  )
                }
              >
                <option value="">No project</option>
                {workspace.projects.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="meta-row">
              <span>Priority</span>
              <select
                className="meta-select"
                value={task.priority}
                onChange={(event) =>
                  update((current) =>
                    current.setTaskPriority(task.id, event.target.value as TaskPriority),
                  )
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </label>

            <label className="meta-row">
              <span>Due date</span>
              <input
                type="date"
                className="meta-select"
                value={task.dueDate ?? ""}
                onChange={(event) =>
                  update((current) =>
                    current.setTaskDueDate(task.id, event.target.value || null),
                  )
                }
              />
            </label>

            <label className="meta-row">
              <span>Estimate</span>
              <select
                className="meta-select"
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

            <label className="meta-row">
              <span>Scheduled</span>
              <span className="meta-value">
                {task.scheduledDate
                  ? `${relativeDayLabel(task.scheduledDate)}${
                      task.scheduledTime ? ` · ${formatTimeLabel(task.scheduledTime)}` : ""
                    }`
                  : "Not scheduled"}
              </span>
            </label>
          </div>
        </section>

        <section className="card rail-card">
          <div className="rail-row">
            <h2 className="rail-title">Task progress</h2>
            <span className="muted-small">{Math.round(task.progress * 100)}%</span>
          </div>
          <ProgressBar value={task.progress} height={6} label="Task progress" />
          <p className="rail-caption">
            {task.criteria.length === 0
              ? "Add steps to track progress."
              : remaining === 0
                ? "Every step is done."
                : `${remaining} ${remaining === 1 ? "step" : "steps"} remain`}
          </p>
          <div className="detail-focus-stat">
            <span className="rail-label">FOCUS LOGGED</span>
            <strong>{formatDuration(task.focusedMinutes)}</strong>
          </div>
          {project ? (
            <button
              type="button"
              className="project-link"
              onClick={() => onOpenProject(project.id)}
            >
              <ProjectMark color={project.color} size={22} muted />
              <span>{project.name}</span>
              <Icon name="chevron-right" size={14} />
            </button>
          ) : null}
        </section>

        <div className="rail-divider" />

        <div className="rail-block">
          <div className="rail-row">
            <h3>Recent activity</h3>
            <span className="muted-tiny">Latest</span>
          </div>
          {activity.length > 0 ? (
            <ul className="activity-list">
              {activity.map((entry) => (
                <li key={entry.id} className={`activity-item activity-${entry.kind}`}>
                  <span className="activity-node" aria-hidden="true" />
                  <div className="activity-copy">
                    <strong>{entry.text}</strong>
                    <span>{formatActivityMoment(entry.at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rail-note">Changes to this task will show up here.</p>
          )}
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <button
            type="button"
            className="text-link"
            onClick={() => {
              update((current) => current.moveTaskToInbox(task.id));
              pushToast({ title: "Moved to Inbox", detail: task.title });
              onBack();
            }}
          >
            <Icon name="inbox" size={15} />
            Move back to Inbox
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this task?"
        description={`“${task.title}” will be removed from the workspace. This cannot be undone.`}
        confirmLabel="Delete task"
        danger
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          update((current) => current.deleteTask(task.id));
          pushToast({ title: "Task deleted", detail: task.title });
          onBack();
        }}
      />
    </>
  );
}
