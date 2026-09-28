import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n'

// "Join the partner portal" band. Used on the home page and at the bottom of
// other public pages, so there's always a way to sign up nearby.
export default function PartnerPortalBand({ title, text }) {
  const { t } = useLanguage()
  return (
    <section className="portal-band">
      <div className="container portal-band-inner">
        <div>
          <h2>{title ?? t.partnerBand.title}</h2>
          <p>{text ?? t.partnerBand.text}</p>
        </div>
        <div className="portal-band-actions">
          <Link to="/signup" className="btn btn-yellow">
            {t.common.signUp}
          </Link>
          <Link to="/portal/login" className="btn btn-on-dark">
            {t.common.logIn}
          </Link>
        </div>
      </div>
    </section>
  )
}
