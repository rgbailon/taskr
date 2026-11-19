import { createId } from "../lib/id";
import { nowIso, todayISO, toISODate } from "../lib/date";
import type {
  ActivityData,
  ActivityKind,
  CriterionData,
  ProjectData,
  TaskData,
  TaskPriority,
  TaskStatus,
  WorkspaceData,
} from "./types";

const MAX_ACTIVITY_ENTRIES = 200;
const MIN_ESTIMATE = 5;
const MAX_ESTIMATE = 480;

export function createActivity(
  kind: ActivityKind,
  text: string,
  subject: string,
  options: { at?: string; taskId?: string; projectId?: string; minutes?: number } = {},
): ActivityData {
  return {
    id: createId("activity"),
    at: options.at ?? nowIso(),
    kind,
    text,
    subject,
    taskId: options.taskId,
    projectId: options.projectId,
    minutes: options.minutes,
  };
}

export class Task {
  private constructor(private readonly data: TaskData) {}

  static create(input: {
    title: string;
    description?: string;
    projectId?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    estimateMin?: number;
    dueDate?: string | null;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    criteria?: string[];
    notes?: string;
    createdAt?: string;
  }): Task {
    const title = input.title.trim();
    if (!title) {
      throw new Error("A task needs a title.");
    }
    const createdAt = input.createdAt ?? nowIso();
    return new Task({
      id: createId("task"),
      title,
      description: input.description?.trim() ?? "",
      projectId: input.projectId ?? null,
      status: input.status ?? "inbox",
      priority: input.priority ?? "normal",
      estimateMin: clampEstimate(input.estimateMin ?? 25),
      dueDate: input.dueDate ?? null,
      scheduledDate: input.scheduledDate ?? null,
      scheduledTime: input.scheduledTime ?? null,
      criteria: (input.criteria ?? []).map((text) => ({
        id: createId("step"),
        text,
        done: false,
      })),
      notes: input.notes ?? "",
      createdAt,
      updatedAt: createdAt,
      completedAt: input.status === "done" ? createdAt : null,
      focusedMinutes: 0,
    });
  }

  static fromJSON(raw: TaskData): Task {
    const createdAt = raw.createdAt || nowIso();
    return new Task({
      id: raw.id || createId("task"),
      title: (raw.title ?? "").trim() || "Untitled task",
      description: raw.description ?? "",
      projectId: raw.projectId ?? null,
      status: isStatus(raw.status) ? raw.status : "todo",
      priority: isPriority(raw.priority) ? raw.priority : "normal",
      estimateMin: clampEstimate(raw.estimateMin ?? 25),
      dueDate: raw.dueDate ?? null,
      scheduledDate: raw.scheduledDate ?? null,
      scheduledTime: raw.scheduledTime ?? null,
      criteria: Array.isArray(raw.criteria)
        ? raw.criteria
            .filter((criterion) => Boolean(criterion?.text))
            .map((criterion) => ({
              id: criterion.id || createId("step"),
              text: criterion.text,
              done: Boolean(criterion.done),
            }))
        : [],
      notes: raw.notes ?? "",
      createdAt,
      updatedAt: raw.updatedAt || createdAt,
      completedAt: raw.completedAt ?? null,
      focusedMinutes: Number.isFinite(raw.focusedMinutes) ? Math.max(0, raw.focusedMinutes) : 0,
    });
  }

  get id(): string {
    return this.data.id;
  }
  get title(): string {
    return this.data.title;
  }
  get description(): string {
    return this.data.description;
  }
  get projectId(): string | null {
    return this.data.projectId;
  }
  get status(): TaskStatus {
    return this.data.status;
  }
  get priority(): TaskPriority {
    return this.data.priority;
  }
  get estimateMin(): number {
    return this.data.estimateMin;
  }
  get dueDate(): string | null {
    return this.data.dueDate;
  }
  get scheduledDate(): string | null {
    return this.data.scheduledDate;
  }
  get scheduledTime(): string | null {
    return this.data.scheduledTime;
  }
  get criteria(): readonly CriterionData[] {
    return this.data.criteria;
  }
  get notes(): string {
    return this.data.notes;
  }
  get createdAt(): string {
    return this.data.createdAt;
  }
  get updatedAt(): string {
    return this.data.updatedAt;
  }
  get completedAt(): string | null {
    return this.data.completedAt;
  }
  get focusedMinutes(): number {
    return this.data.focusedMinutes;
  }
  get isDone(): boolean {
    return this.data.status === "done";
  }
  get isScheduled(): boolean {
    return Boolean(this.data.scheduledDate);
  }
  get criteriaDone(): number {
    return this.data.criteria.filter((criterion) => criterion.done).length;
  }
  get progress(): number {
    if (this.data.criteria.length === 0) {
      return this.isDone ? 1 : 0;
    }
    return this.criteriaDone / this.data.criteria.length;
  }

