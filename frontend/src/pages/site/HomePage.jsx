import { Link } from 'react-router-dom'
import PartnerPortalBand from '../../components/PartnerPortalBand'
import PartnersSection from '../../components/PartnersSection'
import ReserveFeature from '../../components/ReserveFeature'
import RotatingTagline from '../../components/RotatingTagline'
import { useLanguage } from '../../i18n'
import { useSiteText } from '../../siteText'

// Photo descriptions are in siteWords.js (photos)
const PHOTO_STRIP = [
  { src: '/photos/boxes-apples-carrots.jpg', alt: 'boxes' },
  { src: '/photos/parsnips-carrots.jpg', alt: 'parsnips' },
  { src: '/photos/produce-bag.jpg', alt: 'bag' },
  { src: '/photos/market-potatoes.jpg', alt: 'marketPotatoes' },
  { src: '/photos/field-rows.jpg', alt: 'field' },
]

export default function HomePage() {
  const text = useSiteText()
  const { t } = useLanguage()
  return (
    <>
      <section className="home-hero" style={{ backgroundImage: 'url(/photos/brussels-sprouts.jpg)' }}>
        <div className="home-hero-inner">
          <h1>{text('home.hero')}</h1>
          <div className="hero-buttons">
            <Link to="/signup" className="btn btn-on-dark">
              {t.home.getInvolved}
            </Link>
            <Link to="/about" className="btn btn-on-dark">
              {t.home.aboutUs}
            </Link>
          </div>
        </div>
      </section>
      <RotatingTagline />
      <ReserveFeature />

      <FeatureBlock
        label={t.home.mission}
        subtitle={text('home.mission.subtitle')}
        photo="/photos/market-potatoes.jpg"
        photoAlt={t.photos.marketPotatoesForSale}
        link={{ to: '/about', text: t.home.aboutUs }}
      >
        {text('home.mission.text')}
      </FeatureBlock>

      <FeatureBlock
        label={t.home.impact}
        subtitle={text('home.impact.subtitle')}
        photo="/photos/food-waste-shirt.jpg"
        photoAlt={t.photos.shirt}
        photoFirst
        photoPosition="80% center"
        link={{ to: '/drop-dates-locations', text: t.home.dropDates }}
      >
        {text('home.impact.text')}
      </FeatureBlock>

      <FeatureBlock
        label={t.home.support}
        subtitle={text('home.support.subtitle')}
        photo="/photos/produce-bag.jpg"
        photoAlt={t.photos.bagFull}
        link={{ to: '/signup', text: t.home.getInvolved }}
      >
        {text('home.support.text')}
      </FeatureBlock>

      <section className="enactus-section">
        <div className="container enactus-inner">
          <div>
            <h2>{t.home.enactusTitle}</h2>
            <p>{text('home.enactus')}</p>
            <a
              className="btn btn-on-dark"
              href="https://arthurlirvingentrepreneurshipcentre.ca/for-students/enactus-saint-marys/"
              target="_blank"
              rel="noreferrer"
            >
              {t.home.learnMore}
            </a>
          </div>
          <img src="/photos/team-shirts.jpg" alt={t.photos.team} />
        </div>
      </section>

      <section className="get-involved-section">
        <h2>{t.home.getInvolved}</h2>
        <nav className="get-involved-links" aria-label={t.home.getInvolvedLinks}>
          <Link to="/contact-us">{t.home.contactUs}</Link>
          <Link to="/for-farms">{t.home.forFarms}</Link>
          <Link to="/become-a-community-manager">{t.home.becomeCm}</Link>
          <Link to="/signup/host-site">{t.home.hostDrop}</Link>
        </nav>
      </section>

      <PartnerPortalBand />
      <PartnersSection />

      <div className="photo-strip">
        {PHOTO_STRIP.map((photo) => (
          <img key={photo.src} src={photo.src} alt={t.photos[photo.alt]} loading="lazy" />
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
