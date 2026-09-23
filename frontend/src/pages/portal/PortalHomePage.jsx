import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { ROLES } from '../../roles'
import PageHero from '../../components/PageHero'

// Each role's landing page: a welcome, then a block for each of their screens.
export default function PortalHomePage() {
  const { user } = useAuth()
  const role = ROLES[user.role]
  const screens = role.nav.filter((item) => item.to !== role.home)

  return (
    <>
      <PageHero title={`Welcome, ${user.first_name}`} lead={role.welcome} />

      <section className="section">
        <div className="container">
          {screens.length === 0 ? (
            <div className="block block-white">
              <h3>Upcoming drops</h3>
              <p className="muted">Drop dates at your location will show here once the team schedules them.</p>
            </div>
          ) : (
            <div className="grid grid-2">
              {screens.map((item) => (
                <div key={item.to} className="block block-white">
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                  <Link to={item.to} className="btn">
                    Open {item.label}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
