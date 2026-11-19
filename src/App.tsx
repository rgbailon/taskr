import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { breadcrumbFor, routeKey, type Route } from "./app/routes";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { QuickAddModal, type QuickAddPreset } from "./components/QuickAddModal";
import { ProjectModal } from "./components/ProjectModal";
import { PlanDayModal } from "./components/PlanDayModal";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { LogoMark } from "./components/LogoMark";
import { useWorkspace } from "./state/WorkspaceProvider";
import { FocusView } from "./views/FocusView";
import { InboxView } from "./views/InboxView";
import { UpcomingView } from "./views/UpcomingView";
import { ProjectView } from "./views/ProjectView";
import { TaskDetailView } from "./views/TaskDetailView";

type Overlay = "palette" | "quick-add" | "project" | "plan-day" | "shortcuts" | null;

export function App() {
  const { workspace, ready, focusStartRequest } = useWorkspace();
  const [route, setRoute] = useState<Route>({ view: "focus" });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [quickAddPreset, setQuickAddPreset] = useState<QuickAddPreset>({});
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const historyRef = useRef<Route[]>([]);

  const navigate = useCallback((next: Route) => {
    setRoute((current) => {
      if (routeKey(current) === routeKey(next)) return current;
      historyRef.current = [...historyRef.current.slice(-14), current];
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setRoute((current) => {
      const previous = historyRef.current.pop();
      if (previous) return previous;
      return current.view === "task" ? { view: "inbox" } : { view: "focus" };
    });
  }, []);

  const openQuickAdd = useCallback((preset: QuickAddPreset = {}) => {
    setQuickAddPreset(preset);
    setOverlay("quick-add");
  }, []);

  const closeOverlay = useCallback(() => setOverlay(null), []);

  const projectName = useMemo(() => {
    if (!workspace) return undefined;
    const target =
      route.view === "project"
        ? route.projectId
        : route.view === "task"
          ? workspace.taskById(route.taskId)?.projectId
          : null;
    return target ? workspace.projectById(target)?.name : undefined;
  }, [route, workspace]);

  useEffect(() => {
    if (focusStartRequest === 0) return;
    navigate({ view: "focus" });
    setAutoStartFocus(true);
  }, [focusStartRequest, navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const typing =
        Boolean(target?.closest("input, textarea, select, [contenteditable='true']")) ||
        Boolean(document.querySelector("dialog[open]"));

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOverlay((current) => (current === "palette" ? null : "palette"));
        return;
      }
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        openQuickAdd();
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setOverlay("plan-day");
        return;
      }
      if (mod && !event.shiftKey) {
        if (event.key === "1") {
          event.preventDefault();
          navigate({ view: "focus" });
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          navigate({ view: "inbox" });
          return;
        }
        if (event.key === "3") {
          event.preventDefault();
          navigate({ view: "upcoming" });
          return;
        }
      }
      if (typing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        goBack();
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setOverlay("shortcuts");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, openQuickAdd, goBack]);

  if (!ready || !workspace) {
    return (
      <div className="boot-screen">
        <LogoMark size={52} />
        <strong>Tasker</strong>
        <span>Opening your workspace…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TitleBar breadcrumb={breadcrumbFor(route, projectName)} />

      <div className="app-body">
        <Sidebar
          route={route}
          onNavigate={navigate}
          onNewProject={() => setOverlay("project")}
          onShowShortcuts={() => setOverlay("shortcuts")}
        />

        {route.view === "focus" ? (
          <FocusView
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onOpenProject={(projectId) => navigate({ view: "project", projectId })}
            onPlanDay={() => setOverlay("plan-day")}
            autoStartFocus={autoStartFocus}
            onAutoStartConsumed={() => setAutoStartFocus(false)}
          />
        ) : null}

        {route.view === "inbox" ? (
          <InboxView
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onNewTask={() => openQuickAdd()}
          />
        ) : null}

        {route.view === "upcoming" ? (
          <UpcomingView
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onNewTaskForDate={(date, time) =>
              openQuickAdd({ scheduledDate: date, scheduledTime: time })
            }
          />
        ) : null}

        {route.view === "project" ? (
          <ProjectView
            projectId={route.projectId}
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onNewTaskForProject={(projectId) => openQuickAdd({ projectId })}
          />
        ) : null}

        {route.view === "task" ? (
          <TaskDetailView
            taskId={route.taskId}
            onBack={goBack}
            onOpenProject={(projectId) => navigate({ view: "project", projectId })}
            onStartFocus={() => navigate({ view: "focus" })}
          />
        ) : null}
      </div>

      <CommandPalette
        open={overlay === "palette"}
        onClose={closeOverlay}
        onNavigate={(next) => {
          closeOverlay();
          navigate(next);
        }}
        onNewTask={() => openQuickAdd()}
        onNewProject={() => setOverlay("project")}
        onPlanDay={() => setOverlay("plan-day")}
        onShowShortcuts={() => setOverlay("shortcuts")}
      />

      <QuickAddModal
        open={overlay === "quick-add"}
        preset={quickAddPreset}
        onClose={closeOverlay}
      />

      <ProjectModal
        open={overlay === "project"}
        onClose={closeOverlay}
        onCreated={(projectId) => navigate({ view: "project", projectId })}
      />

      <PlanDayModal open={overlay === "plan-day"} onClose={closeOverlay} />

      <ShortcutsDialog open={overlay === "shortcuts"} onClose={closeOverlay} />
    </div>
  );
}
