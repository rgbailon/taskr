import type { TaskStatus } from "../domain/types";
import { TASK_STATUS_LABELS } from "../domain/types";

export function StatusPill({ status, subtle = false }: { status: TaskStatus; subtle?: boolean }) {
  return (
    <span className={`status-pill status-${status}${subtle ? " is-subtle" : ""}`}>
      <span className="status-dot" aria-hidden="true" />
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}
