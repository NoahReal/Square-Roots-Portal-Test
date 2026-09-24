import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
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
import NotFoundPage from './pages/site/NotFoundPage'
import ReservePage from './pages/site/ReservePage'
import ManageReservationPage from './pages/site/ManageReservationPage'
import BundlePage from './pages/site/BundlePage'
import PrivacyPage from './pages/site/PrivacyPage'
import HostReservePage from './pages/portal/host/HostReservePage'

// Partner portal (everything under /portal)
import Layout from './components/Layout'
import LoginPage from './pages/portal/LoginPage'
import PendingPage from './pages/portal/PendingPage'
import ForgotPasswordPage from './pages/portal/ForgotPasswordPage'
import ResetPasswordPage from './pages/portal/ResetPasswordPage'
import AccountPage from './pages/portal/AccountPage'
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
import PeoplePage from './pages/portal/admin/PeoplePage'
import AdminHomePage from './pages/portal/admin/AdminHomePage'
import ManagerHomePage from './pages/portal/manager/ManagerHomePage'
import FarmHomePage from './pages/portal/farm/FarmHomePage'
import AdminLocationsPage from './pages/portal/admin/LocationsPage'
import AdminEventsPage from './pages/portal/admin/EventsPage'
import MoneyPage from './pages/portal/admin/MoneyPage'
import PackingPage from './pages/portal/admin/PackingPage'
import SettingsPage from './pages/portal/admin/SettingsPage'

// Only lets an approved, logged-in user with the right role through.
function RequireRole({ role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/portal/login" replace />
  if (user.status !== 'approved' || user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

// Which page component shows for each portal menu item (the menus are in roles.js).
const PAGES = {
  '/portal/admin': AdminHomePage,
  '/portal/manager': ManagerHomePage,
  '/portal/farm': FarmHomePage,
  '/portal/admin/signups': SignupsPage,
  '/portal/admin/cycles': DropCyclesPage,
  '/portal/admin/orders': OrdersPage,
  '/portal/admin/farms': FarmsPage,
  '/portal/admin/impact': ImpactPage,
  '/portal/admin/api': ApiPage,
  '/portal/admin/people': PeoplePage,
  '/portal/admin/locations': AdminLocationsPage,
  '/portal/admin/events': AdminEventsPage,
  '/portal/admin/money': MoneyPage,
  '/portal/admin/packing': PackingPage,
  '/portal/admin/settings': SettingsPage,
  '/portal/manager/order': OrderPage,
  '/portal/manager/preorders': PreordersPage,
  '/portal/manager/after-drop': AfterDropPage,
  '/portal/farm/produce': ProducePage,
  '/portal/farm/pickups': PickupsPage,
  '/portal/host': HostDropsPage,
  '/portal/host/reserve': HostReservePage,
}

function pageFor(item) {
  const Page = PAGES[item.to]
  return <Page />
}

// Only lets an approved, logged-in user through (any role). Used for My Account.
function RequireApproved() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/portal/login" replace />
  if (user.status !== 'approved') return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

// Browser tab titles for the public pages, like the live site ("About | Square Roots").
const PUBLIC_TITLES = {
  '/': 'Home',
  '/about': 'About',
  '/drop-dates-locations': 'Drop Dates & Locations',
  '/for-farms': 'For Farms',
  '/become-a-community-manager': 'Become a Community Manager',
  '/events': 'Events',
  '/contact-us': 'Contact Us',
  '/reserve': 'Reserve a Bundle',
  '/whats-in-the-bundle': 'What’s in the Bundle',
  '/privacy': 'Privacy',
  '/signup': 'Partner Sign-up',
  '/portal/login': 'Log in',
  '/portal/pending': 'Application received',
  '/portal/forgot-password': 'Forgot password',
  '/portal/reset-password': 'Choose a new password',
  '/portal/account': 'My account',
}

function titleFor(pathname) {
  if (pathname.startsWith('/signup/')) return 'Partner Sign-up | Square Roots'
  if (pathname.startsWith('/reserve/manage/')) return 'Your Reservation | Square Roots'
  if (PUBLIC_TITLES[pathname]) {
    return `${PUBLIC_TITLES[pathname]} | Square Roots${pathname.startsWith('/portal') ? ' Partner Portal' : ''}`
  }
  for (const role of Object.values(ROLES)) {
    const item = role.nav.find((i) => i.to === pathname)
    if (item) return `${item.label === 'Home' ? role.label : item.label} | Square Roots Partner Portal`
  }
  return 'Page not found | Square Roots'
}

// Start each new page at the top, like a normal website, and set the browser tab title.
function PageChange() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = titleFor(pathname)
  }, [pathname])
  return null
}

export default function App() {
  const { user, checking } = useAuth()
  const { pathname } = useLocation()
  if (checking) return null

  return (
    <>
      <PageChange />
      <ErrorBoundary resetKey={pathname}>
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
            <Route path="/reserve" element={<ReservePage />} />
            <Route path="/reserve/manage/:token" element={<ManageReservationPage />} />
            <Route path="/whats-in-the-bundle" element={<BundlePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            <Route path="/portal/login" element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
            <Route path="/portal/pending" element={<PendingPage />} />
            <Route path="/portal/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/portal/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
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

          <Route element={<RequireApproved />}>
            <Route element={<Layout />}>
              <Route path="/portal/account" element={<AccountPage />} />
            </Route>
          </Route>
        </Routes>
      </ErrorBoundary>
    </>
  )
}
