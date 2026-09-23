import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

// "Forgot your password?": we email a link for choosing a new one.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!email.trim()) {
      setError('Enter the email address on your account.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await api('/auth/password-reset/', { method: 'POST', body: { email } })
      setSent(result.detail)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <>
      <section className="title-block title-block-left">
        <h1>Forgot your password?</h1>
        <p>Enter the email address on your partner portal account and we'll send you a link to choose a new one.</p>
      </section>
      <section className="section">
        <div className="container container-narrow">
          {sent ? (
            <div className="block block-white">
              <div className="notice notice-success" role="status">
                {sent}
              </div>
              <p>
                The link works once. The email also reminds you of your username. If nothing arrives in a few minutes,
                check your spam folder or email us at{' '}
                <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>.
              </p>
              <Link to="/portal/login" className="btn">
                Back to log in
              </Link>
            </div>
          ) : (
            <form className="block block-white narrow-form" onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="notice notice-error" role="alert">
                  {error}
                </div>
              )}
              <div className="field">
                <label htmlFor="reset-email">Email</label>
                <input id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Sending…' : 'Email me a link'}
              </button>
              <p className="form-footnote">
                <Link to="/portal/login">Back to log in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