  patch(patch: Partial<Omit<TaskData, "id" | "createdAt">>, at = nowIso()): Task {
    return new Task({ ...this.data, ...patch, updatedAt: at });
  }

  withTitle(title: string, at = nowIso()): Task {
    const trimmed = title.trim();
    if (!trimmed) return this;
    return this.patch({ title: trimmed }, at);
  }

  withDescription(description: string, at = nowIso()): Task {
    return this.patch({ description }, at);
  }

  withNotes(notes: string, at = nowIso()): Task {
    return this.patch({ notes }, at);
  }

  withProject(projectId: string | null, at = nowIso()): Task {
    return this.patch({ projectId }, at);
  }

  withStatus(status: TaskStatus, at = nowIso()): Task {
    if (status === "done") {
      return this.complete(at);
    }
    return this.patch(
      {
        status,
        completedAt: null,
      },
      at,
    );
  }

  withPriority(priority: TaskPriority, at = nowIso()): Task {
    return this.patch({ priority }, at);
  }

  withEstimate(estimateMin: number, at = nowIso()): Task {
    return this.patch({ estimateMin: clampEstimate(estimateMin) }, at);
  }

  withDueDate(dueDate: string | null, at = nowIso()): Task {
    return this.patch({ dueDate }, at);
  }

  withSchedule(date: string | null, time: string | null, at = nowIso()): Task {
    return this.patch({ scheduledDate: date, scheduledTime: time }, at);
  }

  withFocusMinutes(minutes: number, at = nowIso()): Task {
    return this.patch(
      {
        focusedMinutes: this.data.focusedMinutes + Math.max(0, Math.round(minutes)),
      },
      at,
    );
  }

  complete(at = nowIso()): Task {
    if (this.isDone) return this;
    return this.patch({ status: "done", completedAt: at }, at);
  }

  reopen(at = nowIso()): Task {
    return this.patch({ status: "todo", completedAt: null }, at);
  }

  toggleCriterion(criterionId: string, at = nowIso()): Task {
    return this.patch(
      {
        criteria: this.data.criteria.map((criterion) =>
          criterion.id === criterionId ? { ...criterion, done: !criterion.done } : criterion,
        ),
      },
      at,
    );
  }

  addCriterion(text: string, at = nowIso()): Task {
    const trimmed = text.trim();
    if (!trimmed) return this;
    return this.patch(
      {
        criteria: [...this.data.criteria, { id: createId("step"), text: trimmed, done: false }],
      },
      at,
    );
  }

  renameCriterion(criterionId: string, text: string, at = nowIso()): Task {
    const trimmed = text.trim();
    if (!trimmed) return this;
    return this.patch(
      {
        criteria: this.data.criteria.map((criterion) =>
          criterion.id === criterionId ? { ...criterion, text: trimmed } : criterion,
        ),
      },
      at,
    );
  }

  removeCriterion(criterionId: string, at = nowIso()): Task {
    return this.patch(
      {
        criteria: this.data.criteria.filter((criterion) => criterion.id !== criterionId),
      },
      at,
    );
  }

  toJSON(): TaskData {
    return {
      ...this.data,
      criteria: this.data.criteria.map((criterion) => ({ ...criterion })),
    };
  }
}

export class Project {
  private constructor(private readonly data: ProjectData) {}

  static create(input: {
    name: string;
    description?: string;
    color: string;
    milestone?: string;
    milestoneDue?: string | null;
    notes?: string;
    createdAt?: string;
  }): Project {
    const name = input.name.trim();
    if (!name) {
      throw new Error("A project needs a name.");
    }
    return new Project({
      id: createId("project"),
      name,
      description: input.description?.trim() ?? "",
      color: input.color,
      milestone: input.milestone?.trim() ?? "",
      milestoneDue: input.milestoneDue ?? null,
      notes: input.notes ?? "",
      createdAt: input.createdAt ?? nowIso(),
    });
  }

