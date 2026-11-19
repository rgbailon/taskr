import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/views.css";
import "./styles/dialogs.css";
import { App } from "./App";
import { ToastProvider } from "./state/ToastProvider";
import { WorkspaceProvider } from "./state/WorkspaceProvider";
import { FocusTimerProvider } from "./state/FocusTimerProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ToastProvider>
      <WorkspaceProvider>
        <FocusTimerProvider>
          <App />
        </FocusTimerProvider>
      </WorkspaceProvider>
    </ToastProvider>
  </React.StrictMode>,
);
