import { Component } from 'react'

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
    return (
      <main className="crash-page">
        <a href="/" className="crash-logo">
          <img src="/square-roots-logo.png" alt="Square Roots home" />
        </a>
        <h1>Something went wrong</h1>
        <p>Sorry, this page didn’t load properly.</p>
        <p>Try loading the page again. If it keeps happening, please let us know at squareroots@enactussmu.ca.</p>
        <div className="crash-buttons">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Load the page again
          </button>
          <a href="/" className="btn">
            Go to the home page
          </a>
        </div>
      </main>
    )
  }
}