  static fromJSON(raw: ProjectData): Project {
    return new Project({
      id: raw.id || createId("project"),
      name: raw.name?.trim() || "Untitled project",
      description: raw.description ?? "",
      color: raw.color || "#3B9F93",
      milestone: raw.milestone ?? "",
      milestoneDue: raw.milestoneDue ?? null,
      notes: raw.notes ?? "",
      createdAt: raw.createdAt || nowIso(),
    });
  }

  get id(): string {
    return this.data.id;
  }
  get name(): string {
    return this.data.name;
  }
  get description(): string {
    return this.data.description;
  }
  get color(): string {
    return this.data.color;
  }
  get milestone(): string {
    return this.data.milestone;
  }
  get milestoneDue(): string | null {
    return this.data.milestoneDue;
  }
  get notes(): string {
    return this.data.notes;
  }
  get createdAt(): string {
    return this.data.createdAt;
  }

  withNotes(notes: string): Project {
    return new Project({ ...this.data, notes });
  }

  withMilestone(milestone: string, milestoneDue: string | null): Project {
    return new Project({ ...this.data, milestone, milestoneDue });
  }

  withDetails(input: {
    name: string;
    description: string;
    color: string;
    milestone: string;
    milestoneDue: string | null;
  }): Project {
    const name = input.name.trim();
    if (!name) return this;
    return new Project({
      ...this.data,
      name,
      description: input.description.trim(),
      color: input.color,
      milestone: input.milestone.trim(),
      milestoneDue: input.milestoneDue,
    });
  }

  toJSON(): ProjectData {
    return { ...this.data };
  }
}

export class Workspace {
  private constructor(private readonly data: WorkspaceData) {}

  static fromJSON(raw: WorkspaceData): Workspace {
    const projectIds = new Set((raw.projects ?? []).map((project) => project.id));
    const preferences = raw.preferences ?? { focusMinutes: 25, breakMinutes: 5 };
    const focusMinutes = clampFocusMinutes(preferences.focusMinutes);
    const breakMinutes = clampFocusMinutes(preferences.breakMinutes);
    const tasks = (raw.tasks ?? []).map((task) => {
      const rehydrated = Task.fromJSON(task);
      return rehydrated.projectId && !projectIds.has(rehydrated.projectId)
        ? rehydrated.withProject(null)
        : rehydrated;
    });
    const focusTaskId =
      raw.focusTaskId && tasks.some((task) => task.id === raw.focusTaskId) ? raw.focusTaskId : null;

    return new Workspace({
      version: 1,
      profile: {
        name: raw.profile?.name?.trim() || "Maya Chen",
        role: raw.profile?.role?.trim() || "Developer",
        workspace: raw.profile?.workspace?.trim() || "Maya’s space",
      },
      projects: (raw.projects ?? []).map((project) => Project.fromJSON(project).toJSON()),
      tasks: tasks.map((task) => task.toJSON()),
      activities: sortActivities(
        (raw.activities ?? []).filter((activity) => Boolean(activity?.id && activity?.at)),
      ).slice(0, MAX_ACTIVITY_ENTRIES),
      preferences: { focusMinutes, breakMinutes },
      focusTaskId,
      createdAt: raw.createdAt || nowIso(),
    });
  }

  get profile(): WorkspaceData["profile"] {
    return { ...this.data.profile };
  }
  get preferences(): WorkspaceData["preferences"] {
    return { ...this.data.preferences };
  }
  get focusTaskId(): string | null {
    return this.data.focusTaskId;
  }
  get createdAt(): string {
    return this.data.createdAt;
  }
  get projects(): Project[] {
    return this.data.projects.map((project) => Project.fromJSON(project));
  }
  get tasks(): Task[] {
    return this.data.tasks.map((task) => Task.fromJSON(task));
  }
  get activities(): ActivityData[] {
    return this.data.activities.map((activity) => ({ ...activity }));
  }

  projectById(id: string | null): Project | null {
    if (!id) return null;
    return this.projects.find((project) => project.id === id) ?? null;
  }

  taskById(id: string | null): Task | null {
    if (!id) return null;
    return this.tasks.find((task) => task.id === id) ?? null;
  }

  tasksForProject(projectId: string): Task[] {
    return this.tasks
      .filter((task) => task.projectId === projectId)
      .sort(compareTasksForList);
  }

