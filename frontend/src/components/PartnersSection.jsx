import { useLanguage } from '../i18n'

// "Our Partners & Supporters" logos, as on the live home and About pages.
export default function PartnersSection({ tone = 'cream' }) {
  const { t } = useLanguage()
  return (
    <section className={'partners-section partners-' + tone}>
      <h2>{t.partners.title}</h2>
      <div className="partner-logos">
        <img src="/logos/nova-scotia.png" alt={t.partners.novaScotiaAlt} />
        <img src="/logos/saint-marys.png" alt={t.partners.saintMarysAlt} />
      </div>
    </section>
  )
}
