import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { LanguageSwitch, useLanguage } from '../i18n'
import { savedDetails } from '../reservations'

// "Reserve your bundle" on the home page, right under the hero: the next drop, and a quick way in.
export default function ReserveFeature() {
  const { t, format } = useLanguage()
  const navigate = useNavigate()
  const [options, setOptions] = useState(null)
  const [siteId, setSiteId] = useState(() => savedDetails()?.site ?? '')

  useEffect(() => {
    api('/reserve/options/').then(setOptions).catch(() => setOptions(null))
  }, [])

  // The soonest drop anyone can still reserve for.
  const next = options?.sites
    .flatMap((site) => site.drops.slice(0, 1))
    .sort((a, b) => a.drop_date.localeCompare(b.drop_date))[0]

  function go(event) {
    event.preventDefault()
    navigate(siteId ? `/reserve?site=${siteId}` : '/reserve')
  }

  return (
    <section className="reserve-feature" aria-labelledby="reserve-feature-title">
      <div className="reserve-feature-inner">
        <div>
          <h2 id="reserve-feature-title">{t.homeReserveTitle}</h2>
          {next ? (
            <>
              <p className="reserve-feature-next">{t.homeNextDrop(format.longDate(next.drop_date))}</p>
              <p>{t.homeReserveBy(format.dateAtTime(next.order_cutoff))}</p>
            </>
          ) : (
            <p>{t.homeIntro}</p>
          )}
          {options && (
            <p className="muted">
              {t.homePayWhatWorks(format.money(options.prices.standard), format.money(options.prices.at_cost))}
              {options.money.free_bundles_covered > 0 && t.homeGifts(format.number(options.money.free_bundles_covered))}
            </p>
          )}
          <p className="reserve-feature-links">
            <Link to="/whats-in-the-bundle">{t.whatsInTheBundle}</Link>
          </p>
          <LanguageSwitch />
        </div>
        <form className="reserve-feature-form" onSubmit={go}>
          <label htmlFor="reserve-feature-site" className="visually-hidden">
            {t.yourLocation}
          </label>
          <select id="reserve-feature-site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{t.chooseLocation}</option>
            {options?.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-large">{t.reserveABundle}</button>
        </form>
      </div>
    </section>
  )
}
