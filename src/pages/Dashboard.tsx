
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Dashboard() {
      const navigate = useNavigate()
  const { user, signOut } = useAuth()
  return (
    <main className="min-h-screen bg-[#ECE4D9] text-[#292724]">

      <header className="flex items-center justify-between bg-white px-8 py-5">
        <Link to="/" className="text-2xl font-bold">
          Dice <span className="text-[#E69A51]">&</span> Dragons
        </Link>

        <div className="flex items-center gap-4"><span className="hidden text-sm text-gray-500 sm:inline">{user?.displayName} · {user?.email}</span><button onClick={async () => { await signOut(); navigate('/') }} className="text-sm text-gray-500 hover:text-[#E69A51]">Выйти</button></div>
      </header>
      
      <section className="mx-auto max-w-6xl px-6 py-16">

        <p className="font-medium uppercase tracking-widest text-[#B87839]">
          Your adventure awaits
        </p>

        <h1 className="mt-3 text-4xl font-bold">
          Добро пожаловать!
        </h1>

        <p className="mt-4 text-gray-600">
          Выбери, кем ты хочешь стать в своём приключении.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-2">

          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="text-5xl">🐉</div>

            <h2 className="mt-6 text-2xl font-bold">
              Dungeon Master
            </h2>

            <p className="mt-4 leading-relaxed text-gray-600">
              Создавай собственные миры, управляй монстрами,
              придумывай задания и веди игроков через
              невероятные приключения.
            </p>

            <button
  onClick={() => navigate('/master')}
  className="mt-8 w-full rounded-xl bg-[#E69A51] py-3 font-semibold text-white transition hover:bg-[#D8873D]"
>
  Стать мастером
</button>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow-sm">
            <div className="text-5xl">⚔️</div>

            <h2 className="mt-6 text-2xl font-bold">
              Player
            </h2>

            <p className="mt-4 leading-relaxed text-gray-600">
              Создай собственного героя, вступай в кампании,
              исследуй фантастические миры и сражайся
              вместе с друзьями.
            </p>

            <button onClick={() => navigate('/player')} className="mt-8 w-full rounded-xl bg-[#292724] py-3 font-semibold text-white transition hover:bg-[#45413C]">
              Стать героем
            </button>
          </div>

        </div>

      </section>

    </main>
  )
}

export default Dashboard
