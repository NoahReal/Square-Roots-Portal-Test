import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { homeFor } from '../../roles'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, PENDING_DEMO_ACCOUNTS } from '../../demoAccounts'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(username, password)
      navigate(homeFor(user))
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  function fillDemoAccount(account) {
    setUsername(account.username)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <>
      <div className="login-split">
        <section className="login-form-side">
          <h1>Partner Portal</h1>
          <p className="lead">For Community Managers, farms, host sites and the Square Roots team.</p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div className="notice notice-error" role="alert">
                {error}
              </div>
            )}
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                autoComplete="username"
                autoCapitalize="none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </form>
          <p className="form-footnote">
            New to Square Roots? <Link to="/signup">Sign up as a partner</Link>
          </p>
        </section>

        <section className="login-message-side">
          <h2>Reducing Food Waste, Increasing Food Security</h2>
          <p>
            Square Roots connects perfectly healthy produce that doesn't meet grocery store cosmetic standards with
            community members across Nova Scotia.
          </p>
        </section>
      </div>

      <section className="section">
        <div className="container">
          <h2>Demo accounts</h2>
          <p className="muted">
            Tap an account to fill in the form. Every demo password is <strong>{DEMO_PASSWORD}</strong>.
          </p>
          <DemoAccountList accounts={DEMO_ACCOUNTS} onPick={fillDemoAccount} />
          <h3 className="demo-subheading">Signed up, waiting for approval</h3>
          <p className="muted">These people signed up on the website. Log in as one to see what they see.</p>
          <DemoAccountList accounts={PENDING_DEMO_ACCOUNTS} onPick={fillDemoAccount} />
        </div>
      </section>
    </>
  )
}

function DemoAccountList({ accounts, onPick }) {
  return (
    <ul className="demo-accounts">
      {accounts.map((account) => (
        <li key={account.username}>
          <button type="button" onClick={() => onPick(account)}>
            <span>
              <strong>{account.who}</strong>
              <br />
              <span className="muted">{account.username}</span>
            </span>
            <span className="tag">{account.role}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
