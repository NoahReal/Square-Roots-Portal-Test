import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { homeFor } from '../../roles'
import PageHero from '../../components/PageHero'

// Placeholder for screens that haven't been built yet.
export default function ComingSoonPage({ item }) {
  const { user } = useAuth()
  return (
    <>
      <PageHero title={item.label} lead={item.description} />
      <section className="section">
        <div className="container">
          <div className="block block-white">
            <h3>Coming soon</h3>
            <p className="muted">This screen is part of the prototype plan and hasn't been built yet.</p>
            <Link to={homeFor(user)} className="btn">
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
