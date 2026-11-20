import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import type {
  ActivityDto,
  PersistedTaskDto,
  ProjectMemberDto,
  ProjectRole,
} from "@tessera/shared";
import {
  addProjectMember,
  createProject,
  createWorkspace,
  deleteProject,
  getBoard,
  listActivity,
  listMembers,
  listProjects,
  listWorkspaces,
  moveTask,
  myProjectRole,
  removeProjectMember,
} from "./api";
import type { BoardDto, TaskStatus } from "./api";
import { auth } from "./auth";
import { boardSummary, slugify, statusLabels, statusOrder } from "./board";
import { TaskDialog } from "./TaskDialog";
import { Welcome } from "./Welcome";
import { Brand, Dialog, Icon, Notice } from "./ui";
import {
  dateLabel,
  errorMessage,
  initials,
  priorityLabels,
  roleLabels,
} from "./display";
import type { IconName } from "./ui";
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
const userName = () =>
  String(
    auth.tokenParsed?.name ??
      auth.tokenParsed?.preferred_username ??
      "Користувач",
  );
const logout = () => void auth.logout({ redirectUri: window.location.origin });

function loadSession(): Session | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(sessionKey()) ?? "null",
    );
    if (
      value &&
      typeof value === "object" &&
      "projectId" in value &&
      typeof value.projectId === "string"
    )
      return value as Session;
  } catch {
    // The project picker remains available when browser storage is inaccessible.
  }
  return null;
}

const pages = {
  board: {
    title: "Kanban-дошка",
    label: "Дошка",
    icon: "board",
    description:
      "Від плану до готового результату. Стежте за навантаженням на кожному етапі.",
  },
  overview: {
    title: "Огляд проєкту",
    label: "Огляд",
    icon: "overview",
    description: "Поточний стан задач і розподіл роботи за етапами.",
  },
  calendar: {
    title: "Дедлайни",
    label: "Дедлайни",
    icon: "calendar",
    description: "Задачі з визначеним терміном виконання.",
  },
  team: {
    title: "Команда",
    label: "Команда",
    icon: "team",
    description: "Учасники проєкту та їхні права доступу.",
  },
  activity: {
    title: "Журнал змін",
    label: "Журнал змін",
    icon: "activity",
    description: "До 100 останніх операцій, зафіксованих у PostgreSQL.",
  },
} as const satisfies Record<
  string,
  { title: string; label: string; icon: IconName; description: string }
>;
type Page = keyof typeof pages;
const pageOrder = Object.keys(pages) as Page[];

