
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MasterDashboard from './pages/MasterDashboard'
import GameRoom from './pages/GameRoom'
import PlayerDashboard from './pages/PlayerDashboard'
import { AuthProvider, useAuth } from './auth/AuthContext'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-[#ECE4D9] text-sm font-semibold text-[#9B683A]">Загружаем аккаунт…</main>
  return user ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/player" element={<ProtectedRoute><PlayerDashboard /></ProtectedRoute>} />
        <Route path="/master" element={<ProtectedRoute><MasterDashboard /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><GameRoom /></ProtectedRoute>} />
      </Routes>
      </AuthProvider>
    </HashRouter>
  )
}

export default App

