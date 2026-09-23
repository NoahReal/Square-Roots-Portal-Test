import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { LanguageSwitch, useLanguage } from '../../i18n'
import { PRICE_CHOICES, calendarFile, forgetReservation, rememberReservation } from '../../reservations'
import Stepper from '../../components/Stepper'
import BundleItems from '../../components/BundleItems'

function directionsUrl(site) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${site.address}, ${site.name}, Nova Scotia`)
}

// A customer's reservation (or waitlist spot), opened from the private link in their email.
// Shows the pickup code, and lets them change or cancel until ordering closes.
export default function ManageReservationPage() {
  const { t, format } = useLanguage()
  const { token } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [reservation, setReservation] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState(state?.justReserved ? 'new' : '')

  useEffect(() => {
    api(`/reserve/${token}/`)
      .then((found) => {
        setReservation(found)
        rememberReservation(token)
      })
      .catch((err) => setError(err.status === 404 ? err.message : 'load'))
  }, [token])

  async function cancel() {
    await api(`/reserve/${token}/`, { method: 'DELETE' })
    forgetReservation(token)
    navigate('/reserve', { state: { cancelled: true } })
  }

  if (error) {
    return (
      <section className="reserve-section">
        <div className="reserve-container">
          <div className="notice notice-error">{error === 'load' ? t.reservationLoadError : error}</div>
          <Link to="/reserve" className="btn btn-primary">
            {t.reserveABundle}
          </Link>
        </div>
      </section>
    )
  }
  if (!reservation) return <p className="muted reserve-container reserve-loading">{t.loadingReservation}</p>

  const waiting = reservation.status === 'waitlisted'
  const { site, drop } = reservation

  return (
    <section className="reserve-section">
      <div className="reserve-container">
        <LanguageSwitch />
        {notice === 'new' && (
          <div className="notice notice-success" role="status">
            {waiting ? t.onWaitlistNotice : t.allSetNotice} {reservation.email ? t.emailedTo(reservation.email) : t.bookmark}
          </div>
        )}
        {notice === 'saved' && (
          <div className="notice notice-success" role="status">
            {t.changesSaved}
          </div>
        )}

        <h1 className="reserve-title">{waiting ? t.onWaitlistTitle : t.yourReservation}</h1>

        {waiting ? (
          <div className="pickup-card pickup-card-waiting">
            <span className="pickup-label">{t.placeInLine}</span>
            <span className="pickup-code">#{reservation.waitlist_position}</span>
            <p>{t.waitlistExplain(Boolean(reservation.email))}</p>
          </div>
        ) : reservation.delivery ? (
          <div className="pickup-card">
            <span className="pickup-label">{t.deliveryBy(site.delivery_partner)}</span>
            <p className="pickup-address">{reservation.delivery_address}</p>
            <p>{t.deliveryExplain}</p>
          </div>
        ) : (
          <div className="pickup-card">
            <span className="pickup-label">{t.pickupCode}</span>
            <span className="pickup-code" aria-label={`${t.pickupCode}: ${reservation.pickup_code.split('').join(' ')}`}>
              {reservation.pickup_code}
            </span>
            <p>{t.pickupExplain}</p>
          </div>
        )}

        {reservation.picked_up && <div className="notice notice-success">{t.pickedUp}</div>}

        <dl className="reservation-details">
          <div>
            <dt>{t.when}</dt>
            <dd>
              {format.longDate(drop.drop_date)}, {format.timeRange(drop.starts_at, drop.ends_at)}
            </dd>
          </div>
          <div>
            <dt>{t.where}</dt>
            <dd>
              Square Roots {site.name}, {site.address}
              <br />
              <a href={directionsUrl(site)} target="_blank" rel="noreferrer">
                {t.directions}
              </a>
            </dd>
          </div>
          <div>
            <dt>{t.bundlesLabel}</dt>
            <dd>{reservation.bundles}</dd>
          </div>
          {Number(reservation.pay_it_forward) > 0 && (
            <div>
              <dt>{t.giftLabel}</dt>
              <dd>{t.thankYou(format.money(reservation.pay_it_forward))}</dd>
            </div>
          )}
          <div>
            <dt>{waiting ? t.payIfSpot : t.payAtDrop}</dt>
            <dd>
              <strong>{format.money(reservation.amount_due)}</strong>
              {reservation.delivery && t.includesDelivery}
            </dd>
          </div>
        </dl>

        <div className="reservation-actions">
          <a className="btn" href={calendarFile(reservation, t)} download="square-roots-drop.ics">
            {t.addToCalendar}
          </a>
          <CopyLinkButton />
        </div>

        <section className="bundle-section" aria-labelledby="in-your-bundle">
          <h2 id="in-your-bundle">{t.inYourBundle}</h2>
          {reservation.bundle.length > 0 ? <BundleItems items={reservation.bundle} /> : <p className="muted">{t.notDecidedYet}</p>}
          <Link to="/whats-in-the-bundle">{t.seeRecipes}</Link>
        </section>

        <EveryDrop reservation={reservation} onChange={setReservation} />

        {reservation.can_change ? (
          editing ? (
            <ChangeForm
              reservation={reservation}
              onSaved={(updated) => {
                setReservation(updated)
                setEditing(false)
                setNotice('saved')
              }}
              onCancelReservation={cancel}
              onClose={() => setEditing(false)}
            />
          ) : (
            <div className="change-prompt">
              <p className="muted">{t.changeUntil(format.dateAtTime(drop.order_cutoff))}</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditing(true)
                  setNotice('')
                }}
              >
                {waiting ? t.changeOrLeave : t.changeOrCancel}
              </button>
            </div>
          )
        ) : (
          !reservation.picked_up && (
            <p className="muted change-prompt">
              {t.changesClosed}
              {site.instagram_url || site.facebook_url ? (
                <a href={site.instagram_url || site.facebook_url} target="_blank" rel="noreferrer">
                  {t.messageSite(site.name)}
                </a>
              ) : (
                <Link to="/contact-us">{t.contactUs}</Link>
              )}
              .
            </p>
          )
        )}
      </div>
    </section>
  )
}

// "Reserve every drop": shows whether it's on, and lets the customer start or stop it.
function EveryDrop({ reservation, onChange }) {
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)
  const { site } = reservation

  async function set(on) {
    setBusy(true)
    try {
      onChange(await api(`/reserve/${reservation.token}/every-drop/`, { method: on ? 'POST' : 'DELETE' }))
    } finally {
      setBusy(false)
    }
  }

  if (reservation.every_drop) {
    return (
      <div className="every-drop-box">
        <p>
          <strong>{t.everyDropOn(site.name)}</strong>
          {t.everyDropOnExplain(t.bundles(reservation.bundles))}
        </p>
        <button className="link-button" onClick={() => set(false)} disabled={busy}>
          {t.stopEveryDrop}
        </button>
      </div>
    )
  }
  if (!reservation.can_change) return null
  return (
    <div className="every-drop-box">
      <p>{t.everyDropOffer(site.name)}</p>
      <button className="btn btn-small" onClick={() => set(true)} disabled={busy}>
        {t.startEveryDrop}
      </button>
    </div>
  )
}

function CopyLinkButton() {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      window.prompt(t.copyPrompt, window.location.href)
    }
  }
  return (
    <button className="btn" onClick={copy}>
      {copied ? t.linkCopied : t.copyLink}
    </button>
  )
}

function ChangeForm({ reservation, onSaved, onCancelReservation, onClose }) {
  const { t, lang, format } = useLanguage()
  const [bundles, setBundles] = useState(reservation.bundles)
  const [tier, setTier] = useState(reservation.price_tier)
  const [gift, setGift] = useState(Number(reservation.pay_it_forward))
  const [delivery, setDelivery] = useState(reservation.delivery)
  const [address, setAddress] = useState(reservation.delivery_address)
  const [contact, setContact] = useState({ email: reservation.email, phone: reservation.phone })
  const [error, setError] = useState('')
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const waiting = reservation.status === 'waitlisted'

  async function save(event) {
    event.preventDefault()
    try {
      const updated = await api(`/reserve/${reservation.token}/`, {
        method: 'PATCH',
        body: {
          bundles, price_tier: tier, pay_it_forward: tier === 'standard' ? gift : 0, delivery,
          delivery_address: address, language: lang, ...contact,
        },
      })
      onSaved(updated)
    } catch (err) {
      const data = err.data || {}
      setError([].concat(data.detail ?? data.bundles ?? data.email ?? data.phone ?? data.delivery_address ?? err.message).join(' '))
    }
  }

  return (
    <form className="change-form" onSubmit={save} noValidate>
      <h2>{waiting ? t.changeTitleWaitlist : t.changeTitle}</h2>
      <div className="field">
        <label htmlFor="change-bundles">{t.bundlesLabel}</label>
        <Stepper
          id="change-bundles"
          value={bundles}
          onChange={setBundles}
          min={1}
          max={waiting ? 4 : reservation.most_bundles}
          size="small"
          label={t.bundlesLabel}
        />
        {!waiting && reservation.most_bundles === reservation.bundles && <p className="field-hint">{t.noMoreLeft}</p>}
      </div>
      <fieldset className="choice-group choice-row">
        <legend>{t.pricePerBundle}</legend>
        {PRICE_CHOICES.map((choice) => (
          <label key={choice.value} className={'choice' + (tier === choice.value ? ' choice-on' : '')}>
            <input type="radio" name="change-tier" checked={tier === choice.value} onChange={() => setTier(choice.value)} />
            {t[choice.words + 'Title']}
          </label>
        ))}
      </fieldset>
      {tier === 'standard' && (
        <fieldset className="choice-group choice-row">
          <legend>{t.giftLabel}</legend>
          {[0, 2, 5, 10].map((amount) => (
            <label key={amount} className={'choice' + (gift === amount ? ' choice-on' : '')}>
              <input type="radio" name="change-gift" checked={gift === amount} onChange={() => setGift(amount)} />
              {amount === 0 ? t.none : `+${format.money(amount).replace(/[.,]00/, '')}`}
            </label>
          ))}
        </fieldset>
      )}
      {reservation.site.delivery_partner && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
            {t.deliverWith(reservation.site.delivery_partner, format.money(reservation.delivery_fee))}
          </label>
          {delivery && (
            <>
              <label htmlFor="change-address" className="visually-hidden">
                {t.deliveryAddress}
              </label>
              <input id="change-address" placeholder={t.deliveryAddress} value={address} onChange={(e) => setAddress(e.target.value)} />
            </>
          )}
        </div>
      )}
      <div className="field">
        <label htmlFor="change-email">{t.email}</label>
        <input id="change-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="change-phone">{t.phone}</label>
        <input id="change-phone" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="change-buttons">
        <button className="btn btn-primary">{t.saveChanges}</button>
        <button type="button" className="btn" onClick={onClose}>
          {t.neverMind}
        </button>
      </div>

      <div className="cancel-zone">
        {confirmingCancel ? (
          <>
            <p>{waiting ? t.leaveWaitlistConfirm : reservation.every_drop ? t.cancelEveryDropConfirm : t.cancelConfirm}</p>
            <div className="change-buttons">
              <button type="button" className="btn btn-danger" onClick={onCancelReservation}>
                {waiting ? t.yesLeave : t.yesCancel}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingCancel(false)}>
                {t.keepIt}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirmingCancel(true)}>
            {waiting ? t.leaveWaitlist : t.cancelMine}
          </button>
        )}
      </div>
    </form>
  )
}
