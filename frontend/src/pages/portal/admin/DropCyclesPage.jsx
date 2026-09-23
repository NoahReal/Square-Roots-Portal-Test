import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { addDays, dateAndTime, fromLocalInput, longDate, shortDate, todayIso, toLocalInput } from '../../../format'
import PageHero from '../../../components/PageHero'

// Admin screen: plan drop cycles, choose which locations take part, and adjust dates for any site.
export default function DropCyclesPage() {
  const [cycles, setCycles] = useState(null)
  const [sites, setSites] = useState([])
  const [openId, setOpenId] = useState(null)
  const [notice, setNotice] = useState('')
  const [showPast, setShowPast] = useState(false)

  function load() {
    return api('/admin/cycles/').then(setCycles)
  }

  useEffect(() => {
    load()
    api('/sites/').then(setSites)
  }, [])

  const today = todayIso()
  const upcoming = cycles?.filter((c) => c.drop_date >= today).reverse() ?? []
  const past = cycles?.filter((c) => c.drop_date < today) ?? []
  const lastDate = cycles?.[0]?.drop_date

  async function created(cycle) {
    await load()
    setOpenId(cycle.id)
    setNotice(`Created the ${cycle.name} for ${cycle.site_count} locations. Community Managers can order now.`)
  }

  return (
    <>
      <PageHero title="Drop Cycles" lead="Set order cutoffs and drop dates for each site." />

      <section className="section">
        <div className="container cycles-layout">
          <div className="block block-white">
            <h2>New drop cycle</h2>
            {/* Wait for the cycles too, so the suggested date follows the last planned drop. */}
            {sites.length > 0 && cycles && <NewCycleForm sites={sites} lastDate={lastDate} onCreated={created} />}
          </div>

          <div>
            {notice && (
              <div className="notice notice-success" role="status">
                {notice}
              </div>
            )}
            <h2>Coming up</h2>
            {!cycles && <p className="muted">Loading…</p>}
            {cycles && upcoming.length === 0 && <p className="muted">No drops planned. Create one to open ordering.</p>}
            <ul className="cycle-list">
              {upcoming.map((cycle) => (
                <CycleRow
                  key={cycle.id}
                  cycle={cycle}
                  open={openId === cycle.id}
                  onToggle={() => setOpenId(openId === cycle.id ? null : cycle.id)}
                  onChanged={load}
                />
              ))}
            </ul>

            {past.length > 0 && (
              <section className="order-group">
                <button className="link-button section-toggle" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
                  {showPast ? 'Hide' : 'Show'} past drops ({past.length})
                </button>
                {showPast && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Drop</th>
                        <th scope="col" className="num">Sites</th>
                        <th scope="col" className="num">Bundles</th>
                        <th scope="col" className="num">Reports in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {past.map((cycle) => (
                        <tr key={cycle.id}>
                          <td>
                            <Link to={`/portal/admin/orders?cycle=${cycle.id}`}>{cycle.name}</Link>
                          </td>
                          <td className="num">{cycle.site_count}</td>
                          <td className="num">{cycle.bundles_ordered}</td>
                          <td className="num">
                            {cycle.reports_in} of {cycle.sites_ordered}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

function statusTag(cycle) {
  if (cycle.ordering_open) return <span className="tag tag-waiting">Ordering open</span>
  return <span className="tag tag-confirmed">Ordering closed</span>
}

function CycleRow({ cycle, open, onToggle, onChanged }) {
  return (
    <li className={'cycle' + (open ? ' cycle-open' : '')}>
      <button className="cycle-summary" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{cycle.name}</strong>
          <br />
          <span className="muted">
            {longDate(cycle.drop_date)} · order by {dateAndTime(cycle.order_cutoff)}
          </span>
        </span>
        <span className="cycle-summary-right">
          {statusTag(cycle)}
          <span className="muted">
            {cycle.sites_ordered} of {cycle.site_count} sites ordered · {cycle.bundles_ordered} bundles
          </span>
        </span>
      </button>
      {open && <CycleDetail cycleId={cycle.id} onChanged={onChanged} />}
    </li>
  )
}

function CycleDetail({ cycleId, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/admin/cycles/${cycleId}/`).then(setDetail)
  }, [cycleId])

  async function run(request) {
    setError('')
    try {
      const updated = await request()
      if (updated) setDetail(updated)
      setEditingId(null)
      onChanged()
    } catch (err) {
      setError(err.data?.order_cutoff || err.data?.detail || err.message)
    }
  }

  if (!detail) return <p className="muted cycle-detail">Loading…</p>

  return (
    <div className="cycle-detail">
      {error && <div className="notice notice-error">{error}</div>}
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Location</th>
            <th scope="col">Drop date</th>
            <th scope="col">Order by</th>
            <th scope="col" className="num">Bundles</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {detail.site_drops.map((drop) =>
            editingId === drop.id ? (
              <SiteDropEditor
                key={drop.id}
                drop={drop}
                onSave={(changes) => run(() => api(`/admin/site-drops/${drop.id}/`, { method: 'PATCH', body: changes }))}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <tr key={drop.id}>
                <td>{drop.site_name}</td>
                <td>{shortDate(drop.drop_date)}</td>
                <td>{dateAndTime(drop.order_cutoff)}</td>
                <td className="num">{drop.bundles ?? <span className="muted">not yet</span>}</td>
                <td className="row-actions">
                  <button className="link-button" onClick={() => setEditingId(drop.id)}>
                    Change dates
                  </button>
                  {drop.bundles === null && (
                    <button
                      className="link-button"
                      onClick={() => run(() => api(`/admin/site-drops/${drop.id}/`, { method: 'DELETE' }))}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <div className="cycle-detail-actions">
        {detail.other_sites.length > 0 && (
          <AddSite
            sites={detail.other_sites}
            onAdd={(site) => run(() => api(`/admin/cycles/${cycleId}/sites/`, { method: 'POST', body: { site } }))}
          />
        )}
        <Link to={`/portal/admin/orders?cycle=${cycleId}`} className="btn btn-small">
          See orders and farm purchases
        </Link>
        {detail.bundles_ordered === 0 && detail.farm_orders.length === 0 && (
          <button
            className="btn btn-small"
            onClick={() => run(async () => {
              await api(`/admin/cycles/${cycleId}/`, { method: 'DELETE' })
              return null
            })}
          >
            Delete this cycle
          </button>
        )}
      </div>
    </div>
  )
}

function SiteDropEditor({ drop, onSave, onCancel }) {
  const [dropDate, setDropDate] = useState(drop.drop_date)
  const [cutoff, setCutoff] = useState(toLocalInput(drop.order_cutoff))
  return (
    <tr className="editing-row">
      <td>{drop.site_name}</td>
      <td>
        <input type="date" value={dropDate} min={todayIso()} onChange={(e) => setDropDate(e.target.value)} aria-label="Drop date" />
      </td>
      <td>
        <input type="datetime-local" value={cutoff} onChange={(e) => setCutoff(e.target.value)} aria-label="Order by" />
      </td>
      <td />
      <td className="row-actions">
        <button className="btn btn-small btn-primary" onClick={() => onSave({ drop_date: dropDate, order_cutoff: fromLocalInput(cutoff) })}>
          Save
        </button>
        <button className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </td>
    </tr>
  )
}

function AddSite({ sites, onAdd }) {
  const [site, setSite] = useState('')
  return (
    <div className="add-site">
      <select value={site} onChange={(e) => setSite(e.target.value)} aria-label="Add a location">
        <option value="">Add a location…</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button className="btn btn-small" disabled={!site} onClick={() => onAdd(Number(site))}>
        Add
      </button>
    </div>
  )
}

function NewCycleForm({ sites, lastDate, onCreated }) {
  // Suggest two weeks after the last planned drop, with ordering closing the Tuesday before at 5 pm.
  const suggestedDate = lastDate && lastDate >= todayIso() ? addDays(lastDate, 14) : addDays(todayIso(), 14)
  const [dropDate, setDropDate] = useState(suggestedDate)
  const [cutoff, setCutoff] = useState(`${addDays(suggestedDate, -4)}T17:00`)
  const [chosen, setChosen] = useState(() => new Set(sites.map((s) => s.id)))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  function changeDate(value) {
    setDropDate(value)
    if (value) setCutoff(`${addDays(value, -4)}T17:00`)
  }

  function toggle(id) {
    const next = new Set(chosen)
    next.has(id) ? next.delete(id) : next.add(id)
    setChosen(next)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const cycle = await api('/admin/cycles/', {
        method: 'POST',
        body: { drop_date: dropDate, order_cutoff: fromLocalInput(cutoff), sites: [...chosen] },
      })
      onCreated(cycle)
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
        <label htmlFor="new-drop-date">Drop date</label>
        <input id="new-drop-date" type="date" min={todayIso()} value={dropDate} onChange={(e) => changeDate(e.target.value)} />
        {errorFor('drop_date')}
      </div>
      <div className="field">
        <label htmlFor="new-cutoff">Ordering closes</label>
        <input id="new-cutoff" type="datetime-local" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        <p className="field-hint">Usually the Tuesday before, at 5 p.m.</p>
        {errorFor('order_cutoff')}
      </div>

      <fieldset className="site-checklist">
        <legend>Locations</legend>
        <div className="site-checklist-controls">
          <button type="button" className="link-button" onClick={() => setChosen(new Set(sites.map((s) => s.id)))}>
            All
          </button>
          <button type="button" className="link-button" onClick={() => setChosen(new Set())}>
            None
          </button>
          <span className="muted">
            {chosen.size} of {sites.length}
          </span>
        </div>
        {sites.map((site) => (
          <label key={site.id} className="check">
            <input type="checkbox" checked={chosen.has(site.id)} onChange={() => toggle(site.id)} />
            {site.name}
          </label>
        ))}
        {errorFor('sites')}
      </fieldset>

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Creating…' : 'Create drop cycle'}
      </button>
    </form>
  )
}
