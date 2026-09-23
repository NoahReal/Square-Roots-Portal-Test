import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { ROLES, homeFor } from './roles'

// Public website (same addresses as squarerootssmu.ca)
import PublicLayout from './components/PublicLayout'
import HomePage from './pages/site/HomePage'
import AboutPage from './pages/site/AboutPage'
import LocationsPage from './pages/site/LocationsPage'
import ForFarmsPage from './pages/site/ForFarmsPage'
import BecomeCommunityManagerPage from './pages/site/BecomeCommunityManagerPage'
import EventsPage from './pages/site/EventsPage'
import ContactPage from './pages/site/ContactPage'
import SignupChooserPage from './pages/site/SignupChooserPage'
import SignupPage from './pages/site/SignupPage'

// Partner portal (everything under /portal)
import Layout from './components/Layout'
import LoginPage from './pages/portal/LoginPage'
import PendingPage from './pages/portal/PendingPage'
import PortalHomePage from './pages/portal/PortalHomePage'
import ComingSoonPage from './pages/portal/ComingSoonPage'
import ApiPage from './pages/portal/ApiPage'
import SignupsPage from './pages/portal/SignupsPage'
import ProducePage from './pages/portal/farm/ProducePage'
import PickupsPage from './pages/portal/farm/PickupsPage'

// Only lets an approved, logged-in user with the right role through.
function RequireRole({ role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/portal/login" replace />
  if (user.status !== 'approved' || user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

// Which page component to show for each portal menu item. As screens get built,
// add them here, e.g.  if (item.to === '/portal/admin/cycles') return <DropCyclesPage />
function pageFor(item, roleConfig) {
  if (item.to === roleConfig.home) return <PortalHomePage />
  if (item.to === '/portal/admin/signups') return <SignupsPage />
  if (item.to === '/portal/admin/api') return <ApiPage />
  if (item.to === '/portal/farm/produce') return <ProducePage />
  if (item.to === '/portal/farm/pickups') return <PickupsPage />
  return <ComingSoonPage item={item} />
}

// Start each new page at the top, like a normal website.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { user, checking } = useAuth()
  if (checking) return null

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/drop-dates-locations" element={<LocationsPage />} />
          <Route path="/for-farms" element={<ForFarmsPage />} />
          <Route path="/become-a-community-manager" element={<BecomeCommunityManagerPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/contact-us" element={<ContactPage />} />
          <Route path="/signup" element={<SignupChooserPage />} />
          <Route path="/signup/:roleSlug" element={<SignupPage />} />

          <Route path="/portal/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
          <Route path="/portal/pending" element={<PendingPage />} />
        </Route>

        <Route path="/portal" element={<Navigate to={user ? homeFor(user) : '/portal/login'} replace />} />

        {Object.entries(ROLES).map(([role, config]) => (
          <Route key={role} element={<RequireRole role={role} />}>
            <Route element={<Layout />}>
              {config.nav.map((item) => (
                <Route key={item.to} path={item.to} element={pageFor(item, config)} />
              ))}
            </Route>
          </Route>
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
