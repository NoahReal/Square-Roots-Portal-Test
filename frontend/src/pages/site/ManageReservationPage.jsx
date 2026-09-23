import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { dateAtTime, longDate, money, timeRange } from '../../format'
import { PRICE_CHOICES, calendarFile, forgetReservation, rememberReservation } from '../../reservations'
import Stepper from '../../components/Stepper'

function directionsUrl(site) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${site.address}, ${site.name}, Nova Scotia`)
}

// A customer's reservation (or waitlist spot), opened from the private link in their email.
// Shows the pickup code, and lets them change or cancel until ordering closes.
export default function ManageReservationPage() {
  const { token } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const [reservation, setReservation] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState(state?.justReserved ? 'new' : '')

  useEffect(() => {
    api(`/reserve/${token}/`)
      .then((found) => {
        setReservation(found)
        rememberReservation(token)
      })
      .catch((err) => setError(err.status === 404 ? err.message : 'We couldn’t load your reservation. Try again in a moment.'))
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
          <div className="notice notice-error">{error}</div>
          <Link to="/reserve" className="btn btn-primary">
            Reserve a bundle
          </Link>
        </div>
      </section>
    )
  }
  if (!reservation) return <p className="muted reserve-container reserve-loading">Loading your reservation…</p>

  const waiting = reservation.status === 'waitlisted'
  const { site, drop } = reservation

  return (
    <section className="reserve-section">
      <div className="reserve-container">
        {notice === 'new' && (
          <div className="notice notice-success" role="status">
            {waiting
              ? 'You’re on the waitlist.'
              : 'You’re all set! Your bundle is reserved.'}{' '}
            {reservation.email
              ? `We’ve emailed the details to ${reservation.email}.`
              : 'Bookmark this page: it’s how you change or cancel.'}
          </div>
        )}
        {notice === 'saved' && (
          <div className="notice notice-success" role="status">
            Your changes are saved.
          </div>
        )}

        <h1 className="reserve-title">{waiting ? 'You’re on the waitlist' : 'Your reservation'}</h1>

        {waiting ? (
          <div className="pickup-card pickup-card-waiting">
            <span className="pickup-label">Your place in line</span>
            <span className="pickup-code">#{reservation.waitlist_position}</span>
            <p>
              If a bundle opens up before ordering closes, it’s reserved for you automatically
              {reservation.email ? ' and we’ll email you' : ''}. Check back here any time.
            </p>
          </div>
        ) : reservation.delivery ? (
          <div className="pickup-card">
            <span className="pickup-label">Delivery by {site.delivery_partner}</span>
            <p className="pickup-address">{reservation.delivery_address}</p>
            <p>Your bundle will be delivered on drop day. Please have payment ready.</p>
          </div>
        ) : (
          <div className="pickup-card">
            <span className="pickup-label">Your pickup code</span>
            <span className="pickup-code" aria-label={`Pickup code ${reservation.pickup_code.split('').join(' ')}`}>
              {reservation.pickup_code}
            </span>
            <p>Show this at the drop. Your Community Manager will find your bundle.</p>
          </div>
        )}

        {reservation.picked_up && <div className="notice notice-success">Picked up. Enjoy your produce!</div>}

        <dl className="reservation-details">
          <div>
            <dt>When</dt>
            <dd>
              {longDate(drop.drop_date)}, {timeRange(drop.starts_at, drop.ends_at)}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>
              Square Roots {site.name}, {site.address}
              <br />
              <a href={directionsUrl(site)} target="_blank" rel="noreferrer">
                Directions
              </a>
            </dd>
          </div>
          <div>
            <dt>Bundles</dt>
            <dd>{reservation.bundles}</dd>
          </div>
          {Number(reservation.pay_it_forward) > 0 && (
            <div>
              <dt>Gift for a neighbour</dt>
              <dd>{money(reservation.pay_it_forward)}. Thank you!</dd>
            </div>
          )}
          <div>
            <dt>{waiting ? 'You’ll pay if a spot opens' : 'You’ll pay at the drop'}</dt>
            <dd>
              <strong>{money(reservation.amount_due)}</strong>
              {reservation.delivery && ' (includes delivery)'}
            </dd>
          </div>
        </dl>

        <div className="reservation-actions">
          <a className="btn" href={calendarFile(reservation)} download="square-roots-drop.ics">
            Add to my calendar
          </a>
          <CopyLinkButton />
        </div>

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
              <p className="muted">You can change or cancel until {dateAtTime(drop.order_cutoff)}</p>
              <button className="btn btn-primary" onClick={() => { setEditing(true); setNotice('') }}>
                {waiting ? 'Change or leave the waitlist' : 'Change or cancel'}
              </button>
            </div>
          )
        ) : (
          !reservation.picked_up && (
            <p className="muted change-prompt">
              Changes for this drop have closed. If something’s come up, please{' '}
              {site.instagram_url || site.facebook_url ? (
                <a href={site.instagram_url || site.facebook_url} target="_blank" rel="noreferrer">
                  message Square Roots {site.name}
                </a>
              ) : (
                <Link to="/contact-us">contact us</Link>
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
          <strong>You reserve every {site.name} drop.</strong> Each time a new drop is scheduled, we reserve{' '}
          {reservation.bundles} {reservation.bundles === 1 ? 'bundle' : 'bundles'} for you and email you.
        </p>
        <button className="link-button" onClick={() => set(false)} disabled={busy}>
          Stop reserving every drop
        </button>
      </div>
    )
  }
  if (!reservation.can_change) return null
  return (
    <div className="every-drop-box">
      <p>Coming every time? We can reserve for you at every {site.name} drop, and email you each time.</p>
      <button className="btn btn-small" onClick={() => set(true)} disabled={busy}>
        Reserve every drop for me
      </button>
    </div>
  )
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      window.prompt('Copy this link:', window.location.href)
    }
  }
  return (
    <button className="btn" onClick={copy}>
      {copied ? 'Link copied' : 'Copy link to this page'}
    </button>
  )
}

function ChangeForm({ reservation, onSaved, onCancelReservation, onClose }) {
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
        body: { bundles, price_tier: tier, pay_it_forward: tier === 'standard' ? gift : 0, delivery, delivery_address: address, ...contact },
      })
      onSaved(updated)
    } catch (err) {
      const data = err.data || {}
      setError([].concat(data.detail ?? data.bundles ?? data.email ?? data.phone ?? data.delivery_address ?? err.message).join(' '))
    }
  }

  return (
    <form className="change-form" onSubmit={save} noValidate>
      <h2>Change your {waiting ? 'waitlist spot' : 'reservation'}</h2>
      <div className="field">
        <label htmlFor="change-bundles">Bundles</label>
        <Stepper
          id="change-bundles"
          value={bundles}
          onChange={setBundles}
          min={1}
          max={waiting ? 4 : reservation.most_bundles}
          size="small"
          label="bundles"
        />
        {!waiting && reservation.most_bundles === reservation.bundles && (
          <p className="field-hint">No more bundles are left to add at this drop.</p>
        )}
      </div>
      <fieldset className="choice-group choice-row">
        <legend>Price per bundle</legend>
        {PRICE_CHOICES.map((choice) => (
          <label key={choice.value} className={'choice' + (tier === choice.value ? ' choice-on' : '')}>
            <input type="radio" name="change-tier" checked={tier === choice.value} onChange={() => setTier(choice.value)} />
            {choice.title}
          </label>
        ))}
      </fieldset>
      {tier === 'standard' && (
        <fieldset className="choice-group choice-row">
          <legend>Gift for a neighbour</legend>
          {[0, 2, 5, 10].map((amount) => (
            <label key={amount} className={'choice' + (gift === amount ? ' choice-on' : '')}>
              <input type="radio" name="change-gift" checked={gift === amount} onChange={() => setGift(amount)} />
              {amount === 0 ? 'None' : `+$${amount}`}
            </label>
          ))}
        </fieldset>
      )}
      {reservation.site.delivery_partner && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
            Deliver to my home with {reservation.site.delivery_partner}
          </label>
          {delivery && (
            <>
              <label htmlFor="change-address" className="visually-hidden">
                Delivery address
              </label>
              <input id="change-address" placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </>
          )}
        </div>
      )}
      <div className="field">
        <label htmlFor="change-email">Email</label>
        <input id="change-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="change-phone">Phone</label>
        <input id="change-phone" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="change-buttons">
        <button className="btn btn-primary">Save changes</button>
        <button type="button" className="btn" onClick={onClose}>
          Never mind
        </button>
      </div>

      <div className="cancel-zone">
        {confirmingCancel ? (
          <>
            <p>
              {waiting
                ? 'Leave the waitlist? Your details will be deleted.'
                : reservation.every_drop
                  ? 'Cancel this drop’s reservation? Your bundle goes to the next person waiting. You’ll still be reserved at future drops.'
                  : 'Cancel your reservation? Your bundle goes to the next person waiting, and your details are deleted.'}
            </p>
            <div className="change-buttons">
              <button type="button" className="btn btn-danger" onClick={onCancelReservation}>
                {waiting ? 'Yes, leave the waitlist' : 'Yes, cancel it'}
              </button>
              <button type="button" className="btn" onClick={() => setConfirmingCancel(false)}>
                Keep it
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirmingCancel(true)}>
            {waiting ? 'Leave the waitlist' : 'Cancel my reservation'}
          </button>
        )}
      </div>
    </form>
  )
}
