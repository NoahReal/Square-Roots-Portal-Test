import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { longDate, money } from '../../../format'
import PageHero from '../../../components/PageHero'
import OrderFormDetail from '../../../components/ordering/OrderFormDetail'

// Admin screen: the order forms for each route. Build one from the suppliers' price lists,
// open it for orders, then send what goes where to the suppliers and trucks.
export default function OrderFormsPage() {
  const [params, setParams] = useSearchParams()
  const formId = Number(params.get('form')) || null
  const [forms, setForms] = useState(null)
  const [setup, setSetup] = useState(null)

  const load = () => api('/admin/order-forms/').then(setForms)

  useEffect(() => {
    load()
    api('/admin/ordering/').then(setSetup)
  }, [])

  const open = (id) => setParams(id ? { form: id } : {})

  if (formId) {
    return (
      <>
        <PageHero title="Order Form" lead="What locations can order, who has ordered, and what goes to each supplier and truck." />
        <section className="section">
          <div className="container">
            <button className="link-button back-link" onClick={() => { open(null); load() }}>
              ← All order forms
            </button>
            <OrderFormDetail id={formId} onDeleted={() => { open(null); load() }} />
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHero title="Order Forms" lead="One form per route each cycle (Halifax and Halifax North share one). Replaces the spreadsheet with a tab per location." />
      <section className="section">
        <div className="container cycles-layout">
          <div className="block block-white">
            <h2>Start a form</h2>
            {setup ? <NewFormForm setup={setup} onCreated={(form) => open(form.id)} /> : <p className="muted">Loading…</p>}
          </div>
          <div>
            <h2>Order forms</h2>
            {!forms && <p className="muted">Loading…</p>}
            {forms?.length === 0 && <p className="muted">No order forms yet.</p>}
            <ul className="form-list">
              {forms?.map((form) => (
                <li key={form.id}>
                  <button className="form-list-item" onClick={() => open(form.id)}>
                    <span className="form-list-main">
                      <strong>{form.routes.map((r) => r.name).join(' and ')}</strong>
                      <span>Delivered {longDate(form.delivery_date)}</span>
                      <span className="muted">
                        {form.status === 'draft'
                          ? 'Not open yet'
                          : `${form.locations_ordered} of ${form.locations} locations ordered · ${form.boxes} boxes · ${money(form.cost)}`}
                      </span>
                    </span>
                    <span className={'tag ' + STATUS_TAGS[form.status]}>
                      {form.status === 'open' && !form.ordering_open ? 'Ordering closed' : form.status_label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  )
}

const STATUS_TAGS = { draft: '', open: 'tag-waiting', sent: 'tag-confirmed' }

function NewFormForm({ setup, onCreated }) {
  const switched = setup.routes.filter((r) => r.uses_order_forms)
  const [cycle, setCycle] = useState(setup.cycles.find((c) => c.ordering_open)?.id ?? '')
  const [routes, setRoutes] = useState(switched.map((r) => r.id))
  const [copyLast, setCopyLast] = useState(true)
  const [error, setError] = useState('')

  async function create(event) {
    event.preventDefault()
    setError('')
    try {
      onCreated(await api('/admin/order-forms/', { method: 'POST', body: { cycle, routes, copy_last: copyLast } }))
    } catch (err) {
      setError([].concat(err.data?.routes ?? err.message).join(' '))
    }
  }

  return (
    <form onSubmit={create} noValidate>
      <div className="field">
        <label htmlFor="new-form-cycle">For which drop?</label>
        <select id="new-form-cycle" value={cycle} onChange={(e) => setCycle(Number(e.target.value))}>
          {setup.cycles.filter((c) => c.ordering_open).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="choice-group">
        <legend>Routes on this form</legend>
        {setup.routes.map((route) => (
          <label key={route.id} className={'choice' + (routes.includes(route.id) ? ' choice-on' : '')}>
            <input
              type="checkbox"
              checked={routes.includes(route.id)}
              onChange={(e) => setRoutes(e.target.checked ? [...routes, route.id] : routes.filter((id) => id !== route.id))}
            />
            {route.name}
            {!route.uses_order_forms && <span className="muted"> (still ordering bundles)</span>}
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={copyLast} onChange={(e) => setCopyLast(e.target.checked)} />
        Start from the last form, at this drop’s prices
      </label>
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={!cycle || routes.length === 0}>
        Start the form
      </button>
      <p className="field-hint">
        Delivery and due dates come from each route’s days (see Routes); you can change them on the form.
      </p>
    </form>
  )
}

