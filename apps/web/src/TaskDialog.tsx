import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { maxAttachmentBytes } from "@tessera/shared";
import type { PersistedTaskDto, ProjectMemberDto } from "@tessera/shared";
import {
  addAttachment,
  addComment,
  createTask,
  deleteTask,
  getAttachment,
  getDiscussion,
  updateTask,
} from "./api";
import { statusLabels } from "./board";
import { Dialog, Icon, Notice } from "./ui";
import { dateLabel, errorMessage, priorityLabels } from "./display";

interface Props {
  task?: PersistedTaskDto;
  projectId: string;
  members: ProjectMemberDto[];
  canWrite: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}

function encodeFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Не вдалося прочитати файл."));
    reader.readAsDataURL(file);
  });
}

export function TaskDialog({
  task,
  projectId,
  members,
  canWrite,
  canDelete,
  onClose,
  onChanged,
}: Props) {
  const [discussion, setDiscussion] =
    useState<Awaited<ReturnType<typeof getDiscussion>>>();
  const [discussionError, setDiscussionError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const taskId = task?.taskId;

  useEffect(() => {
    if (!taskId) return;
    let active = true;
    void getDiscussion(taskId)
      .then((items) => {
        if (active) setDiscussion(items);
      })
      .catch((caught: unknown) => {
        if (active) setDiscussionError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, [taskId]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title")).trim();
    if (!title) {
      setError("Введіть назву задачі.");
      return;
    }
    const command = {
      title,
      description: String(form.get("description")),
      priority: String(form.get("priority")) as PersistedTaskDto["priority"],
      storyPoints: Number(form.get("points")),
      dueDate: String(form.get("dueDate")) || null,
      assigneeId: String(form.get("assignee")) || null,
    };
    void run(async () => {
      if (task)
        await updateTask(task.taskId, {
          ...command,
          expectedVersion: task.version,
        });
      else await createTask(projectId, command);
      onChanged(task ? "Зміни збережено." : "Задачу створено.");
      onClose();
    });
  }

  function comment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskId) return;
    const form = event.currentTarget;
    const body = String(new FormData(form).get("comment")).trim();
    if (!body) {
      setError("Напишіть коментар.");
      return;
    }
    void run(async () => {
      const entry = await addComment(taskId, body);
      setDiscussion((previous) => ({
        comments: [entry, ...(previous?.comments ?? [])],
        attachments: previous?.attachments ?? [],
      }));
      form.reset();
      onChanged("Коментар додано.");
    });
  }

  return (
    <Dialog
      title={task ? task.taskKey : "Нова задача"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="dialog-body stack">
        {error && <Notice error>{error}</Notice>}
        {task && (
          <span className={`tag status--${task.status.toLowerCase()}`}>
            {statusLabels[task.status]}
          </span>
        )}
        <form className="stack" onSubmit={save}>
          <fieldset className="stack" disabled={!canWrite || busy}>
            <label>
              Назва{" "}
              <input
                name="title"
                defaultValue={task?.title}
                required
                maxLength={240}
                autoFocus={canWrite}
                placeholder="Наприклад, перевірити WIP-політику"
              />
            </label>
            <label>
              Опис{" "}
              <textarea
                name="description"
                defaultValue={task?.description}
                maxLength={4000}
                rows={3}
                placeholder="Контекст і критерії готовності"
              />
            </label>
            <div className="form-grid">
              <label>
                Пріоритет{" "}
                <select
                  name="priority"
                  defaultValue={task?.priority ?? "NORMAL"}
                >
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Оцінка, SP{" "}
                <input
                  name="points"
                  defaultValue={task?.storyPoints ?? 3}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  required
                />
                <small>Story points оцінюють складність задачі.</small>
              </label>
              <label>
                Дедлайн{" "}
                <input
                  type="date"
                  name="dueDate"
                  defaultValue={task?.dueDate ?? ""}
                />
              </label>
              <label>
                Виконавець{" "}
                <select name="assignee" defaultValue={task?.assigneeId ?? ""}>
                  <option value="">Не призначено</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          {canWrite && (
            <div className="actions">
              <button className="button button--primary" disabled={busy}>
                {task ? "Зберегти зміни" : "Створити задачу"}
              </button>
            </div>
          )}
        </form>
        {taskId && (
          <section className="dialog-section stack">
            <h3>Вкладення</h3>
            {discussionError && <Notice error>{discussionError}</Notice>}
            {discussion?.attachments.map((attachment) => (
              <button
                type="button"
                key={attachment.attachmentId}
                className="file-row"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const { content, name } = await getAttachment(
                      taskId,
                      attachment.attachmentId,
                    );
                    const blob = new Blob(
                      [
                        Uint8Array.from(atob(content), (char) =>
                          char.charCodeAt(0),
                        ),
                      ],
                      { type: "application/octet-stream" },
                    );
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = name;
                    link.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                <Icon name="file" />
                <span>{attachment.name}</span>
                <small>{Math.ceil(attachment.size / 1024)} КБ</small>
              </button>
            ))}
            {discussion?.attachments.length === 0 && (
              <p className="muted">Файлів ще немає.</p>
            )}
            {canWrite && (
              <label className="upload-label">
                Додати файл <small>До 2 МіБ, до 10 файлів на задачу</small>
                <input
                  type="file"
                  disabled={
                    busy || !discussion || discussion.attachments.length >= 10
                  }
                  onChange={(event) => {
                    const input = event.currentTarget;
                    const file = input.files?.[0];
                    input.value = "";
                    if (!file) return;
                    if (file.size === 0 || file.size > maxAttachmentBytes) {
                      setError("Оберіть непорожній файл розміром до 2 МіБ.");
                      return;
                    }
                    void run(async () => {
                      const entry = await addAttachment(taskId, {
                        name: file.name,
                        content: await encodeFile(file),
                      });
                      setDiscussion((previous) => ({
                        comments: previous?.comments ?? [],
                        attachments: [...(previous?.attachments ?? []), entry],
                      }));
                      onChanged("Вкладення додано.");
                    });
                  }}
                />
              </label>
            )}
            <h3>Коментарі</h3>
            {!discussion && !discussionError && (
              <p className="muted">Завантажуємо обговорення…</p>
            )}
            {canWrite && (
              <form className="stack" onSubmit={comment}>
                <textarea
                  name="comment"
                  aria-label="Новий коментар"
                  placeholder="Напишіть коментар…"
                  rows={2}
                  maxLength={2000}
                  required
                />
                <div className="actions">
                  <button
                    className="button button--secondary"
                    disabled={busy || !discussion}
                  >
                    Додати коментар
                  </button>
                </div>
              </form>
            )}
            {discussion?.comments.length === 0 && (
              <p className="muted">Коментарів ще немає.</p>
            )}
            {discussion?.comments.map((entry) => (
              <article className="comment" key={entry.commentId}>
                <strong>{entry.author}</strong>
                <time dateTime={entry.createdAt}>
                  {dateLabel(entry.createdAt)}
                </time>
                <p>{entry.body}</p>
              </article>
            ))}
          </section>
        )}
        {task && canDelete && (
          <section className="dialog-section">
            {confirmDelete ? (
              <div className="stack">
                <p>
                  Видалити {task.taskKey} разом із коментарями та вкладеннями?
                </p>
                <div className="actions">
                  <button
                    type="button"
                    className="button button--danger"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await deleteTask(task.taskId, task.version);
                        onChanged("Задачу видалено.");
                        onClose();
                      })
                    }
                  >
                    Підтвердити видалення
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Скасувати
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="button button--danger"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Видалити задачу
              </button>
            )}
          </section>
        )}
      </div>
    </Dialog>
  );
}
