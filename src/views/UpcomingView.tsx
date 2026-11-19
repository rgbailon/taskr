import { useMemo, useState, type CSSProperties } from "react";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import type { Task } from "../domain/models";
import {
  addDays,
  formatDuration,
  formatLongDate,
  formatTimeLabel,
  formatWeekdayShort,
  fromISODate,
  nextPlanStart,
  relativeDayLabel,
  toISODate,
  todayISO,
  weekDates,
} from "../lib/date";
import { CheckCircle } from "../components/CheckCircle";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { ProjectDot } from "../components/ProjectMark";

export function UpcomingView({
  onOpenTask,
  onNewTaskForDate,
}: {
  onOpenTask: (taskId: string) => void;
  onNewTaskForDate: (date: string, time: string) => void;
}) {
  const { workspace, update } = useWorkspace();
  const { pushToast } = useToast();
  const today = todayISO();
  const [anchor, setAnchor] = useState(() => fromISODate(today));
  const [selectedDate, setSelectedDate] = useState(today);

  const week = useMemo(() => weekDates(anchor), [anchor]);
  const selectedTasks = workspace?.tasksForDate(selectedDate) ?? [];
  const doneCount = selectedTasks.filter((task) => task.isDone).length;
  const totalMinutes = selectedTasks.reduce((total, task) => total + task.estimateMin, 0);

  const upcomingDays = useMemo(() => {
    if (!workspace) return [];
    return week
      .map((day) => toISODate(day))
      .filter((date) => date > selectedDate)
      .map((date) => ({ date, tasks: workspace.tasksForDate(date) }))
      .filter((group) => group.tasks.length > 0)
      .slice(0, 2);
  }, [week, selectedDate, workspace]);

  if (!workspace) return null;

  const weekKey = week[0] ? toISODate(week[0]) : "week";
  const isCurrentWeek = week.some((day) => toISODate(day) === today);
  const monthLabel = (week[0] ?? anchor).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const toggleTask = (task: Task) => {
    if (task.isDone) {
      update((current) => current.reopenTask(task.id));
      return;
    }
    update((current) => current.completeTask(task.id));
    pushToast({ title: "Task finished", detail: task.title, tone: "success" });
  };

  const shiftWeek = (direction: number) => {
    const selectedIndex = week.findIndex((day) => toISODate(day) === selectedDate);
    const nextWeek = weekDates(addDays(anchor, direction * 7));
    setAnchor(addDays(anchor, direction * 7));
    setSelectedDate(toISODate(nextWeek[selectedIndex >= 0 ? selectedIndex : 0] ?? nextWeek[0]));
  };

  const goToday = () => {
    setAnchor(fromISODate(today));
    setSelectedDate(today);
  };

  const addForSelectedDay = () => {
    onNewTaskForDate(selectedDate, selectedDate === today ? nextPlanStart() : "09:30");
  };

  const weekStats = workspace.weekStats(week[3] ?? new Date());

  return (
    <>
      <main className="main">
        <div className="view upcoming-view">
          <header className="view-head">
            <div>
              <h1 className="page-title">Upcoming</h1>
              <p className="subtitle">See what’s next and leave room for focused work.</p>
            </div>
            <button type="button" className="button button-primary" onClick={addForSelectedDay}>
              <Icon name="plus" size={15} />
              Add to day
            </button>
          </header>

          <div className="week-toolbar">
            <span className="week-month">{monthLabel}</span>
            <div className="week-controls">
              <button
                type="button"
                className="icon-button icon-small"
                onClick={() => shiftWeek(-1)}
                aria-label="Previous week"
                title="Previous week"
              >
                <Icon name="chevron-left" size={16} />
              </button>
              {!isCurrentWeek || selectedDate !== today ? (
                <button type="button" className="text-button" onClick={goToday}>
                  Today
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button icon-small"
                onClick={() => shiftWeek(1)}
                aria-label="Next week"
                title="Next week"
              >
                <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </div>

          <div className="week-strip" role="group" aria-label={`Week of ${monthLabel}`}>
            {week.map((day) => {
              const iso = toISODate(day);
              const dayTasks = workspace.tasksForDate(iso);
              const selected = iso === selectedDate;
              const isToday = iso === today;
              return (
                <button
                  type="button"
                  key={`${weekKey}-${iso}`}
                  className={`week-day${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
                  onClick={() => setSelectedDate(iso)}
                  aria-pressed={selected}
                  aria-label={`${formatLongDate(day)}, ${dayTasks.length} tasks`}
                >
                  <span className="week-day-label">{formatWeekdayShort(day)}</span>
                  <span className="week-day-number">{day.getDate()}</span>
                  <span className="week-day-meta">
                    {dayTasks.length > 0 ? (
                      <span className="week-day-count">
                        {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                      </span>
                    ) : (
                      <span className="week-day-empty">—</span>
                    )}
                  </span>
                  {isToday ? <span className="week-today-dot" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>

          <div className="day-section">
            <div className="section-head">
              <div className="day-heading">
                <h2>{formatLongDate(fromISODate(selectedDate))}</h2>
                {selectedDate === today ? <span className="today-pill">Today</span> : null}
              </div>
              <span className="muted-small">
                {selectedTasks.length} {selectedTasks.length === 1 ? "task" : "tasks"}
                {totalMinutes > 0 ? ` · about ${formatDuration(totalMinutes)}` : ""}
              </span>
            </div>

            {selectedTasks.length > 0 ? (
              <div className="day-task-list">
                {selectedTasks.map((task) => (
                  <ScheduleRow
                    key={task.id}
                    task={task}
                    projectName={workspace.projectById(task.projectId)?.name}
                    projectColor={workspace.projectById(task.projectId)?.color}
                    onToggle={() => toggleTask(task)}
                    onOpen={() => onOpenTask(task.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="quiet-empty day-empty">
                <Icon name="calendar" size={17} />
                <span>Nothing planned for this day.</span>
                <button type="button" className="text-button" onClick={addForSelectedDay}>
                  Add a task
                </button>
              </div>
            )}

            {doneCount > 0 && selectedTasks.length > 0 ? (
              <p className="view-footnote">
                {doneCount} of {selectedTasks.length} done on this day.
              </p>
            ) : null}
          </div>

          {upcomingDays.map((group) => (
            <div className="day-section" key={group.date}>
              <div className="section-head">
                <h2>{formatLongDate(fromISODate(group.date))}</h2>
                <span className="muted-small">
                  {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
                </span>
              </div>
              <div className="day-task-list">
                {group.tasks.map((task) => (
                  <ScheduleRow
                    key={task.id}
                    task={task}
                    projectName={workspace.projectById(task.projectId)?.name}
                    projectColor={workspace.projectById(task.projectId)?.color}
                    onToggle={() => toggleTask(task)}
                    onOpen={() => onOpenTask(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <aside className="rail" aria-label="Day plan">
        <div className="card rail-card day-plan-card">
          <div className="rail-row">
            <h2 className="rail-title">Day plan</h2>
            <span className="muted-small">
              {doneCount} of {selectedTasks.length}
            </span>
          </div>
          <ProgressBar
            value={selectedTasks.length === 0 ? 0 : doneCount / selectedTasks.length}
            height={7}
            label="Selected day progress"
          />
          <p className="rail-caption">
            {selectedTasks.length === 0
              ? "Nothing planned. A little room is useful."
              : doneCount >= selectedTasks.length
                ? "Every planned task is done. The evening is yours."
                : `${selectedTasks.length - doneCount} left. Keep the afternoon flexible.`}
          </p>
          <p className="muted-tiny">
            {relativeDayLabel(selectedDate)} · {weekStats.completed} completed this week
          </p>
        </div>

        <div className="rail-block">
          <h3>Focus blocks</h3>
          {selectedTasks.filter((task) => !task.isDone).length > 0 ? (
            <ul className="focus-block-list">
              {selectedTasks
                .filter((task) => !task.isDone)
                .slice(0, 4)
                .map((task) => {
                  const project = workspace.projectById(task.projectId);
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => onOpenTask(task.id)}>
                        <ProjectDot color={project?.color ?? "#B6C0CA"} size={8} />
                        <span className="focus-block-time">
                          {task.scheduledTime ? formatTimeLabel(task.scheduledTime) : "Anytime"}
                        </span>
                        <span className="focus-block-copy">
                          <strong>{task.title}</strong>
                          <span>
                            {formatDuration(task.estimateMin)}
                            {project ? ` · ${project.name}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          ) : (
            <p className="rail-note">No focus blocks left on this day.</p>
          )}
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <div className="rail-row">
            <h3>This week</h3>
          </div>
          <div className="stat-row">
            <span>Completed</span>
            <strong>{weekStats.completed} tasks</strong>
          </div>
          <div className="stat-row">
            <span>Focused time</span>
            <strong>{formatDuration(weekStats.focusedMinutes)}</strong>
          </div>
          <div className="tip-card">
            <strong>A little space is useful</strong>
            <p>Leave breathing room between planned focus blocks.</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function ScheduleRow({
  task,
  projectName,
  projectColor,
  onToggle,
  onOpen,
}: {
  task: Task;
  projectName?: string;
  projectColor?: string;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className={`schedule-row${task.isDone ? " is-done" : ""}`}
      style={{ "--row-color": projectColor ?? "#C9D2DC" } as CSSProperties}
    >
      <span className="row-accent" aria-hidden="true" />
      <span className="schedule-time">
        {task.scheduledTime ? formatTimeLabel(task.scheduledTime) : "—"}
      </span>
      <CheckCircle
        checked={task.isDone}
        size="sm"
        label={task.isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={onToggle}
      />
      <button type="button" className="schedule-copy" onClick={onOpen}>
        <strong>{task.title}</strong>
        <span>{projectName ?? "No project"}</span>
      </button>
      <span className="duration-chip">{formatDuration(task.estimateMin)}</span>
    </div>
  );
}
