import { Brand, Icon } from "./ui";
import "./Welcome.css";

const demoColumns = [
  {
    title: "Заплановано",
    tone: "planned",
    tasks: ["Зібрати вимоги", "Узгодити макет"],
  },
  { title: "У роботі", tone: "active", tasks: ["Підготувати демо"] },
  {
    title: "Виконано",
    tone: "done",
    tasks: ["Створити дошку", "Додати команду"],
  },
] as const;

const features = [
  {
    icon: "board",
    title: "Kanban-дошка",
    detail: "Робота команди на одному екрані",
  },
  {
    icon: "calendar",
    title: "Дедлайни",
    detail: "Найближчі терміни в одному місці",
  },
  {
    icon: "team",
    title: "Ролі в команді",
    detail: "Доступ відповідно до ролі",
  },
] as const;

export function Welcome({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="welcome">
      <div className="welcome-atmosphere" aria-hidden="true">
        <div className="welcome-grid" />
        <div className="welcome-glow" />
        <div className="welcome-orbit welcome-orbit--inner" />
        <div className="welcome-orbit welcome-orbit--outer" />
      </div>
      <div className="welcome-frame">
        <header className="welcome-top">
          <Brand />
        </header>
        <section className="welcome-hero" aria-labelledby="welcome-title">
          <div className="welcome-intro">
            <p className="welcome-kicker">Простір для командної роботи</p>
            <h1 id="welcome-title">
              Команда на
              <br /> одній дошці<span>.</span>
            </h1>
            <p className="welcome-description">
              Розподіляйте задачі, обговорюйте рішення в картках і бачте, що
              зараз у роботі, а що вже готово.
            </p>
            <button className="welcome-login" type="button" onClick={onLogin}>
              <Icon name="lock" /> Увійти в Tessera
            </button>
          </div>
          <figure className="welcome-preview">
            <figcaption className="welcome-preview-header">
              <span className="welcome-preview-icon">
                <Icon name="board" />
              </span>
              <div>
                <h2>Дошка проєкту</h2>
                <p>Приклад робочого простору</p>
              </div>
            </figcaption>
            <div className="welcome-preview-columns">
              {demoColumns.map(({ title, tone, tasks }) => (
                <div
                  className={`welcome-preview-column welcome-preview-column--${tone}`}
                  key={tone}
                >
                  <h3>
                    <i aria-hidden="true" />
                    {title}
                  </h3>
                  {tasks.map((task) => (
                    <div className="welcome-preview-task" key={task}>
                      {task}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </figure>
        </section>
        <ul className="welcome-features" aria-label="Можливості Tessera">
          {features.map(({ icon, title, detail }) => (
            <li key={icon}>
              <span className="welcome-feature-icon">
                <Icon name={icon} />
              </span>
              <div>
                <strong>{title}</strong>
                <p>{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
