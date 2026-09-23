import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { longDate, pounds } from '../../../format'
import PageHero from '../../../components/PageHero'
import Stepper from '../../../components/Stepper'

const LEFTOVER_CHOICES = [
  { value: 'donated', label: 'Donated' },
  { value: 'kept', label: 'Kept for the next drop' },
  { value: 'composted', label: 'Composted' },
  { value: 'other', label: 'Something else' },
]

// Community Manager screen: after each drop, log how many bundles sold and what happened to leftovers.
export default function AfterDropPage() {
  const { user } = useAuth()
  const [drops, setDrops] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/manager/drops/')
      .then((all) => setDrops(all.filter((d) => d.has_happened && d.bundles !== null).reverse()))
      .catch((err) => setError(err.message))
  }, [])

  function replace(updated) {
    setDrops(drops.map((d) => (d.id === updated.id ? updated : d)))
  }

  const toLog = drops?.filter((d) => !d.report) ?? []
  const logged = drops?.filter((d) => d.report) ?? []

  return (
    <>
      <PageHero title="After Drop" lead="Log bundles sold and anything left over.">
        {user.site_name && <p className="hero-meta">{user.site_name}</p>}
      </PageHero>

      <section className="section">
        <div className="container container-narrow">
          {error && <div className="notice notice-error">{error}</div>}
          {!drops && !error && <p className="muted">Loading…</p>}

          {drops && toLog.length === 0 && (
            <div className="notice notice-success">You're all caught up. Every drop has been logged. Thank you!</div>
          )}

          {toLog.length > 0 && (
            <section className="order-group">
              <h2>Needs logging</h2>
              {toLog.map((drop) => (
                <ReportCard key={drop.id} drop={drop} onSaved={replace} startOpen />
              ))}
            </section>
          )}

          {logged.length > 0 && (
            <section className="order-group">
              <h2>Logged</h2>
              {logged.map((drop) => (
                <ReportCard key={drop.id} drop={drop} onSaved={replace} />
              ))}
            </section>
          )}
        </div>
      </section>
    </>
  )
}

function ReportCard({ drop, onSaved, startOpen = false }) {
  const [editing, setEditing] = useState(startOpen)
  const report = drop.report

  return (
    <article className={'block block-white report-card' + (report ? '' : ' report-needed')}>
      <header className="order-head">
        <div>
          <h3>{drop.cycle_name}</h3>
          <p className="muted">
            {longDate(drop.drop_date)} · you ordered {drop.bundles} bundles
          </p>
        </div>
        <span className={'tag ' + (report ? 'tag-confirmed' : 'tag-waiting')}>{report ? 'Logged' : 'To do'}</span>
      </header>

      {editing ? (
        <ReportForm drop={drop} onSaved={(updated) => { onSaved(updated); setEditing(false) }} onCancel={report ? () => setEditing(false) : null} />
      ) : (
        <div className="report-summary">
          <p>
            Sold <strong>{report.bundles_sold}</strong> of {drop.bundles} bundles ({pounds(report.bundles_sold * 10)})
            {report.bundles_left_over > 0
              ? `. ${report.bundles_left_over} left over: ${report.leftovers_label.toLowerCase()}.`
              : '. Nothing left over.'}
          </p>
          {report.notes && <p className="produce-notes">{report.notes}</p>}
          <button className="btn btn-small" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
    </article>
  )
}

function ReportForm({ drop, onSaved, onCancel }) {
  const existing = drop.report
  const [sold, setSold] = useState(existing?.bundles_sold ?? drop.bundles)
  const [leftOver, setLeftOver] = useState(existing?.bundles_left_over ?? 0)
  const [leftoversWentTo, setLeftoversWentTo] = useState(existing?.leftovers_went_to ?? 'none')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  // Changing "sold" suggests the rest were left over, which is usually right.
  function changeSold(value) {
    setSold(value)
    setLeftOver(Math.max(0, drop.bundles - value))
  }

  async function save() {
    setBusy(true)
    setErrors({})
    const destination = leftOver > 0 ? leftoversWentTo : 'none'
    try {
      const updated = await api(`/manager/drops/${drop.id}/report/`, {
        method: 'PUT',
        body: { bundles_sold: sold, bundles_left_over: leftOver, leftovers_went_to: destination, notes },
      })
      onSaved(updated)
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
      setBusy(false)
    }
  }

  const id = (name) => `report-${drop.id}-${name}`

  return (
    <div className="report-form">
      {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
      <div className="field-row">
        <div className="field">
          <label htmlFor={id('sold')}>Bundles sold</label>
          <Stepper id={id('sold')} value={sold} onChange={changeSold} max={300} size="small" label="bundles sold" />
        </div>
        <div className="field">
          <label htmlFor={id('left')}>Bundles left over</label>
          <Stepper id={id('left')} value={leftOver} onChange={setLeftOver} max={300} size="small" label="bundles left over" />
        </div>
      </div>

      {leftOver > 0 && (
        <fieldset className="choice-group">
          <legend>What happened to the leftovers?</legend>
          {LEFTOVER_CHOICES.map((choice) => (
            <label key={choice.value} className={'choice' + (leftoversWentTo === choice.value ? ' choice-on' : '')}>
              <input
                type="radio"
                name={id('leftovers')}
                value={choice.value}
                checked={leftoversWentTo === choice.value}
                onChange={() => setLeftoversWentTo(choice.value)}
              />
              {choice.label}
            </label>
          ))}
          {errors.leftovers_went_to && <p className="field-error">{[].concat(errors.leftovers_went_to).join(' ')}</p>}
        </fieldset>
      )}

      <div className="field">
        <label htmlFor={id('notes')}>
          Anything the team should know? <span className="field-hint">(optional)</span>
        </label>
        <textarea
          id={id('notes')}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Ran out of carrots by noon, lots of new faces"
        />
      </div>

      <div className="button-row">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {onCancel && (
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
