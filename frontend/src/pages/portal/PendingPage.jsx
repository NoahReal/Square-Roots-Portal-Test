import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { homeFor } from '../../roles'

// What someone sees after signing up, until an admin approves (or declines) them.
export default function PendingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return <Navigate to="/portal/login" replace />
  if (user.status === 'approved') return <Navigate to={homeFor(user)} replace />

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  const declined = user.status === 'declined'

  return (
    <>
      <section className={'title-block title-block-left' + (declined ? ' title-block-maroon' : '')}>
        <h1>{declined ? 'About your application' : `Thanks, ${user.first_name}!`}</h1>
        <p>
          {declined
            ? "We're not able to approve your application right now. If you have questions, please email us at squareroots@enactussmu.ca."
            : `We've received your application to join Square Roots as a ${user.role_label}.`}
        </p>
      </section>

      <section className="section">
        <div className="container container-narrow">
          {!declined && (
            <div className="block block-white">
              <h2>What happens next</h2>
              <ol className="next-steps">
                <li>Someone from the Square Roots team at Enactus Saint Mary's reviews your application.</li>
                <li>We'll email you once your account is approved. This usually takes a few days.</li>
                <li>Then log in here with the username and password you chose, and your partner portal will be ready.</li>
              </ol>
            </div>
          )}
          <div className="button-row">
            <Link to="/" className="btn btn-primary">
              Back to the Square Roots site
            </Link>
            <button className="btn" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
