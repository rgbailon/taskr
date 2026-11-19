import { invoke } from "@tauri-apps/api/core";
import type { WorkspaceData } from "./types";

export type RepositoryKind = "tauri" | "browser";

export interface WorkspaceRepository {
  kind: RepositoryKind;
  load(): Promise<WorkspaceData | null>;
  save(data: WorkspaceData): Promise<void>;
  exportCopy(data: WorkspaceData): Promise<string>;
  reset(): Promise<void>;
  location(): Promise<string>;
}

const BROWSER_KEY = "tasker.workspace.v1";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export class TauriWorkspaceRepository implements WorkspaceRepository {
  readonly kind = "tauri" as const;

  async load(): Promise<WorkspaceData | null> {
    const raw = await invoke<string | null>("load_workspace");
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceData;
  }

  async save(data: WorkspaceData): Promise<void> {
    await invoke("save_workspace", { data: JSON.stringify(data) });
  }

  async exportCopy(data: WorkspaceData): Promise<string> {
    return invoke<string>("export_workspace", { data: JSON.stringify(data) });
  }

  async reset(): Promise<void> {
    await invoke("reset_workspace");
  }

  async location(): Promise<string> {
    return invoke<string>("storage_location");
  }
}

export class BrowserWorkspaceRepository implements WorkspaceRepository {
  readonly kind = "browser" as const;

  async load(): Promise<WorkspaceData | null> {
    const raw = window.localStorage.getItem(BROWSER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceData;
  }

  async save(data: WorkspaceData): Promise<void> {
    window.localStorage.setItem(BROWSER_KEY, JSON.stringify(data));
  }

  async exportCopy(data: WorkspaceData): Promise<string> {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tasker-export-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return "Downloads folder";
  }

  async reset(): Promise<void> {
    window.localStorage.removeItem(BROWSER_KEY);
  }

  async location(): Promise<string> {
    return "Browser preview storage";
  }
}

export function createWorkspaceRepository(): WorkspaceRepository {
  return isTauriRuntime()
    ? new TauriWorkspaceRepository()
    : new BrowserWorkspaceRepository();
}

export function notifyDesktop(title: string, body: string): void {
  if (!isTauriRuntime()) return;
  void (async () => {
    try {
      const plugin = await import("@tauri-apps/plugin-notification");
      let granted = await plugin.isPermissionGranted();
      if (!granted) {
        granted = (await plugin.requestPermission()) === "granted";
      }
      if (granted) {
        plugin.sendNotification({ title, body });
      }
    } catch {
      // Notifications are a convenience; the in-app toast is the source of truth.
    }
  })();
}
