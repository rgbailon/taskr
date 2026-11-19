export type TaskStatus = "inbox" | "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "normal" | "high";

export type ActivityKind =
  | "focus"
  | "complete"
  | "create"
  | "schedule"
  | "plan"
  | "project"
  | "status"
  | "sorted";

export interface CriterionData {
  id: string;
  text: string;
  done: boolean;
}

export interface TaskData {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimateMin: number;
  dueDate: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  criteria: CriterionData[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  focusedMinutes: number;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  color: string;
  milestone: string;
  milestoneDue: string | null;
  notes: string;
  createdAt: string;
}

export interface ActivityData {
  id: string;
  at: string;
  kind: ActivityKind;
  text: string;
  subject: string;
  taskId?: string;
  projectId?: string;
  minutes?: number;
}

export interface ProfileData {
  name: string;
  role: string;
  workspace: string;
}

export interface PreferencesData {
  focusMinutes: number;
  breakMinutes: number;
}

export interface WorkspaceData {
  version: 1;
  profile: ProfileData;
  projects: ProjectData[];
  tasks: TaskData[];
  activities: ActivityData[];
  preferences: PreferencesData;
  focusTaskId: string | null;
  createdAt: string;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  inbox: "Inbox",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};

export const ESTIMATE_OPTIONS = [5, 10, 15, 20, 25, 30, 45, 60, 90, 120];