  get inboxTasks(): Task[] {
    return this.tasks
      .filter((task) => task.status === "inbox")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  tasksForDate(date: string): Task[] {
    return this.tasks
      .filter((task) => task.scheduledDate === date)
      .sort(compareTasksBySchedule);
  }

  completedOn(date: string): Task[] {
    return this.tasks.filter(
      (task) => task.completedAt !== null && toISODate(new Date(task.completedAt)) === date,
    );
  }

  focusTask(): Task | null {
    return this.taskById(this.data.focusTaskId);
  }

  dailyProgress(now = new Date()): { done: number; total: number } {
    const today = todayISO(now);
    const relevant = new Map<string, Task>();
    for (const task of this.tasks) {
      if (task.scheduledDate === today) relevant.set(task.id, task);
      if (task.completedAt && toISODate(new Date(task.completedAt)) === today) {
        relevant.set(task.id, task);
      }
    }
    const values = [...relevant.values()];
    return {
      done: values.filter((task) => task.isDone).length,
      total: values.length,
    };
  }

  weekStats(now = new Date()): { completed: number; focusedMinutes: number } {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const weekday = start.getDay();
    start.setDate(start.getDate() + (weekday === 0 ? -6 : 1 - weekday));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const completed = this.tasks.filter((task) => {
      if (!task.completedAt) return false;
      const date = new Date(task.completedAt);
      return date >= start && date < end;
    }).length;

    const focusedMinutes = this.data.activities.reduce((total, activity) => {
      if (activity.kind !== "focus") return total;
      const date = new Date(activity.at);
      if (date < start || date >= end) return total;
      return total + (activity.minutes ?? 0);
    }, 0);

    return { completed, focusedMinutes };
  }

  recentActivities(limit = 4): ActivityData[] {
    return this.activities.slice(0, limit);
  }

  activitiesForTask(taskId: string, limit = 6): ActivityData[] {
    return this.activities
      .filter((activity) => activity.taskId === taskId)
      .slice(0, limit);
  }

  activitiesForProject(projectId: string, limit = 4): ActivityData[] {
    return this.activities
      .filter((activity) => activity.projectId === projectId)
      .slice(0, limit);
  }

  nextScheduledToday(now = new Date()): Task | null {
    const today = todayISO(now);
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    return (
      this.tasks
        .filter(
          (task) =>
            task.scheduledDate === today &&
            task.scheduledTime &&
            !task.isDone &&
            toMinutes(task.scheduledTime) >= minutesNow,
        )
        .sort(compareTasksBySchedule)[0] ?? null
    );
  }

  addTask(task: Task, at = nowIso()): Workspace {
    const activity = createActivity(
      task.scheduledDate ? "schedule" : "create",
      task.scheduledDate ? "Scheduled a task" : "Captured a task",
      task.title,
      { at, taskId: task.id, projectId: task.projectId ?? undefined },
    );
    return this.cloneWith(
      { tasks: [...this.data.tasks, task.toJSON()] },
      [activity, ...this.data.activities],
    );
  }

  updateTask(task: Task): Workspace {
    return this.cloneWith({
      tasks: this.data.tasks.map((entry) => (entry.id === task.id ? task.toJSON() : entry)),
    });
  }

  setTaskNotes(taskId: string, notes: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withNotes(notes, at));
  }

