export type Route =
  | { view: "focus" }
  | { view: "inbox" }
  | { view: "upcoming" }
  | { view: "terminal" }
  | { view: "project"; projectId: string }
  | { view: "task"; taskId: string };

export const PRIMARY_ROUTES = {
  focus: { view: "focus" } as Route,
  inbox: { view: "inbox" } as Route,
  upcoming: { view: "upcoming" } as Route,
};

export function routeKey(route: Route): string {
  if (route.view === "project") return `project:${route.projectId}`;
  if (route.view === "task") return `task:${route.taskId}`;
  return route.view;
}

export function breadcrumbFor(route: Route, projectName?: string): string {
  switch (route.view) {
    case "focus":
      return "Focus workspace";
    case "inbox":
      return "Inbox";
    case "upcoming":
      return "Upcoming";
    case "terminal":
      return "Terminal";
    case "project":
      return projectName ?? "Project";
    case "task":
      return "Task details";
    default:
      return "Focus workspace";
  }
}
