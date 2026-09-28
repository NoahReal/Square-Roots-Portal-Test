import SignupForm from '../../components/SignupForm'
import { useLanguage } from '../../i18n'
import { useSiteText } from '../../siteText'

// The words are editable on the admin Website Text screen (see siteText.jsx).
const BENEFITS = ['farms.benefit1', 'farms.benefit2', 'farms.benefit3']

export default function ForFarmsPage() {
  const text = useSiteText()
  const { t } = useLanguage()
  return (
    <>
      <section className="title-block title-block-compact">
        <h1>{t.farms.title}</h1>
      </section>

      <section className="benefits" style={{ backgroundImage: 'url(/photos/field-rows.jpg)' }}>
        <ol className="benefit-cards">
          {BENEFITS.map((benefit, index) => (
            <li key={benefit}>
              <span className="benefit-number">{index + 1}</span>
              <h3>{text(benefit + '.title')}</h3>
              <p>{text(benefit + '.text')}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="form-split" id="interested">
        <img className="form-split-photo" src="/photos/market-potatoes.jpg" alt={t.photos.secondsPotatoes} />
        <div className="form-split-form">
          <h2>{t.farms.interested}</h2>
          <p>{text('farms.interested')}</p>
          <SignupForm roleSlug="farm" />
        </div>
      </section>
    </>
  )
}
