import { useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../auth'
import PageHero from '../../components/PageHero'

// My Account: anyone can change their contact details and password.
export default function AccountPage() {
  const { user } = useAuth()
  const linkedTo = user.site_name || user.farm_name

  return (
    <>
      <PageHero title="My account" lead={`${user.role_label}${linkedTo ? ` · ${linkedTo}` : ''} · username ${user.username}`} />
      <section className="section">
        <div className="container account-layout">
          <DetailsForm />
          <PasswordForm />
        </div>
      </section>
    </>
  )
}

function DetailsForm() {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone,
  })
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const update = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value })
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      refreshUser(await api('/auth/me/', { method: 'PATCH', body: form }))
      setSaved(true)
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  const errorFor = (name) => errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>

  return (
    <form className="block block-white" onSubmit={handleSubmit} noValidate>
      <h2>Your details</h2>
      <p className="muted">The Square Roots team and your partners use these to reach you.</p>
      {saved && (
        <div className="notice notice-success" role="status">
          Saved.
        </div>
      )}
      {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
      <div className="field-row">
        <div className="field">
          <label htmlFor="acc-first">First name</label>
          <input id="acc-first" name="first_name" autoComplete="given-name" value={form.first_name} onChange={update} />
          {errorFor('first_name')}
        </div>
        <div className="field">
          <label htmlFor="acc-last">Last name</label>
          <input id="acc-last" name="last_name" autoComplete="family-name" value={form.last_name} onChange={update} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="acc-email">Email</label>
        <input id="acc-email" name="email" type="email" autoComplete="email" value={form.email} onChange={update} />
        {errorFor('email')}
      </div>
      <div className="field">
        <label htmlFor="acc-phone">Phone</label>
        <input id="acc-phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={update} />
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Save details'}
      </button>
    </form>
  )
}

function PasswordForm() {
  const empty = { current_password: '', new_password: '', confirm: '' }
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const update = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value })
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (form.new_password !== form.confirm) {
      setErrors({ confirm: "The two new passwords don't match." })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      await api('/auth/change-password/', {
        method: 'POST',
        body: { current_password: form.current_password, new_password: form.new_password },
      })
      setForm(empty)
      setSaved(true)
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  const errorFor = (name) => errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>

  return (
    <form className="block block-white" onSubmit={handleSubmit} noValidate>
      <h2>Change password</h2>
      {saved && (
        <div className="notice notice-success" role="status">
          Your password is changed.
        </div>
      )}
      <div className="field">
        <label htmlFor="acc-current">Current password</label>
        <input id="acc-current" name="current_password" type="password" autoComplete="current-password" value={form.current_password} onChange={update} />
        {errorFor('current_password')}
      </div>
      <div className="field">
        <label htmlFor="acc-new">
          New password <span className="field-hint">(at least 8 characters, and not just numbers)</span>
        </label>
        <input id="acc-new" name="new_password" type="password" autoComplete="new-password" value={form.new_password} onChange={update} />
        {errorFor('new_password')}
      </div>
      <div className="field">
        <label htmlFor="acc-confirm">Type the new password again</label>
        <input id="acc-confirm" name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={update} />
        {errorFor('confirm')}
      </div>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}