  setTaskDescription(taskId: string, description: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withDescription(description, at));
  }

  setTaskTitle(taskId: string, title: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    const next = task.withTitle(title, at);
    if (next === task) return this;
    return this.updateTask(next);
  }

  setTaskProject(taskId: string, projectId: string | null, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withProject(projectId, at));
  }

  setTaskPriority(taskId: string, priority: TaskPriority, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withPriority(priority, at));
  }

  setTaskEstimate(taskId: string, estimateMin: number, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withEstimate(estimateMin, at));
  }

  setTaskDueDate(taskId: string, dueDate: string | null, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withDueDate(dueDate, at));
  }

  toggleCriterion(taskId: string, criterionId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.toggleCriterion(criterionId, at));
  }

  addCriterion(taskId: string, text: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.addCriterion(text, at));
  }

  renameCriterion(taskId: string, criterionId: string, text: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.renameCriterion(criterionId, text, at));
  }

  removeCriterion(taskId: string, criterionId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.removeCriterion(criterionId, at));
  }

  setStatus(taskId: string, status: TaskStatus, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    if (status === "done") return this.completeTask(taskId, at);
    if (task.status === status) return this;
    const next = task.withStatus(status, at);
    const activity = createActivity("status", `Task moved to ${statusLabel(status)}`, task.title, {
      at,
      taskId,
      projectId: task.projectId ?? undefined,
    });
    return this.cloneWith(
      { tasks: this.replaceTask(next) },
      [activity, ...this.data.activities],
    );
  }

  completeTask(taskId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task || task.isDone) return this;
    const next = task.complete(at);
    const activity = createActivity("complete", "Finished a task", task.title, {
      at,
      taskId,
      projectId: task.projectId ?? undefined,
    });
    return this.cloneWith(
      {
        tasks: this.replaceTask(next),
        focusTaskId: this.data.focusTaskId === taskId ? null : this.data.focusTaskId,
      },
      [activity, ...this.data.activities],
    );
  }

  reopenTask(taskId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task || !task.isDone) return this;
    const next = task.reopen(at);
    const activity = createActivity("status", "Task reopened", task.title, {
      at,
      taskId,
      projectId: task.projectId ?? undefined,
    });
    return this.cloneWith(
      { tasks: this.replaceTask(next) },
      [activity, ...this.data.activities],
    );
  }

  moveTaskToInbox(taskId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    const next = task.patch(
      {
        status: "inbox",
        scheduledDate: null,
        scheduledTime: null,
        completedAt: null,
      },
      at,
    );
    const activity = createActivity("status", "Moved back to Inbox", task.title, {
      at,
      taskId,
      projectId: task.projectId ?? undefined,
    });
    return this.cloneWith(
      {
        tasks: this.replaceTask(next),
        focusTaskId: this.data.focusTaskId === taskId ? null : this.data.focusTaskId,
      },
      [activity, ...this.data.activities],
    );
  }

  scheduleTask(taskId: string, date: string, time: string | null, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    const next = task.withSchedule(date, time, at).patch(
      {
        status: task.isDone ? "todo" : task.status === "inbox" ? "todo" : task.status,
        completedAt: task.isDone ? null : task.completedAt,
      },
      at,
    );
    const activity = createActivity(
      "schedule",
      "Scheduled a task",
      `${task.title} · ${formatScheduledDay(date)}`,
      { at, taskId, projectId: task.projectId ?? undefined },
    );
    return this.cloneWith(
      { tasks: this.replaceTask(next) },
      [activity, ...this.data.activities],
    );
  }

  scheduleMany(
    entries: Array<{ taskId: string; date: string; time: string | null }>,
    at = nowIso(),
  ): Workspace {
    if (entries.length === 0) return this;
    const entryMap = new Map(entries.map((entry) => [entry.taskId, entry]));
    const tasks = this.data.tasks.map((entry) => {
      const schedule = entryMap.get(entry.id);
      if (!schedule) return entry;
      const task = Task.fromJSON(entry);
      return task
        .withSchedule(schedule.date, schedule.time, at)
        .patch(
          {
            status: task.isDone ? "todo" : task.status === "inbox" ? "todo" : task.status,
            completedAt: task.isDone ? null : task.completedAt,
          },
          at,
        )
        .toJSON();
    });
    const activity = createActivity(
      "plan",
      "Planned the day",
      `Picked ${entries.length} ${entries.length === 1 ? "task" : "tasks"}`,
      { at },
    );
    return this.cloneWith({ tasks }, [activity, ...this.data.activities]);
  }

  unscheduleTask(taskId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    return this.updateTask(task.withSchedule(null, null, at));
  }

  startFocus(taskId: string, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task || task.isDone) return this;
    const next = task.patch(
      {
        status: task.status === "todo" || task.status === "inbox" ? "in_progress" : task.status,
      },
      at,
    );
    return this.cloneWith({ tasks: this.replaceTask(next), focusTaskId: taskId });
  }

  logFocusSession(taskId: string, minutes: number, at = nowIso()): Workspace {
    const task = this.taskById(taskId);
    if (!task) return this;
    const rounded = Math.max(1, Math.round(minutes));
    const next = task.withFocusMinutes(rounded, at);
    const activity = createActivity(
      "focus",
      "Focus session completed",
      `${task.title} · ${rounded} min`,
      { at, taskId, projectId: task.projectId ?? undefined, minutes: rounded },
    );
    return this.cloneWith(
      { tasks: this.replaceTask(next) },
      [activity, ...this.data.activities],
    );
  }

  clearFocus(): Workspace {
    return this.cloneWith({ focusTaskId: null });
  }

  setFocusTask(taskId: string | null): Workspace {
    if (taskId && !this.taskById(taskId)) return this;
    return this.cloneWith({ focusTaskId: taskId });
  }

  addProject(project: Project, at = nowIso()): Workspace {
    const activity = createActivity("project", "Created a project", project.name, {
      at,
      projectId: project.id,
    });
    return this.cloneWith(
      { projects: [...this.data.projects, project.toJSON()] },
      [activity, ...this.data.activities],
    );
  }

  setProjectNotes(projectId: string, notes: string): Workspace {
    const project = this.projectById(projectId);
    if (!project) return this;
    return this.cloneWith({
      projects: this.data.projects.map((entry) =>
        entry.id === projectId ? project.withNotes(notes).toJSON() : entry,
      ),
    });
  }

  updateProject(project: Project): Workspace {
    return this.cloneWith({
      projects: this.data.projects.map((entry) =>
        entry.id === project.id ? project.toJSON() : entry,
      ),
    });
  }

  deleteTask(taskId: string): Workspace {
    return this.cloneWith(
      {
        tasks: this.data.tasks.filter((task) => task.id !== taskId),
        focusTaskId: this.data.focusTaskId === taskId ? null : this.data.focusTaskId,
      },
    );
  }

  /** Removes a project and returns its tasks to the Inbox instead of deleting them. */
  deleteProject(projectId: string): Workspace {
    const project = this.projectById(projectId);
    if (!project) return this;

    const detached = new Map(
      this.tasksForProject(projectId).map((task) => [
        task.id,
        (task.isDone
          ? task.withProject(null)
          : task.patch({
              projectId: null,
              status: "inbox",
              scheduledDate: null,
              scheduledTime: null,
            })
        ).toJSON(),
      ]),
    );

    return this.cloneWith({
      projects: this.data.projects.filter((entry) => entry.id !== projectId),
      tasks: this.data.tasks.map((task) => detached.get(task.id) ?? task),
    });
  }

  toJSON(): WorkspaceData {
    return {
      version: 1,
      profile: { ...this.data.profile },
      projects: this.data.projects.map((project) => ({ ...project })),
      tasks: this.data.tasks.map((task) => ({
        ...task,
        criteria: task.criteria.map((criterion) => ({ ...criterion })),
      })),
      activities: this.data.activities.map((activity) => ({ ...activity })),
      preferences: { ...this.data.preferences },
      focusTaskId: this.data.focusTaskId,
      createdAt: this.data.createdAt,
    };
  }

  private replaceTask(task: Task): TaskData[] {
    return this.data.tasks.map((entry) => (entry.id === task.id ? task.toJSON() : entry));
  }

  private cloneWith(patch: Partial<WorkspaceData>, activities?: ActivityData[]): Workspace {
    return new Workspace({
      ...this.data,
      ...patch,
      activities: sortActivities(activities ?? this.data.activities).slice(0, MAX_ACTIVITY_ENTRIES),
    });
  }
}

