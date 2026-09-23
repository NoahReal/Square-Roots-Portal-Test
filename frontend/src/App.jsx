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
import ApiPage from './pages/portal/ApiPage'
import SignupsPage from './pages/portal/SignupsPage'
import ProducePage from './pages/portal/farm/ProducePage'
import PickupsPage from './pages/portal/farm/PickupsPage'
import DropCyclesPage from './pages/portal/admin/DropCyclesPage'
import OrdersPage from './pages/portal/admin/OrdersPage'
import FarmsPage from './pages/portal/admin/FarmsPage'
import ImpactPage from './pages/portal/admin/ImpactPage'
import OrderPage from './pages/portal/manager/OrderPage'
import PreordersPage from './pages/portal/manager/PreordersPage'
import AfterDropPage from './pages/portal/manager/AfterDropPage'
import HostDropsPage from './pages/portal/host/HostDropsPage'

// Only lets an approved, logged-in user with the right role through.
function RequireRole({ role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/portal/login" replace />
  if (user.status !== 'approved' || user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

// Which page component shows for each portal menu item (the menus are in roles.js).
const PAGES = {
  '/portal/admin/signups': SignupsPage,
  '/portal/admin/cycles': DropCyclesPage,
  '/portal/admin/orders': OrdersPage,
  '/portal/admin/farms': FarmsPage,
  '/portal/admin/impact': ImpactPage,
  '/portal/admin/api': ApiPage,
  '/portal/manager/order': OrderPage,
  '/portal/manager/preorders': PreordersPage,
  '/portal/manager/after-drop': AfterDropPage,
  '/portal/farm/produce': ProducePage,
  '/portal/farm/pickups': PickupsPage,
  '/portal/host': HostDropsPage,
}

function pageFor(item) {
  const Page = PAGES[item.to] ?? PortalHomePage
  return <Page />
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
                <Route key={item.to} path={item.to} element={pageFor(item)} />
              ))}
            </Route>
          </Route>
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
