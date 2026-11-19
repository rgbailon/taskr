import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Icon } from "../components/Icon";

export function TerminalView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    let fitAddon: FitAddon | null = null;

    const terminal = new Terminal({
      fontFamily: '"Cascadia Mono", "Consolas", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.35,
      cursorBlink: true,
      theme: {
        background: "#0f1419",
        foreground: "#d7dee8",
        cursor: "#4cbcae",
        selectionBackground: "rgba(76, 188, 174, 0.28)",
      },
      scrollback: 5000,
    });
    terminalRef.current = terminal;

    const start = async () => {
      try {
        await invoke("terminal_start");
      } catch (error) {
        terminal.write(`\r\n\x1b[31mCould not start PowerShell: ${String(error)}\x1b[0m\r\n`);
      }

      if (disposed || !containerRef.current) return;
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();

      unlisten = await listen<string>("terminal-output", (event) => {
        terminal.write(event.payload);
      });

      terminal.onData((data) => {
        void invoke("terminal_write", { data }).catch(() => undefined);
      });

      const resize = () => fitAddon?.fit();
      window.addEventListener("resize", resize);
      (terminal as Terminal & { __resize?: () => void }).__resize = resize;
    };

    void start();

    return () => {
      disposed = true;
      const resize = (terminal as Terminal & { __resize?: () => void }).__resize;
      if (resize) window.removeEventListener("resize", resize);
      if (unlisten) unlisten();
      terminal.dispose();
      terminalRef.current = null;
      void invoke("terminal_stop").catch(() => undefined);
    };
  }, []);

  const restart = async () => {
    await invoke("terminal_stop").catch(() => undefined);
    await invoke("terminal_start").catch(() => undefined);
    terminalRef.current?.clear();
    terminalRef.current?.write("\r\n\x1b[36mShell restarted.\x1b[0m\r\n");
  };

  return (
    <main className="main terminal-main">
      <div className="terminal-view">
        <header className="terminal-head">
          <div>
            <p className="eyebrow">TERMINAL</p>
            <h1 className="page-title">PowerShell</h1>
            <p className="subtitle">
              A real PowerShell session rooted in Tasker&apos;s data folder. Run Tasker commands below, or any PowerShell/SQLite command.
            </p>
          </div>
          <button type="button" className="button button-quiet" onClick={restart}>
            <Icon name="refresh" size={15} />
            Restart shell
          </button>
        </header>

        <section className="terminal-help card">
          <h2>Tasker commands</h2>
          <div className="terminal-help-grid">
            <code>Get-TaskerDb</code>
            <span>Path to tasker.db</span>
            <code>Get-TaskerTasks</code>
            <span>List tasks as JSON</span>
            <code>Get-TaskerProjects</code>
            <span>List projects as JSON</span>
            <code>New-TaskerTask -Title "..."</code>
            <span>Create an inbox task</span>
            <code>Remove-TaskerTask -Id "task-..."</code>
            <span>Delete a task</span>
            <code>Remove-TaskerProject -Id "project-..."</code>
            <span>Delete a project</span>
            <code>Invoke-TaskerSql "SELECT ..."</code>
            <span>Run any SQL against tasker.db</span>
          </div>
        </section>

        <div className="terminal-frame" ref={containerRef} />
      </div>
    </main>
  );
}