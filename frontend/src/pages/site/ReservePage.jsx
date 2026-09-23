import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { LanguageSwitch, useLanguage } from '../../i18n'
import {
  PRICE_CHOICES, forgetDetails, forgetReservation, myReservationTokens, rememberReservation, saveDetails, savedDetails,
} from '../../reservations'
import Stepper from '../../components/Stepper'
import MoneyBreakdown from '../../components/MoneyBreakdown'

// The public Reserve page: pick a location, how many bundles and a price, and reserve.
// No account needed. A returning customer's details are filled in, so it's one tap.
// All the words are in i18n.jsx, in English and French.
export default function ReservePage() {
  const { t, lang, format } = useLanguage()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [options, setOptions] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [saved] = useState(savedDetails)

  const [siteId, setSiteId] = useState(Number(params.get('site')) || saved?.site || null)
  const [dropId, setDropId] = useState(null)
  const [bundles, setBundles] = useState(1)
  const [tier, setTier] = useState(saved?.tier ?? 'standard')
  const [delivery, setDelivery] = useState(false)
  const [gift, setGift] = useState(0)
  const [everyDrop, setEveryDrop] = useState(false)
  const [form, setForm] = useState({
    customer_name: saved?.customer_name ?? '',
    email: saved?.email ?? '',
    phone: saved?.phone ?? '',
    delivery_address: saved?.delivery_address ?? '',
    website: '', // the spam trap; people never see it
  })
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/reserve/options/')
      .then(setOptions)
      .catch(() => setLoadError(true))
  }, [])

  const site = options?.sites.find((s) => s.id === siteId)
  // The drop defaults to the next one at the chosen location.
  const drop = site?.drops.find((d) => d.id === dropId) ?? site?.drops[0]
  const full = drop ? bundles > drop.bundles_left : false
  const priceOf = (choice) => (choice.priceKey ? Number(options.prices[choice.priceKey]) : 0)
  const total =
    options && bundles * priceOf(PRICE_CHOICES.find((c) => c.value === tier)) +
      (delivery && site?.delivery_partner ? Number(options.prices.delivery_fee) : 0) +
      gift

  function chooseSite(id) {
    setSiteId(id)
    setDropId(null)
    setDelivery(false)
    setErrors({})
  }

  // Typing in a box clears its error message.
  const update = (name) => (event) => {
    setForm({ ...form, [name]: event.target.value })
    if (errors[name]) setErrors({ ...errors, [name]: undefined })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const problems = {}
    if (!drop) problems.site_drop = t.errLocation
    if (!form.customer_name.trim()) problems.customer_name = t.errName
    if (!form.email.trim() && !form.phone.trim()) problems.email = t.errContact
    if (delivery && !form.delivery_address.trim()) problems.delivery_address = t.errAddress
    setErrors(problems)
    if (Object.keys(problems).length) {
      document.querySelector('.has-error input, .has-error select')?.focus()
      return
    }

    setBusy(true)
    try {
      const reservation = await api('/reserve/', {
        method: 'POST',
        body: {
          ...form,
          site_drop: drop.id,
          bundles,
          price_tier: tier,
          delivery: delivery && Boolean(site.delivery_partner),
          pay_it_forward: gift,
          every_drop: everyDrop,
          join_waitlist: full,
          language: lang,
        },
      })
      rememberReservation(reservation.token)
      if (remember) {
        saveDetails({
          site: site.id, tier, customer_name: form.customer_name, email: form.email, phone: form.phone,
          delivery_address: form.delivery_address,
        })
      } else {
        forgetDetails()
      }
      navigate(`/reserve/manage/${reservation.token}`, { state: { justReserved: true } })
    } catch (err) {
      if (err.status === 409) {
        // Someone else reserved first: show what's left now.
        const left = err.data.bundles_left
        setOptions((current) => ({
          ...current,
          sites: current.sites.map((s) => ({
            ...s,
            drops: s.drops.map((d) => (d.id === drop.id ? { ...d, bundles_left: left } : d)),
          })),
        }))
        setErrors({ detail: left === 0 ? t.allReserved('') : t.onlyLeftChooseFewer(left) })
      } else {
        setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
      }
      setBusy(false)
    }
  }

  return (
    <>
      <section className="title-block title-block-compact">
        <h1>{t.reserveTitle}</h1>
        <p>{t.reserveLead}</p>
        <LanguageSwitch />
      </section>

      <section className="reserve-section">
        <div className="reserve-container">
          {state?.cancelled && (
            <div className="notice notice-success" role="status">
              {t.cancelledNotice}
            </div>
          )}
          <MyReservations />

          {loadError && <div className="notice notice-error">{t.loadError}</div>}
          {!options && !loadError && <p className="muted">{t.loadingLocations}</p>}

          {options && (
            <form className="reserve-form" onSubmit={handleSubmit} noValidate>
              {errors.detail && (
                <div className="notice notice-error" role="alert">
                  {[].concat(errors.detail).join(' ')}
                </div>
              )}

              <Step number="1" title={t.step1}>
                <div className={'field' + (errors.site_drop ? ' has-error' : '')}>
                  <label htmlFor="reserve-site">{t.location}</label>
                  <select id="reserve-site" value={siteId ?? ''} onChange={(e) => chooseSite(Number(e.target.value) || null)}>
                    <option value="">{t.chooseLocation}</option>
                    {options.sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <FieldError error={errors.site_drop} />
                </div>
                {site && <DropChoice site={site} drop={drop} onChoose={setDropId} bundles={bundles} />}
              </Step>

              {drop && (
                <>
                  <Step number="2" title={t.step2}>
                    <Stepper
                      id="reserve-bundles"
                      value={bundles}
                      onChange={setBundles}
                      min={1}
                      max={options.max_bundles}
                      size="small"
                      label={lang === 'fr' ? 'paniers' : 'bundles'}
                    />
                    <p className="muted reserve-hint">{t.bundleWeight}</p>
                  </Step>

                  <Step number="3" title={t.step3}>
                    <fieldset className="price-choices">
                      <legend className="visually-hidden">{t.pricePerBundle}</legend>
                      {PRICE_CHOICES.map((choice) => (
                        <label key={choice.value} className={'price-choice' + (tier === choice.value ? ' price-choice-on' : '')}>
                          <input
                            type="radio"
                            name="price-tier"
                            value={choice.value}
                            checked={tier === choice.value}
                            onChange={() => {
                              setTier(choice.value)
                              if (choice.value !== 'standard') setGift(0)
                            }}
                          />
                          <span className="price-choice-amount">
                            {format.money(choice.priceKey ? options.prices[choice.priceKey] : 0)}
                          </span>
                          <span className="price-choice-title">{t[choice.words + 'Title']}</span>
                          <span className="price-choice-text">{t[choice.words + 'Text']}</span>
                        </label>
                      ))}
                    </fieldset>
                    <p className="muted reserve-hint">{t.privateChoice}</p>
                    {tier === 'standard' && <GiftChoice gift={gift} onChange={setGift} money={options.money} />}
                    <MoneyBreakdown money={options.money} />
                  </Step>

                  {site.delivery_partner && (
                    <Step number="4" title={t.step4Delivery}>
                      <fieldset className="choice-group">
                        <legend className="visually-hidden">{t.step4Delivery}</legend>
                        <label className={'choice' + (!delivery ? ' choice-on' : '')}>
                          <input type="radio" name="delivery" checked={!delivery} onChange={() => setDelivery(false)} />
                          {t.pickUpAtDrop}
                        </label>
                        <label className={'choice' + (delivery ? ' choice-on' : '')}>
                          <input type="radio" name="delivery" checked={delivery} onChange={() => setDelivery(true)} />
                          {t.deliverWith(site.delivery_partner, format.money(options.prices.delivery_fee))}
                        </label>
                      </fieldset>
                      {delivery && (
                        <TextField
                          label={t.deliveryAddress}
                          id="delivery_address"
                          autoComplete="street-address"
                          value={form.delivery_address}
                          onChange={update('delivery_address')}
                          error={errors.delivery_address}
                        />
                      )}
                    </Step>
                  )}

                  <Step number={site.delivery_partner ? '5' : '4'} title={t.stepDetails}>
                    <TextField
                      label={t.yourName}
                      id="customer_name"
                      autoComplete="name"
                      value={form.customer_name}
                      onChange={update('customer_name')}
                      error={errors.customer_name}
                    />
                    <TextField
                      label={t.email}
                      hint={t.emailHint}
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={update('email')}
                      error={errors.email}
                    />
                    <TextField
                      label={t.phone}
                      hint={t.phoneHint}
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={update('phone')}
                      error={errors.phone}
                    />
                    {/* Spam trap: hidden from people, but bots fill it in. */}
                    <div className="visually-hidden" aria-hidden="true">
                      <label htmlFor="reserve-website">Website</label>
                      <input id="reserve-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update('website')} />
                    </div>
                    <label className="check check-with-hint">
                      <input type="checkbox" checked={everyDrop} onChange={(e) => setEveryDrop(e.target.checked)} />
                      <span>
                        {t.everyDrop(site.name)}
                        <span className="field-hint"> {t.everyDropHint}</span>
                      </span>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      {t.rememberMe}
                    </label>
                  </Step>

                  <div className="reserve-summary">
                    <div>
                      <span className="reserve-summary-label">{full ? t.ifSpotOpens : t.payAtDrop}</span>
                      <span className="reserve-summary-total">{format.money(total)}</span>
                    </div>
                    <button className="btn btn-primary btn-large" disabled={busy}>
                      {busy ? t.oneMoment : full ? t.joinWaitlist : t.reserveN(bundles)}
                    </button>
                  </div>
                  <p className="reserve-privacy">{t.privacy}</p>
                </>
              )}
            </form>
          )}
        </div>
      </section>
    </>
  )
}

