import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../auth'
import { homeFor } from '../roles'
import { LanguageButtons, useLanguage } from '../i18n'
import { MenuIcon } from './Icons'

// The same menu as squarerootssmu.ca, plus Partner Portal links. Labels are in siteWords.js (nav).
const GET_INVOLVED = [
  { to: '/for-farms', label: 'forFarms' },
  { to: '/become-a-community-manager', label: 'becomeCm' },
  { to: '/signup/host-site', label: 'hostDrop' },
  { to: '/signup', label: 'partnerSignup' },
]

export default function SiteHeader() {
  const { user } = useAuth()
  const { t } = useLanguage()
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
          <img src="/square-roots-logo.png" alt={t.nav.logoAlt} />
        </Link>

        {/* On every page and every screen size, so French speakers find it straight away */}
        <div className="header-language">
          <LanguageButtons short />
        </div>

        <button
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <MenuIcon open={menuOpen} />
          <span className="visually-hidden">{t.nav.menu}</span>
        </button>

        <nav id="site-menu" className={'public-nav' + (menuOpen ? ' open' : '')} aria-label={t.nav.main}>
          <NavLink to="/about">{t.nav.about}</NavLink>
          <NavLink to="/drop-dates-locations">{t.nav.dropDates}</NavLink>
          <div className="nav-dropdown">
            <button className="nav-dropdown-label" aria-haspopup="true">
              {t.nav.getInvolved}
            </button>
            <div className="nav-dropdown-menu">
              {GET_INVOLVED.map((item) => (
                <NavLink key={item.to} to={item.to} end>
                  {t.nav[item.label]}
                </NavLink>
              ))}
            </div>
          </div>
          <NavLink to="/events">{t.nav.events}</NavLink>
          <NavLink to="/contact-us">{t.nav.contactUs}</NavLink>
          <Link to="/reserve" className="btn btn-yellow btn-small portal-button reserve-button">
            {t.nav.reserve}
          </Link>
          <Link to={portalLink} className="btn btn-primary btn-small portal-button">
            {t.nav.partnerPortal}
          </Link>
        </nav>
      </div>
    </header>
  )
}
