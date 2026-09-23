import SignupForm from '../../components/SignupForm'

const BENEFITS = [
  {
    title: 'Earn From Your Seconds Produce',
    text: 'Our farmers earn cash from produce that would otherwise be sent to landfills or reploughed. This produce is less than cosmetically perfect but is still healthy and edible.',
  },
  {
    title: 'Consistent Orders',
    text: "We order our produce 24 times a year, generally bi-weekly. If you don't have seconds produce that week, no worries, we understand!",
  },
  {
    title: 'Social Good',
    text: 'We sell to communities at reduced prices and promote social entrepreneurship to solve food insecurity.',
  },
]

export default function ForFarmsPage() {
  return (
    <>
      <section className="title-block title-block-compact">
        <h1>For Farms</h1>
      </section>

      <section className="benefits" style={{ backgroundImage: 'url(/photos/field-rows.jpg)' }}>
        <ol className="benefit-cards">
          {BENEFITS.map((benefit, index) => (
            <li key={benefit.title}>
              <span className="benefit-number">{index + 1}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="form-split" id="interested">
        <img className="form-split-photo" src="/photos/market-potatoes.jpg" alt="Seconds potatoes and beets ready to sell" />
        <div className="form-split-form">
          <h2>Interested?</h2>
          <p>
            Sign up to sell us your seconds produce. Once we approve your account, you can post what you have available
            and see our orders in the partner portal.
          </p>
          <SignupForm roleSlug="farm" />
        </div>
      </section>
    </>
  )
}
