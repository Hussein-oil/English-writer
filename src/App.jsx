import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Welcome from './pages/Welcome'
import Input from './pages/Input'
import Analysis from './pages/Analysis'
import Chat from './pages/Chat'
import Reader from './pages/Reader'

function GuardedRoute({ children }) {
  const { isConfigured } = useApp()
  return isConfigured ? children : <Navigate to="/" replace />
}

function WelcomeRoute() {
  const { isConfigured } = useApp()
  return isConfigured ? <Navigate to="/input" replace /> : <Welcome />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeRoute />} />
      <Route path="/input" element={<GuardedRoute><Input /></GuardedRoute>} />
      <Route path="/analysis" element={<GuardedRoute><Analysis /></GuardedRoute>} />
      <Route path="/chat" element={<GuardedRoute><Chat /></GuardedRoute>} />
      <Route path="/reader" element={<GuardedRoute><Reader /></GuardedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
