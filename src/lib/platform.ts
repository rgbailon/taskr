export function isMacLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function modKeyLabel(): string {
  return isMacLike() ? "⌘" : "Ctrl";
}

export function shortcutLabel(keys: string): string {
  return `${modKeyLabel()} ${keys}`;
}
