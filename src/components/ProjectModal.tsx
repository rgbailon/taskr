import { useState } from "react";
import { Modal, ModalHeader } from "./Modal";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import { Project } from "../domain/models";

const PROJECT_COLORS = ["#3B9F93", "#7797D8", "#C39A61", "#C6838D", "#9A8BC4"];

export function ProjectModal({
  open,
  project = null,
  onClose,
  onCreated,
}: {
  open: boolean;
  project?: Project | null;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="project-modal-title">
      {open ? (
        <ProjectForm project={project} onClose={onClose} onCreated={onCreated} />
      ) : null}
    </Modal>
  );
}

function ProjectForm({
  project,
  onClose,
  onCreated,
}: {
  project: Project | null;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { update } = useWorkspace();
  const { pushToast } = useToast();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [milestone, setMilestone] = useState(project?.milestone ?? "");
  const [milestoneDue, setMilestoneDue] = useState(project?.milestoneDue ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [error, setError] = useState("");
  const editing = Boolean(project);

  const submit = () => {
    if (!name.trim()) {
      setError("Give the project a name.");
      return;
    }

    if (project) {
      const updated = project.withDetails({
        name,
        description,
        color,
        milestone,
        milestoneDue: milestoneDue || null,
      });
      update((current) => current.updateProject(updated));
      pushToast({
        title: "Project updated",
        detail: `${updated.name} saved.`,
        tone: "success",
      });
      onClose();
      return;
    }

    const created = Project.create({
      name,
      description,
      color,
      milestone,
      milestoneDue: milestoneDue || null,
    });
    update((current) => current.addProject(created));
    pushToast({
      title: "Project created",
      detail: `${created.name} is ready for its first task.`,
      tone: "success",
    });
    onClose();
    onCreated(created.id);
  };

  return (
    <>
      <ModalHeader
        title={editing ? "Edit project" : "Add a project"}
        description={
          editing
            ? "Update the project name, color, or next milestone."
            : "A project is a home for related work and its milestone."
        }
        titleId="project-modal-title"
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
          <span>Name</span>
          <input
            type="text"
            value={name}
            autoFocus
            placeholder="e.g. API platform"
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError("");
            }}
            aria-invalid={Boolean(error)}
          />
          {error ? <small className="field-error">{error}</small> : null}
        </label>

        <label className="field">
          <span>Description</span>
          <input
            type="text"
            value={description}
            placeholder="What is this project for?"
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Next milestone</span>
            <input
              type="text"
              value={milestone}
              placeholder="e.g. Cursor pagination"
              onChange={(event) => setMilestone(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Milestone date</span>
            <input
              type="date"
              value={milestoneDue}
              onChange={(event) => setMilestoneDue(event.target.value)}
            />
          </label>
        </div>

        <fieldset className="field field-swatches">
          <legend>Color</legend>
          <div className="swatch-row">
            {PROJECT_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={`swatch${color === option ? " is-active" : ""}`}
                style={{ background: option }}
                aria-label={`Use ${option}`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
              >
                {color === option ? <span className="swatch-check" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {editing ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>
    </>
  );
}
