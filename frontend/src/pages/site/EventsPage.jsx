import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { longDate } from '../../format'
import PartnerPortalBand from '../../components/PartnerPortalBand'
import { FacebookIcon, InstagramIcon } from '../../components/Icons'

// Public Events page. The Square Roots team adds events in the portal (Admin → Events).
export default function EventsPage() {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    api('/events/')
      .then(setEvents)
      .catch(() => setEvents({ upcoming: [], past: [] }))
  }, [])

  return (
    <>
      <section className="title-block title-block-compact">
        <h1>Events</h1>
      </section>

      <section className="events">
        <div className="container container-narrow">
          {!events && <p className="muted center">Loading…</p>}

          {events && events.upcoming.length === 0 && (
            <div className="event event-empty">
              <h2>No upcoming events right now</h2>
              <p>
                Follow us for giveaways, markets and pop-ups. Regular drops happen every two weeks at our{' '}
                <Link to="/drop-dates-locations">locations</Link>.
              </p>
              <div className="contact-social event-social">
                <a href="https://www.instagram.com/squarerootssmu/" target="_blank" rel="noreferrer" aria-label="Instagram">
                  <InstagramIcon />
                </a>
                <a href="https://www.facebook.com/squarerootssmu/" target="_blank" rel="noreferrer" aria-label="Facebook">
                  <FacebookIcon />
                </a>
              </div>
            </div>
          )}
          {events?.upcoming.map((event) => (
            <Event key={event.id} event={event} />
          ))}

          {events?.past.length > 0 && (
            <>
              <h2 className="past-events-heading">Past events</h2>
              {events.past.map((event) => (
                <Event key={event.id} event={event} past />
              ))}
            </>
          )}
        </div>
      </section>

      <PartnerPortalBand
        title="Want to host an event with us?"
        text="Community centres, schools and organizations can host a Square Roots drop. Sign up and we'll get in touch."
      />
    </>
  )
}

function Event({ event, past }) {
  const multiDay = event.ends_on && event.ends_on !== event.starts_on
  const year = event.starts_on.slice(0, 4)
  return (
    <article className={'event' + (past ? ' event-past' : '')}>
      <p className="event-when">
        {longDate(event.starts_on)}
        {multiDay && ` to ${longDate(event.ends_on)}`}
        {past && `, ${year}`}
        {event.time_text && ` · ${event.time_text}`}
      </p>
      <h2>{event.title}</h2>
      {event.location && <p className="event-where">{event.location}</p>}
      <p>{event.description}</p>
    </article>
  )
}
