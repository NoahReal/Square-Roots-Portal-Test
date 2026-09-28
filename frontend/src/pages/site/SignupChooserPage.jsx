import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n'
import { SIGNUP_ROLES } from '../../signupRoles'

// /signup: "Which describes you?"
export default function SignupChooserPage() {
  const { t } = useLanguage()
  const words = t.signup
  return (
    <>
      <section className="title-block">
        <h1>{words.chooserTitle}</h1>
        <p>{words.chooserLead}</p>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="center">{words.whichDescribesYou}</h2>
          <div className="grid grid-3">
            {Object.keys(SIGNUP_ROLES).map((slug) => (
              <div key={slug} className="block block-white signup-choice">
                <span className="tag">{words.roles[slug].label}</span>
                <h3>{words.roles[slug].title}</h3>
                <p>{words.roles[slug].summary}</p>
                <Link to={`/signup/${slug}`} className="btn btn-primary btn-block">
                  {words.roles[slug].button}
                </Link>
              </div>
            ))}
          </div>
          <p className="center form-footnote">
            {words.haveAccount}
            <Link to="/portal/login">{words.logInToPortal}</Link>
          </p>
        </div>
      </section>
    </>
  )
}
