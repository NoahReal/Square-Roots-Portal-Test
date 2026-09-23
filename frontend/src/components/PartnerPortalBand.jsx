import { Link } from 'react-router-dom'

// "Join the partner portal" band. Used on the home page and at the bottom of
// other public pages, so there's always a way to sign up nearby.
export default function PartnerPortalBand({
  title = 'Partner Portal',
  text = 'Community Managers, farms and host sites use the partner portal to order bundles, post produce and see drop dates, all in one place.',
}) {
  return (
    <section className="portal-band">
      <div className="container portal-band-inner">
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <div className="portal-band-actions">
          <Link to="/signup" className="btn btn-yellow">
            Sign up
          </Link>
          <Link to="/portal/login" className="btn btn-on-dark">
            Log in
          </Link>
        </div>
      </div>
    </section>
  )
}
