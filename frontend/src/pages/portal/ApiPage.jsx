import { useEffect, useState } from 'react'
import { api } from '../api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demoAccounts'
import PageHero from '../components/PageHero'

// Admin-only page: every API endpoint the portal uses, plus tools for testing logins.
export default function ApiPage() {
  return (
    <>
      <PageHero
        title="API"
        lead="Every address the portal's screens use to talk to the server. This list is built by the server itself, so new APIs appear here automatically."
      />
      <EndpointList />
      <LoginTester />
      <LoginCheckSuite />
      <AutomatedTests />
    </>
  )
}

// ---------- The list of endpoints ----------

function EndpointList() {
  const [endpoints, setEndpoints] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/catalog/').then(setEndpoints).catch((err) => setError(err.message))
  }, [])

  return (
    <section className="section">
      <div className="container">
        <h2>Endpoints</h2>
        {error && <div className="notice notice-error">{error}</div>}
        {!endpoints && !error && <p className="muted">Loading…</p>}
        {endpoints && (
          <p className="muted">
            {endpoints.length} endpoints. “Try it” runs a GET request as you and shows what the server sends back.
          </p>
        )}
        {endpoints?.map((endpoint) => <Endpoint key={endpoint.path} endpoint={endpoint} />)}
      </div>
    </section>
  )
}

function Endpoint({ endpoint }) {
  const [result, setResult] = useState(null)
  const canTry = endpoint.methods.includes('GET') && !endpoint.has_parameters

  async function tryIt() {
    try {
      setResult({ ok: true, data: await api(endpoint.path.replace(/^\/api/, '')) })
    } catch (err) {
      setResult({ ok: false, data: err.data ?? err.message, status: err.status })
    }
  }

  return (
    <div className="block block-white endpoint">
      <div className="endpoint-head">
        {endpoint.methods.map((method) => (
          <span key={method} className={'tag tag-method tag-' + method.toLowerCase()}>
            {method}
          </span>
        ))}
        <code className="endpoint-path">{endpoint.path}</code>
      </div>
      <p>{endpoint.description}</p>
      <p className="muted endpoint-who">
        <strong>Who can use it:</strong> {endpoint.who.join(', ')}
      </p>
      {canTry && (
        <button className="btn btn-small" onClick={tryIt}>
          Try it
        </button>
      )}
      {result && (
        <pre className={'json' + (result.ok ? '' : ' json-error')}>
          {result.status ? `Error ${result.status}\n` : ''}
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---------- Check one username and password ----------

function checkLogin(username, password) {
  return api('/auth/check-login/', { method: 'POST', body: { username, password } })
}

function LoginTester() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setResult(await checkLogin(username, password))
  }

  return (
    <section className="section section-tinted">
      <div className="container">
        <h2>Test a login</h2>
        <p className="muted">
          Checks a username and password exactly the way the login page does, but doesn't log anyone in, and you
          stay logged in as yourself. Unlike the login page, it tells you <em>why</em> a login would fail.
        </p>
        <form className="login-tester" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="test-username">Username</label>
            <input
              id="test-username"
              autoComplete="off"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="test-password">Password (shown so you can see what's being tested)</label>
            <input
              id="test-password"
              autoComplete="off"
              autoCapitalize="none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary">Check login</button>
        </form>
        {result &&
          (result.valid ? (
            <div className="notice notice-success" role="status">
              ✓ This would log in as {result.user.first_name} {result.user.last_name} ({result.user.role_label}).
            </div>
          ) : (
            <div className="notice notice-error" role="status">
              ✗ This would not log in. {result.reason}
            </div>
          ))}
      </div>
    </section>
  )
}

// ---------- Run a set of login checks in one go ----------

// Each check: what to try, and what should happen.
const LOGIN_CHECKS = [
  ...DEMO_ACCOUNTS.map((account) => ({
    name: `${account.who} can log in`,
    username: account.username,
    password: DEMO_PASSWORD,
    expect: { valid: true, role: account.role },
  })),
  {
    name: 'Wrong password is refused',
    username: 'cm.dartmouth',
    password: 'not-the-password',
    expect: { valid: false, reason: 'The password is wrong.' },
  },
  {
    name: 'Passwords are case-sensitive',
    username: 'cm.dartmouth',
    password: DEMO_PASSWORD.toUpperCase(),
    expect: { valid: false, reason: 'The password is wrong.' },
  },
  {
    name: 'Spaces around a username are ignored',
    username: '  cm.dartmouth ',
    password: DEMO_PASSWORD,
    expect: { valid: true, role: 'Community Manager' },
  },
  {
    name: 'Unknown username is refused',
    username: 'no.such.person',
    password: DEMO_PASSWORD,
    expect: { valid: false, reason: 'No account has that username.' },
  },
  {
    name: 'Blank username and password are refused',
    username: '',
    password: '',
    expect: { valid: false, reason: 'Username and password are both required.' },
  },
]

function describeExpected(expect) {
  return expect.valid ? `Logs in as ${expect.role}` : `Refused: ${expect.reason}`
}

function describeActual(result) {
  return result.valid ? `Logs in as ${result.user.role_label}` : `Refused: ${result.reason}`
}

function LoginCheckSuite() {
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)

  async function runAll() {
    setRunning(true)
    // Checking a password is deliberately slow (it makes guessing passwords
    // hard), so run all the checks at the same time rather than one by one.
    const done = await Promise.all(
      LOGIN_CHECKS.map(async (check) => {
        const result = await checkLogin(check.username, check.password)
        const expected = describeExpected(check.expect)
        const actual = describeActual(result)
        return { ...check, expected, actual, passed: expected === actual }
      }),
    )
    setResults(done)
    setRunning(false)
  }

  const passed = results?.filter((r) => r.passed).length

  return (
    <section className="section">
      <div className="container">
        <h2>Run all login checks</h2>
        <p className="muted">
          Tries every demo account and the usual mistakes (wrong password, wrong capitals, unknown username, blank
          form) and compares what happened with what should happen.
        </p>
        <button className="btn btn-primary" onClick={runAll} disabled={running}>
          {running ? 'Running…' : `Run ${LOGIN_CHECKS.length} checks`}
        </button>

        {results && (
          <>
            <div className={'notice ' + (passed === results.length ? 'notice-success' : 'notice-error')} role="status">
              {passed} of {results.length} checks passed.
            </div>
            <ul className="check-list">
              {results.map((r) => (
                <li key={r.name} className={r.passed ? 'check-pass' : 'check-fail'}>
                  <span className="check-mark" aria-label={r.passed ? 'Passed' : 'Failed'}>
                    {r.passed ? '✓' : '✗'}
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                    <br />
                    <code>{JSON.stringify(r.username)}</code> / <code>{JSON.stringify(r.password)}</code>
                    <br />
                    <span className="muted">Expected: {r.expected}</span>
                    {!r.passed && (
                      <>
                        <br />
                        <span>Got: {r.actual}</span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

// ---------- How to run the automated tests ----------

function AutomatedTests() {
  return (
    <section className="section section-tinted">
      <div className="container">
        <h2>Automated tests</h2>
        <p>
          The same login rules are also checked by automated tests that run without a browser. Run them in a
          terminal after changing anything to do with logins:
        </p>
        <pre className="json">
          {`cd backend
source .venv/bin/activate
python manage.py test`}
        </pre>
        <p className="muted">
          The tests are in <code>backend/accounts/tests.py</code>. Each one has a plain-English name, like{' '}
          <code>test_wrong_password_is_rejected</code>.
        </p>
      </div>
    </section>
  )
}
