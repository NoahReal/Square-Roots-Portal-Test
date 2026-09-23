import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ROLES } from '../roles'
import SiteFooter from './SiteFooter'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = ROLES[user.role]

  async function handleLogout() {
    await logout()
    navigate('/portal/login')
  }

  // Only show the phone tab bar if there's more than one screen to switch between.
  const tabs = role.nav.filter((item) => item.inTabBar !== false)
  const showTabs = tabs.length > 1

  return (
    <div className={'app' + (showTabs ? ' has-tab-bar' : '')}>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to={role.home} className="brand">
            <img src="/square-roots-logo.png" alt="Square Roots" />
            <span className="brand-label">
              Partner Portal
              <small>{role.label}</small>
            </span>
          </Link>

          <nav className="top-nav" aria-label="Main">
            {role.nav.map((item) => (
              <NavLink key={item.to} to={item.to} end>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="user-menu">
            <Link to="/" className="main-site-link">
              Main site
            </Link>
            <span className="user-menu-name">
              {user.first_name} {user.last_name}
              <small>{user.role_label}</small>
            </span>
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

      <SiteFooter />

      {showTabs && (
        <nav className="tab-bar" aria-label="Main">
          {tabs.map((item) => (
            <NavLink key={item.to} to={item.to} end>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
