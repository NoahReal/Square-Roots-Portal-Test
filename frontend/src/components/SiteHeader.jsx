import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { homeFor } from '../roles'
import { MenuIcon } from './Icons'

// The same menu as squarerootssmu.ca, plus Partner Portal links.
const GET_INVOLVED = [
  { to: '/for-farms', label: 'For Farms' },
  { to: '/become-a-community-manager', label: 'Become a Community Manager' },
  { to: '/signup/host-site', label: 'Host a Drop' },
  { to: '/signup', label: 'Partner Sign-up' },
]

export default function SiteHeader() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the phone menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const portalLink = user ? homeFor(user) : '/portal/login'

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link to="/" className="public-logo">
          <img src="/square-roots-logo.png" alt="Square Roots home" />
        </Link>

        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MenuIcon open={menuOpen} />
          <span className="visually-hidden">Menu</span>
        </button>

        <nav id="site-menu" className={'public-nav' + (menuOpen ? ' open' : '')} aria-label="Main">
          <NavLink to="/about">About</NavLink>
          <NavLink to="/drop-dates-locations">Drop Dates &amp; Locations</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-label" aria-haspopup="true">
              Get Involved
            </button>
            <div className="nav-dropdown-menu">
              {GET_INVOLVED.map((item) => (
                <NavLink key={item.to} to={item.to} end>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <NavLink to="/events">Events</NavLink>
          <NavLink to="/contact-us">Contact Us</NavLink>
          <Link to="/reserve" className="btn btn-yellow btn-small portal-button reserve-button">
            Reserve a Bundle
          </Link>
          <Link to={portalLink} className="btn btn-primary btn-small portal-button">
            Partner Portal
          </Link>
        </nav>
      </div>
    </header>
  )
}
