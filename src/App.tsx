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
import { useFocusTimerContext } from "./state/FocusTimerProvider";
import { FocusView } from "./views/FocusView";
import { InboxView } from "./views/InboxView";
import { UpcomingView } from "./views/UpcomingView";
import { ProjectView } from "./views/ProjectView";
import { TaskDetailView } from "./views/TaskDetailView";

type Overlay = "palette" | "quick-add" | "project" | "plan-day" | "shortcuts" | null;

export function App() {
  const { workspace, ready, focusStartRequest } = useWorkspace();
  const { isLocked: isFocusLocked } = useFocusTimerContext();
  const [route, setRoute] = useState<Route>({ view: "focus" });
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [quickAddPreset, setQuickAddPreset] = useState<QuickAddPreset>({});
  const historyRef = useRef<Route[]>([]);

  const navigate = useCallback(
    (next: Route) => {
      if (isFocusLocked && next.view !== "focus") return;
      setRoute((current) => {
        if (routeKey(current) === routeKey(next)) return current;
        historyRef.current = [...historyRef.current.slice(-14), current];
        return next;
      });
    },
    [isFocusLocked],
  );

  const goBack = useCallback(() => {
    if (isFocusLocked) return;
    setRoute((current) => {
      const previous = historyRef.current.pop();
      if (previous) return previous;
      return current.view === "task" ? { view: "inbox" } : { view: "focus" };
    });
  }, [isFocusLocked]);

  const openQuickAdd = useCallback(
    (preset: QuickAddPreset = {}) => {
      if (isFocusLocked) return;
      setQuickAddPreset(preset);
      setOverlay("quick-add");
    },
    [isFocusLocked],
  );

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
  }, [focusStartRequest, navigate]);

  useEffect(() => {
    if (!isFocusLocked) return;
    setOverlay(null);
    setRoute((current) => (current.view === "focus" ? current : { view: "focus" }));
  }, [isFocusLocked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFocusLocked) return;
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
  }, [isFocusLocked, navigate, openQuickAdd, goBack]);

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
    <div className={`app-shell${isFocusLocked ? " is-focus-locked" : ""}`}>
      <TitleBar
        breadcrumb={isFocusLocked ? "Focus session" : breadcrumbFor(route, projectName)}
        focusLocked={isFocusLocked}
      />

      <div className={`app-body${isFocusLocked ? " is-focus-locked" : ""}`}>
        {!isFocusLocked ? (
          <Sidebar
            route={route}
            onNavigate={navigate}
            onNewProject={() => setOverlay("project")}
            onShowShortcuts={() => setOverlay("shortcuts")}
          />
        ) : null}

        {isFocusLocked || route.view === "focus" ? (
          <FocusView
            locked={isFocusLocked}
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onOpenProject={(projectId) => navigate({ view: "project", projectId })}
            onPlanDay={() => setOverlay("plan-day")}
          />
        ) : null}

        {!isFocusLocked && route.view === "inbox" ? (
          <InboxView
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onNewTask={() => openQuickAdd()}
          />
        ) : null}

        {!isFocusLocked && route.view === "upcoming" ? (
          <UpcomingView
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onNewTaskForDate={(date, time) =>
              openQuickAdd({ scheduledDate: date, scheduledTime: time })
            }
          />
        ) : null}

        {!isFocusLocked && route.view === "project" ? (
          <ProjectView
            projectId={route.projectId}
            onOpenTask={(taskId) => navigate({ view: "task", taskId })}
            onNewTaskForProject={(projectId) => openQuickAdd({ projectId })}
            onProjectDeleted={() => navigate({ view: "inbox" })}
          />
        ) : null}

        {!isFocusLocked && route.view === "task" ? (
          <TaskDetailView
            taskId={route.taskId}
            onBack={goBack}
            onOpenProject={(projectId) => navigate({ view: "project", projectId })}
            onStartFocus={() => navigate({ view: "focus" })}
          />
        ) : null}
      </div>

      {!isFocusLocked ? (
        <>
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
        </>
      ) : null}
    </div>
  );
}
