import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { longDate, money, pounds, shortDate } from '../../../format'
import { usePricing } from '../../../pricing'
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
            Sold <strong>{report.bundles_sold}</strong> of {drop.bundles} bundles ({pounds(report.bundles_sold * 10)}):{' '}
            {report.bundles_standard} standard, {report.bundles_at_cost} at cost, {report.bundles_free} free.
            {report.bundles_left_over > 0
              ? ` ${report.bundles_left_over} left over: ${report.leftovers_label.toLowerCase()}.`
              : ' Nothing left over.'}
          </p>
          {report.notes && <p className="produce-notes">{report.notes}</p>}
          {drop.statement && <Statement statement={drop.statement} />}
          <button className="btn btn-small" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      )}
    </article>
  )
}

// Money for one drop: what was collected, what's owed to Square Roots, and what the Community Manager keeps.
function Statement({ statement }) {
  const received = statement.remittance_received_on
  return (
    <div className="statement">
      <dl>
        <div>
          <dt>Collected</dt>
          <dd>{money(statement.collected)}</dd>
        </div>
        <div>
          <dt>Owed to Square Roots</dt>
          <dd>{money(statement.owed_to_square_roots)}</dd>
        </div>
        <div>
          <dt>You keep</dt>
          <dd>{money(statement.manager_keeps)}</dd>
        </div>
      </dl>
      <p className="statement-note">
        {statement.first_drop
          ? `First drop: you owe just ${money(statement.cost_per_bundle)} per paid bundle. `
          : `You owe ${money(statement.cost_per_bundle)} per paid bundle; free bundles cost you nothing. `}
        {Number(statement.donations) > 0 && `Includes ${money(statement.donations)} in donations, which you keep. `}
        {Number(statement.owed_to_square_roots) === 0
          ? 'Nothing to pay.'
          : received
            ? `Payment received ${shortDate(received)}. Thank you!`
            : 'Payment not received yet.'}
      </p>
    </div>
  )
}

function ReportForm({ drop, onSaved, onCancel }) {
  const existing = drop.report
  const pricing = usePricing()
  // Bundles sold at each price. Starts with every bundle at the standard price; change the split to match the day.
  const [tiers, setTiers] = useState({
    standard: existing?.bundles_standard ?? drop.bundles,
    atCost: existing?.bundles_at_cost ?? 0,
    free: existing?.bundles_free ?? 0,
  })
  const [donations, setDonations] = useState(existing ? String(Number(existing.donations)) : '0')
  const [leftOver, setLeftOver] = useState(existing?.bundles_left_over ?? 0)
  const [leftoversWentTo, setLeftoversWentTo] = useState(existing?.leftovers_went_to ?? 'none')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const sold = tiers.standard + tiers.atCost + tiers.free

  // Changing a number sold also suggests the rest were left over, which is usually right.
  function changeTier(name) {
    return (value) => {
      const next = { ...tiers, [name]: value }
      setTiers(next)
      setLeftOver(Math.max(0, drop.bundles - next.standard - next.atCost - next.free))
    }
  }

  async function save() {
    setBusy(true)
    setErrors({})
    const destination = leftOver > 0 ? leftoversWentTo : 'none'
    try {
      const updated = await api(`/manager/drops/${drop.id}/report/`, {
        method: 'PUT',
        body: {
          bundles_standard: tiers.standard,
          bundles_at_cost: tiers.atCost,
          bundles_free: tiers.free,
          bundles_left_over: leftOver,
          leftovers_went_to: destination,
          donations: donations || '0',
          notes,
        },
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
      <fieldset className="tier-fields">
        <legend>Bundles sold ({sold} of {drop.bundles})</legend>
        <div className="field">
          <label htmlFor={id('standard')}>Standard {pricing && `(${money(pricing.standard_price)})`}</label>
          <Stepper id={id('standard')} value={tiers.standard} onChange={changeTier('standard')} max={300} size="small" label="standard bundles" />
        </div>
        <div className="field">
          <label htmlFor={id('at-cost')}>At cost {pricing && `(${money(pricing.at_cost_price)})`}</label>
          <Stepper id={id('at-cost')} value={tiers.atCost} onChange={changeTier('atCost')} max={300} size="small" label="at-cost bundles" />
        </div>
        <div className="field">
          <label htmlFor={id('free')}>Free</label>
          <Stepper id={id('free')} value={tiers.free} onChange={changeTier('free')} max={300} size="small" label="free bundles" />
        </div>
      </fieldset>
      {sold > drop.bundles && (
        <p className="text-warning">
          That's {sold - drop.bundles} more than the {drop.bundles} you ordered. That's fine if you had some kept from last
          time; otherwise check the numbers.
        </p>
      )}
      <div className="field-row">
        <div className="field">
          <label htmlFor={id('left')}>Bundles left over</label>
          <Stepper id={id('left')} value={leftOver} onChange={setLeftOver} max={300} size="small" label="bundles left over" />
        </div>
        <div className="field">
          <label htmlFor={id('donations')}>
            Donations ($) <span className="field-hint">(if any)</span>
          </label>
          <input
            id={id('donations')}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={donations}
            onChange={(e) => setDonations(e.target.value)}
          />
          {Number(drop.pay_it_forward) > 0 && (
            <p className="field-hint">
              Pay-it-forward gifts from paid reservations: {money(drop.pay_it_forward)}.{' '}
              {Number(donations) === 0 && (
                <button type="button" className="link-button" onClick={() => setDonations(String(Number(drop.pay_it_forward)))}>
                  Use this amount
                </button>
              )}
            </p>
          )}
          {errors.donations && <p className="field-error">{[].concat(errors.donations).join(' ')}</p>}
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
