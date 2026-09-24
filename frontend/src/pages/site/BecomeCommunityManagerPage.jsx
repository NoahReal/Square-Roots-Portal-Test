import SignupForm from '../../components/SignupForm'
import { useSiteText } from '../../siteText'

export default function BecomeCommunityManagerPage() {
  const text = useSiteText()
  return (
    <>
      <section className="title-block title-block-left">
        <h1>{text('cm.title')}</h1>
        <p>{text('cm.intro')}</p>
      </section>

      <section className="centered-intro">
        <h2>Become a Community Manager</h2>
        <p>{text('cm.apply')}</p>
      </section>

      <section className="form-split" id="apply">
        <img className="form-split-photo" src="/photos/boxes-apples-carrots.jpg" alt="Boxes of apples, carrots and potatoes" />
        <div className="form-split-form form-split-yellow">
          <h2 className="form-heading">Become a Community Manager</h2>
          <SignupForm roleSlug="community-manager" />
        </div>
      </section>
    </>
  )
}
