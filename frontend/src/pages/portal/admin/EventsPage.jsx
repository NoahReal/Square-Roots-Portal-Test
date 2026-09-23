import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { longDate, todayIso } from '../../../format'
import PageHero from '../../../components/PageHero'

const EMPTY = { title: '', starts_on: '', ends_on: '', time_text: '', location: '', description: '', is_published: true }

// Admin screen: events shown on the public Events page.
export default function EventsPage() {
  const [events, setEvents] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api('/admin/events/').then(setEvents)
  }, [])

  function saved(event, message) {
    const exists = events.some((e) => e.id === event.id)
    const list = exists ? events.map((e) => (e.id === event.id ? event : e)) : [event, ...events]
    setEvents(list.sort((a, b) => b.starts_on.localeCompare(a.starts_on)))
    setEditingId(null)
    setNotice(message)
  }

  async function remove(event) {
    await api(`/admin/events/${event.id}/`, { method: 'DELETE' })
    setEvents(events.filter((e) => e.id !== event.id))
    setNotice(`Deleted “${event.title}”.`)
  }

  const today = todayIso()

  return (
    <>
      <PageHero title="Events" lead="Add events to the public Events page." />
      <section className="section">
        <div className="container cycles-layout">
          <div className="block block-white">
            <h2>Add an event</h2>
            <EventForm
              key={events?.length}
              initial={EMPTY}
              submitLabel="Add event"
              onSave={(form) => api('/admin/events/', { method: 'POST', body: form })}
              onSaved={(e) => saved(e, `Added “${e.title}”.${e.is_published ? ' It’s on the Events page now.' : ''}`)}
            />
          </div>

          <div>
            {notice && (
              <div className="notice notice-success" role="status">
                {notice} <Link to="/events">See the Events page</Link>
              </div>
            )}
            <h2>All events</h2>
            {!events && <p className="muted">Loading…</p>}
            {events?.length === 0 && <p className="muted">No events yet.</p>}
            <ul className="location-admin-list">
              {events?.map((event) => (
                <li key={event.id} className="block block-white">
                  {editingId === event.id ? (
                    <EventForm
                      initial={event}
                      submitLabel="Save changes"
                      onSave={(form) => api(`/admin/events/${event.id}/`, { method: 'PATCH', body: form })}
                      onSaved={(e) => saved(e, `Saved “${e.title}”.`)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <div className="order-head">
                        <div>
                          <h3>{event.title}</h3>
                          <p className="muted">
                            {longDate(event.starts_on)}
                            {event.ends_on && event.ends_on !== event.starts_on && ` to ${longDate(event.ends_on)}`}
                            {', '}
                            {event.starts_on.slice(0, 4)}
                            {event.time_text && ` · ${event.time_text}`}
                            {event.location && ` · ${event.location}`}
                          </p>
                        </div>
                        <span className={'tag ' + (!event.is_published ? '' : (event.ends_on || event.starts_on) >= today ? 'tag-confirmed' : '')}>
                          {!event.is_published ? 'Hidden' : (event.ends_on || event.starts_on) >= today ? 'Upcoming' : 'Past'}
                        </span>
                      </div>
                      <p>{event.description}</p>
                      <div className="button-row">
                        <button className="btn btn-small" onClick={() => setEditingId(event.id)}>
                          Edit
                        </button>
                        <DeleteButton onDelete={() => remove(event)} />
                      </div>
                    </>
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

function DeleteButton({ onDelete }) {
  const [confirming, setConfirming] = useState(false)
  return confirming ? (
    <>
      <button className="btn btn-small btn-primary" onClick={onDelete}>
        Yes, delete
      </button>
      <button className="link-button" onClick={() => setConfirming(false)}>
        Keep it
      </button>
    </>
  ) : (
    <button className="btn btn-small" onClick={() => setConfirming(true)}>
      Delete
    </button>
  )
}

function EventForm({ initial, submitLabel, onSave, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, ends_on: initial.ends_on ?? '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const update = (event) => {
    const { name, type, checked, value } = event.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }
  const idFor = (name) => `event-${initial.id ?? 'new'}-${name}`

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const { id, ...body } = form
      onSaved(await onSave({ ...body, ends_on: body.ends_on || null }))
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  const errorFor = (name) => errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
      <div className="field">
        <label htmlFor={idFor('title')}>Event name</label>
        <input id={idFor('title')} name="title" value={form.title} onChange={update} />
        {errorFor('title')}
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={idFor('starts_on')}>Date</label>
          <input id={idFor('starts_on')} name="starts_on" type="date" value={form.starts_on} onChange={update} />
          {errorFor('starts_on')}
        </div>
        <div className="field">
          <label htmlFor={idFor('ends_on')}>
            Last day <span className="field-hint">(if more than one day)</span>
          </label>
          <input id={idFor('ends_on')} name="ends_on" type="date" min={form.starts_on} value={form.ends_on} onChange={update} />
          {errorFor('ends_on')}
        </div>
      </div>
      <div className="field">
        <label htmlFor={idFor('time_text')}>
          Time <span className="field-hint">(optional, e.g. 12 to 4 p.m.)</span>
        </label>
        <input id={idFor('time_text')} name="time_text" value={form.time_text} onChange={update} />
      </div>
      <div className="field">
        <label htmlFor={idFor('location')}>
          Where <span className="field-hint">(optional)</span>
        </label>
        <input id={idFor('location')} name="location" value={form.location} onChange={update} />
      </div>
      <div className="field">
        <label htmlFor={idFor('description')}>What's happening</label>
        <textarea id={idFor('description')} name="description" rows={4} value={form.description} onChange={update} />
        {errorFor('description')}
      </div>
      <label className="check">
        <input type="checkbox" name="is_published" checked={form.is_published} onChange={update} />
        Show on the website
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
