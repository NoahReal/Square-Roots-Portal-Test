import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ROLES, menuFor } from '../roles'
import SiteFooter from './SiteFooter'

export default function Layout() {
  const { user, logout, demoMode } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const role = ROLES[user.role]
  const { main, more } = menuFor(role)

  async function handleLogout() {
    await logout()
    navigate('/portal/login')
  }

  // Only show the phone tab bar if there's more than one screen to switch between.
  const showTabs = main.length > 1
  const moreIsActive = more.some((item) => pathname.startsWith(item.to))

  return (
    <div className={'app' + (showTabs ? ' has-tab-bar' : '')}>
      {demoMode && <DemoBanner />}
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand">
            {/* The logo is the way back to the main Square Roots website. */}
            <Link to="/">
              <img src="/square-roots-logo.png" alt="Square Roots website" />
            </Link>
            <span className="brand-label">
              Partner Portal
              <small>{role.label}</small>
            </span>
          </div>

          <nav className="top-nav" aria-label="Main">
            {main.map((item) => (
              <NavLink key={item.to} to={item.to} end>
                {item.label}
              </NavLink>
            ))}
            {more.length > 0 && (
              <div className={'top-nav-more' + (moreIsActive ? ' active' : '')}>
                <button className="top-nav-more-label" aria-haspopup="true">
                  More
                </button>
                <div className="top-nav-more-menu">
                  {more.map((item) => (
                    <NavLink key={item.to} to={item.to} end>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </nav>

          <div className="user-menu">
            <Link to="/portal/account" className="user-menu-name">
              <span className="user-menu-full">
                {user.first_name} {user.last_name}
              </span>
              <small>My account</small>
            </Link>
            <button className="btn btn-small" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="green-band" />

      <main className="app-main">
        <Outlet />
      </main>

      <SiteFooter inPortal />

      {showTabs && (
        <nav className="tab-bar" aria-label="Main">
          {main.map((item) => (
            <NavLink key={item.to} to={item.to} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <strong>Demo</strong> · The people, farms and numbers here are made up to show how the portal works. The locations
      are real.
    </div>
  )
}
