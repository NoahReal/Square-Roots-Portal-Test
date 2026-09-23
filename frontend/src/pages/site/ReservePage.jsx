import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { dateAtTime, longDate, money, timeLeft, timeRange } from '../../format'
import {
  PRICE_CHOICES, forgetDetails, forgetReservation, myReservationTokens, rememberReservation, saveDetails, savedDetails,
} from '../../reservations'
import Stepper from '../../components/Stepper'

// The public Reserve page: pick a location, how many bundles and a price, and reserve.
// No account needed. A returning customer's details are filled in, so it's one tap.
export default function ReservePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [options, setOptions] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [saved] = useState(savedDetails)

  const [siteId, setSiteId] = useState(Number(params.get('site')) || saved?.site || null)
  const [dropId, setDropId] = useState(null)
  const [bundles, setBundles] = useState(1)
  const [tier, setTier] = useState(saved?.tier ?? 'standard')
  const [delivery, setDelivery] = useState(false)
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
      .catch(() => setLoadError('We couldn’t load the locations. Check your connection and try again.'))
  }, [])

  const site = options?.sites.find((s) => s.id === siteId)
  // The drop defaults to the next one at the chosen location.
  const drop = site?.drops.find((d) => d.id === dropId) ?? site?.drops[0]
  const full = drop ? bundles > drop.bundles_left : false
  const priceOf = (choice) => (choice.priceKey ? Number(options.prices[choice.priceKey]) : 0)
  const total =
    options && bundles * priceOf(PRICE_CHOICES.find((c) => c.value === tier)) +
      (delivery && site?.delivery_partner ? Number(options.prices.delivery_fee) : 0)

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
    if (!drop) problems.site_drop = 'Choose a location.'
    if (!form.customer_name.trim()) problems.customer_name = 'Please add your name.'
    if (!form.email.trim() && !form.phone.trim()) problems.email = 'Add an email or a phone number, so we can reach you if plans change.'
    if (delivery && !form.delivery_address.trim()) problems.delivery_address = 'Add the address to deliver to.'
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
          join_waitlist: full,
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
        setOptions((current) => ({
          ...current,
          sites: current.sites.map((s) => ({
            ...s,
            drops: s.drops.map((d) => (d.id === drop.id ? { ...d, bundles_left: err.data.bundles_left } : d)),
          })),
        }))
      }
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
      setBusy(false)
    }
  }

  return (
    <>
      <section className="title-block title-block-compact">
        <h1>Reserve a Bundle</h1>
        <p>10 lbs of fresh Nova Scotia produce. Reserve now and pay at the drop: whatever works for you.</p>
      </section>

      <section className="reserve-section">
        <div className="reserve-container">
          {state?.cancelled && (
            <div className="notice notice-success" role="status">
              Your reservation is cancelled and your details are deleted.
            </div>
          )}
          <MyReservations />

          {loadError && <div className="notice notice-error">{loadError}</div>}
          {!options && !loadError && <p className="muted">Loading locations…</p>}

          {options && (
            <form className="reserve-form" onSubmit={handleSubmit} noValidate>
              {errors.detail && (
                <div className="notice notice-error" role="alert">
                  {[].concat(errors.detail).join(' ')}
                </div>
              )}

              <Step number="1" title="Where will you pick up?">
                <div className={'field' + (errors.site_drop ? ' has-error' : '')}>
                  <label htmlFor="reserve-site">Location</label>
                  <select id="reserve-site" value={siteId ?? ''} onChange={(e) => chooseSite(Number(e.target.value) || null)}>
                    <option value="">Choose your location…</option>
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
                  <Step number="2" title="How many bundles?">
                    <Stepper
                      id="reserve-bundles"
                      value={bundles}
                      onChange={setBundles}
                      min={1}
                      max={options.max_bundles}
                      size="small"
                      label="bundles"
                    />
                    <p className="muted reserve-hint">Each bundle is 10 lbs of fresh produce.</p>
                  </Step>

                  <Step number="3" title="Pay what works for you">
                    <fieldset className="price-choices">
                      <legend className="visually-hidden">Price per bundle</legend>
                      {PRICE_CHOICES.map((choice) => (
                        <label key={choice.value} className={'price-choice' + (tier === choice.value ? ' price-choice-on' : '')}>
                          <input
                            type="radio"
                            name="price-tier"
                            value={choice.value}
                            checked={tier === choice.value}
                            onChange={() => setTier(choice.value)}
                          />
                          <span className="price-choice-amount">{choice.priceKey ? money(options.prices[choice.priceKey]) : '$0'}</span>
                          <span className="price-choice-title">{choice.title}</span>
                          <span className="price-choice-text">{choice.text}</span>
                        </label>
                      ))}
                    </fieldset>
                    <p className="muted reserve-hint">Every choice is private and gets the same bundle.</p>
                  </Step>

                  {site.delivery_partner && (
                    <Step number="4" title="Pick up or delivery?">
                      <fieldset className="choice-group">
                        <legend className="visually-hidden">Pick up or delivery</legend>
                        <label className={'choice' + (!delivery ? ' choice-on' : '')}>
                          <input type="radio" name="delivery" checked={!delivery} onChange={() => setDelivery(false)} />
                          I’ll pick up at the drop
                        </label>
                        <label className={'choice' + (delivery ? ' choice-on' : '')}>
                          <input type="radio" name="delivery" checked={delivery} onChange={() => setDelivery(true)} />
                          Deliver to my home with {site.delivery_partner} ({money(options.prices.delivery_fee)})
                        </label>
                      </fieldset>
                      {delivery && (
                        <TextField
                          label="Delivery address"
                          id="delivery_address"
                          autoComplete="street-address"
                          value={form.delivery_address}
                          onChange={update('delivery_address')}
                          error={errors.delivery_address}
                        />
                      )}
                    </Step>
                  )}

                  <Step number={site.delivery_partner ? '5' : '4'} title="Your details">
                    <TextField
                      label="Your name"
                      id="customer_name"
                      autoComplete="name"
                      value={form.customer_name}
                      onChange={update('customer_name')}
                      error={errors.customer_name}
                    />
                    <TextField
                      label="Email"
                      hint="for your confirmation and pickup code"
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={update('email')}
                      error={errors.email}
                    />
                    <TextField
                      label="Phone"
                      hint="if you'd rather not use email"
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
                    <label className="check">
                      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      Remember my details on this device
                    </label>
                  </Step>

                  <div className="reserve-summary">
                    <div>
                      <span className="reserve-summary-label">{full ? 'If a spot opens up, you’ll pay' : 'You’ll pay at the drop'}</span>
                      <span className="reserve-summary-total">{money(total)}</span>
                    </div>
                    <button className="btn btn-primary btn-large" disabled={busy}>
                      {busy ? 'One moment…' : full ? 'Join the waitlist' : `Reserve ${bundles} ${bundles === 1 ? 'bundle' : 'bundles'}`}
                    </button>
                  </div>
                  <p className="reserve-privacy">
                    Your details go only to your Community Manager and the Square Roots team, and are used only for this
                    reservation. If you cancel, they’re deleted.
                  </p>
                </>
              )}
            </form>
          )}
        </div>
      </section>
    </>
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
  if (!site.online_reservations) {
    return (
      <div className="notice notice-info">
        {site.name} doesn’t take online reservations yet. Just come by on drop day, or{' '}
        {site.instagram_url || site.facebook_url ? (
          <a href={site.instagram_url || site.facebook_url} target="_blank" rel="noreferrer">
            message the location
          </a>
        ) : (
          <Link to="/contact-us">contact us</Link>
        )}{' '}
        to hold a bundle. See all dates on <Link to="/drop-dates-locations">Drop Dates &amp; Locations</Link>.
      </div>
    )
  }
  if (!drop) {
    return (
      <div className="notice notice-info">
        There’s no drop open for reservations at {site.name} right now. New dates are added every two weeks, so check
        back soon.
      </div>
    )
  }
  return (
    <div className="drop-choice">
      {site.drops.length > 1 && (
        <fieldset className="choice-group choice-row">
          <legend>Which drop?</legend>
          {site.drops.map((d) => (
            <label key={d.id} className={'choice' + (d.id === drop.id ? ' choice-on' : '')}>
              <input type="radio" name="drop" checked={d.id === drop.id} onChange={() => onChoose(d.id)} />
              {longDate(d.drop_date)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="drop-card">
        <p className="drop-card-when">
          {longDate(drop.drop_date)}, {timeRange(drop.starts_at, drop.ends_at)}
        </p>
        <p>{site.address}</p>
        <p className="muted">
          Reserve by {dateAtTime(drop.order_cutoff)} ({timeLeft(drop.order_cutoff)})
        </p>
        <Availability drop={drop} bundles={bundles} />
      </div>
    </div>
  )
}

function Availability({ drop, bundles }) {
  const left = drop.bundles_left
  if (left === 0) {
    return (
      <p className="availability availability-full" role="status">
        All bundles for this drop are reserved. Join the waitlist and we’ll email you if one opens up
        {drop.waitlist_count > 0 ? ` (${drop.waitlist_count} ${drop.waitlist_count === 1 ? 'person' : 'people'} waiting)` : ''}.
      </p>
    )
  }
  if (bundles > left) {
    return (
      <p className="availability availability-full" role="status">
        Only {left} {left === 1 ? 'bundle is' : 'bundles are'} left. Choose fewer, or join the waitlist.
      </p>
    )
  }
  return (
    <p className={'availability' + (left <= 3 ? ' availability-low' : '')}>
      {left <= 3 ? `Only ${left} left` : `${left} bundles left`}
    </p>
  )
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
      <h2>Your reservations</h2>
      <ul>
        {mine.map((r) => (
          <li key={r.token}>
            <Link to={`/reserve/manage/${r.token}`}>
              <strong>{longDate(r.drop.drop_date)}</strong> at {r.site.name}: {r.bundles}{' '}
              {r.bundles === 1 ? 'bundle' : 'bundles'}
              {r.status === 'waitlisted' ? ' (waitlist)' : ''}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
