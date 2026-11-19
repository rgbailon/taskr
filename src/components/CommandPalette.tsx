import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "../app/routes";
import { useWorkspace } from "../state/WorkspaceProvider";
import { Modal } from "./Modal";
import { Icon, type IconName } from "./Icon";
import { shortcutLabel } from "../lib/platform";

interface CommandEntry {
  id: string;
  label: string;
  hint?: string;
  icon: IconName;
  group: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: Route) => void;
  onNewTask: () => void;
  onNewProject: () => void;
  onPlanDay: () => void;
  onShowShortcuts: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onNewTask,
  onNewProject,
  onPlanDay,
  onShowShortcuts,
}: CommandPaletteProps) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="palette-title" className="palette-modal">
      {open ? (
        <CommandPaletteBody
          onClose={onClose}
          onNavigate={onNavigate}
          onNewTask={onNewTask}
          onNewProject={onNewProject}
          onPlanDay={onPlanDay}
          onShowShortcuts={onShowShortcuts}
        />
      ) : null}
    </Modal>
  );
}

function CommandPaletteBody({
  onClose,
  onNavigate,
  onNewTask,
  onNewProject,
  onPlanDay,
  onShowShortcuts,
}: Omit<CommandPaletteProps, "open">) {
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    if (!workspace) return [];
    const normalized = query.trim().toLowerCase();
    const matches = (...values: Array<string | null | undefined>) =>
      !normalized || values.some((value) => value?.toLowerCase().includes(normalized));

    const goEntries: CommandEntry[] = [
      {
        id: "go-focus",
        label: "Go to Focus",
        hint: shortcutLabel("1"),
        icon: "focus",
        group: "Go",
        run: () => onNavigate({ view: "focus" }),
      },
      {
        id: "go-inbox",
        label: "Go to Inbox",
        hint: shortcutLabel("2"),
        icon: "inbox",
        group: "Go",
        run: () => onNavigate({ view: "inbox" }),
      },
      {
        id: "go-upcoming",
        label: "Go to Upcoming",
        hint: shortcutLabel("3"),
        icon: "calendar",
        group: "Go",
        run: () => onNavigate({ view: "upcoming" }),
      },
    ];
    const go = goEntries.filter((entry) => matches(entry.label));

    const actionEntries: CommandEntry[] = [
      {
        id: "action-new-task",
        label: "Add a task",
        hint: shortcutLabel("N"),
        icon: "plus",
        group: "Actions",
        run: onNewTask,
      },
      {
        id: "action-new-project",
        label: "Add a project",
        icon: "folder",
        group: "Actions",
        run: onNewProject,
      },
      {
        id: "action-plan-day",
        label: "Plan the day",
        hint: shortcutLabel("⇧ P"),
        icon: "spark",
        group: "Actions",
        run: onPlanDay,
      },
      {
        id: "action-shortcuts",
        label: "Keyboard shortcuts",
        hint: "?",
        icon: "keyboard",
        group: "Actions",
        run: onShowShortcuts,
      },
    ];
    const actions = actionEntries.filter((entry) => matches(entry.label));

    const projectEntries: CommandEntry[] = workspace.projects
      .filter((project) => matches(project.name, project.description))
      .map((project) => ({
        id: `project-${project.id}`,
        label: project.name,
        hint: "Project",
        icon: "folder" as IconName,
        group: "Projects",
        run: () => onNavigate({ view: "project", projectId: project.id }),
      }));

    const taskSource = normalized
      ? workspace.tasks.filter((task) => matches(task.title, task.description))
      : workspace.tasks.filter((task) => task.status === "in_progress" || task.status === "todo");
    const taskEntries: CommandEntry[] = taskSource.slice(0, normalized ? 8 : 5).map((task) => {
      const project = workspace.projectById(task.projectId);
      return {
        id: `task-${task.id}`,
        label: task.title,
        hint: project?.name ?? "No project",
        icon: "list" as IconName,
        group: normalized ? "Tasks" : "Open tasks",
        run: () => onNavigate({ view: "task", taskId: task.id }),
      };
    });

    return [
      { label: "Go", items: go },
      { label: "Actions", items: actions },
      { label: "Projects", items: projectEntries },
      { label: normalized ? "Tasks" : "Open tasks", items: taskEntries },
    ].filter((group) => group.items.length > 0);
  }, [workspace, query, onNavigate, onNewTask, onNewProject, onPlanDay, onShowShortcuts]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeEntry = flatItems[activeIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex > flatItems.length - 1) {
      setActiveIndex(Math.max(0, flatItems.length - 1));
    }
  }, [activeIndex, flatItems.length]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const choose = (entry: CommandEntry) => {
    onClose();
    entry.run();
  };

  return (
    <div className="palette">
      <h2 id="palette-title" className="sr-only">
        Search Tasker
      </h2>
      <div className="palette-search">
        <Icon name="search" size={18} />
        <input
          type="text"
          autoFocus
          value={query}
          placeholder="Search tasks, projects, or actions…"
          aria-label="Search tasks, projects, or actions"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => (flatItems.length ? (current + 1) % flatItems.length : 0));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) =>
                flatItems.length ? (current - 1 + flatItems.length) % flatItems.length : 0,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              if (activeEntry) choose(activeEntry);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <kbd className="palette-esc">Esc</kbd>
      </div>

      <div className="palette-results" ref={listRef}>
        {groups.length === 0 ? (
          <div className="palette-empty">
            <strong>No matches</strong>
            <p>Try a task title, a project name, or an action.</p>
          </div>
        ) : (
          groups.map((group) => (
            <div className="palette-group" key={group.label}>
              <span className="palette-group-label">{group.label}</span>
              {group.items.map((entry) => {
                const index = flatItems.findIndex((item) => item.id === entry.id);
                return (
                  <button
                    type="button"
                    key={entry.id}
                    data-index={index}
                    className={`palette-item${index === activeIndex ? " is-active" : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(entry)}
                  >
                    <span className="palette-icon">
                      <Icon name={entry.icon} size={16} />
                    </span>
                    <span className="palette-label">{entry.label}</span>
                    {entry.hint ? <span className="palette-hint">{entry.hint}</span> : null}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div className="palette-foot">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> to move
        </span>
        <span>
          <kbd>Enter</kbd> to open
        </span>
        <span>
          <kbd>Esc</kbd> to close
        </span>
      </div>
    </div>
  );
}
