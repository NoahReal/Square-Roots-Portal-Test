import { Link, Navigate, useParams } from 'react-router-dom'
import SignupForm from '../../components/SignupForm'
import { SIGNUP_ROLES } from '../../signupRoles'

// /signup/community-manager, /signup/farm, /signup/host-site
export default function SignupPage() {
  const { roleSlug } = useParams()
  const info = SIGNUP_ROLES[roleSlug]
  if (!info) return <Navigate to="/signup" replace />

  return (
    <>
      <section className="title-block title-block-left">
        <p className="eyebrow">
          <Link to="/signup">Partner sign-up</Link> / {info.label}
        </p>
        <h1>{info.title}</h1>
        <p>{info.summary}</p>
      </section>
      <section className="section">
        <div className="container container-narrow">
          <SignupForm roleSlug={roleSlug} />
        </div>
      </section>
    </>
  )
}
