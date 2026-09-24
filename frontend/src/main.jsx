import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import { LanguageProvider } from './i18n'
import { SiteTextProvider } from './siteText'
import './theme.css'
import './styles.css'
import './public.css'
import './farm.css'
import './screens.css'
import './dashboard.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <SiteTextProvider>
            <App />
          </SiteTextProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
