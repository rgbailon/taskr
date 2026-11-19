import { Modal, ModalHeader } from "./Modal";
import { modKeyLabel } from "../lib/platform";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: [modKeyLabel(), "K"], label: "Search tasks, projects, and commands" },
  { keys: [modKeyLabel(), "N"], label: "Add a task" },
  { keys: [modKeyLabel(), "⇧", "P"], label: "Plan the day" },
  { keys: [modKeyLabel(), "1"], label: "Go to Focus" },
  { keys: [modKeyLabel(), "2"], label: "Go to Inbox" },
  { keys: [modKeyLabel(), "3"], label: "Go to Upcoming" },
  { keys: ["Space"], label: "Start or pause the focus timer" },
  { keys: ["Esc"], label: "Close a dialog or step back" },
  { keys: ["?"], label: "Show this list" },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="shortcuts-title" className="modal-small">
      <ModalHeader
        title="Keyboard shortcuts"
        description="Shortcuts stay out of the way while you are typing in a field."
        titleId="shortcuts-title"
        onClose={onClose}
      />
      <ul className="shortcut-list">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.label}>
            <span className="shortcut-keys">
              {shortcut.keys.map((key, index) => (
                <kbd key={`${shortcut.label}-${key}-${index}`}>{key}</kbd>
              ))}
            </span>
            <span>{shortcut.label}</span>
          </li>
        ))}
      </ul>
      <div className="modal-actions">
        <button type="button" className="button button-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
