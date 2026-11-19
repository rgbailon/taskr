import { useEffect, useRef, useState } from "react";
import type { Task } from "../domain/models";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import { useFocusTimerContext } from "../state/FocusTimerProvider";
import { formatDuration, relativeDayLabel } from "../lib/date";
import { Icon } from "./Icon";
import { ProjectMark } from "./ProjectMark";
import { StatusPill } from "./StatusPill";
import { ProgressBar } from "./ProgressBar";
import { TimerRing } from "./TimerRing";
import { ConfirmDialog } from "./Modal";

interface FocusCardProps {
  task: Task;
  locked: boolean;
  onOpenDetails: () => void;
  onOpenProject: (projectId: string) => void;
}

export function FocusCard({
  task,
  locked,
  onOpenDetails,
  onOpenProject,
}: FocusCardProps) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const project = workspace?.projectById(task.projectId) ?? null;
  const timer = useFocusTimerContext();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (document.querySelector("dialog[open]")) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
      event.preventDefault();
      timerRef.current.toggleForTask(taskRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const criteria = task.criteria;
  const hasCriteria = criteria.length > 0;

  return (
    <section className="card focus-card" aria-labelledby="focus-task-title">
      <div className="focus-card-top">
        <div className="focus-project-line">
          {project ? (
            locked ? (
              <span className="project-chip is-static">
                <ProjectMark color={project.color} size={24} muted />
                <span>{project.name}</span>
              </span>
            ) : (
              <button
                type="button"
                className="project-chip"
                onClick={() => onOpenProject(project.id)}
              >
                <ProjectMark color={project.color} size={24} muted />
                <span>{project.name}</span>
              </button>
            )
          ) : (
            <span className="project-chip is-static">
              <span className="project-mark is-muted" style={{ width: 24, height: 24 }}>
                <span className="unassigned-mark">–</span>
              </span>
              <span>No project</span>
            </span>
          )}
          {project?.milestone || task.dueDate ? (
            <>
              <span className="dot-separator" aria-hidden="true" />
              <span className="focus-context">
                {task.dueDate ? `Due ${relativeDayLabel(task.dueDate)}` : project?.milestone}
              </span>
            </>
          ) : null}
        </div>
        <StatusPill status={task.status} />
      </div>

      <div className="focus-card-main">
        <div className="focus-copy">
          <h2 id="focus-task-title">{task.title}</h2>
          {task.description ? <p>{task.description}</p> : null}
        </div>
        <TimerRing remaining={timer.remaining} total={timer.totalSeconds} status={timer.status} />
      </div>

      {hasCriteria ? (
        <>
          <div className="card-divider" />
          <div className="focus-progress-head">
            <span className="section-strong">Task progress</span>
            <span className="muted-small">
              {task.criteriaDone} of {criteria.length} steps
            </span>
          </div>
          <ProgressBar value={task.progress} height={6} label="Task checklist progress" />
          <div className="criteria-grid">
            {criteria.map((criterion) => (
              <button
                type="button"
                key={criterion.id}
                className={`criteria-item${criterion.done ? " is-done" : ""}`}
                onClick={() => update((current) => current.toggleCriterion(task.id, criterion.id))}
                aria-pressed={criterion.done}
              >
                <span
                  className={`check-circle check-sm${criterion.done ? " is-checked" : ""}`}
                  aria-hidden="true"
                >
                  {criterion.done ? <Icon name="check" size={10} strokeWidth={2.4} /> : null}
                </span>
                <span>{criterion.text}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="focus-card-foot">
        <div className="focus-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => timer.toggleForTask(task)}
          >
            <Icon name={timer.isRunning ? "pause" : "play"} size={14} />
            {timer.isRunning
              ? locked
                ? "Pause & unlock"
                : "Pause focus"
              : timer.status === "paused" && timer.sessionTaskId === task.id
                ? "Resume focus"
                : "Start focus"}
          </button>
          {timer.status !== "idle" ? (
            locked ? (
              <button
                type="button"
                className="text-button focus-end"
                onClick={() => setConfirmEnd(true)}
              >
                End session
              </button>
            ) : (
              <button
                type="button"
                className="icon-button"
                onClick={timer.reset}
                title="Reset the focus timer"
                aria-label="Reset the focus timer"
              >
                <Icon name="reset" size={17} />
              </button>
            )
          ) : null}
          {!locked ? (
            <button type="button" className="text-link" onClick={onOpenDetails}>
              Open task details
              <Icon name="arrow-right" size={14} />
            </button>
          ) : null}
        </div>
        <span className="focus-meta">
          <span className="focus-estimate">Estimate · {formatDuration(task.estimateMin)}</span>
          <button
            type="button"
            className="text-button focus-finish"
            onClick={() => {
              update((current) => current.completeTask(task.id));
              pushToast({ title: "Task finished", detail: task.title, tone: "success" });
            }}
          >
            <Icon name="check" size={13} strokeWidth={2.2} />
            Mark done
          </button>
        </span>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        title="End this focus session?"
        description="The timer stops and Tasker unlocks. Time from this session will not be added to the task's logged focus."
        confirmLabel="End session"
        danger
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          timer.reset();
        }}
      />
    </section>
  );
}
