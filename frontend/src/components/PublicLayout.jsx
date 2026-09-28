import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useLanguage } from '../i18n'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

// Frame for every public page (and the portal login and "application received" pages).
export default function PublicLayout() {
  const { lang, t } = useLanguage()

  // Tells browsers and screen readers which language the page is in. The portal is English.
  useEffect(() => {
    document.documentElement.lang = lang
    return () => {
      document.documentElement.lang = 'en'
    }
  }, [lang])

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {t.nav.skipToContent}
      </a>
      <SiteHeader />
      <main className="app-main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
