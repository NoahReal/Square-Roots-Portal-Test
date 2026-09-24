import { Link } from 'react-router-dom'

// The privacy policy, in plain language. It describes what this website actually does;
// if the code changes what's collected or how long it's kept, update this page too.
export default function PrivacyPage() {
  return (
    <>
      <section className="title-block title-block-compact">
        <h1>Privacy</h1>
        <p>What we collect, why, who sees it, and how long we keep it.</p>
      </section>

      <section className="section">
        <div className="container container-narrow privacy-page">
          <p className="notice notice-info">
            This is a draft for Square Roots to review before the website is used by the public, ideally with advice
            from someone who knows Canadian privacy law (PIPEDA).
          </p>

          <h2>Who we are</h2>
          <p>
            Square Roots is a community interest company run by students from Enactus Saint Mary’s, at Saint Mary’s
            University in Halifax. Questions about your information go to{' '}
            <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a>.
          </p>

          <h2>When you reserve a bundle</h2>
          <p>We ask for:</p>
          <ul>
            <li>your name, so your Community Manager knows who the bundle is for;</li>
            <li>an email or phone number, so we can send your confirmation and tell you if plans change;</li>
            <li>your address, only if you ask for home delivery.</li>
          </ul>
          <p>
            We also keep how many bundles you reserved, the price you chose and any gift you added. The price you choose
            is private: only your Community Manager and the Square Roots team see it.
          </p>
          <p>
            <strong>Who sees it:</strong> your location’s Community Manager and the Square Roots team. For home
            delivery, the delivery partner (for example BayRides) gets your name, address and phone number. If a host
            site reserved for you, they see the name they gave and your pickup code. We never sell your information or
            use it for advertising.
          </p>
          <p>
            <strong>How long:</strong> we remove your name and contact details 60 days after your drop. If you cancel,
            they’re deleted right away. If you asked us to reserve at every drop, we keep your details until you stop.
          </p>

          <h2>Emails we send</h2>
          <p>
            Only about your reservations: your confirmation, reminders before your drop, a short question afterwards
            about how your bundle was, and notices if your drop changes. There’s no mailing list.
          </p>

          <h2>“Bring Square Roots to my area”</h2>
          <p>
            If you ask us to start a location near you, we keep your email and postal code to tell you if one opens, and
            to show the team where people are asking. You can ask us to delete it at any time.
          </p>

          <h2>Contact Us messages</h2>
          <p>We keep messages sent through the Contact Us page for one year, then delete them.</p>

          <h2>Partner portal accounts</h2>
          <p>
            Community Managers, farms and host sites have accounts with their name, email, phone and organization. These
            are kept while they work with Square Roots. Ask us to close your account and we’ll delete it.
          </p>

          <h2>Cookies and your device</h2>
          <p>
            The partner portal uses one cookie to keep you logged in. If you tick “Remember my details” when reserving,
            your name and contact details are saved on your own device (not on our servers) so you don’t have to type
            them again. The website doesn’t use tracking or advertising cookies.
          </p>

          <h2>Your choices</h2>
          <p>
            You can see, correct or delete your information at any time: change or cancel a reservation from the link
            in your confirmation email, or email{' '}
            <a href="mailto:squareroots@enactussmu.ca">squareroots@enactussmu.ca</a> and we’ll help within 30 days.
          </p>

          <p className="privacy-back">
            <Link to="/reserve">Back to reserving a bundle</Link>
          </p>
        </div>
      </section>
    </>
  )
}
