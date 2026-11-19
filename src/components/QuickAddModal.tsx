import { useState } from "react";
import { Modal, ModalHeader } from "./Modal";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import { Task } from "../domain/models";
import { ESTIMATE_OPTIONS, type TaskPriority } from "../domain/types";
import { formatDuration, relativeDayLabel } from "../lib/date";

export interface QuickAddPreset {
  projectId?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
}

export function QuickAddModal({
  open,
  preset,
  onClose,
}: {
  open: boolean;
  preset: QuickAddPreset;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="quick-add-title">
      {open ? <QuickAddForm preset={preset} onClose={onClose} /> : null}
    </Modal>
  );
}

function QuickAddForm({ preset, onClose }: { preset: QuickAddPreset; onClose: () => void }) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(preset.projectId ?? "");
  const [estimateMin, setEstimateMin] = useState(25);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [day, setDay] = useState(preset.scheduledDate ?? "");
  const [time, setTime] = useState(preset.scheduledTime ?? "");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  if (!workspace) return null;

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the task a short, clear title.");
      return;
    }
    const task = Task.create({
      title: trimmed,
      description,
      projectId: projectId || null,
      status: day || projectId ? "todo" : "inbox",
      estimateMin,
      priority,
      scheduledDate: day || null,
      scheduledTime: day && time ? time : null,
    });
    update((current) => current.addTask(task));
    pushToast({
      title: day ? "Task scheduled" : "Task captured",
      detail: day
        ? `${task.title} · ${relativeDayLabel(day)}${time ? ` at ${time}` : ""}`
        : `${task.title} · waiting in your inbox`,
      tone: "success",
    });
    onClose();
  };

  return (
    <>
      <ModalHeader
        title="Add a task"
        description="Capture it now. You can give it a home in a moment."
        titleId="quick-add-title"
        onClose={onClose}
      />
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span>Title</span>
          <input
            type="text"
            value={title}
            autoFocus
            placeholder="What needs to happen?"
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError("");
            }}
            aria-invalid={Boolean(error)}
          />
          {error ? <small className="field-error">{error}</small> : null}
        </label>

        <div className="field-row">
          <label className="field">
            <span>Project</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">No project</option>
              {workspace.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Estimate</span>
            <select
              value={estimateMin}
              onChange={(event) => setEstimateMin(Number(event.target.value))}
            >
              {ESTIMATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatDuration(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <div className="field-row field-row-tight">
          <label className="field">
            <span>Day</span>
            <input
              type="date"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                if (!event.target.value) setTime("");
              }}
            />
          </label>
          <label className="field">
            <span>Time</span>
            <input
              type="time"
              value={time}
              disabled={!day}
              onChange={(event) => setTime(event.target.value)}
            />
          </label>
          <div className="field field-note">
            <span>Where it lands</span>
            <p>{day ? `Scheduled for ${relativeDayLabel(day)}` : "Stays in your Inbox"}</p>
          </div>
        </div>

        <label className="field">
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            placeholder="Context, constraints, links…"
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {day ? "Add to my day" : "Capture task"}
          </button>
        </div>
      </form>
    </>
  );
}
