import { Link, Navigate, useParams } from 'react-router-dom'
import SignupForm from '../../components/SignupForm'
import { useLanguage } from '../../i18n'
import { SIGNUP_ROLES } from '../../signupRoles'

// /signup/community-manager, /signup/farm, /signup/host-site
export default function SignupPage() {
  const { roleSlug } = useParams()
  const { t } = useLanguage()
  if (!SIGNUP_ROLES[roleSlug]) return <Navigate to="/signup" replace />
  const info = t.signup.roles[roleSlug]

  return (
    <>
      <section className="title-block title-block-left">
        <p className="eyebrow">
          <Link to="/signup">{t.signup.breadcrumb}</Link> / {info.label}
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
