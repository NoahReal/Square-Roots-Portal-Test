import { Component } from 'react'
import { wordsFor } from '../i18n'

// If a page crashes, show a friendly screen instead of a blank page.
// Going to another page (a new `resetKey`) clears the error.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Shows up in the browser's developer console, for whoever is fixing it.
    console.error('Page crashed:', error, info.componentStack)
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    // In the language the page was showing (the portal is always English)
    const words = wordsFor(document.documentElement.lang)
    const t = words.crash
    return (
      <main className="crash-page">
        <a href="/" className="crash-logo">
          <img src="/square-roots-logo.png" alt={words.nav.logoAlt} />
        </a>
        <h1>{t.title}</h1>
        <p>{t.sorry}</p>
        <p>{t.tryAgain}</p>
        <div className="crash-buttons">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            {t.reload}
          </button>
          <a href="/" className="btn">
            {t.home}
          </a>
        </div>
      </main>
    )
  }
}
