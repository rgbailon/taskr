const MS_PER_DAY = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
}

export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function addDaysISO(value: string, days: number): string {
  const date = fromISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfWeek(date = new Date()): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekday = copy.getDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

export function weekDates(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function isSameISODate(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a === b);
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatMonthDay(value: string | Date): string {
  const date =
    typeof value === "string"
      ? value.length > 10
        ? new Date(value)
        : fromISODate(value)
      : value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatWeekdayShort(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
}

export function formatWeekday(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export function relativeDayLabel(value: string, now = new Date()): string {
  const today = todayISO(now);
  if (value === today) return "Today";
  if (value === addDaysISO(today, 1)) return "Tomorrow";
  if (value === addDaysISO(today, -1)) return "Yesterday";
  return fromISODate(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

export function formatTimeLabel(time: string | null): string {
  if (!time) return "";
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${pad(minute)} ${suffix}`;
}

export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

export function roundUpToHalfHour(date = new Date()): string {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutesToTime(Math.ceil((minutes + 1) / 30) * 30);
}

export function nextPlanStart(now = new Date()): string {
  const current = now.getHours() * 60 + now.getMinutes();
  if (current < 9 * 60 + 30) return "09:30";
  return roundUpToHalfHour(now);
}

export function formatTimeOfDay(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatRelativeMoment(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const sameDay = toISODate(date) === todayISO(now);
  if (sameDay) return formatTimeOfDay(iso);
  if (toISODate(date) === addDaysISO(todayISO(now), -1)) return `Yesterday · ${formatTimeOfDay(iso)}`;
  return `${formatMonthDay(date)} · ${formatTimeOfDay(iso)}`;
}

export function formatActivityMoment(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (toISODate(date) === todayISO(now)) return formatTimeOfDay(iso);
  if (toISODate(date) === addDaysISO(todayISO(now), -1)) return "Yesterday";
  return formatMonthDay(date);
}

export function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function daysBetweenISO(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / MS_PER_DAY);
}
