import { addDaysISO, fromISODate, todayISO } from "../lib/date";
import { Workspace } from "../domain/models";
import type { ActivityData, CriterionData, ProjectData, TaskData, WorkspaceData } from "../domain/types";

type SeedTask = Partial<TaskData> &
  Pick<TaskData, "id" | "title" | "status" | "projectId" | "estimateMin" | "createdAt">;

function steps(prefix: string, entries: Array<[string, boolean]>): CriterionData[] {
  return entries.map(([text, done], index) => ({
    id: `${prefix}-step-${index + 1}`,
    text,
    done,
  }));
}

function task(input: SeedTask): TaskData {
  const createdAt = input.createdAt;
  return {
    description: "",
    priority: "normal",
    dueDate: null,
    scheduledDate: null,
    scheduledTime: null,
    criteria: [],
    notes: "",
    updatedAt: createdAt,
    completedAt: null,
    focusedMinutes: 0,
    ...input,
  };
}

export function createSeedWorkspace(now = new Date()): Workspace {
  const today = todayISO(now);
  const tomorrow = addDaysISO(today, 1);
  const plus = (days: number) => addDaysISO(today, days);

  const at = (dayOffset: number, hour: number, minute = 0): string => {
    const base = fromISODate(today);
    base.setDate(base.getDate() + dayOffset);
    base.setHours(hour, minute, 0, 0);
    return base.toISOString();
  };

  const createdAt = (daysAgo: number, hour = 9): string => at(-daysAgo, hour, 12);

  const projects: ProjectData[] = [
    {
      id: "api-platform",
      name: "API platform",
      description: "Stable, predictable endpoints for event-driven products.",
      color: "#3B9F93",
      milestone: "Cursor pagination",
      milestoneDue: plus(8),
      notes: "Keep cursor tokens opaque and validate before querying.",
      createdAt: createdAt(42),
    },
    {
      id: "web-dashboard",
      name: "Web dashboard",
      description: "A faster, calmer workspace for customer support teams.",
      color: "#7797D8",
      milestone: "Activity overview",
      milestoneDue: plus(13),
      notes: "Confirm the loading state with product before the next review.",
      createdAt: createdAt(35),
    },
    {
      id: "developer-docs",
      name: "Developer docs",
      description: "Make the first successful API call easier to reach.",
      color: "#C39A61",
      milestone: "Quickstart refresh",
      milestoneDue: plus(5),
      notes: "Lead with the first successful API call; move reference detail below.",
      createdAt: createdAt(28),
    },
  ];

  const tasks: TaskData[] = [
    task({
      id: "api-pagination",
      title: "Add cursor pagination to the events endpoint",
      description:
        "Return stable pages for large event streams, with a cursor clients can reuse. Keep the existing response shape compatible.",
      projectId: "api-platform",
      status: "in_progress",
      estimateMin: 45,
      dueDate: tomorrow,
      priority: "high",
      createdAt: createdAt(3),
      updatedAt: at(0, 10, 5),
      notes:
        "Keep the cursor opaque. Encode the last event ID and creation time; validate both before querying.",
      criteria: steps("api-pagination", [
        ["Define cursor and limit contract", true],
        ["Add repository query", true],
        ["Wire response metadata", false],
        ["Cover edge cases", false],
      ]),
      focusedMinutes: 50,
    }),
    task({
      id: "api-contract-tests",
      title: "Add API contract tests",
      description: "Cover pagination limits, cursor reuse, and malformed tokens.",
      projectId: "api-platform",
      status: "todo",
      estimateMin: 30,
      scheduledDate: today,
      scheduledTime: "09:30",
      createdAt: createdAt(2),
      criteria: steps("api-contract-tests", [
        ["Happy path with a full page", false],
        ["Malformed cursor is rejected", false],
      ]),
    }),
    task({
      id: "api-retry",
      title: "Review the retry behavior",
      description: "Confirm retry and timeout behavior stays predictable under load.",
      projectId: "api-platform",
      status: "todo",
      estimateMin: 20,
      dueDate: today,
      scheduledDate: today,
      scheduledTime: "11:00",
      createdAt: createdAt(2, 11),
    }),
    task({
      id: "api-request-id",
      title: "Add a request ID to error responses",
      projectId: "api-platform",
      status: "inbox",
      estimateMin: 15,
      createdAt: at(0, 10, 2),
      notes: "Make it useful in support tickets without exposing internals.",
    }),
    task({
      id: "api-event-schema",
      title: "Ask Sam to review the event schema",
      projectId: null,
      status: "inbox",
      estimateMin: 5,
      createdAt: at(-1, 16, 40),
    }),
    task({
      id: "api-repo-query",
      title: "Add repository query",
      projectId: "api-platform",
      status: "done",
      estimateMin: 25,
      scheduledDate: today,
      scheduledTime: "09:00",
      createdAt: createdAt(4),
      completedAt: at(0, 9, 42),
      criteria: steps("api-repo-query", [["Query uses the shared cursor helper", true]]),
      focusedMinutes: 25,
    }),
    task({
      id: "api-cursor-contract",
      title: "Define cursor and limit contract",
      projectId: "api-platform",
      status: "done",
      estimateMin: 15,
      scheduledDate: today,
      scheduledTime: "08:30",
      createdAt: createdAt(4),
      completedAt: at(0, 9, 5),
    }),
    task({
      id: "api-webhook-notes",
      title: "Draft event delivery notes",
      projectId: "api-platform",
      status: "todo",
      estimateMin: 40,
      dueDate: plus(5),
      createdAt: createdAt(1, 14),
    }),
    task({
      id: "api-idempotency",
      title: "Add idempotency checks",
      projectId: "api-platform",
      status: "todo",
      estimateMin: 60,
      dueDate: plus(9),
      createdAt: createdAt(1, 15),
    }),
    task({
      id: "web-activity",
      title: "Reduce loading shifts in activity feed",
      description:
        "Stabilize the feed while filters and pages change so the layout never jumps.",
      projectId: "web-dashboard",
      status: "in_progress",
      estimateMin: 45,
      dueDate: plus(2),
      priority: "high",
      createdAt: createdAt(5),
      updatedAt: at(0, 10, 5),
      criteria: steps("web-activity", [
        ["Measure layout shift on slow 3G", true],
        ["Reserve space for avatars and copy", true],
        ["Verify filtered views", false],
      ]),
    }),
    task({
      id: "web-keyboard",
      title: "Pair on keyboard navigation",
      description: "Walk the support flow with Sam and fix focus order along the way.",
      projectId: "web-dashboard",
      status: "todo",
      estimateMin: 25,
      scheduledDate: today,
      scheduledTime: "13:30",
      createdAt: createdAt(3),
    }),
    task({
      id: "web-empty-copy",
      title: "Review empty-state copy",
      projectId: "web-dashboard",
      status: "todo",
      estimateMin: 20,
      createdAt: createdAt(2, 13),
    }),
    task({
      id: "web-shortcut-conflicts",
      title: "Check keyboard shortcut conflicts",
      projectId: "web-dashboard",
      status: "inbox",
      estimateMin: 20,
      createdAt: at(0, 9, 54),
    }),
    task({
      id: "web-loading-copy",
      title: "Review loading copy with Sam",
      projectId: "web-dashboard",
      status: "done",
      estimateMin: 15,
      scheduledDate: today,
      scheduledTime: "08:00",
      createdAt: createdAt(4),
      completedAt: at(0, 8, 50),
    }),
    task({
      id: "web-filters",
      title: "Persist table filters in the URL",
      projectId: "web-dashboard",
      status: "todo",
      estimateMin: 35,
      dueDate: plus(6),
      createdAt: createdAt(1, 9),
    }),
    task({
      id: "docs-endpoint-examples",
      title: "Update endpoint examples",
      description:
        "Refresh examples for the new cursor fields without changing the quickstart narrative.",
      projectId: "developer-docs",
      status: "in_progress",
      estimateMin: 45,
      dueDate: tomorrow,
      scheduledDate: tomorrow,
      scheduledTime: "10:00",
      createdAt: createdAt(4),
      notes: "Keep every example runnable against the local seed data.",
      criteria: steps("docs-endpoint-examples", [
        ["List endpoint uses the new cursor", true],
        ["Page response is documented", false],
      ]),
      focusedMinutes: 40,
    }),
    task({
      id: "docs-seed-setup",
      title: "Document local seed data setup",
      projectId: "developer-docs",
      status: "inbox",
      estimateMin: 25,
      createdAt: at(-1, 11, 15),
    }),
    task({
      id: "docs-quickstart",
      title: "Add a quickstart checklist",
      projectId: "developer-docs",
      status: "done",
      estimateMin: 30,
      createdAt: createdAt(7),
      completedAt: at(-1, 11, 20),
    }),
    task({
      id: "docs-auth-overview",
      title: "Rewrite auth overview",
      projectId: "developer-docs",
      status: "done",
      estimateMin: 60,
      createdAt: createdAt(9),
      completedAt: at(-2, 15, 10),
    }),
    task({
      id: "docs-webhook-sample",
      title: "Add a webhook sample",
      projectId: "developer-docs",
      status: "done",
      estimateMin: 45,
      createdAt: createdAt(11),
      completedAt: at(-3, 14, 5),
    }),
    task({
      id: "docs-seed-data",
      title: "Document local seed data",
      projectId: "developer-docs",
      status: "todo",
      estimateMin: 25,
      createdAt: createdAt(3, 10),
    }),
    task({
      id: "docs-errors",
      title: "Explain retry and rate limits",
      projectId: "developer-docs",
      status: "todo",
      estimateMin: 30,
      dueDate: plus(4),
      createdAt: createdAt(2, 9),
    }),
  ];

  const activities: ActivityData[] = [
    {
      id: "activity-focus-1",
      at: new Date(now.getTime() - 25 * 60_000).toISOString(),
      kind: "focus",
      text: "Focus session completed",
      subject: "Add cursor pagination to the events endpoint",
      taskId: "api-pagination",
      projectId: "api-platform",
      minutes: 25,
    },
    {
      id: "activity-sorted-1",
      at: at(0, 10, 2),
      kind: "sorted",
      text: "Sorted an inbox item",
      subject: "Add API contract tests",
      projectId: "api-platform",
    },
    {
      id: "activity-complete-1",
      at: at(0, 9, 42),
      kind: "complete",
      text: "Finished a task",
      subject: "Add repository query",
      taskId: "api-repo-query",
      projectId: "api-platform",
    },
    {
      id: "activity-plan-1",
      at: at(0, 9, 10),
      kind: "plan",
      text: "Planned the day",
      subject: "Picked 5 tasks",
    },
    {
      id: "activity-complete-2",
      at: at(0, 8, 50),
      kind: "complete",
      text: "Finished a task",
      subject: "Review loading copy with Sam",
      taskId: "web-loading-copy",
      projectId: "web-dashboard",
    },
    {
      id: "activity-status-1",
      at: at(-1, 15, 18),
      kind: "status",
      text: "Task moved to In progress",
      subject: "Add cursor pagination to the events endpoint",
      taskId: "api-pagination",
      projectId: "api-platform",
    },
    {
      id: "activity-project-1",
      at: at(-1, 16, 20),
      kind: "project",
      text: "Milestone progress changed",
      subject: "Cursor pagination",
      projectId: "api-platform",
    },
    {
      id: "activity-sorted-2",
      at: at(-1, 14, 5),
      kind: "sorted",
      text: "Sorted an inbox item",
      subject: "Reduce loading shifts in activity feed",
      projectId: "web-dashboard",
    },
    {
      id: "activity-complete-3",
      at: at(-1, 11, 20),
      kind: "complete",
      text: "Finished a task",
      subject: "Add a quickstart checklist",
      taskId: "docs-quickstart",
      projectId: "developer-docs",
    },
    {
      id: "activity-focus-2",
      at: at(-1, 16, 0),
      kind: "focus",
      text: "Focus session completed",
      subject: "Update endpoint examples",
      taskId: "docs-endpoint-examples",
      projectId: "developer-docs",
      minutes: 40,
    },
    {
      id: "activity-project-2",
      at: at(-2, 16, 45),
      kind: "project",
      text: "Milestone progress changed",
      subject: "Quickstart refresh",
      projectId: "developer-docs",
    },
    {
      id: "activity-complete-4",
      at: at(-2, 15, 10),
      kind: "complete",
      text: "Finished a task",
      subject: "Rewrite auth overview",
      taskId: "docs-auth-overview",
      projectId: "developer-docs",
    },
  ];

  const data: WorkspaceData = {
    version: 1,
    profile: {
      name: "Maya Chen",
      role: "Developer",
      workspace: "Maya’s space",
    },
    projects,
    tasks,
    activities,
    preferences: {
      focusMinutes: 25,
      breakMinutes: 5,
    },
    focusTaskId: "api-pagination",
    createdAt: createdAt(60),
  };

  return Workspace.fromJSON(data);
}
