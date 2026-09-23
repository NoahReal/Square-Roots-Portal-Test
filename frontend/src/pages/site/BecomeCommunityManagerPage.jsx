import SignupForm from '../../components/SignupForm'

export default function BecomeCommunityManagerPage() {
  return (
    <>
      <section className="title-block title-block-left">
        <h1>So you want to become a Community Manager...</h1>
        <p>
          As a Community Manager, you'll be essential in forming relationships with your community and listening to how
          Square Roots can best provide for their produce needs. You'll order produce bi-weekly or monthly from the
          order forms we send you. Any revenue above the produce cost and our commission is entirely yours!
        </p>
      </section>

      <section className="centered-intro">
        <h2>Become a Community Manager</h2>
        <p>
          Just send us your contact info, where you'd like to start a location, and include an optional message and
          we'll get back to you as soon as possible.
        </p>
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