const GIFTS = [0, 2, 5, 10]

// "Pay it forward": an optional gift on top of the $10, paid at the drop, to help cover free bundles.
function GiftChoice({ gift, onChange, money }) {
  const { t, format } = useLanguage()
  return (
    <fieldset className="choice-group choice-row gift-choice">
      <legend>
        {t.giftQuestion} <span className="field-hint">{t.giftHint}</span>
      </legend>
      {GIFTS.map((amount) => (
        <label key={amount} className={'choice' + (gift === amount ? ' choice-on' : '')}>
          <input type="radio" name="gift" checked={gift === amount} onChange={() => onChange(amount)} />
          {amount === 0 ? t.noThanks : `+${format.money(amount).replace(/[.,]00/, '')}`}
        </label>
      ))}
      {money.free_bundles_covered > 0 && (
        <p className="muted reserve-hint">{t.giftsCovered(format.number(money.free_bundles_covered))}</p>
      )}
    </fieldset>
  )
}

function Step({ number, title, children }) {
  return (
    <section className="reserve-step" aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`}>
        <span className="reserve-step-number" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

// The chosen location's drop (or a choice of the next two), and how many bundles are left.
function DropChoice({ site, drop, onChoose, bundles }) {
  const { t, format } = useLanguage()
  if (!site.online_reservations) {
    return (
      <div className="notice notice-info">
        {t.noOnline(site.name)}
        {site.instagram_url || site.facebook_url ? (
          <a href={site.instagram_url || site.facebook_url} target="_blank" rel="noreferrer">
            {t.messageLocation}
          </a>
        ) : (
          <Link to="/contact-us">{t.contactUs}</Link>
        )}
        {t.toHoldBundle}
        <Link to="/drop-dates-locations">{t.dropDatesLink}</Link>.
      </div>
    )
  }
  if (!drop) return <div className="notice notice-info">{t.noDropOpen(site.name)}</div>
  return (
    <div className="drop-choice">
      {site.drops.length > 1 && (
        <fieldset className="choice-group choice-row">
          <legend>{t.whichDrop}</legend>
          {site.drops.map((d) => (
            <label key={d.id} className={'choice' + (d.id === drop.id ? ' choice-on' : '')}>
              <input type="radio" name="drop" checked={d.id === drop.id} onChange={() => onChoose(d.id)} />
              {format.longDate(d.drop_date)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="drop-card">
        <p className="drop-card-when">
          {format.longDate(drop.drop_date)}, {format.timeRange(drop.starts_at, drop.ends_at)}
        </p>
        <p>{site.address}</p>
        <p className="muted">{t.reserveBy(format.dateAtTime(drop.order_cutoff), format.timeLeft(drop.order_cutoff))}</p>
        <Availability drop={drop} bundles={bundles} />
      </div>
    </div>
  )
}

function Availability({ drop, bundles }) {
  const { t } = useLanguage()
  const left = drop.bundles_left
  if (left === 0) {
    return (
      <p className="availability availability-full" role="status">
        {t.allReserved(drop.waitlist_count > 0 ? t.peopleWaiting(drop.waitlist_count) : '')}
      </p>
    )
  }
  if (bundles > left) {
    return (
      <p className="availability availability-full" role="status">
        {t.onlyLeftChooseFewer(left)}
      </p>
    )
  }
  return <p className={'availability' + (left <= 3 ? ' availability-low' : '')}>{left <= 3 ? t.onlyLeft(left) : t.bundlesLeft(left)}</p>
}

function TextField({ label, hint, id, error, ...inputProps }) {
  return (
    <div className={'field' + (error ? ' has-error' : '')}>
      <label htmlFor={'reserve-' + id}>
        {label}
        {hint && <span className="field-hint"> ({hint})</span>}
      </label>
      <input id={'reserve-' + id} aria-invalid={Boolean(error)} {...inputProps} />
      <FieldError error={error} />
    </div>
  )
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="field-error">{[].concat(error).join(' ')}</p>
}

// Reservations made on this device that haven't happened yet, so people can find them without the email.
function MyReservations() {
  const { t, format } = useLanguage()
  const [mine, setMine] = useState([])

  useEffect(() => {
    const tokens = myReservationTokens()
    Promise.all(
      tokens.map((token) =>
        api(`/reserve/${token}/`).catch((err) => {
          if (err.status === 404) forgetReservation(token) // cancelled
          return null
        })
      )
    ).then((found) => setMine(found.filter((r) => r && r.can_change)))
  }, [])

  if (mine.length === 0) return null
  return (
    <div className="my-reservations">
      <h2>{t.yourReservations}</h2>
      <ul>
        {mine.map((r) => (
          <li key={r.token}>
            <Link to={`/reserve/manage/${r.token}`}>
              <strong>{format.longDate(r.drop.drop_date)}</strong> · {r.site.name}: {t.bundles(r.bundles)}
              {r.status === 'waitlisted' ? ` ${t.waitlistShort}` : ''}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
