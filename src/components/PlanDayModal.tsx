import { useMemo, useState } from "react";
import { Modal, ModalHeader } from "./Modal";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import type { Task } from "../domain/models";
import { Icon } from "./Icon";
import { ProjectDot } from "./ProjectMark";
import { formatDuration, minutesToTime, nextPlanStart, relativeDayLabel, timeToMinutes, todayISO } from "../lib/date";

export function PlanDayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="plan-day-title">
      {open ? <PlanDayForm onClose={onClose} /> : null}
    </Modal>
  );
}

function PlanDayForm({ onClose }: { onClose: () => void }) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const today = todayISO();

  const candidates = useMemo<Task[]>(() => {
    if (!workspace) return [];
    return workspace.tasks
      .filter((task) => !task.isDone && task.scheduledDate !== today)
      .sort((a, b) => {
        const statusRank = { in_progress: 0, todo: 1, inbox: 2, done: 3 } as const;
        const statusDelta = statusRank[a.status] - statusRank[b.status];
        if (statusDelta !== 0) return statusDelta;
        const priorityRank = { high: 0, normal: 1, low: 2 } as const;
        const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];
        if (priorityDelta !== 0) return priorityDelta;
        if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return a.createdAt.localeCompare(b.createdAt);
      })
      .slice(0, 8);
  }, [workspace, today]);

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(candidates.slice(0, 3).map((task) => task.id)),
  );
  const [startTime, setStartTime] = useState(() => nextPlanStart());

  if (!workspace) return null;

  const planned = candidates
    .filter((task) => selected.has(task.id))
    .reduce<Array<{ task: Task; time: string }>>((entries, task) => {
      const previous = entries[entries.length - 1];
      const cursor = previous
        ? timeToMinutes(previous.time) + previous.task.estimateMin + 10
        : timeToMinutes(startTime);
      entries.push({ task, time: minutesToTime(cursor) });
      return entries;
    }, []);

  const totalMinutes = planned.reduce((total, entry) => total + entry.task.estimateMin, 0);

  const toggle = (taskId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const apply = () => {
    if (planned.length === 0) return;
    update((current) =>
      current.scheduleMany(
        planned.map((entry) => ({
          taskId: entry.task.id,
          date: today,
          time: entry.time,
        })),
      ),
    );
    pushToast({
      title: "Day planned",
      detail: `${planned.length} ${planned.length === 1 ? "task" : "tasks"} · starts at ${planned[0]?.time}`,
      tone: "success",
    });
    onClose();
  };

  return (
    <>
      <ModalHeader
        title="Plan the day"
        description="Pick a few tasks. Tasker gives each one a time and leaves room to breathe."
        titleId="plan-day-title"
        onClose={onClose}
      />
      <div className="modal-form">
        {candidates.length === 0 ? (
          <div className="plan-empty">
            <strong>Nothing left to plan.</strong>
            <p>Every open task already has a place, or the list is clear.</p>
          </div>
        ) : (
          <>
            <div className="plan-candidates">
              {candidates.map((task) => {
                const project = workspace.projectById(task.projectId);
                const entry = planned.find((item) => item.task.id === task.id);
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`plan-candidate${selected.has(task.id) ? " is-selected" : ""}`}
                    onClick={() => toggle(task.id)}
                  >
                    <span
                      className={`check-circle check-sm${selected.has(task.id) ? " is-checked" : ""}`}
                      aria-hidden="true"
                    >
                      {selected.has(task.id) ? (
                        <Icon name="check" size={10} strokeWidth={2.4} />
                      ) : null}
                    </span>
                    <span className="plan-candidate-copy">
                      <strong>{task.title}</strong>
                      <span>
                        {project ? (
                          <>
                            <ProjectDot color={project.color} size={7} /> {project.name}
                          </>
                        ) : (
                          "No project"
                        )}
                        {" · "}
                        {formatDuration(task.estimateMin)}
                      </span>
                    </span>
                    <span className={`plan-time${entry ? " is-set" : ""}`}>
                      {entry ? entry.time : relativeDayLabel(today)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="plan-summary">
              <label className="field field-inline">
                <span>Start at</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value || "09:30")}
                />
              </label>
              <span className="plan-total">
                {planned.length} selected · {formatDuration(totalMinutes)}
              </span>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={planned.length === 0}
            onClick={apply}
          >
            Plan {planned.length || "no"} {planned.length === 1 ? "task" : "tasks"}
          </button>
        </div>
      </div>
    </>
  );
}
