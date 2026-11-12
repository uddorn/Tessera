import './App.css'

function App() {
  return (
    <main>
      <p className="eyebrow">Tessera · Sprint 1</p>
      <h1>Дипломна платформа починається зі стабільного ядра</h1>
      <p className="lead">
        Монорепозиторій уже розділяє React Boundary, NestJS API та спільні Zod-контракти.
      </p>
      <section className="grid">
        <article><span>apps/web</span><h2>React 19 + Vite</h2><p>Межовий шар майбутньої Kanban SPA.</p></article>
        <article><span>apps/api</span><h2>NestJS + Domain</h2><p>WIP policy, State та фабрика сповіщень.</p></article>
        <article><span>packages/shared</span><h2>Zod contracts</h2><p>Єдині типи команд, DTO та доменних подій.</p></article>
      </section>
      <p className="next">Наступний крок: Docker-інфраструктура на домашньому WSL.</p>
    </main>
  )
}

export default App
