import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSeedWorkspace } from "../data/seed";
import { Workspace } from "../domain/models";
import {
  createWorkspaceRepository,
  isTauriRuntime,
  type RepositoryKind,
  type WorkspaceRepository,
} from "../domain/repository";
import { useToast } from "./ToastProvider";

export type SaveState = "loading" | "saving" | "saved" | "error";

interface WorkspaceContextValue {
  workspace: Workspace | null;
  ready: boolean;
  saveState: SaveState;
  lastSavedAt: Date | null;
  storagePath: string;
  repositoryKind: RepositoryKind;
  focusStartRequest: number;
  update: (recipe: (current: Workspace) => Workspace) => void;
  beginFocus: (taskId: string) => void;
  exportCopy: () => Promise<void>;
  resetDemo: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const repositoryRef = useRef<WorkspaceRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = createWorkspaceRepository();
  }
  const repository = repositoryRef.current;

  const { pushToast } = useToast();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [storagePath, setStoragePath] = useState("");
  const [focusStartRequest, setFocusStartRequest] = useState(0);

  const workspaceRef = useRef<Workspace | null>(null);
  const skipNextSaveRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const bootedRef = useRef(false);
  const closingRef = useRef(false);

  const persist = useCallback((snapshot: Workspace) => {
    setSaveState("saving");
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await repository.save(snapshot.toJSON());
        setSaveState("saved");
        setLastSavedAt(new Date());
      })
      .catch((error: unknown) => {
        console.error("Tasker could not save the workspace.", error);
        setSaveState("error");
      });
  }, [repository]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const boot = async () => {
      try {
        const [stored, location] = await Promise.all([
          repository.load(),
          repository.location(),
        ]);
        setStoragePath(location);

        if (stored) {
          const restored = Workspace.fromJSON(stored);
          workspaceRef.current = restored;
          skipNextSaveRef.current = true;
          setWorkspace(restored);
          setSaveState("saved");
        } else {
          const seed = createSeedWorkspace();
          workspaceRef.current = seed;
          skipNextSaveRef.current = true;
          setWorkspace(seed);
          try {
            await repository.save(seed.toJSON());
            setSaveState("saved");
            setLastSavedAt(new Date());
          } catch (error) {
            console.error("Tasker could not save the first workspace.", error);
            setSaveState("error");
          }
        }
      } catch (error) {
        console.error("Tasker could not open the saved workspace.", error);
        const seed = createSeedWorkspace();
        workspaceRef.current = seed;
        skipNextSaveRef.current = true;
        setWorkspace(seed);
        setSaveState("error");
        pushToast({
          title: "Started from the sample workspace",
          detail: "The saved workspace could not be read. Your next change will write a fresh copy.",
          tone: "error",
          durationMs: 7000,
        });
      } finally {
        setReady(true);
      }
    };

    void boot();
  }, [pushToast, repository]);

  useEffect(() => {
    if (!ready || !workspace) return;
    workspaceRef.current = workspace;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => persist(workspace), 450);
    return () => window.clearTimeout(timer);
  }, [workspace, ready, persist]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        const stop = await appWindow.onCloseRequested(async (event) => {
          if (closingRef.current) return;
          event.preventDefault();
          closingRef.current = true;
          try {
            if (workspaceRef.current) {
              await repository.save(workspaceRef.current.toJSON());
            }
          } catch (error) {
            console.error("Tasker could not flush the workspace before closing.", error);
          } finally {
            await appWindow.destroy();
          }
        });
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
        }
      } catch (error) {
        console.error("Tasker could not register the close handler.", error);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [repository]);

  useEffect(() => {
    const flush = () => {
      if (workspaceRef.current) {
        void repository.save(workspaceRef.current.toJSON()).catch(() => undefined);
      }
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [repository]);

  const update = useCallback((recipe: (current: Workspace) => Workspace) => {
    setWorkspace((current) => {
      if (!current) return current;
      const next = recipe(current);
      workspaceRef.current = next;
      return next;
    });
  }, []);

  const beginFocus = useCallback((taskId: string) => {
    setWorkspace((current) => {
      if (!current) return current;
      const next = current.startFocus(taskId);
      workspaceRef.current = next;
      return next;
    });
    setFocusStartRequest((current) => current + 1);
  }, []);

  const exportCopy = useCallback(async () => {
    const current = workspaceRef.current;
    if (!current) return;
    try {
      const path = await repository.exportCopy(current.toJSON());
      pushToast({
        title: "Exported a copy",
        detail: path,
        tone: "success",
        durationMs: 7000,
      });
    } catch (error) {
      console.error("Tasker could not export a copy.", error);
      pushToast({
        title: "Export failed",
        detail: "The workspace copy could not be written.",
        tone: "error",
      });
    }
  }, [pushToast, repository]);

  const resetDemo = useCallback(async () => {
    try {
      await repository.reset();
      const seed = createSeedWorkspace();
      workspaceRef.current = seed;
      skipNextSaveRef.current = true;
      setWorkspace(seed);
      setSaveState("saved");
      await repository.save(seed.toJSON());
      setLastSavedAt(new Date());
      pushToast({
        title: "Sample workspace restored",
        detail: "Projects, tasks, and activity are back to their original state.",
        tone: "success",
      });
    } catch (error) {
      console.error("Tasker could not reset the workspace.", error);
      pushToast({
        title: "Reset failed",
        detail: "The local database could not be reset.",
        tone: "error",
      });
    }
  }, [pushToast, repository]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspace,
      ready,
      saveState,
      lastSavedAt,
      storagePath,
      repositoryKind: repository.kind,
      focusStartRequest,
      update,
      beginFocus,
      exportCopy,
      resetDemo,
    }),
    [
      workspace,
      ready,
      saveState,
      lastSavedAt,
      storagePath,
      repository.kind,
      focusStartRequest,
      update,
      beginFocus,
      exportCopy,
      resetDemo,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
