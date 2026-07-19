import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { JoinSession } from './features/session/JoinSession'
import { StudentLobby } from './features/student/StudentLobby'
import { StudentQuiz } from './features/student/StudentQuiz'
import { PresenterAuth } from './features/presenter/PresenterAuth'
import { PresenterDashboard } from './features/presenter/PresenterDashboard'
import { PresenterLobby } from './features/presenter/PresenterLobby'
import { PresenterQuiz } from './features/presenter/PresenterQuiz'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Student View Routes */}
          <Route path="/" element={<JoinSession />} />
          <Route path="/session/:code/lobby" element={<StudentLobby />} />
          <Route path="/session/:code/quiz" element={<StudentQuiz />} />

          {/* Presenter View Routes */}
          <Route path="/presenter/auth" element={<PresenterAuth />} />
          <Route path="/presenter/dashboard" element={<PresenterDashboard />} />
          <Route path="/presenter/session/:code/lobby" element={<PresenterLobby />} />
          <Route path="/presenter/session/:code/quiz" element={<PresenterQuiz />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
