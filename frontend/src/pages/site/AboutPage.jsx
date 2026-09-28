import { Link } from 'react-router-dom'
import PartnersSection from '../../components/PartnersSection'
import { useLanguage } from '../../i18n'
import { useSiteText } from '../../siteText'

export default function AboutPage() {
  const text = useSiteText()
  const { t } = useLanguage()
  const words = t.aboutPage
  return (
    <>
      <section className="title-block">
        <h1>{words.title}</h1>
        <p>{text('about.intro')}</p>
      </section>

      <section className="split">
        <img className="split-photo" src="/photos/boxes-apples-carrots.jpg" alt={t.photos.boxes} />
        <div className="split-text">
          <h2>{words.howItWorks}</h2>
          <p>{text('about.how1')}</p>
          <p>{text('about.how2')}</p>
          <p>{words.findCommunity}</p>
          <Link to="/drop-dates-locations" className="btn">
            {words.dropDates}
          </Link>
        </div>
      </section>

      <div className="banner-band">{text('about.banner')}</div>

      <section className="split split-reverse">
        <div className="split-text">
          <h2>{words.communityManagers}</h2>
          <p>{text('about.cm1')}</p>
          <p>{text('about.cm2')}</p>
          <Link to="/become-a-community-manager" className="btn">
            {words.becomeCm}
          </Link>
        </div>
        <img className="split-photo" src="/photos/parsnips-carrots.jpg" alt={t.photos.parsnips} />
      </section>

      <section className="split founder">
        <img className="split-photo founder-photo" src="/photos/evan-payne.png" alt={t.photos.evan} />
        <div className="split-text">
          <h2>{words.leadership}</h2>
          <p className="founder-role">
            <strong>Evan Payne</strong>
            <br />
            {words.evanRole}
          </p>
          <p>{words.evan1}</p>
          <p>{words.evan2}</p>
          <p>{words.evan3}</p>
        </div>
      </section>

      <PartnersSection tone="yellow" />
    </>
  )
}
