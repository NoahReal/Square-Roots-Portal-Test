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
          <TwoStepBlock />
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

// Two-step login: a 6-digit code from an authenticator app on top of the password.
// Recommended for admins, since they can see everyone's details.
function TwoStepBlock() {
  const { user, refreshUser } = useAuth()
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [turningOff, setTurningOff] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function start() {
    setError('')
    setDone('')
    setSetup(await api('/auth/two-step/', { method: 'POST', body: {} }))
  }

  async function finish(event) {
    event.preventDefault()
    try {
      refreshUser(await api('/auth/two-step/', { method: 'POST', body: { code } }))
      setSetup(null)
      setCode('')
      setDone('Two-step login is on. Next time you log in, you’ll need a code from your app.')
    } catch (err) {
      setError([].concat(err.data?.code ?? err.message).join(' '))
    }
  }

  async function turnOff(event) {
    event.preventDefault()
    try {
      refreshUser(await api('/auth/two-step/', { method: 'DELETE', body: { password } }))
      setTurningOff(false)
      setPassword('')
      setDone('Two-step login is off.')
    } catch (err) {
      setError([].concat(err.data?.password ?? err.message).join(' '))
    }
  }

  return (
    <div className="block block-white two-step">
      <h2>Two-step login</h2>
      {done && (
        <div className="notice notice-success" role="status">
          {done}
        </div>
      )}
      {user.two_step ? (
        <>
          <p>
            <strong>On.</strong> Logging in needs your password and a 6-digit code from your authenticator app.
          </p>
          {turningOff ? (
            <form onSubmit={turnOff} noValidate>
              <div className="field">
                <label htmlFor="two-step-password">Your password, to turn it off</label>
                <input id="two-step-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p className="field-error">{error}</p>}
              </div>
              <div className="button-row">
                <button className="btn btn-primary">Turn off</button>
                <button type="button" className="btn" onClick={() => setTurningOff(false)}>
                  Keep it on
                </button>
              </div>
            </form>
          ) : (
            <button className="link-button" onClick={() => setTurningOff(true)}>
              Turn off two-step login
            </button>
          )}
        </>
      ) : setup ? (
        <form onSubmit={finish} noValidate>
          <ol className="two-step-steps">
            <li>
              Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or 1Password all
              work).
            </li>
            <li>
              On your phone, <a href={setup.app_link}>tap here to add Square Roots</a>. Or add an account by hand with
              this key: <code className="two-step-key">{setup.secret.match(/.{1,4}/g).join(' ')}</code>
            </li>
            <li>Type the 6-digit code the app shows:</li>
          </ol>
          <div className="field">
            <label htmlFor="two-step-code">6-digit code</label>
            <input
              id="two-step-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            {error && <p className="field-error">{error}</p>}
          </div>
          <button className="btn btn-primary">Turn on</button>
        </form>
      ) : (
        <>
          <p>
            Add a 6-digit code from your phone to your password, so nobody can log in with your password alone.
            {user.role === 'admin' && ' Recommended for admins, since you can see everyone’s details.'}
          </p>
          <button className="btn" onClick={start}>
            Set up two-step login
          </button>
        </>
      )}
    </div>
  )
}
