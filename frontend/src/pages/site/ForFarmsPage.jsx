import SignupForm from '../../components/SignupForm'
import { useSiteText } from '../../siteText'

// The words are editable on the admin Website Text screen (see siteText.jsx).
const BENEFITS = ['farms.benefit1', 'farms.benefit2', 'farms.benefit3']

export default function ForFarmsPage() {
  const text = useSiteText()
  return (
    <>
      <section className="title-block title-block-compact">
        <h1>For Farms</h1>
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
        <img className="form-split-photo" src="/photos/market-potatoes.jpg" alt="Seconds potatoes and beets ready to sell" />
        <div className="form-split-form">
          <h2>Interested?</h2>
          <p>{text('farms.interested')}</p>
          <SignupForm roleSlug="farm" />
        </div>
      </section>
    </>
  )
}
