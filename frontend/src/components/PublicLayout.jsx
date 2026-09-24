import { Outlet } from 'react-router-dom'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

// Frame for every public page (and the portal login and "application received" pages).
export default function PublicLayout() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      <main className="app-main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}
