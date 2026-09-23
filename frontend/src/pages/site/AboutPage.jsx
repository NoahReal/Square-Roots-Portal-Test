import { Link } from 'react-router-dom'
import PartnersSection from '../../components/PartnersSection'

export default function AboutPage() {
  return (
    <>
      <section className="title-block">
        <h1>About Us</h1>
        <p>
          Square Roots is a community interest company based out of Halifax. We're dedicated to increasing food
          security across Canada by providing set-to-be-wasted, low-cost produce to communities around Nova Scotia.
        </p>
      </section>

      <section className="split">
        <img className="split-photo" src="/photos/boxes-apples-carrots.jpg" alt="Boxes of apples, carrots and potatoes" />
        <div className="split-text">
          <h2>How It Works</h2>
          <p>
            We connect perfectly healthy produce that doesn’t meet the cosmetic standards of grocery stores to community
            members in need.
          </p>
          <p>
            This produce is diverted from being reploughed into fields or wasted in landfills and becomes part of
            healthy, nutritious meals for Nova Scotians.
          </p>
          <p>Find a community near you:</p>
          <Link to="/drop-dates-locations" className="btn">
            Drop Dates &amp; Locations
          </Link>
        </div>
      </section>

      <div className="banner-band">Nourishing Communities with Seconds Produce</div>

      <section className="split split-reverse">
        <div className="split-text">
          <h2>Community Managers</h2>
          <p>
            We partner with community individuals and like-minded organizations interested in running their own Square
            Roots locations. These Community Managers are responsible for organizing bi-weekly produce markets in their
            regions with our support.
          </p>
          <p>
            Square Roots enables these Community Managers to engage in risk-free entrepreneurship by providing
            incentivized produce prices for their first drop.
          </p>
          <Link to="/become-a-community-manager" className="btn">
            Become a Community Manager
          </Link>
        </div>
        <img className="split-photo" src="/photos/parsnips-carrots.jpg" alt="Boxes of parsnips, carrots and sweet potatoes" />
      </section>

      <PartnersSection tone="yellow" />
    </>
  )
}
