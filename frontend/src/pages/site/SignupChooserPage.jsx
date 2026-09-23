import { Link } from 'react-router-dom'
import { SIGNUP_ROLES } from '../../signupRoles'

// /signup: "Which describes you?"
export default function SignupChooserPage() {
  return (
    <>
      <section className="title-block">
        <h1>Join Square Roots</h1>
        <p>
          Sign up for the partner portal. Tell us a little about yourself, and once the Square Roots team approves your
          account you can start ordering, posting produce or scheduling drops.
        </p>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="center">Which describes you?</h2>
          <div className="grid grid-3">
            {Object.entries(SIGNUP_ROLES).map(([slug, info]) => (
              <div key={slug} className="block block-white signup-choice">
                <span className="tag">{info.label}</span>
                <h3>{info.title}</h3>
                <p>{info.summary}</p>
                <Link to={`/signup/${slug}`} className="btn btn-primary btn-block">
                  {info.button}
                </Link>
              </div>
            ))}
          </div>
          <p className="center form-footnote">
            Already have an account? <Link to="/portal/login">Log in to the partner portal</Link>
          </p>
        </div>
      </section>
    </>
  )
}
