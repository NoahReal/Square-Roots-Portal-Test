import { Link } from 'react-router-dom'
import PartnerPortalBand from '../../components/PartnerPortalBand'
import PartnersSection from '../../components/PartnersSection'
import ReserveFeature from '../../components/ReserveFeature'
import RotatingTagline from '../../components/RotatingTagline'
import { useSiteText } from '../../siteText'

const PHOTO_STRIP = [
  { src: '/photos/boxes-apples-carrots.jpg', alt: 'Boxes of apples, carrots and potatoes' },
  { src: '/photos/parsnips-carrots.jpg', alt: 'Boxes of parsnips, carrots and sweet potatoes' },
  { src: '/photos/produce-bag.jpg', alt: 'A Square Roots bag with apples, cucumbers and corn' },
  { src: '/photos/market-potatoes.jpg', alt: 'Potatoes and beets at a Square Roots market' },
  { src: '/photos/field-rows.jpg', alt: 'Rows of leafy greens on a farm' },
]

export default function HomePage() {
  const text = useSiteText()
  return (
    <>
      <section className="home-hero" style={{ backgroundImage: 'url(/photos/brussels-sprouts.jpg)' }}>
        <div className="home-hero-inner">
          <h1>{text('home.hero')}</h1>
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
      <ReserveFeature />

      <FeatureBlock
        label="Mission"
        subtitle={text('home.mission.subtitle')}
        photo="/photos/market-potatoes.jpg"
        photoAlt="Potatoes and beets for sale at a Square Roots market"
        link={{ to: '/about', text: 'About Us' }}
      >
        {text('home.mission.text')}
      </FeatureBlock>

      <FeatureBlock
        label="Impact"
        subtitle={text('home.impact.subtitle')}
        photo="/photos/food-waste-shirt.jpg"
        photoAlt="A volunteer in an “All my friends hate food waste” shirt beside boxes of carrots"
        photoFirst
        photoPosition="80% center"
        link={{ to: '/drop-dates-locations', text: 'Drop Dates & Locations' }}
      >
        {text('home.impact.text')}
      </FeatureBlock>

      <FeatureBlock
        label="Support"
        subtitle={text('home.support.subtitle')}
        photo="/photos/produce-bag.jpg"
        photoAlt="A Square Roots bag filled with apples, cucumbers, corn and potatoes"
        link={{ to: '/signup', text: 'Get Involved' }}
      >
        {text('home.support.text')}
      </FeatureBlock>

      <section className="enactus-section">
        <div className="container enactus-inner">
          <div>
            <h2>Enactus Saint Mary's</h2>
            <p>{text('home.enactus')}</p>
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
