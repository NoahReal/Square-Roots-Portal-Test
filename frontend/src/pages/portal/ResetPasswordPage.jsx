import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'

// Opened from the link in a password reset email: choose a new password.
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [doneFor, setDoneFor] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (password !== confirm) {
      setErrors({ confirm: "The two passwords don't match." })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      const result = await api('/auth/password-reset/confirm/', {
        method: 'POST',
        body: { uid: params.get('uid'), token: params.get('token'), new_password: password },
      })
      setDoneFor(result.username)
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  return (
    <>
      <section className="title-block title-block-left">
        <h1>Choose a new password</h1>
      </section>
      <section className="section">
        <div className="container container-narrow">
          {doneFor ? (
            <div className="block block-white">
              <div className="notice notice-success" role="status">
                Your password is changed. You can log in now as <strong>{doneFor}</strong>.
              </div>
              <Link to="/portal/login" className="btn btn-primary">
                Log in
              </Link>
            </div>
          ) : (
            <form className="block block-white narrow-form" onSubmit={handleSubmit} noValidate>
              {errors.detail && (
                <div className="notice notice-error" role="alert">
                  {errors.detail} <Link to="/portal/forgot-password">Get a new link</Link>
                </div>
              )}
              <div className="field">
                <label htmlFor="new-password">
                  New password <span className="field-hint">(at least 8 characters, and not just numbers)</span>
                </label>
                <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                {errors.new_password && <p className="field-error">{errors.new_password}</p>}
              </div>
              <div className="field">
                <label htmlFor="confirm-password">Type it again</label>
                <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                {errors.confirm && <p className="field-error">{errors.confirm}</p>}
              </div>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
