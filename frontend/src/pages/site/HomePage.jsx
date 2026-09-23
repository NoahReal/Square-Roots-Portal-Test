import { Link } from 'react-router-dom'
import PartnerPortalBand from '../../components/PartnerPortalBand'
import PartnersSection from '../../components/PartnersSection'
import RotatingTagline from '../../components/RotatingTagline'

const PHOTO_STRIP = [
  { src: '/photos/boxes-apples-carrots.jpg', alt: 'Boxes of apples, carrots and potatoes' },
  { src: '/photos/parsnips-carrots.jpg', alt: 'Boxes of parsnips, carrots and sweet potatoes' },
  { src: '/photos/produce-bag.jpg', alt: 'A Square Roots bag with apples, cucumbers and corn' },
  { src: '/photos/market-potatoes.jpg', alt: 'Potatoes and beets at a Square Roots market' },
  { src: '/photos/field-rows.jpg', alt: 'Rows of leafy greens on a farm' },
]

export default function HomePage() {
  return (
    <>
      <section className="home-hero" style={{ backgroundImage: 'url(/photos/brussels-sprouts.jpg)' }}>
        <div className="home-hero-inner">
          <h1>A Community Interest Company Addressing Food Insecurity</h1>
          <div className="hero-buttons">
            <Link to="/signup" className="btn btn-on-dark">
              Get Involved
            </Link>
            <Link to="/about" className="btn btn-on-dark">
              About Us
            </Link>
          </div>
        </div>
      </section>
      <RotatingTagline />

      <FeatureBlock
        label="Mission"
        subtitle="Reducing Food Waste, Increasing Food Security"
        photo="/photos/market-potatoes.jpg"
        photoAlt="Potatoes and beets for sale at a Square Roots market"
        link={{ to: '/about', text: 'About Us' }}
      >
        Square Roots connects perfectly healthy produce that doesn't meet the cosmetic standards of grocery stores to
        community members in need. This produce is diverted from being reploughed into fields or wasted in landfills
        and becomes part of healthy, nutritious meals for Canadians.
      </FeatureBlock>

      <FeatureBlock
        label="Impact"
        subtitle="Redistributing Seconds Produce, Providing Opportunities for Entrepreneurship"
        photo="/photos/food-waste-shirt.jpg"
        photoAlt="A volunteer in an “All my friends hate food waste” shirt beside boxes of carrots"
        photoFirst
        photoPosition="80% center"
        link={{ to: '/drop-dates-locations', text: 'Drop Dates & Locations' }}
      >
        Through our various locations around Nova Scotia, independent Community Managers sell bundles at affordable
        prices.
      </FeatureBlock>

      <FeatureBlock
        label="Support"
        subtitle="Join Us in Creating a Hunger-Free Canada"
        photo="/photos/produce-bag.jpg"
        photoAlt="A Square Roots bag filled with apples, cucumbers, corn and potatoes"
        link={{ to: '/signup', text: 'Get Involved' }}
      >
        Your involvement can make a real difference in the lives of individuals and families facing food insecurity.
        Together, we can build a future where everyone has access to an abundance of nutritious food.
      </FeatureBlock>

      <section className="enactus-section">
        <div className="container enactus-inner">
          <div>
            <h2>Enactus Saint Mary's</h2>
            <p>
              Square Roots was developed and is run by students from Enactus Saint Mary's with help from advisors at
              the university
            </p>
            <a
              className="btn btn-on-dark"
              href="https://arthurlirvingentrepreneurshipcentre.ca/for-students/enactus-saint-marys/"
              target="_blank"
              rel="noreferrer"
            >
              Learn More
            </a>
          </div>
          <img src="/photos/team-shirts.jpg" alt="Four Square Roots team members in matching shirts, facing away" />
        </div>
      </section>

      <section className="get-involved-section">
        <h2>Get Involved</h2>
        <nav className="get-involved-links" aria-label="Get involved">
          <Link to="/contact-us">Contact Us</Link>
          <Link to="/for-farms">For Farms</Link>
          <Link to="/become-a-community-manager">Become a Community Manager</Link>
          <Link to="/signup/host-site">Host a Drop</Link>
        </nav>
      </section>

      <PartnerPortalBand />
      <PartnersSection />

      <div className="photo-strip">
        {PHOTO_STRIP.map((photo) => (
          <img key={photo.src} src={photo.src} alt={photo.alt} loading="lazy" />
        ))}
      </div>
    </>
  )
}

// Yellow text block beside a full-bleed photo, like Mission / Impact / Support on the live site.
function FeatureBlock({ label, subtitle, photo, photoAlt, photoFirst, photoPosition, link, children }) {
  return (
    <section className={'feature-block' + (photoFirst ? ' photo-first' : '')}>
      <div className="feature-text">
        <h2 className="feature-label">{label}</h2>
        <p className="feature-subtitle">{subtitle}</p>
        <p>{children}</p>
        <Link to={link.to} className="btn">
          {link.text}
        </Link>
      </div>
      <img className="feature-photo" src={photo} alt={photoAlt} style={{ objectPosition: photoPosition }} />
    </section>
  )
}
