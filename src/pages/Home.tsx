import { useState } from 'react'
import { Link } from 'react-router-dom'
function Home() {
      const [diceResult, setDiceResult] = useState<number | null>(null)

  function rollDice() {
    const result = Math.floor(Math.random() * 20) + 1
    setDiceResult(result)
  }
  return (
    <main className="min-h-screen bg-[#ECE4D9] text-[#292724]">
      {/* Навигация */}
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="text-2xl font-bold">
          Dice <span className="text-[#E69A51]">&</span> Dragons
        </h1>

        <nav className="flex items-center gap-6">
          <a href="#about" className="hover:text-[#E69A51]">
            О платформе
          </a>

          <a href="#rules" className="hover:text-[#E69A51]">
            Правила
          </a>

          <Link
  to="/login"
  className="rounded-xl border border-[#292724] px-5 py-2 hover:bg-white"
>
  Войти
</Link>
        </nav>
      </header>

      {/* Главный экран */}
      <section className="mx-auto flex max-w-6xl flex-col items-center px-6 py-28 text-center">
        <p className="mb-5 font-medium uppercase tracking-[0.25em] text-[#B87839]">
          Your adventure begins here
        </p>

        <h2 className="max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
          Создай свою историю.
          <br />
          <span className="text-[#E69A51]">
            Стань её героем.
          </span>
        </h2>

        <p className="mt-8 max-w-2xl text-lg text-gray-600">
          Погрузись в мир Dungeons & Dragons.
          Создавай персонажей, исследуй миры и отправляйся
          в приключения вместе с друзьями.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
  to="/register"
  className="rounded-xl bg-[#E69A51] px-8 py-4 font-semibold text-white transition hover:bg-[#D8873D]"
>
  Начать приключение
</Link>

          <button className="rounded-xl border border-[#292724] px-8 py-4 font-semibold transition hover:bg-white">
            Узнать больше
          </button>
        </div>
      </section>

      
{/* О платформе */}
<section id="about" className="bg-white px-6 py-24">
  <div className="mx-auto max-w-6xl">

    <div className="text-center">
      <p className="font-medium uppercase tracking-widest text-[#B87839]">
        Discover D&D
      </p>

      <h2 className="mt-3 text-4xl font-bold">
        Что такое Dungeons & Dragons?
      </h2>

      <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-gray-600">
        Это настольная ролевая игра, в которой ты создаёшь
        собственного героя, исследуешь фантастические миры,
        сражаешься с монстрами и вместе с друзьями создаёшь
        уникальную историю.
      </p>
    </div>

    <div className="mt-16 grid gap-8 md:grid-cols-3">

      <div className="rounded-2xl bg-[#ECE4D9] p-8">
        <div className="text-4xl">⚔️</div>
        <h3 className="mt-5 text-xl font-bold">
          Создай героя
        </h3>
        <p className="mt-3 leading-relaxed text-gray-600">
          Выбери расу, класс, способности и создай
          персонажа со своей историей.
        </p>
      </div>

      <div className="rounded-2xl bg-[#ECE4D9] p-8">
        <div className="text-4xl">🎲</div>
        <h3 className="mt-5 text-xl font-bold">
          Бросай кубики
        </h3>
        <p className="mt-3 leading-relaxed text-gray-600">
          Проверяй свои навыки, атакуй противников
          и решай судьбу приключения.
        </p>
      </div>

      <div className="rounded-2xl bg-[#ECE4D9] p-8">
        <div className="text-4xl">🐉</div>
        <h3 className="mt-5 text-xl font-bold">
          Исследуй мир
        </h3>
        <p className="mt-3 leading-relaxed text-gray-600">
          Отправляйся в путешествия, встречай
          персонажей и сражайся с чудовищами.
        </p>
      </div>

    </div>
  </div>
</section>

{/* Демонстрация кубика */}
<section id="dice" className="bg-[#ECE4D9] px-6 py-24">
  <div className="mx-auto max-w-3xl text-center">

    <p className="font-medium uppercase tracking-widest text-[#B87839]">
      Try your luck
    </p>

    <h2 className="mt-3 text-4xl font-bold">
      Испытай свою удачу
    </h2>

    <p className="mt-5 text-gray-600">
      Брось двадцатигранный кубик и узнай свой результат.
    </p>

    <div className="mt-10">
      <div className="text-8xl font-bold text-[#E69A51]">
        🎲
      </div>

      <p className="mt-6 text-5xl font-bold">
  {diceResult ?? '?'}
</p>

      <button
  onClick={rollDice}
  className="mt-8 rounded-xl bg-[#E69A51] px-10 py-4 font-semibold text-white transition hover:bg-[#D8873D]"
>
  Бросить D20
</button>
    </div>

  </div>
</section>


      <footer className="px-6 py-8 text-center text-sm text-gray-500">
        © 2026 Dice & Dragons
      </footer>
    </main>
  )
}

export default Home
