import SignupForm from '../../components/SignupForm'
import { useLanguage } from '../../i18n'
import { useSiteText } from '../../siteText'

export default function BecomeCommunityManagerPage() {
  const text = useSiteText()
  const { t } = useLanguage()
  return (
    <>
      <section className="title-block title-block-left">
        <h1>{text('cm.title')}</h1>
        <p>{text('cm.intro')}</p>
      </section>

      <section className="centered-intro">
        <h2>{t.cm.become}</h2>
        <p>{text('cm.apply')}</p>
      </section>

      <section className="form-split" id="apply">
        <img className="form-split-photo" src="/photos/boxes-apples-carrots.jpg" alt={t.photos.boxes} />
        <div className="form-split-form form-split-yellow">
          <h2 className="form-heading">{t.cm.become}</h2>
          <SignupForm roleSlug="community-manager" />
        </div>
      </section>
    </>
  )
}
