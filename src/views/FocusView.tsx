import { useState } from "react";
import { useWorkspace } from "../state/WorkspaceProvider";
import { useToast } from "../state/ToastProvider";
import {
  formatActivityMoment,
  formatDuration,
  formatLongDate,
  formatTimeLabel,
  greetingFor,
  todayISO,
} from "../lib/date";
import { FocusCard } from "../components/FocusCard";
import { CheckCircle } from "../components/CheckCircle";
import { Icon } from "../components/Icon";
import { ProgressBar } from "../components/ProgressBar";
import { ProjectDot } from "../components/ProjectMark";

interface FocusViewProps {
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
  onPlanDay: () => void;
  autoStartFocus: boolean;
  onAutoStartConsumed: () => void;
}

export function FocusView({
  onOpenTask,
  onOpenProject,
  onPlanDay,
  autoStartFocus,
  onAutoStartConsumed,
}: FocusViewProps) {
  const { workspace, update, saveState, beginFocus } = useWorkspace();
  const { pushToast } = useToast();
  const [pickedAutoStart, setPickedAutoStart] = useState(false);

  if (!workspace) return null;

  const now = new Date();
  const today = todayISO(now);
  const activeTask = workspace.focusTask();
  const daily = workspace.dailyProgress(now);
  const upNext = workspace
    .tasksForDate(today)
    .filter((task) => !task.isDone && task.id !== activeTask?.id)
    .slice(0, 4);
  const upNextMinutes = upNext.reduce((total, task) => total + task.estimateMin, 0);
  const nextCheckIn = workspace.nextScheduledToday(now);
  const firstName = workspace.profile.name.split(/\s+/)[0] ?? workspace.profile.name;
  const candidates = workspace.tasks
    .filter((task) => !task.isDone && task.id !== activeTask?.id)
    .sort((a, b) => {
      const rank = { in_progress: 0, todo: 1, inbox: 2, done: 3 } as const;
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 3);

  const pickTask = (taskId: string) => {
    beginFocus(taskId);
    setPickedAutoStart(true);
  };

  const finishTask = (taskId: string, title: string) => {
    update((current) => current.completeTask(taskId));
    pushToast({ title: "Task finished", detail: title, tone: "success" });
  };

  return (
    <>
      <main className="main">
        <div className="view focus-view">
          <header className="view-head">
          <div>
            <p className="eyebrow">{formatLongDate(now)}</p>
            <h1 className="page-title">
              {greetingFor(now)}, {firstName}
            </h1>
            <p className="subtitle">One clear priority, then the next.</p>
          </div>
          <button type="button" className="button button-quiet" onClick={onPlanDay}>
            <Icon name="spark" size={15} />
            Plan day
          </button>
        </header>

        {activeTask && !activeTask.isDone ? (
          <FocusCard
            key={activeTask.id}
            task={activeTask}
            autoStart={autoStartFocus || pickedAutoStart}
            onAutoStartConsumed={() => {
              setPickedAutoStart(false);
              onAutoStartConsumed();
            }}
            onOpenDetails={() => onOpenTask(activeTask.id)}
            onOpenProject={onOpenProject}
          />
        ) : (
          <section className="card focus-empty">
            <div className="focus-empty-head">
              <span className="empty-icon" aria-hidden="true">
                <Icon name="target" size={22} />
              </span>
              <div>
                <h2>Choose your next focus</h2>
                <p>A task is easier to start when it is the only one on the screen.</p>
              </div>
            </div>
            {candidates.length > 0 ? (
              <div className="focus-candidates">
                {candidates.map((task) => {
                  const project = workspace.projectById(task.projectId);
                  return (
                    <button
                      type="button"
                      key={task.id}
                      className="focus-candidate"
                      onClick={() => pickTask(task.id)}
                    >
                      <span className="focus-candidate-copy">
                        <strong>{task.title}</strong>
                        <span>
                          {project ? (
                            <>
                              <ProjectDot color={project.color} size={7} />
                              {project.name}
                            </>
                          ) : (
                            "No project"
                          )}
                          {" · "}
                          {formatDuration(task.estimateMin)}
                        </span>
                      </span>
                      <span className="focus-candidate-action">
                        Focus
                        <Icon name="arrow-right" size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="focus-clear">Nothing is waiting. Capture an idea in the Inbox.</p>
            )}
          </section>
        )}

        <section className="up-next" aria-labelledby="up-next-title">
          <div className="section-head">
            <h2 id="up-next-title">Up next</h2>
            <span className="muted-small">
              {upNext.length} {upNext.length === 1 ? "task" : "tasks"}
              {upNextMinutes > 0 ? ` · about ${formatDuration(upNextMinutes)}` : ""}
            </span>
          </div>

          {upNext.length > 0 ? (
            <div className="stack-list">
              {upNext.map((task) => {
                const project = workspace.projectById(task.projectId);
                return (
                  <div className="up-next-row" key={task.id}>
                    <CheckCircle
                      checked={false}
                      size="sm"
                      label={`Complete ${task.title}`}
                      onClick={() => finishTask(task.id, task.title)}
                    />
                    <button
                      type="button"
                      className="row-main"
                      onClick={() => onOpenTask(task.id)}
                    >
                      <strong>{task.title}</strong>
                      <span>
                        {project?.name ?? "No project"}
                        {task.scheduledTime ? ` · ${formatTimeLabel(task.scheduledTime)}` : ""}
                      </span>
                    </button>
                    <span className="duration-chip">{formatDuration(task.estimateMin)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="quiet-empty">
              <Icon name="check" size={16} />
              <span>Nothing else is scheduled for today.</span>
            </div>
          )}

          <p className="view-footnote">
            A short break between tasks helps keep the next block useful.
          </p>
        </section>
        </div>
      </main>

      <aside className="rail" aria-label="Today">
        <div className="rail-head">
          <h2>Today</h2>
          <span className="muted-small">
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </span>
        </div>

        <div className="rail-block">
          <div className="rail-row">
            <span className="section-strong">Daily progress</span>
            <span className="muted-small">
              {daily.done} of {daily.total} tasks
            </span>
          </div>
          <ProgressBar
            value={daily.total === 0 ? 0 : daily.done / daily.total}
            height={7}
            label="Daily progress"
          />
          <p className="rail-caption">
            {daily.total === 0
              ? "A clear day. Start with one task."
              : daily.done >= daily.total
                ? "Everything planned is done. The rest is yours."
                : "You’re on track for today."}
          </p>
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <div className="rail-row">
            <h3>Recent activity</h3>
            <span className="muted-tiny">Today</span>
          </div>
          <ul className="activity-list">
            {workspace.recentActivities(3).map((activity) => (
              <li key={activity.id} className={`activity-item activity-${activity.kind}`}>
                <span className="activity-node" aria-hidden="true" />
                <div className="activity-copy">
                  <strong>{activity.text}</strong>
                  <span>
                    {activity.subject} · {formatActivityMoment(activity.at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rail-divider" />

        <div className="rail-block">
          <div className="rail-row">
            <h3>Task notes</h3>
            <span className={`save-inline save-${saveState}`}>
              <span className="save-dot" aria-hidden="true" />
              {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}
            </span>
          </div>
          {activeTask ? (
            <textarea
              className="notes-box"
              value={activeTask.notes}
              placeholder="Add a note…"
              aria-label={`Notes for ${activeTask.title}`}
              onChange={(event) =>
                update((current) => current.setTaskNotes(activeTask.id, event.target.value))
              }
            />
          ) : (
            <p className="rail-note">Notes follow the task in focus. Pick a task above to start.</p>
          )}
        </div>

        <button
          type="button"
          className="next-checkin"
          onClick={() => (nextCheckIn ? onOpenTask(nextCheckIn.id) : onPlanDay())}
        >
          <span className="checkin-icon" aria-hidden="true">
            <Icon name="clock" size={17} />
          </span>
          <span className="checkin-copy">
            <span className="rail-label">NEXT CHECK-IN</span>
            <strong>{nextCheckIn?.scheduledTime ? formatTimeLabel(nextCheckIn.scheduledTime) : "Nothing else"}</strong>
            <span>{nextCheckIn ? nextCheckIn.title : "Leave the evening open"}</span>
          </span>
          <Icon name="chevron-right" size={16} />
        </button>

        <p className="rail-quote">A quiet place for your working notes.</p>
      </aside>
    </>
  );
}
