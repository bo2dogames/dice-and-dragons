import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'player' | 'master'>('player')
  const [error, setError] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const signedIn = await signUp({ displayName, email, password, role })
      if (signedIn) navigate('/dashboard', { replace: true })
      else setConfirmationSent(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось создать аккаунт. Попробуйте ещё раз.')
    } finally { setBusy(false) }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#ECE4D9] px-4 py-10"><div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg md:p-10">
    <Link to="/" className="text-sm text-gray-500 hover:text-[#E69A51]">← На главную</Link>
    <h1 className="mt-8 text-3xl font-bold text-[#292724]">Создай аккаунт</h1><p className="mt-2 text-gray-500">Твоё приключение начинается здесь.</p>
    {confirmationSent && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">Аккаунт создан. Подтверди адрес по ссылке из письма, затем войди.</p>}
    <form onSubmit={handleRegister} className="mt-8 space-y-5">
      <label className="block text-sm font-medium">Имя пользователя<input required minLength={2} maxLength={40} autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Например, DragonMaster" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#E69A51]" /></label>
      <label className="block text-sm font-medium">Электронная почта<input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#E69A51]" /></label>
      <label className="block text-sm font-medium">Я буду играть как<select value={role} onChange={(event) => setRole(event.target.value as 'player' | 'master')} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#E69A51]"><option value="player">Игрок</option><option value="master">Мастер</option></select></label>
      <label className="block text-sm font-medium">Пароль<input required minLength={10} maxLength={200} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Не менее 10 символов" className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#E69A51]" /></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#E69A51] py-3 font-semibold text-white transition hover:bg-[#D8873D] disabled:opacity-60">{busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}</button>
    </form>
    <p className="mt-6 text-center text-sm text-gray-500">Уже есть аккаунт? <Link to="/login" className="font-semibold text-[#D8873D]">Войти</Link></p>
  </div></main>
}
export default Register
