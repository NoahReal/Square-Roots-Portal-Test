import { useEffect, useState } from 'react'
import { api } from '../../../api'
import PageHero from '../../../components/PageHero'

const EMPTY = { name: '', address: '', instagram_url: '', facebook_url: '', highlight: '', delivery_partner: '', first_drop_pricing: true }

// Admin screen: the Square Roots locations shown on the website and used for drops.
export default function LocationsPage() {
  const [locations, setLocations] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api('/admin/locations/').then(setLocations)
  }, [])

  function saved(location, message) {
    const exists = locations.some((l) => l.id === location.id)
    setLocations(exists ? locations.map((l) => (l.id === location.id ? location : l)) : [...locations, location])
    setEditingId(null)
    setNotice(message)
  }

  return (
    <>
      <PageHero title="Locations" lead="Add and edit Square Roots locations shown on the website." />
      <section className="section">
        <div className="container cycles-layout">
          <div className="block block-white">
            <h2>Add a location</h2>
            <LocationForm
              key={locations?.length}
              initial={EMPTY}
              submitLabel="Add location"
              onSave={(form) => api('/admin/locations/', { method: 'POST', body: form })}
              onSaved={(l) => saved(l, `Added ${l.name}. It's on the website now; add it to a drop cycle to open ordering.`)}
            />
          </div>

          <div>
            {notice && (
              <div className="notice notice-success" role="status">
                {notice}
              </div>
            )}
            <h2>All locations</h2>
            {!locations && <p className="muted">Loading…</p>}
            <ul className="location-admin-list">
              {locations?.map((location) => (
                <li key={location.id} className={'block block-white' + (location.is_active ? '' : ' person-off')}>
                  {editingId === location.id ? (
                    <LocationForm
                      initial={location}
                      submitLabel="Save changes"
                      onSave={(form) => api(`/admin/locations/${location.id}/`, { method: 'PATCH', body: form })}
                      onSaved={(l) => saved(l, `Saved ${l.name}.`)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <LocationSummary
                      location={location}
                      onEdit={() => setEditingId(location.id)}
                      onToggle={async () => {
                        const updated = await api(`/admin/locations/${location.id}/`, {
                          method: 'PATCH',
                          body: { is_active: !location.is_active },
                        })
                        saved(
                          updated,
                          updated.is_active
                            ? `${updated.name} is back on the website.`
                            : `${updated.name} is switched off and hidden from the website.`,
                        )
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

function LocationSummary({ location, onEdit, onToggle }) {
  return (
    <>
      <div className="order-head">
        <div>
          <h3>{location.name}</h3>
          <p className="muted">{location.address}</p>
        </div>
        {!location.is_active && <span className="tag tag-cant-fill">Switched off</span>}
      </div>
      <p>
        {location.people.length === 0 ? (
          <span className="text-warning">Nobody is linked to this location yet.</span>
        ) : (
          location.people.map((p) => `${p.name} (${p.role_label})`).join(', ')
        )}
        <span className="muted"> · {location.drops_this_year} drops this year</span>
      </p>
      {location.highlight && <p className="produce-notes">Highlight: {location.highlight}</p>}
      {location.delivery_partner && <p className="muted">Home delivery by {location.delivery_partner}</p>}
      <div className="button-row">
        <button className="btn btn-small" onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-small" onClick={onToggle}>
          {location.is_active ? 'Switch off' : 'Switch back on'}
        </button>
      </div>
    </>
  )
}

function LocationForm({ initial, submitLabel, onSave, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name,
    address: initial.address,
    instagram_url: initial.instagram_url,
    facebook_url: initial.facebook_url,
    highlight: initial.highlight,
    delivery_partner: initial.delivery_partner,
    first_drop_pricing: initial.first_drop_pricing,
  })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const update = (event) => {
    const { name, type, checked, value } = event.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }
  const idFor = (name) => `loc-${initial.id ?? 'new'}-${name}`

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      onSaved(await onSave(form))
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  const field = (name, label, hint, props = {}) => (
    <div className="field">
      <label htmlFor={idFor(name)}>
        {label} {hint && <span className="field-hint">({hint})</span>}
      </label>
      <input id={idFor(name)} name={name} value={form[name]} onChange={update} {...props} />
      {errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
      {field('name', 'Name', 'e.g. Lower Sackville')}
      {field('address', 'Street address', '', { autoComplete: 'street-address' })}
      {field('instagram_url', 'Instagram link', 'optional', { type: 'url', placeholder: 'https://www.instagram.com/…' })}
      {field('facebook_url', 'Facebook link', 'optional', { type: 'url', placeholder: 'https://www.facebook.com/…' })}
      {field('highlight', 'Highlight on the website', 'optional, e.g. “Our newest location”')}
      {field('delivery_partner', 'Home delivery partner', 'optional, e.g. BayRides; leave blank if there’s no delivery')}
      <label className="check">
        <input type="checkbox" name="first_drop_pricing" checked={form.first_drop_pricing} onChange={update} />
        New location: charge the first-drop price at its first drop
      </label>
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
