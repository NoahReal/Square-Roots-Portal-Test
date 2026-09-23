import PartnerPortalBand from '../../components/PartnerPortalBand'

export default function EventsPage() {
  return (
    <>
      <section className="events">
        <div className="container container-narrow">
          <article className="event">
            <h2>Saint Mary's - NSCC Ivany</h2>
            <p>
              On August 31 and September 1 we will be giving away free produce from 12-4 at Gorsebrook Park (facing
              Inglis). We hope to see you there!
            </p>
            <p>
              We'll also be giving away free bundles with the help of Enactus NSCC Ivany at their campus. Stay tuned for
              more updates!
            </p>
          </article>
        </div>
      </section>

      <PartnerPortalBand
        title="Want to host an event with us?"
        text="Community centres, schools and organizations can host a Square Roots drop. Sign up and we'll get in touch."
      />
    </>
  )
}
