import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import { isTauriRuntime } from "../domain/repository";
import { formatSavedTime } from "../lib/date";
import { LogoMark } from "./LogoMark";
import { Icon } from "./Icon";

export function TitleBar({
  breadcrumb,
  focusLocked = false,
}: {
  breadcrumb: string;
  focusLocked?: boolean;
}) {
  const { saveState, lastSavedAt, storagePath, repositoryKind } = useWorkspace();
  const { pushToast } = useToast();

  const saveLabel =
    saveState === "loading"
      ? "Opening workspace…"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "error"
          ? "Not saved"
          : "All changes saved";

  const tooltip =
    saveState === "error"
      ? "Tasker could not write to the local database."
      : `${storagePath || (repositoryKind === "tauri" ? "Local app data" : "Browser preview storage")}${
          lastSavedAt ? ` · Saved ${formatSavedTime(lastSavedAt)}` : ""
        }`;

  const runWindowAction = (action: "minimize" | "maximize" | "close") => {
    if (!isTauriRuntime()) {
      pushToast({
        title: "Window controls need the desktop build",
        detail: "Run `npm run desktop` to open Tasker as a native window.",
      });
      return;
    }
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const appWindow = getCurrentWindow();
      if (action === "minimize") await appWindow.minimize();
      if (action === "maximize") await appWindow.toggleMaximize();
      if (action === "close") await appWindow.close();
    })();
  };

  const toggleMaximize = () => {
    if (!isTauriRuntime()) return;
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    })();
  };

  return (
    <header
      className="titlebar"
      data-tauri-drag-region
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        toggleMaximize();
      }}
    >
      <div className="titlebar-left" data-tauri-drag-region>
        <div className="traffic-lights">
          <button
            type="button"
            className="traffic traffic-close"
            aria-label="Close window"
            title="Close"
            onClick={() => runWindowAction("close")}
          >
            <Icon name="close" size={7} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            className="traffic traffic-minimize"
            aria-label="Minimize window"
            title="Minimize"
            onClick={() => runWindowAction("minimize")}
          >
            <span className="traffic-glyph" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="traffic traffic-maximize"
            aria-label="Maximize or restore window"
            title="Maximize"
            onClick={() => runWindowAction("maximize")}
          >
            <span className="traffic-glyph traffic-glyph-square" aria-hidden="true" />
          </button>
        </div>

        <span className="titlebar-divider" aria-hidden="true" />
        <span className="titlebar-brand" data-tauri-drag-region>
          <LogoMark size={23} />
          <span className="titlebar-product" data-tauri-drag-region>
            Tasker
          </span>
        </span>
        <span className="titlebar-slash" aria-hidden="true" data-tauri-drag-region>
          /
        </span>
        <span className="titlebar-crumb" data-tauri-drag-region>
          {breadcrumb}
        </span>
      </div>

      <div className="titlebar-right">
        {focusLocked ? (
          <span className="focus-lock-chip" role="status">
            <Icon name="lock" size={12} />
            Focus locked
          </span>
        ) : null}
        <span className={`save-chip save-${saveState}`} title={tooltip} aria-live="polite">
          <span className="save-dot" aria-hidden="true" />
          <span>{saveLabel}</span>
        </span>
      </div>
    </header>
  );
}
