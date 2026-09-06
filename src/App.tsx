import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'

// Lazy load feature components
const JoinSession = lazy(() => import('./features/session/JoinSession').then(m => ({ default: m.JoinSession })))
const StudentLobby = lazy(() => import('./features/student/StudentLobby').then(m => ({ default: m.StudentLobby })))
const StudentQuiz = lazy(() => import('./features/student/StudentQuiz').then(m => ({ default: m.StudentQuiz })))
const PresenterAuth = lazy(() => import('./features/presenter/PresenterAuth').then(m => ({ default: m.PresenterAuth })))
const PresenterDashboard = lazy(() => import('./features/presenter/PresenterDashboard').then(m => ({ default: m.PresenterDashboard })))
const PresenterLobby = lazy(() => import('./features/presenter/PresenterLobby').then(m => ({ default: m.PresenterLobby })))
const PresenterQuiz = lazy(() => import('./features/presenter/PresenterQuiz').then(m => ({ default: m.PresenterQuiz })))

// Common loading spinner
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0d0f14] text-white">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-[#6366f1] border-t-transparent animate-spin" />
      <span className="text-xs font-semibold text-gray-400">Loading Yalcit...</span>
    </div>
  </div>
)

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Student View Routes */}
            <Route path="/" element={<JoinSession />} />
            <Route path="/session/:code" element={<JoinSession />} />
            <Route path="/session/:code/lobby" element={<StudentLobby />} />
            <Route path="/session/:code/quiz" element={<StudentQuiz />} />

            {/* Presenter View Routes */}
            <Route path="/presenter/auth" element={<PresenterAuth />} />
            <Route path="/presenter/dashboard" element={<PresenterDashboard />} />
            <Route path="/presenter/session/:code/lobby" element={<PresenterLobby />} />
            <Route path="/presenter/session/:code/quiz" element={<PresenterQuiz />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  )
}

export default App