function Setup({ onReady }: { onReady: (session: Session) => void }) {
  const [available, setAvailable] =
    useState<(Session & { role: ProjectRole })[]>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [deleting, setDeleting] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const workspaces = await listWorkspaces();
        const groups = await Promise.all(
          workspaces.map(async (workspace) =>
            Promise.all(
              (await listProjects(workspace.workspaceId)).map(
                async (project) => ({
                  workspaceId: workspace.workspaceId,
                  workspaceName: workspace.name,
                  projectId: project.projectId,
                  projectName: project.name,
                  projectCode: project.code,
                  role: (await myProjectRole(project.projectId)).role,
                }),
              ),
            ),
          ),
        );
        if (active) setAvailable(groups.flat());
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("workspace")).trim();
    const projectName = String(form.get("project")).trim();
    const code = String(form.get("code")).trim();
    if (name.length < 2 || projectName.length < 2) {
      setError("Введіть назви простору й проєкту.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const workspace = await createWorkspace({
        name,
        slug: `${slugify(name).slice(0, 65).replace(/-$/, "") || "tessera"}-${crypto.randomUUID().slice(0, 8)}`,
      });
      const project = await createProject(workspace.workspaceId, {
        name: projectName,
        code,
        description: "",
      });
      onReady({
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.name,
        projectId: project.projectId,
        projectName: project.name,
        projectCode: project.code,
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="entry">
      <header className="entry-top">
        <Brand />
        <button className="button button--secondary" onClick={logout}>
          <Icon name="exit" /> Вийти
        </button>
      </header>
      <section className="entry-card stack">
        <p className="eyebrow">Робочий простір</p>
        <h1>Ваші проєкти</h1>
        <p className="muted">
          {userName()}, оберіть проєкт або створіть новий.
        </p>
        {error && <Notice error>{error}</Notice>}
        {!available && !error && (
          <p className="muted" role="status">
            Завантажуємо проєкти…
          </p>
        )}
        {available?.length === 0 && (
          <p className="muted">
            У вас поки немає проєктів. Власник іншого проєкту може додати вас за
            електронною поштою.
          </p>
        )}
        {available?.map((item) => (
          <div className="project-choice" key={item.projectId}>
            <button
              className="project-choice-main"
              onClick={() => onReady(item)}
            >
              <span className="project-symbol">
                {item.projectCode.slice(0, 3)}
              </span>
              <span>
                <strong>{item.projectName}</strong>
                <small>{item.workspaceName}</small>
              </span>
            </button>
            {item.role === "OWNER" && (
              <button
                className="button button--icon project-delete"
                title={`Видалити проєкт ${item.projectName}`}
                aria-label={`Видалити проєкт ${item.projectName}`}
                onClick={() => setDeleting(item)}
              >
                <Icon name="trash" />
              </button>
            )}
          </div>
        ))}
        {!newOpen ? (
          <button
            className="button button--primary self-start"
            onClick={() => setNewOpen(true)}
          >
            <Icon name="plus" /> Новий проєкт
          </button>
        ) : (
          <form className="stack" onSubmit={(event) => void submit(event)}>
            <label>
              Назва робочого простору{" "}
              <input
                name="workspace"
                required
                minLength={2}
                maxLength={160}
                placeholder="Наприклад, Команда розробки"
              />
            </label>
            <label>
              Назва проєкту{" "}
              <input
                name="project"
                required
                minLength={2}
                maxLength={160}
                placeholder="Наприклад, Платіжний шлюз v2.0"
              />
            </label>
            <label>
              Код проєкту{" "}
              <input
                name="code"
                required
                pattern="[A-Za-z][A-Za-z0-9]{1,11}"
                placeholder="PAY"
                title="Від 2 до 12 латинських літер або цифр, починаючи з літери"
              />
              <small>Використовується в номерах задач, наприклад PAY-1.</small>
            </label>
            <div className="actions">
              <button
                type="button"
                className="button button--secondary"
                disabled={pending}
                onClick={() => setNewOpen(false)}
              >
                Скасувати
              </button>
              <button className="button button--primary" disabled={pending}>
                {pending ? "Створюємо…" : "Створити проєкт"}
              </button>
            </div>
          </form>
        )}
      </section>
      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setAvailable((current) =>
              current?.filter((item) => item.projectId !== deleting.projectId),
            );
            setDeleting(null);
          }}
        />
      )}
    </main>
  );
}

