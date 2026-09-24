import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

// "Bring Square Roots to my area": for people with no location nearby.
// Requests are grouped by area for the team (admin screen: Location Requests).
export default function RequestLocationPage() {
  const [form, setForm] = useState({ email: '', postal_code: '', town: '', note: '', could_help: false })
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (event) => {
    const { name, type, checked, value } = event.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
    if (errors[name]) setErrors({ ...errors, [name]: undefined })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      setSent(await api('/area-requests/', { method: 'POST', body: form }))
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
    }
    setBusy(false)
  }

  const errorFor = (name) => errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>

  return (
    <>
      <section className="title-block title-block-compact">
        <h1>Bring Square Roots to Your Area</h1>
        <p>No location near you yet? Tell us where you are. When enough people ask, we look for someone to start one.</p>
      </section>

      <section className="section">
        <div className="container container-narrow">
          {sent ? (
            <div className="notice notice-success" role="status">
              Thank you! We’ve added {sent.area} to the list and we’ll email you if a location opens nearby.{' '}
              {form.could_help && 'Since you said you could help, someone from the team will be in touch. '}
              <Link to="/drop-dates-locations">See current locations</Link>
            </div>
          ) : (
            <form className="request-form" onSubmit={handleSubmit} noValidate>
              {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
              <div className={'field' + (errors.postal_code ? ' has-error' : '')}>
                <label htmlFor="req-postal">
                  Postal code <span className="field-hint">(or just the first part, like B3H)</span>
                </label>
                <input id="req-postal" name="postal_code" autoComplete="postal-code" autoCapitalize="characters" value={form.postal_code} onChange={update} />
                {errorFor('postal_code')}
              </div>
              <div className="field">
                <label htmlFor="req-town">
                  Town or neighbourhood <span className="field-hint">(optional)</span>
                </label>
                <input id="req-town" name="town" value={form.town} onChange={update} />
              </div>
              <div className={'field' + (errors.email ? ' has-error' : '')}>
                <label htmlFor="req-email">
                  Email <span className="field-hint">(so we can tell you if a location opens)</span>
                </label>
                <input id="req-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} />
                {errorFor('email')}
              </div>
              <label className="check check-with-hint">
                <input type="checkbox" name="could_help" checked={form.could_help} onChange={update} />
                <span>
                  I could help run or host a location
                  <span className="field-hint"> Community Managers run drops every two weeks, with support from our team.</span>
                </span>
              </label>
              <div className="field">
                <label htmlFor="req-note">
                  Anything else? <span className="field-hint">(optional)</span>
                </label>
                <textarea id="req-note" name="note" rows={3} maxLength={500} value={form.note} onChange={update} />
              </div>
              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Sending…' : 'Ask for a location'}
              </button>
              <p className="form-footnote">
                We keep your email and postal code only for this. <Link to="/privacy">Privacy</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
