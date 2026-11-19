import { useEffect, useMemo, useState } from "react";
import type { Route } from "../app/routes";
import { useWorkspace } from "../state/WorkspaceProvider";
import { LogoMark } from "./LogoMark";
import { Icon, type IconName } from "./Icon";
import { ProjectDot } from "./ProjectMark";
import { ConfirmDialog } from "./Modal";
import { useTheme, type ThemeChoice } from "../state/ThemeProvider";

type SidebarMenu = "workspace" | "profile" | null;

const APPEARANCE_OPTIONS: Array<{ value: ThemeChoice; label: string; icon: IconName }> = [
  { value: "system", label: "System", icon: "monitor" },
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

interface SidebarProps {
  route: Route;
  onNavigate: (route: Route) => void;
  onNewProject: () => void;
  onShowShortcuts: () => void;
}

export function Sidebar({ route, onNavigate, onNewProject, onShowShortcuts }: SidebarProps) {
  const {
    workspace,
    saveState,
    storagePath,
    repositoryKind,
    exportCopy,
    resetDemo,
  } = useWorkspace();
  const { choice: appearance, setChoice: setAppearance } = useTheme();
  const [menu, setMenu] = useState<SidebarMenu>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".sidebar-popover, .workspace-card, .profile-button")) {
        setMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  const projects = workspace?.projects ?? [];
  const inboxCount = workspace?.inboxTasks.length ?? 0;
  const openCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!workspace) return counts;
    for (const task of workspace.tasks) {
      if (!task.projectId) continue;
      if (task.status === "todo" || task.status === "in_progress") {
        counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
      }
    }
    return counts;
  }, [workspace]);

  if (!workspace) return <aside className="sidebar" />;

  const profile = workspace.profile;
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isFocusActive = route.view === "focus";
  const isInboxActive = route.view === "inbox";
  const isUpcomingActive = route.view === "upcoming";

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <LogoMark size={32} />
        <span className="wordmark">tasker</span>
      </div>

      <div className="workspace-block">
        <button
          type="button"
          className={`workspace-card${menu === "workspace" ? " is-open" : ""}`}
          aria-expanded={menu === "workspace"}
          aria-haspopup="dialog"
          onClick={() => setMenu(menu === "workspace" ? null : "workspace")}
        >
          <span className="workspace-check" aria-hidden="true">
            <Icon name="check" size={12} strokeWidth={2.1} />
          </span>
          <span className="workspace-copy">
            <span className="workspace-label">WORKSPACE</span>
            <span className="workspace-name">{profile.workspace}</span>
          </span>
          <Icon name="chevron-down" size={15} className="workspace-chevron" />
        </button>

        {menu === "workspace" ? (
          <div className="sidebar-popover workspace-popover" role="dialog" aria-label="Workspace details">
            <div className="popover-heading">
              <span className="popover-label">LOCAL WORKSPACE</span>
              <strong>{profile.workspace}</strong>
            </div>
            <p className="popover-note">
              Tasks, projects, notes, and activity stay on this device. Nothing leaves your computer.
            </p>
            <span className="popover-label">SAVED AT</span>
            <code className="storage-path" title={storagePath}>
              {storagePath || "Resolving location…"}
            </code>
            <div className="popover-foot">
              <span className={`save-inline save-${saveState}`}>
                <span className="save-dot" aria-hidden="true" />
                {saveState === "saved" ? "Up to date" : saveState === "saving" ? "Saving…" : "Needs attention"}
              </span>
              <span className="popover-kind">{repositoryKind === "tauri" ? "Desktop app" : "Browser preview"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="primary-nav" aria-label="Workspace">
        <button
          type="button"
          className={`nav-item${isFocusActive ? " is-active" : ""}`}
          aria-current={isFocusActive ? "page" : undefined}
          onClick={() => onNavigate({ view: "focus" })}
        >
          <Icon name="focus" size={17} />
          <span>Focus</span>
        </button>
        <button
          type="button"
          className={`nav-item${isInboxActive ? " is-active" : ""}`}
          aria-current={isInboxActive ? "page" : undefined}
          onClick={() => onNavigate({ view: "inbox" })}
        >
          <Icon name="inbox" size={17} />
          <span>Inbox</span>
          {inboxCount > 0 ? <span className="nav-dot" aria-label={`${inboxCount} items`} /> : null}
        </button>
        <button
          type="button"
          className={`nav-item${isUpcomingActive ? " is-active" : ""}`}
          aria-current={isUpcomingActive ? "page" : undefined}
          onClick={() => onNavigate({ view: "upcoming" })}
        >
          <Icon name="calendar" size={17} />
          <span>Upcoming</span>
        </button>
      </nav>

      <div className="projects-head">
        <span className="section-label">PROJECTS</span>
        <button
          type="button"
          className="icon-button icon-small"
          onClick={onNewProject}
          aria-label="Add a project"
          title="Add a project"
        >
          <Icon name="plus" size={15} />
        </button>
      </div>

      <div className="project-list">
        {projects.map((project) => {
          const active = route.view === "project" && route.projectId === project.id;
          const openCount = openCounts.get(project.id) ?? 0;
          return (
            <button
              type="button"
              key={project.id}
              className={`project-item${active ? " is-active" : ""}`}
              onClick={() => onNavigate({ view: "project", projectId: project.id })}
              aria-current={active ? "page" : undefined}
            >
              <ProjectDot color={project.color} size={11} />
              <span className="project-name">{project.name}</span>
              {openCount > 0 ? <span className="project-count">{openCount}</span> : null}
            </button>
          );
        })}
      </div>

      <button type="button" className="add-project" onClick={onNewProject}>
        <Icon name="plus" size={14} />
        Add a project
      </button>

      <div className="sidebar-spacer" />

      <div className="sidebar-footer">
        <button
          type="button"
          className={`profile-button${menu === "profile" ? " is-open" : ""}`}
          aria-expanded={menu === "profile"}
          aria-haspopup="menu"
          onClick={() => setMenu(menu === "profile" ? null : "profile")}
        >
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="profile-copy">
            <strong>{profile.name}</strong>
            <span>{profile.role}</span>
          </span>
          <span className="profile-more" aria-hidden="true">
            <Icon name="more" size={16} />
          </span>
        </button>

        {menu === "profile" ? (
          <div className="sidebar-popover profile-popover" role="menu" aria-label="Tasker menu">
            <div className="popover-heading">
              <span className="popover-label">LOCAL-FIRST</span>
              <strong>{profile.workspace}</strong>
              <code className="storage-path" title={storagePath}>
                {storagePath || "Resolving location…"}
              </code>
            </div>
            <div className="menu-separator" />
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setMenu(null);
                void exportCopy();
              }}
            >
              <Icon name="export" size={16} />
              Export a copy
            </button>
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setMenu(null);
                onShowShortcuts();
              }}
            >
              <Icon name="keyboard" size={16} />
              Keyboard shortcuts
              <span className="menu-shortcut">?</span>
            </button>
            <div className="appearance-block">
              <span className="popover-label">APPEARANCE</span>
              <div className="appearance-options" role="radiogroup" aria-label="Appearance">
                {APPEARANCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={appearance === option.value}
                    className={`appearance-option${appearance === option.value ? " is-active" : ""}`}
                    onClick={() => setAppearance(option.value)}
                  >
                    <Icon name={option.icon} size={14} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="menu-separator" />
            <button
              type="button"
              role="menuitem"
              className="menu-item menu-danger"
              onClick={() => {
                setMenu(null);
                setConfirmReset(true);
              }}
            >
              <Icon name="refresh" size={16} />
              Reset sample data…
            </button>
            <div className="popover-footer">
              <span>Tasker 1.0.0</span>
              <span>{repositoryKind === "tauri" ? "Desktop" : "Preview"}</span>
            </div>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset to the sample workspace?"
        description="Every task, project, note, and activity entry you changed will be replaced by the original sample data. This cannot be undone."
        confirmLabel="Reset workspace"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          void resetDemo();
        }}
      />
    </aside>
  );
}
