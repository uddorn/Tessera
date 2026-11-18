import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { PersistedTaskDto } from "@tessera/shared";
import {
  createProject,
  createTask,
  createWorkspace,
  getBoard,
  listProjects,
  listWorkspaces,
  myProjectRole,
  addProjectMember,
  moveTask,
  type BoardDto,
} from "./api";
import { adjacentStatus, boardSummary, slugify, statusLabels } from "./board";
import { auth } from "./auth";
import "./App.css";

interface Session {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
  projectCode: string;
}

const sessionKey = () =>
  `tessera.coursework.session.${auth.subject ?? "guest"}`;

function loadSession(): Session | null {
  try {
    const value = localStorage.getItem(sessionKey());
    return value ? (JSON.parse(value) as Session) : null;
  } catch {
    return null;
  }
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function Setup({ onReady }: { onReady: (session: Session) => void }) {
  const [workspaceName, setWorkspaceName] = useState("Tessera Workspace");
  const [projectName, setProjectName] = useState("Coursework Kanban");
  const [projectCode, setProjectCode] = useState("TES");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<Session[]>([]);

  useEffect(() => {
    void listWorkspaces()
      .then(async (workspaces) => {
        const choices = await Promise.all(
          workspaces.map(async (workspace) => {
            const projects = await listProjects(workspace.workspaceId);
            return projects.map((project) => ({
              workspaceId: workspace.workspaceId,
              workspaceName: workspace.name,
              projectId: project.projectId,
              projectName: project.name,
              projectCode: project.code,
            }));
          }),
        );
        setAvailable(choices.flat());
      })
      .catch(() => setError("Не вдалося завантажити ваші проєкти"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const suffix = Date.now().toString(36).slice(-5);
      const workspace = await createWorkspace({
        name: workspaceName.trim(),
        slug: `${slugify(workspaceName) || "tessera"}-${suffix}`,
      });
      const project = await createProject(workspace.workspaceId, {
        name: projectName.trim(),
        code: projectCode.trim().toUpperCase(),
        description: "Архітектурно орієнтована Kanban-платформа",
      });
      onReady({
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.name,
        projectId: project.projectId,
        projectName: project.name,
        projectCode: project.code,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося створити проєкт",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="setup-shell">
      <section className="setup-copy">
        <div className="brand brand--large">
          <span className="brand-mark">T</span>
          <span>Tessera</span>
        </div>
        <p className="kicker">
          <span /> Архітектурна Kanban-платформа
        </p>
        <h1>Перетворюйте складну роботу на зрозумілий потік.</h1>
        <p className="setup-lead">
          React boundary, NestJS application layer і PostgreSQL persistence вже
          зібрані в один відтворюваний продукт.
        </p>
        <div className="architecture-strip">
          <span>React 19</span>
          <i />
          <span>NestJS 12</span>
          <i />
          <span>PostgreSQL 18</span>
          <i />
          <span>Docker</span>
        </div>
      </section>

      <section className="setup-card">
        <div className="step-badge">01</div>
        <p className="overline">Швидкий старт</p>
        <h2>Створіть першу дошку</h2>
        <p className="muted">Дані зберігатимуться у локальному PostgreSQL.</p>
        {available.length > 0 && (
          <div className="existing-projects">
            <p>Ваші проєкти</p>
            {available.map((item) => (
              <button key={item.projectId} onClick={() => onReady(item)}>
                {item.projectName} <small>{item.projectCode}</small>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit}>
          <label>
            Робочий простір
            <input
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
          </label>
          <label>
            Назва проєкту
            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
          </label>
          <label>
            Код задач
            <input
              value={projectCode}
              onChange={(event) => setProjectCode(event.target.value)}
              pattern="[A-Za-z][A-Za-z0-9]{1,11}"
              required
            />
            <small>Наприклад, TES → TES-1, TES-2</small>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" disabled={pending}>
            {pending ? "Створюємо…" : "Запустити робочий простір"}
            <span>→</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function TaskCard({
  task,
  moving,
  onMove,
  canWrite,
}: {
  task: PersistedTaskDto;
  moving: boolean;
  onMove: (task: PersistedTaskDto, direction: -1 | 1) => void;
  canWrite: boolean;
}) {
  const previous = adjacentStatus(task.status, -1);
  const next = adjacentStatus(task.status, 1);
  return (
    <article className="task-card">
      <div className="task-meta">
        <span className={`priority priority--${task.priority.toLowerCase()}`}>
          {task.priority === "NORMAL" ? "ЗВИЧАЙНИЙ" : task.priority}
        </span>
        <button className="icon-button" aria-label="Меню задачі">
          •••
        </button>
      </div>
      <h3>{task.title}</h3>
      <p className="task-key">{task.taskKey}</p>
      <div className="task-footer">
        <span className="avatar" title="Не призначено">
          ?
        </span>
        <span className="points" title="Story points">
          ◆ {task.storyPoints}
        </span>
        <div className="move-actions">
          {canWrite && previous && (
            <button
              disabled={moving}
              onClick={() => onMove(task, -1)}
              title={`Перемістити: ${statusLabels[previous]}`}
            >
              ←
            </button>
          )}
          {canWrite && next && (
            <button
              disabled={moving}
              onClick={() => onMove(task, 1)}
              title={`Перемістити: ${statusLabels[next]}`}
            >
              →
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function BoardApp({
  session,
  onReset,
}: {
  session: Session;
  onReset: () => void;
}) {
  const [board, setBoard] = useState<BoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [priority, setPriority] = useState<
    "LOW" | "NORMAL" | "HIGH" | "CRITICAL"
  >("NORMAL");
  const [storyPoints, setStoryPoints] = useState(3);
  const [savingTask, setSavingTask] = useState(false);
  const [movingTask, setMovingTask] = useState<string | null>(null);
  const [role, setRole] = useState<
    "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | null
  >(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">(
    "MEMBER",
  );

  useEffect(() => {
    void myProjectRole(session.projectId)
      .then((value) => setRole(value.role))
      .catch(() => setError("Немає доступу до цього проєкту. Оберіть інший."));
  }, [session.projectId]);
  const canWrite = role === "OWNER" || role === "ADMIN" || role === "MEMBER";
  const canManage = role === "OWNER" || role === "ADMIN";

  const refresh = useCallback(async () => {
    try {
      setError("");
      setBoard(await getBoard(session.projectId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не вдалося завантажити дошку",
      );
    } finally {
      setLoading(false);
    }
  }, [session.projectId]);

  useEffect(() => {
    // Initial remote data loading is the synchronization performed by this effect.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
  }, [refresh]);

  const summary = useMemo(() => boardSummary(board), [board]);
  const completion = summary.total
    ? Math.round((summary.done / summary.total) * 100)
    : 0;

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTask(true);
    setError("");
    try {
      await createTask(session.projectId, {
        title: taskTitle.trim(),
        priority,
        storyPoints,
      });
      setTaskTitle("");
      setPriority("NORMAL");
      setStoryPoints(3);
      setNewTaskOpen(false);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося створити задачу",
      );
    } finally {
      setSavingTask(false);
    }
  }

  async function handleMove(task: PersistedTaskDto, direction: -1 | 1) {
    const target = adjacentStatus(task.status, direction);
    if (!target) return;
    setMovingTask(task.taskId);
    setError("");
    try {
      await moveTask(task.taskId, target, task.version);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не вдалося перемістити задачу",
      );
      await refresh();
    } finally {
      setMovingTask(null);
    }
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await addProjectMember(session.projectId, inviteEmail.trim(), inviteRole);
      setInviteOpen(false);
      setInviteEmail("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не вдалося додати учасника",
      );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <span>Tessera</span>
        </div>
        <nav aria-label="Головна навігація">
          <button className="nav-item">
            <Icon>
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
            </Icon>
            Огляд
          </button>
          <button className="nav-item nav-item--active">
            <Icon>
              <path d="M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v11h-4z" />
            </Icon>
            Дошка
          </button>
          <button className="nav-item">
            <Icon>
              <path d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1z" />
            </Icon>
            Календар
          </button>
          <button className="nav-item">
            <Icon>
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20c0-4 2-6 6-6s6 2 6 6M16 5c3 0 5 2 5 5s-2 5-5 5" />
            </Icon>
            Команда
          </button>
        </nav>
        <div className="sidebar-section">
          <p>Ваш проєкт</p>
          <button className="project-chip">
            <span>{session.projectCode.slice(0, 2)}</span>
            <span>
              <b>{session.projectName}</b>
              <small>{session.projectCode}</small>
            </span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item">
            <Icon>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
            </Icon>
            Налаштування
          </button>
          <button
            className="profile"
            onClick={onReset}
            title="Змінити локальний проєкт"
          >
            <span className="profile-avatar">DT</span>
            <span>
              <b>
                {String(
                  auth.tokenParsed?.name ??
                    auth.tokenParsed?.preferred_username ??
                    "Користувач",
                )}
              </b>
              <small>{role ?? "Учасник"}</small>
            </span>
            <span>⋮</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{session.workspaceName}</span>
            <b>/</b>
            <strong>{session.projectName}</strong>
          </div>
          <div className="top-actions">
            <button className="search-button">
              ⌕ <span>Пошук задач…</span>
              <kbd>⌘ K</kbd>
            </button>
            <button className="round-button" aria-label="Сповіщення">
              ♢<i />
            </button>
            <button
              className="avatar avatar--header"
              onClick={() =>
                void auth.logout({ redirectUri: window.location.origin })
              }
              title="Вийти"
            >
              ↪
            </button>
          </div>
        </header>

        <section className="content">
          <div className="page-heading">
            <div>
              <p className="overline">Проєкт / {session.projectCode}</p>
              <h1>Kanban-дошка</h1>
              <p className="muted">
                Керуйте потоком робіт і контролюйте WIP-ліміти команди.
              </p>
            </div>
            <div className="heading-actions">
              {canManage && (
                <button
                  className="secondary-button"
                  onClick={() => setInviteOpen(true)}
                >
                  ＋ Учасник
                </button>
              )}
              <button
                className="secondary-button"
                onClick={() => void refresh()}
              >
                ↻ Оновити
              </button>
              {canWrite && (
                <button
                  className="primary-button primary-button--compact"
                  onClick={() => setNewTaskOpen(true)}
                >
                  ＋ Нова задача
                </button>
              )}
            </div>
          </div>

          <div className="metrics">
            <div className="metric">
              <span>Усього задач</span>
              <strong>{summary.total}</strong>
              <small>У поточному проєкті</small>
            </div>
            <div className="metric">
              <span>У роботі</span>
              <strong>{summary.inProgress}</strong>
              <small>WIP під контролем</small>
            </div>
            <div className="metric">
              <span>Виконано</span>
              <strong>{summary.done}</strong>
              <small>{completion}% завершено</small>
            </div>
            <div className="metric metric--progress">
              <span>Прогрес</span>
              <strong>{completion}%</strong>
              <div className="progress">
                <i style={{ width: `${completion}%` }} />
              </div>
              <small>{summary.storyPoints} story points загалом</small>
            </div>
          </div>

          {error && (
            <div className="error-banner">
              <span>!</span>
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {inviteOpen && (
            <form className="invite-form" onSubmit={submitInvite}>
              <label>Додати учасника, який уже увійшов хоча б раз</label>
              <input
                type="email"
                placeholder="member@tessera.local"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
              <select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as typeof inviteRole)
                }
              >
                <option value="ADMIN">Адмін</option>
                <option value="MEMBER">Учасник</option>
                <option value="VIEWER">Переглядач</option>
              </select>
              <button className="primary-button primary-button--compact">
                Додати
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setInviteOpen(false)}
              >
                Скасувати
              </button>
            </form>
          )}

          {canWrite && newTaskOpen && (
            <form className="new-task-form" onSubmit={submitTask}>
              <div>
                <span className="form-icon">＋</span>
                <div>
                  <b>Нова задача</b>
                  <small>Буде додана у колонку «Заплановано»</small>
                </div>
              </div>
              <input
                autoFocus
                placeholder="Що потрібно зробити?"
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                maxLength={240}
                required
              />
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as typeof priority)
                }
              >
                <option value="LOW">Низький</option>
                <option value="NORMAL">Звичайний</option>
                <option value="HIGH">Високий</option>
                <option value="CRITICAL">Критичний</option>
              </select>
              <input
                className="points-input"
                type="number"
                min="0"
                max="100"
                value={storyPoints}
                onChange={(event) => setStoryPoints(Number(event.target.value))}
                aria-label="Story points"
              />
              <button
                className="primary-button primary-button--compact"
                disabled={savingTask}
              >
                {savingTask ? "…" : "Додати"}
              </button>
              <button
                type="button"
                className="close-button"
                onClick={() => setNewTaskOpen(false)}
              >
                ×
              </button>
            </form>
          )}

          {loading ? (
            <div className="loading-board">
              <span />
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="board" aria-label="Kanban-дошка">
              {board?.columns.map((column) => (
                <section className="column" key={column.columnId}>
                  <header>
                    <div>
                      <i
                        className={`status-dot status-dot--${column.status.toLowerCase()}`}
                      />
                      <h2>{statusLabels[column.status]}</h2>
                      <span>{column.tasks.length}</span>
                    </div>
                    <button aria-label="Меню колонки">•••</button>
                  </header>
                  <p className="wip">
                    WIP {column.tasks.length} /{" "}
                    {column.wipLimit >= 100 ? "∞" : column.wipLimit}
                  </p>
                  <div className="task-list">
                    {column.tasks.map((task) => (
                      <TaskCard
                        key={task.taskId}
                        task={task}
                        moving={movingTask === task.taskId}
                        onMove={handleMove}
                        canWrite={canWrite}
                      />
                    ))}
                    {column.tasks.length === 0 && (
                      <button
                        className="empty-column"
                        disabled={!canWrite}
                        onClick={() =>
                          column.status === "PLANNED" && setNewTaskOpen(true)
                        }
                      >
                        <span>＋</span>
                        <b>Задач поки немає</b>
                        <small>
                          {column.status === "PLANNED"
                            ? "Створіть першу задачу"
                            : "Перемістіть задачу сюди"}
                        </small>
                      </button>
                    )}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  function saveSession(next: Session) {
    localStorage.setItem(sessionKey(), JSON.stringify(next));
    setSession(next);
  }

  function resetSession() {
    if (
      window.confirm(
        "Від’єднати локальний проєкт від цього браузера? Дані у PostgreSQL залишаться.",
      )
    ) {
      localStorage.removeItem(sessionKey());
      setSession(null);
    }
  }

  if (!auth.authenticated)
    return (
      <main className="login-screen">
        <div className="brand brand--large">
          <span className="brand-mark">T</span>
          <span>Tessera</span>
        </div>
        <p className="kicker">Захищений робочий простір</p>
        <h1>Твоя команда. Твій простір. Твій прогрес.</h1>
        <p>Увійдіть через Keycloak, щоб працювати з проєктами та задачами.</p>
        <button
          className="primary-button primary-button--compact"
          onClick={() => void auth.login()}
        >
          Увійти
        </button>
      </main>
    );

  return session ? (
    <BoardApp session={session} onReset={resetSession} />
  ) : (
    <Setup onReady={saveSession} />
  );
}

export default App;
