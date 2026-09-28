import { Link } from 'react-router-dom'
import { useLanguage } from '../../i18n'

// Shown for any web address that doesn't exist.
export default function NotFoundPage() {
  const { t } = useLanguage()
  const words = t.notFound
  return (
    <>
      <section className="title-block">
        <h1>{words.title}</h1>
        <p>{words.text}</p>
      </section>
      <section className="section">
        <div className="container container-narrow not-found-links">
          <Link to="/" className="btn btn-primary">
            {words.home}
          </Link>
          <Link to="/drop-dates-locations" className="btn">
            {words.findDrop}
          </Link>
          <Link to="/portal/login" className="btn">
            {words.portal}
          </Link>
        </div>
      </section>
    </>
  )
}
