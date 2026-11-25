import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn({ email, password })
      const from = (location.state as { from?: string } | null)?.from
      navigate(from || '/dashboard', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось войти. Попробуйте ещё раз.')
    } finally { setBusy(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#ECE4D9] px-4"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg md:p-10">
    <Link to="/" className="text-sm text-gray-500 hover:text-[#E69A51]">← На главную</Link>
    <h1 className="mt-8 text-3xl font-bold text-[#292724]">С возвращением!</h1><p className="mt-2 text-gray-500">Войдите, чтобы продолжить приключение.</p>
    <form onSubmit={handleLogin} className="mt-8 space-y-5">
      <label className="block text-sm font-medium">Электронная почта<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#E69A51]" /></label>
      <label className="block text-sm font-medium">Пароль<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ваш пароль" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#E69A51]" /></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#E69A51] py-3 font-semibold text-white transition hover:bg-[#D8873D] disabled:opacity-60">{busy ? 'Входим…' : 'Войти'}</button>
    </form>
    <p className="mt-6 text-center text-sm text-gray-500">Ещё нет аккаунта? <Link to="/register" className="font-semibold text-[#D8873D]">Зарегистрироваться</Link></p>
  </div></main>
}
export default Login
