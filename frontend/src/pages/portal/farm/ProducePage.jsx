import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { money, pounds, shortDate, todayIso } from '../../../format'
import PageHero from '../../../components/PageHero'

// Suggestions shown as you type in "What produce?". Farms can still type anything.
const COMMON_PRODUCE = [
  'Apples', 'Beets', 'Broccoli', 'Butternut squash', 'Cabbage', 'Carrots', 'Cauliflower', 'Celery',
  'Corn', 'Cucumbers', 'Garlic', 'Kale', 'Leeks', 'Lettuce', 'Onions', 'Parsnips', 'Pears',
  'Peppers', 'Potatoes', 'Pumpkins', 'Rutabaga', 'Sweet potatoes', 'Tomatoes', 'Turnips', 'Zucchini',
]

const EMPTY_FORM = { produce: '', pounds: '', price_per_pound: '', available_until: '', notes: '' }

// Farm screen: post the seconds produce you have, and keep the list up to date.
export default function ProducePage() {
  const { user } = useAuth()
  const [listings, setListings] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api('/farm/produce/')
      .then(setListings)
      .catch((err) => setError(err.message))
  }, [])

  async function add(form) {
    const listing = await api('/farm/produce/', { method: 'POST', body: form })
    setListings([listing, ...listings])
    setNotice(`Posted ${pounds(listing.pounds)} of ${listing.produce}.`)
  }

  async function save(id, form) {
    const updated = await api(`/farm/produce/${id}/`, { method: 'PATCH', body: form })
    setListings(listings.map((listing) => (listing.id === id ? updated : listing)))
    setNotice(`Updated ${updated.produce}.`)
  }

  async function markSoldOut(listing) {
    await api(`/farm/produce/${listing.id}/`, { method: 'DELETE' })
    setListings(listings.filter((l) => l.id !== listing.id))
    setNotice(`${listing.produce} marked sold out.`)
  }

  const totalPounds = listings?.reduce((sum, listing) => sum + listing.pounds, 0) ?? 0

  return (
    <>
      {/* Suggestions for every "What produce?" box on this page */}
      <datalist id="common-produce">
        {COMMON_PRODUCE.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <PageHero title="Produce" lead="Post what seconds produce you have and how much.">
        {user.farm_name && <p className="hero-meta">Posting for {user.farm_name}</p>}
      </PageHero>

      <section className="section">
        <div className="container farm-layout">
          <div className="block block-white">
            <h2>Post produce</h2>
            <p className="muted">
              Less than perfect is perfect for us: forked, scarred, small or oddly shaped produce is all welcome.
            </p>
            <ProduceForm submitLabel="Post produce" onSubmit={add} resetAfterSubmit />
          </div>

          <div>
            <div className="list-heading">
              <h2>Your produce</h2>
              {listings?.length > 0 && (
                <span className="muted">
                  {listings.length} {listings.length === 1 ? 'item' : 'items'} · {pounds(totalPounds)} available
                </span>
              )}
            </div>

            {notice && (
              <div className="notice notice-success" role="status">
                {notice}
              </div>
            )}
            {error && <div className="notice notice-error">{error}</div>}
            {!listings && !error && <p className="muted">Loading…</p>}
            {listings?.length === 0 && (
              <div className="block block-white">
                <p className="muted">
                  Nothing posted right now. Add what you have and the Square Roots team will see it when planning the
                  next order.
                </p>
              </div>
            )}

            <ul className="produce-list">
              {listings?.map((listing) => (
                <ProduceItem key={listing.id} listing={listing} onSave={save} onSoldOut={markSoldOut} />
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

function ProduceItem({ listing, onSave, onSoldOut }) {
  const [editing, setEditing] = useState(false)
  const [confirmingSoldOut, setConfirmingSoldOut] = useState(false)

  if (editing) {
    return (
      <li className="produce-item produce-item-editing">
        <h3>Edit {listing.produce}</h3>
        <ProduceForm
          initial={listing}
          submitLabel="Save changes"
          onSubmit={async (form) => {
            await onSave(listing.id, form)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="produce-item">
      <div className="produce-item-main">
        <h3>{listing.produce}</h3>
        <p className="produce-amount">
          <strong>{pounds(listing.pounds)}</strong> · {money(listing.price_per_pound)}/lb
        </p>
        <p className="muted">
          {listing.available_until ? `Available until ${shortDate(listing.available_until)}` : 'No end date'}
        </p>
        {listing.notes && <p className="produce-notes">{listing.notes}</p>}
      </div>

      <div className="produce-item-actions">
        {confirmingSoldOut ? (
          <>
            <span className="confirm-question">Mark {listing.produce.toLowerCase()} sold out?</span>
            <button className="btn btn-small btn-primary" onClick={() => onSoldOut(listing)}>
              Yes, sold out
            </button>
            <button className="btn btn-small" onClick={() => setConfirmingSoldOut(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-small" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button className="btn btn-small" onClick={() => setConfirmingSoldOut(true)}>
              Sold out
            </button>
          </>
        )}
      </div>
    </li>
  )
}

// The form for posting or editing produce.
function ProduceForm({ initial, submitLabel, onSubmit, onCancel, resetAfterSubmit }) {
  const [form, setForm] = useState(() => (initial ? toForm(initial) : EMPTY_FORM))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const idPrefix = initial ? `produce-${initial.id}-` : 'produce-new-'

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  async function handleSubmit(event) {
    event.preventDefault()

    // Point out every empty required box at once, before asking the server.
    const missing = {}
    for (const input of event.target.querySelectorAll('[required]')) {
      if (!input.value.trim()) missing[input.name] = 'Please fill this in.'
    }
    if (Object.keys(missing).length > 0) {
      setErrors(missing)
      return
    }

    setBusy(true)
    setErrors({})
    try {
      await onSubmit(form)
      if (resetAfterSubmit) setForm(EMPTY_FORM)
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
    }
    setBusy(false)
  }

  const errorFor = (name) => errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>
  const id = (name) => idPrefix + name

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.detail && <div className="notice notice-error">{errors.detail}</div>}

      <div className="field">
        <label htmlFor={id('produce')}>What produce? *</label>
        <input
          id={id('produce')}
          name="produce"
          list="common-produce"
          value={form.produce}
          onChange={update}
          placeholder="e.g. Carrots"
          required
        />
        {errorFor('produce')}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={id('pounds')}>How many pounds? *</label>
          <input
            id={id('pounds')}
            name="pounds"
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            value={form.pounds}
            onChange={update}
            required
          />
          {errorFor('pounds')}
        </div>
        <div className="field">
          <label htmlFor={id('price_per_pound')}>Price per pound ($) *</label>
          <input
            id={id('price_per_pound')}
            name="price_per_pound"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="0.35"
            value={form.price_per_pound}
            onChange={update}
            required
          />
          {errorFor('price_per_pound')}
        </div>
      </div>

      <div className="field">
        <label htmlFor={id('available_until')}>
          Available until <span className="field-hint">(optional)</span>
        </label>
        <input
          id={id('available_until')}
          name="available_until"
          type="date"
          min={todayIso()}
          value={form.available_until}
          onChange={update}
        />
        {errorFor('available_until')}
      </div>

      <div className="field">
        <label htmlFor={id('notes')}>
          Notes <span className="field-hint">(optional)</span>
        </label>
        <input
          id={id('notes')}
          name="notes"
          value={form.notes}
          onChange={update}
          placeholder="e.g. Some are forked or twisted"
        />
        {errorFor('notes')}
      </div>

      <div className="button-row">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

function toForm(listing) {
  return {
    produce: listing.produce,
    pounds: String(listing.pounds),
    price_per_pound: listing.price_per_pound,
    available_until: listing.available_until ?? '',
    notes: listing.notes,
  }
}