function clampEstimate(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.min(MAX_ESTIMATE, Math.max(MIN_ESTIMATE, Math.round(value)));
}

function clampFocusMinutes(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.min(120, Math.max(5, Math.round(value)));
}

function isStatus(value: unknown): value is TaskStatus {
  return value === "inbox" || value === "todo" || value === "in_progress" || value === "done";
}

function isPriority(value: unknown): value is TaskPriority {
  return value === "low" || value === "normal" || value === "high";
}

function statusLabel(status: TaskStatus): string {
  if (status === "in_progress") return "In progress";
  if (status === "todo") return "To do";
  if (status === "inbox") return "Inbox";
  return "Done";
}

function sortActivities(activities: ActivityData[]): ActivityData[] {
  return [...activities].sort((a, b) => b.at.localeCompare(a.at));
}

function compareTasksForList(a: Task, b: Task): number {
  const order: Record<TaskStatus, number> = { in_progress: 0, todo: 1, inbox: 2, done: 3 };
  const statusDelta = order[a.status] - order[b.status];
  if (statusDelta !== 0) return statusDelta;
  return a.createdAt.localeCompare(b.createdAt);
}

function compareTasksBySchedule(a: Task, b: Task): number {
  const timeA = a.scheduledTime ?? "99:99";
  const timeB = b.scheduledTime ?? "99:99";
  if (timeA !== timeB) return timeA.localeCompare(timeB);
  return a.createdAt.localeCompare(b.createdAt);
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatScheduledDay(date: string): string {
  if (date === todayISO()) return "Today";
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
