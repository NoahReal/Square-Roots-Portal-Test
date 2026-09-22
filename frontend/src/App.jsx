import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { ROLES, homeFor } from './roles'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ComingSoonPage from './pages/ComingSoonPage'
import ApiPage from './pages/ApiPage'

// Only lets a logged-in user with the right role through.
function RequireRole({ role }) {
  const { user, checking } = useAuth()
  if (checking) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

// Which page component to show for each menu item. As screens get built,
// add them here, e.g.  if (item.to === '/admin/cycles') return <DropCyclesPage />
function pageFor(item, roleConfig) {
  if (item.to === roleConfig.home) return <HomePage />
  if (item.to === '/admin/api') return <ApiPage />
  return <ComingSoonPage item={item} />
}

export default function App() {
  const { user, checking } = useAuth()
  if (checking) return null

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />

      {Object.entries(ROLES).map(([role, config]) => (
        <Route key={role} element={<RequireRole role={role} />}>
          <Route element={<Layout />}>
            {config.nav.map((item) => (
              <Route key={item.to} path={item.to} element={pageFor(item, config)} />
            ))}
          </Route>
        </Route>
      ))}

      <Route path="*" element={<Navigate to={user ? homeFor(user) : '/login'} replace />} />
    </Routes>
  )
}