function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: Session;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code !== project.projectCode) return;
    setBusy(true);
    try {
      await deleteProject(project.projectId);
      onDeleted();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Видалити проєкт"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="dialog-body stack"
        onSubmit={(event) => void confirm(event)}
      >
        <p>
          Проєкт «{project.projectName}» буде видалено разом із задачами,
          файлами, коментарями та журналом. Цю дію неможливо скасувати.
        </p>
        <label>
          Введіть код {project.projectCode} для підтвердження
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoFocus
            autoComplete="off"
          />
        </label>
        {error && <Notice error>{error}</Notice>}
        <div className="actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
            disabled={busy}
          >
            Скасувати
          </button>
          <button
            className="button button--danger"
            disabled={busy || code !== project.projectCode}
          >
            {busy ? "Видаляємо…" : "Видалити назавжди"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Metrics({ board }: { board: BoardDto }) {
  const summary = boardSummary(board);
  const donePoints = board.columns
    .flatMap((column) => column.tasks)
    .filter((task) => task.status === "DONE")
    .reduce((sum, task) => sum + task.storyPoints, 0);
  const completion = summary.total
    ? Math.round((summary.done / summary.total) * 100)
    : 0;
  return (
    <div className="metrics">
      <div className="metric">
        <span>Усього задач</span>
        <strong>{summary.total}</strong>
        <small>{summary.storyPoints} SP заплановано</small>
      </div>
      <div className="metric">
        <span>У роботі</span>
        <strong>{summary.inProgress}</strong>
        <small>У колонці «У роботі»</small>
      </div>
      <div className="metric">
        <span>Виконано</span>
        <strong>{summary.done}</strong>
        <small>{donePoints} SP завершено</small>
      </div>
      <div className="metric">
        <span>Прогрес проєкту</span>
        <strong>{completion}%</strong>
        <progress
          value={completion}
          max={100}
          aria-label="Частка виконаних задач"
        />
      </div>
    </div>
  );
}

function DropColumn({
  id,
  className,
  acceptsDrop,
  children,
}: {
  id: string;
  className: string;
  acceptsDrop: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={className + (isOver && acceptsDrop ? " column--drop-target" : "")}
    >
      {children}
    </section>
  );
}

function DraggableCard({
  task,
  disabled,
  children,
}: {
  task: PersistedTaskDto;
  disabled: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: task.taskId,
    disabled,
  });
  return (
    <motion.article
      ref={setNodeRef}
      className={`task-card${isDragging ? " task-card--dragging" : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!disabled && (
        <button
          type="button"
          className="drag-handle"
          aria-label={`Перетягнути ${task.taskKey}`}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" /> Перетягнути
        </button>
      )}
      {children}
    </motion.article>
  );
}

function Board({
  board,
  query,
  members,
  canWrite,
  moving,
  onMove,
  onOpen,
  onCreate,
}: {
  board: BoardDto;
  query: string;
  members: ProjectMemberDto[];
  canWrite: boolean;
  moving: boolean;
  onMove: (task: PersistedTaskDto, target: TaskStatus) => void;
  onOpen: (task: PersistedTaskDto) => void;
  onCreate: () => void;
}) {
  const term = query.trim().toLocaleLowerCase("uk-UA");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
  );
  const draggedTask = board.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.taskId === draggingId);
  return (
    <DndContext
      sensors={sensors}
      autoScroll={false}
      onDragStart={({ active }) => setDraggingId(String(active.id))}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={({ over }) => {
        const column = board.columns.find((item) => item.columnId === over?.id);
        if (
          draggedTask &&
          column &&
          column.tasks.length < column.wipLimit &&
          draggedTask.status !== column.status
        )
          onMove(draggedTask, column.status);
        setDraggingId(null);
      }}
    >
      <div className="board" aria-label="Kanban-дошка">
        {board.columns.map((column) => {
          const visible = column.tasks.filter((task) =>
            `${task.taskKey} ${task.title} ${task.description}`
              .toLocaleLowerCase("uk-UA")
              .includes(term),
          );
          const full = column.tasks.length >= column.wipLimit;
          const acceptsDrop = Boolean(
            canWrite &&
            !moving &&
            draggedTask &&
            !full &&
            draggedTask.status !== column.status,
          );
          return (
            <DropColumn
              id={column.columnId}
              acceptsDrop={acceptsDrop}
              className={`column status--${column.status.toLowerCase()}${draggingId ? (acceptsDrop ? " column--can-drop" : " column--no-drop") : ""}`}
              key={column.columnId}
            >
              <header className="column-header">
                <h2>
                  <i />
                  {statusLabels[column.status]}{" "}
                  <span>{column.tasks.length}</span>
                </h2>
                {column.status === "PLANNED" && canWrite && (
                  <button
                    className="button button--icon"
                    title="Нова задача"
                    aria-label="Нова задача в колонці Заплановано"
                    onClick={onCreate}
                  >
                    <Icon name="plus" />
                  </button>
                )}
              </header>
              <p
                className={
                  full ? "column-limit column-limit--full" : "column-limit"
                }
              >
                {column.tasks.length} / {column.wipLimit} · WIP
                {full ? " · Ліміт досягнуто" : ""}
              </p>
              <div className="task-list">
                {visible.map((task) => {
                  const assignee = members.find(
                    (member) => member.userId === task.assigneeId,
                  );
                  const targets = statusOrder.filter(
                    (status) => status !== task.status,
                  );
                  return (
                    <DraggableCard
                      key={task.taskId}
                      task={task}
                      disabled={!canWrite || moving}
                    >
                      <div className="task-top">
                        <span className="task-key">{task.taskKey}</span>
                        <span
                          className={`tag priority--${task.priority.toLowerCase()}`}
                        >
                          {priorityLabels[task.priority]}
                        </span>
                      </div>
                      <button
                        className="task-title"
                        onClick={() => onOpen(task)}
                      >
                        {task.title}
                      </button>
                      {task.dueDate && (
                        <span className="task-date">
                          <Icon name="calendar" />
                          {dateLabel(task.dueDate)}
                        </span>
                      )}
                      <div className="task-footer">
                        <span
                          className="avatar"
                          title={assignee?.displayName ?? "Не призначено"}
                          aria-label={assignee?.displayName ?? "Не призначено"}
                        >
                          {assignee ? initials(assignee.displayName) : "—"}
                        </span>
                        <span className="task-points" title="Story points">
                          {task.storyPoints} SP
                        </span>
                      </div>
                      {canWrite && (
                        <select
                          className="move-select"
                          value=""
                          disabled={moving}
                          aria-label={`Статус задачі ${task.taskKey}`}
                          onChange={(event) =>
                            onMove(task, event.target.value as TaskStatus)
                          }
                        >
                          <option value="" disabled>
                            Змінити статус
                          </option>
                          {targets.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      )}
                    </DraggableCard>
                  );
                })}
                {visible.length === 0 && (
                  <div className="empty-column">
                    {term ? "Немає збігів" : "Поки немає задач"}
                  </div>
                )}
              </div>
            </DropColumn>
          );
        })}
      </div>
      <DragOverlay>
        {draggedTask ? (
          <motion.div
            className="task-card drag-overlay"
            initial={{ scale: 0.98 }}
            animate={{ scale: 1.04, rotate: -3 }}
          >
            <span className="task-key">{draggedTask.taskKey}</span>
            <strong>{draggedTask.title}</strong>
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

const activityLabels: Record<ActivityDto["kind"], string> = {
  CREATED: "Створення задачі",
  UPDATED: "Редагування задачі",
  MOVED: "Зміна статусу",
  DELETED: "Видалення задачі",
  COMMENTED: "Додавання коментаря",
  ATTACHED: "Додавання файлу",
};
const activityTime = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "short",
  timeStyle: "short",
});

function Activity({ events }: { events: ActivityDto[] }) {
  return (
    <div className="panel">
      {events.length === 0 && (
        <p className="muted">Записи з’являться після першої зміни задачі.</p>
      )}
      {events.map((event) => (
        <div className="data-row" key={event.eventId}>
          <span className="row-icon">
            <Icon name="activity" />
          </span>
          <div>
            <strong>
              {activityLabels[event.kind]} · {event.taskKey}
            </strong>
            <small>
              {event.actor}
              {event.fromStatus &&
                event.toStatus &&
                ` · ${statusLabels[event.fromStatus]} → ${statusLabels[event.toStatus]}`}
            </small>
          </div>
          <time dateTime={event.createdAt}>
            {activityTime.format(new Date(event.createdAt))}
          </time>
        </div>
      ))}
    </div>
  );
}

function InviteDialog({
  projectId,
  onClose,
  onChanged,
}: {
  projectId: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setBusy(true);
    try {
      await addProjectMember(
        projectId,
        String(form.get("email")).trim(),
        String(form.get("role")) as "ADMIN" | "MEMBER" | "VIEWER",
      );
      onChanged("Доступ учасника оновлено.");
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Надати доступ"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="dialog-body stack"
        onSubmit={(event) => void submit(event)}
      >
        <p className="muted">
          Вкажіть email людини, яка вже хоч раз увійшла в Tessera. Якщо вона вже
          є в команді, її роль оновиться.
        </p>
        {error && <Notice error>{error}</Notice>}
        <label>
          Електронна пошта{" "}
          <input
            type="email"
            name="email"
            required
            maxLength={320}
            autoFocus
            placeholder="member@tessera.local"
          />
        </label>
        <label>
          Роль{" "}
          <select name="role" defaultValue="MEMBER">
            {(["MEMBER", "VIEWER", "ADMIN"] as const).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button className="button button--primary" disabled={busy}>
            {busy ? "Зберігаємо…" : "Зберегти доступ"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function RemoveMemberDialog({
  projectId,
  member,
  onClose,
  onChanged,
}: {
  projectId: string;
  member: ProjectMemberDto;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      await removeProjectMember(projectId, member.userId);
      onChanged(`${member.displayName} більше не має доступу до проєкту.`);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Виключити учасника"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="dialog-body stack">
        <p>
          Прибрати доступ {member.displayName} ({member.email}) до цього
          проєкту? Задачі, призначені цій людині, стануть непризначеними.
        </p>
        {error && <Notice error>{error}</Notice>}
        <div className="actions">
          <button
            className="button button--secondary"
            disabled={busy}
            onClick={onClose}
          >
            Скасувати
          </button>
          <button
            className="button button--danger"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? "Виключаємо…" : "Виключити з проєкту"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Workspace({
  session,
  onSwitch,
}: {
  session: Session;
  onSwitch: () => void;
}) {
  const { projectId } = session;
  const [page, setPage] = useState<Page>("board");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [moving, setMoving] = useState(false);
  const [editor, setEditor] = useState<PersistedTaskDto | "new" | null>(null);
  const [invite, setInvite] = useState(false);
  const [removing, setRemoving] = useState<ProjectMemberDto | null>(null);
  const [data, setData] = useState<{
    board: BoardDto;
    role: ProjectRole;
    members: ProjectMemberDto[];
    activity: ActivityDto[];
  }>();
  const requestVersion = useRef(0);
  const board = data?.board;
  const canManage = data?.role === "OWNER" || data?.role === "ADMIN";
  const canWrite = canManage || data?.role === "MEMBER";

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setRefreshing(true);
    try {
      const [board, { role }, members, activity] = await Promise.all([
        getBoard(projectId),
        myProjectRole(projectId),
        listMembers(projectId),
        listActivity(projectId),
      ]);
      if (version === requestVersion.current)
        setData({ board, role, members, activity });
    } catch (caught) {
      if (version === requestVersion.current) setError(errorMessage(caught));
    } finally {
      if (version === requestVersion.current) setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    // The initial remote fetch synchronizes this screen with the project.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
    return () => {
      requestVersion.current += 1;
    };
  }, [refresh]);

  function changed(text: string) {
    setError("");
    setMessage(text);
    void refresh();
  }

  async function move(task: PersistedTaskDto, target: TaskStatus) {
    setMoving(true);
    setMessage("");
    setError("");
    try {
      await moveTask(task.taskId, target, task.version);
      setMessage(`${task.taskKey} переміщено до «${statusLabels[target]}».`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      await refresh();
      setMoving(false);
    }
  }

  const current = pages[page];
  const datedTasks =
    board?.columns
      .flatMap((column) => column.tasks)
      .filter((task) => task.dueDate)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")) ?? [];

  return (
    <div className="app-shell">
      <aside className="rail">
        <Brand />
        <button
          className="rail-project"
          title="Змінити проєкт"
          onClick={onSwitch}
        >
          <span className="project-symbol">
            {session.projectCode.slice(0, 3)}
          </span>
          <span>
            <strong>{session.projectName}</strong>
            <small>Змінити проєкт</small>
          </span>
        </button>
        <nav aria-label="Розділи проєкту">
          {pageOrder.map((name) => (
            <button
              key={name}
              className="nav-item"
              aria-current={page === name ? "page" : undefined}
              onClick={() => setPage(name)}
            >
              <Icon name={pages[name].icon} />
              <span>{pages[name].label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-profile">
          <span className="avatar">{initials(userName())}</span>
          <span>
            <strong>{userName()}</strong>
            <small>{data ? roleLabels[data.role] : "Tessera"}</small>
          </span>
          <button
            className="button button--icon"
            onClick={logout}
            title="Вийти"
            aria-label="Вийти"
          >
            <Icon name="exit" />
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{session.workspaceName}</span>
            <span aria-hidden="true">/</span>
            <strong>{session.projectName}</strong>
          </div>
          <button
            className="button button--secondary"
            disabled={refreshing}
            onClick={() => {
              setError("");
              setMessage("");
              void refresh();
            }}
          >
            <Icon name="refresh" /> Оновити
          </button>
        </header>
        <div className="content stack">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Проєкт · {session.projectCode}</p>
              <h1>{current.title}</h1>
              <p className="muted">{current.description}</p>
            </div>
            <div className="actions">
              {page === "board" && canWrite && (
                <button
                  className="button button--primary"
                  onClick={() => setEditor("new")}
                >
                  <Icon name="plus" /> Нова задача
                </button>
              )}
              {page === "team" && canManage && (
                <button
                  className="button button--primary"
                  onClick={() => setInvite(true)}
                >
                  <Icon name="plus" /> Надати доступ
                </button>
              )}
            </div>
          </header>
          {error && <Notice error>{error}</Notice>}
          {message && <Notice>{message}</Notice>}
          {!data && !error && (
            <p className="muted" role="status">
              Завантажуємо проєкт…
            </p>
          )}
          {!data && error && (
            <button
              className="button button--secondary self-start"
              onClick={onSwitch}
            >
              <Icon name="folder" /> Обрати інший проєкт
            </button>
          )}
          {data && (
            <motion.div
              key={page}
              className="stack page-body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {(page === "board" || page === "overview") && (
                <Metrics board={data.board} />
              )}
              {page === "board" && (
                <>
                  <div className="board-toolbar">
                    <label className="search">
                      <Icon name="search" />
                      <input
                        type="search"
                        aria-label="Пошук задач"
                        placeholder="Пошук за назвою або кодом"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    {canWrite && (
                      <span className="board-hint">
                        Перетягніть картку в потрібну колонку
                      </span>
                    )}
                    {data.role === "VIEWER" && (
                      <span className="tag">
                        <Icon name="lock" /> Лише перегляд
                      </span>
                    )}
                  </div>
                  <Board
                    board={data.board}
                    query={query}
                    members={data.members}
                    moving={moving}
                    canWrite={canWrite}
                    onMove={(task, target) => void move(task, target)}
                    onOpen={setEditor}
                    onCreate={() => setEditor("new")}
                  />
                </>
              )}
              {page === "overview" && (
                <div className="overview-grid">
                  <section className="panel stack">
                    <h2>Розподіл за статусами</h2>
                    {data.board.columns.map((column) => (
                      <div
                        className={`status-line status--${column.status.toLowerCase()}`}
                        key={column.columnId}
                      >
                        <span>
                          <i />
                          {statusLabels[column.status]}
                        </span>
                        <strong>{column.tasks.length}</strong>
                      </div>
                    ))}
                  </section>
                  <section className="panel stack">
                    <h2>Наскрізний сценарій</h2>
                    <ol className="flow">
                      <li>
                        <strong>Boundary · React і REST</strong>
                        <span>
                          Користувач змінює статус, API перевіряє дані запиту.
                        </span>
                      </li>
                      <li>
                        <strong>Control · NestJS</strong>
                        <span>
                          Сервіс перевіряє право на зміну задачі та викликає
                          репозиторій.
                        </span>
                      </li>
                      <li>
                        <strong>Entity · State та WIP</strong>
                        <span>
                          Дозволений перехід і місткість цільової колонки
                          перевіряються до запису.
                        </span>
                      </li>
                      <li>
                        <strong>Persistence · PostgreSQL</strong>
                        <span>
                          Статус і запис у журналі фіксуються в одній
                          транзакції.
                        </span>
                      </li>
                    </ol>
                  </section>
                </div>
              )}
              {page === "calendar" && (
                <section className="panel">
                  {datedTasks.length === 0 && (
                    <p className="muted">
                      Дедлайнів ще немає. Дату можна встановити в деталях
                      задачі.
                    </p>
                  )}
                  {datedTasks.map((task) => (
                    <button
                      type="button"
                      className="data-row data-row--button"
                      key={task.taskId}
                      onClick={() => setEditor(task)}
                    >
                      <span className="row-icon">
                        <Icon name="calendar" />
                      </span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.taskKey} · {statusLabels[task.status]}
                        </small>
                      </span>
                      <time dateTime={task.dueDate ?? undefined}>
                        {dateLabel(task.dueDate!)}
                      </time>
                    </button>
                  ))}
                </section>
              )}
              {page === "team" && (
                <section className="panel">
                  {data.members.map((member) => (
                    <div className="data-row" key={member.userId}>
                      <span className="avatar">
                        {initials(member.displayName)}
                      </span>
                      <div>
                        <strong>{member.displayName}</strong>
                        <small>{member.email}</small>
                      </div>
                      <span className="member-actions">
                        <span className="tag">{roleLabels[member.role]}</span>
                        {canManage &&
                          member.role !== "OWNER" &&
                          (data.role === "OWNER" || member.role !== "ADMIN") &&
                          member.email.toLowerCase() !==
                            String(
                              auth.tokenParsed?.email ?? "",
                            ).toLowerCase() && (
                            <button
                              className="button button--icon member-remove"
                              title={`Виключити ${member.displayName}`}
                              aria-label={`Виключити ${member.displayName}`}
                              onClick={() => setRemoving(member)}
                            >
                              <Icon name="trash" />
                            </button>
                          )}
                      </span>
                    </div>
                  ))}
                </section>
              )}
              {page === "activity" && <Activity events={data.activity} />}
            </motion.div>
          )}
        </div>
      </main>
      {editor && data && (
        <TaskDialog
          key={editor === "new" ? "new" : editor.taskId}
          task={editor === "new" ? undefined : editor}
          projectId={projectId}
          members={data.members}
          canWrite={canWrite}
          canDelete={canManage}
          onChanged={changed}
          onClose={() => setEditor(null)}
        />
      )}
      {invite && canManage && (
        <InviteDialog
          projectId={projectId}
          onChanged={changed}
          onClose={() => setInvite(false)}
        />
      )}
      {removing && canManage && (
        <RemoveMemberDialog
          projectId={projectId}
          member={removing}
          onChanged={changed}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  if (!auth.authenticated) return <Welcome onLogin={() => void auth.login()} />;

  return session ? (
    <Workspace
      key={session.projectId}
      session={session}
      onSwitch={() => {
        localStorage.removeItem(sessionKey());
        setSession(null);
      }}
    />
  ) : (
    <Setup
      onReady={(next) => {
        localStorage.setItem(sessionKey(), JSON.stringify(next));
        setSession(next);
      }}
    />
  );
}
