import { Link } from 'react-router-dom'

// Shown for any web address that doesn't exist.
export default function NotFoundPage() {
  return (
    <>
      <section className="title-block">
        <h1>Page not found</h1>
        <p>We couldn't find that page. It may have moved, or the link may have a typo.</p>
      </section>
      <section className="section">
        <div className="container container-narrow not-found-links">
          <Link to="/" className="btn btn-primary">
            Go to the home page
          </Link>
          <Link to="/drop-dates-locations" className="btn">
            Find a drop near you
          </Link>
          <Link to="/portal/login" className="btn">
            Partner Portal
          </Link>
        </div>
      </section>
    </>
  )
}
