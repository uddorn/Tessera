import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const icons = {
  board: "M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v13h-4z",
  overview: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  calendar: "M4 6h16v14H4zM8 3v6m8-6v6M4 11h16",
  team: "M15 20v-2a5 5 0 0 0-5-5H8a5 5 0 0 0-5 5v2m18 0v-2a5 5 0 0 0-4-5M13 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm4-3a3 3 0 0 1 0 6",
  activity: "M3 12h4l3-7 4 14 3-7h4",
  search: "M16 16l4 4m-3-9a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z",
  plus: "M12 5v14M5 12h14",
  refresh: "M20 8a8 8 0 1 0 0 8m0-12v5h-5",
  close: "m6 6 12 12M6 18 18 6",
  exit: "M10 5H4v14h6m4-11 4 4-4 4m-5-4h9",
  folder: "M3 7V5h7l2 2h9v13H3V7Z",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  lock: "M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3m-4 4v3",
  trash: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6",
  grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
} as const;
export type IconName = keyof typeof icons;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icons[name]} />
    </svg>
  );
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        T
      </span>
      <span>Tessera</span>
    </div>
  );
}

export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={error ? "notice notice--error" : "notice"}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function ConnectionScreen({ failed = false }: { failed?: boolean }) {
  return (
    <main className="entry entry--login">
      <header className="entry-top">
        <Brand />
      </header>
      <section className="entry-card stack">
        <h1>{failed ? "Не вдалося підключитися" : "Підключаємо Tessera"}</h1>
        <Notice error={failed}>
          {failed
            ? "Перевірте, чи доступний Keycloak, і спробуйте ще раз."
            : "Перевіряємо сеанс входу…"}
        </Notice>
        {failed && (
          <button
            className="button button--primary self-start"
            onClick={() => location.reload()}
          >
            Спробувати ще раз
          </button>
        )}
      </section>
    </main>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="button button--icon"
          aria-label="Закрити"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
