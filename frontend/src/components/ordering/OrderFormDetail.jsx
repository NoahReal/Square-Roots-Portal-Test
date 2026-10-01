import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { boxes, dateAndTime, fromLocalInput, longDate, money, toLocalInput } from '../../format'

const DEALS = [
  { value: '', label: 'No note' },
  { value: 'good', label: '★ Good deal' },
  { value: 'pricey', label: '▲ Pricier than usual' },
]

// One order form, for the team: build it, open it, watch orders come in, then send and track confirmations.
export default function OrderFormDetail({ id, onDeleted }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api(`/admin/order-forms/${id}/`).then(setForm).catch((err) => setError(err.message))
  }, [id])

  // Runs a change and shows the updated form, or what went wrong.
  async function run(request, message = '') {
    setError('')
    setNotice('')
    try {
      const updated = await request()
      if (updated) setForm(updated)
      if (message) setNotice(message)
    } catch (err) {
      const data = err.data || {}
      setError([].concat(data.detail ?? data.orders_due ?? data.product ?? data.price ?? data.deal ?? err.message).join(' '))
    }
  }

  if (!form) return error ? <div className="notice notice-error">{error}</div> : <p className="muted">Loading…</p>

  const isDraft = form.status === 'draft'
  const isSent = form.status === 'sent'
  const routes = form.routes.map((r) => r.name).join(' and ')

  return (
    <div className="order-form-detail">
      <header className="block block-yellow order-form-head no-print">
        <span className="eyebrow-label">
          {form.cycle.name} · {form.status === 'open' && !form.ordering_open ? 'Ordering closed' : form.status_label}
        </span>
        <h2>{routes}</h2>
        <p>
          Trucks deliver <strong>{longDate(form.delivery_date)}</strong> · orders due <strong>{dateAndTime(form.orders_due)}</strong>{' '}
          · markets usually {longDate(form.market_date)}
        </p>
      </header>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice notice-success" role="status">
          {notice}
        </div>
      )}

      <div className="send-bar no-print">
        {isDraft && (
          <>
            <p>When the form is ready, open it: each location’s Community Managers get an email with the link, and their market day is set.</p>
            <button className="btn btn-primary" onClick={() => run(() => api(`/admin/order-forms/${id}/publish/`, { method: 'POST' }), 'The form is open. Community Managers have been emailed the link.')}>
              Open for orders
            </button>
          </>
        )}
        {form.status === 'open' && (
          <SendButton form={form} onSend={() => run(() => api(`/admin/order-forms/${id}/send/`, { method: 'POST' }), 'Sent. Each supplier and route’s trucks have a link to confirm.')} />
        )}
        {isSent && <p>Sent to suppliers and trucks {dateAndTime(form.sent_at ?? form.orders_due)}. Confirmations are below.</p>}
        {form.boxes > 0 && (
          <a className="btn" href={`/api/admin/order-forms/${id}/orders.csv`}>
            Download every order (CSV)
          </a>
        )}
      </div>

      {!isSent && <FormSettings form={form} onSave={(changes) => run(() => api(`/admin/order-forms/${id}/`, { method: 'PATCH', body: changes }), 'Saved.')} />}

      <section className="block block-white no-print">
        <h3>On the form ({form.items.length} items)</h3>
        {form.items.length === 0 ? (
          <p className="muted">Nothing yet. Add items from the price lists below.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">From</th>
                  <th scope="col" className="num">
                    Price per box
                  </th>
                  <th scope="col">Note to locations</th>
                  {!isSent && (
                    <th scope="col">
                      <span className="visually-hidden">Remove</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.product}</strong>
                      {item.box_size && <span className="muted"> · {item.box_size}</span>}
                    </td>
                    <td>{item.supplier}</td>
                    <td className="num">{money(item.price)}</td>
                    <td>
                      {isSent ? (
                        DEALS.find((d) => d.value === item.deal)?.label
                      ) : (
                        <ItemNote item={item} onSave={(changes) => run(() => api(`/admin/order-form-items/${item.id}/`, { method: 'PATCH', body: changes }))} />
                      )}
                    </td>
                    {!isSent && (
                      <td>
                        <button
                          className="link-button"
                          onClick={() => run(() => api(`/admin/order-form-items/${item.id}/`, { method: 'DELETE' }))}
                          aria-label={`Remove ${item.product}`}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!isSent && <AddItems form={form} onAdd={(body) => run(() => api(`/admin/order-forms/${id}/items/`, { method: 'POST', body }))} />}

      {!isDraft && <LocationOrders form={form} />}

      {isSent && (
        <>
          <SupplierOrders form={form} />
          <TransportRuns form={form} />
        </>
      )}

      {form.hubs.length > 0 && !isDraft && (
        <section className="block block-white no-print">
          <h3>Hubs</h3>
          <ul className="plain-list">
            {form.hubs.map((hub) => (
              <li key={hub.name}>
                <strong>{hub.name}</strong> ({hub.hub_site}): {money(hub.share)}, {hub.percent}% of {hub.supplier} for the locations it
                takes deliveries for.
              </li>
            ))}
          </ul>
          <p className="field-hint">Worked out without the hub’s own order. To confirm with Square Roots.</p>
        </section>
      )}

      {isDraft && (
        <button className="link-button no-print" onClick={async () => { await api(`/admin/order-forms/${id}/`, { method: 'DELETE' }); onDeleted() }}>
          Delete this draft
        </button>
      )}
    </div>
  )
}

function SendButton({ form, onSend }) {
  const [sure, setSure] = useState(false)
  if (sure) {
    return (
      <>
        <p>
          {form.ordering_open ? 'Ordering is still open. Sending closes it now, ' : ''}
          {form.locations_ordered} of {form.locations} locations have ordered. Send to suppliers and trucks?
        </p>
        <button className="btn btn-primary" onClick={onSend}>
          Yes, send it
        </button>
        <button className="btn" onClick={() => setSure(false)}>
          Not yet
        </button>
      </>
    )
  }
  return (
    <>
      <p>
        {form.ordering_open ? `Ordering closes ${dateAndTime(form.orders_due)}.` : 'Ordering has closed.'} {form.locations_ordered} of{' '}
        {form.locations} locations have ordered.
      </p>
      <button className="btn btn-primary" onClick={() => setSure(true)}>
        {form.ordering_open ? 'Close ordering and send' : 'Send to suppliers and trucks'}
      </button>
    </>
  )
}

function FormSettings({ form, onSave }) {
  const [delivery, setDelivery] = useState(form.delivery_date)
  const [due, setDue] = useState(toLocalInput(form.orders_due))
  const [notes, setNotes] = useState(form.notes)
  const changed = delivery !== form.delivery_date || due !== toLocalInput(form.orders_due) || notes !== form.notes

  return (
    <section className="block block-white no-print">
      <h3>Dates and note</h3>
      <div className="field-row">
        <div className="field">
          <label htmlFor="form-delivery">Trucks deliver</label>
          <input id="form-delivery" type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="form-due">Orders due</label>
          <input id="form-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="form-notes">
          Note to locations <span className="field-hint">(optional, shown at the top of their form)</span>
        </label>
        <textarea
          id="form-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Great prices on beets and cabbage this week."
        />
      </div>
      <button className="btn btn-small" disabled={!changed} onClick={() => onSave({ delivery_date: delivery, orders_due: fromLocalInput(due), notes })}>
        Save
      </button>
    </section>
  )
}

function ItemNote({ item, onSave }) {
  const [note, setNote] = useState(item.note)
  return (
    <div className="item-note">
      <select aria-label={`Deal note for ${item.product}`} value={item.deal} onChange={(e) => onSave({ deal: e.target.value })}>
        {DEALS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        aria-label={`Note about ${item.product}`}
        value={note}
        placeholder="Add a note"
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== item.note && onSave({ note })}
      />
    </div>
  )
}

// Everything on this drop's price lists that isn't on the form yet, plus a way to type an item in.
function AddItems({ form, onAdd }) {
  const notOnForm = form.price_items.filter((p) => !p.on_form)
  const suppliers = [...new Set(notOnForm.map((p) => p.supplier))]
  return (
    <section className="block block-white no-print">
      <h3>Add from this drop’s price lists</h3>
      {form.price_items.length === 0 && (
        <p className="muted">
          No price lists are in for the {form.cycle.name} yet. Add them on <Link to="/portal/admin/price-lists">Price Lists</Link>.
        </p>
      )}
      {form.price_items.length > 0 && notOnForm.length === 0 && <p className="muted">Everything on the price lists is on the form.</p>}
      {suppliers.map((supplier) => (
        <div key={supplier} className="add-items-supplier">
          <h4>{supplier}</h4>
          <ul className="plain-list add-items">
            {notOnForm
              .filter((p) => p.supplier === supplier)
              .map((p) => (
                <li key={p.id}>
                  <span>
                    {p.product}
                    {p.box_size && <span className="muted"> · {p.box_size}</span>} · {money(p.price)}
                  </span>
                  <button className="btn btn-small" onClick={() => onAdd({ price_item: p.id })}>
                    Add
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  )
}

function LocationOrders({ form }) {
  return (
    <section className="block block-white no-print">
      <h3>
        Orders: {form.locations_ordered} of {form.locations} locations · {boxes(form.boxes)} · {money(form.cost)}
      </h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Location</th>
              <th scope="col">Delivered to</th>
              <th scope="col">Order</th>
              <th scope="col" className="num">
                Boxes
              </th>
              <th scope="col" className="num">
                Cost
              </th>
            </tr>
          </thead>
          <tbody>
            {form.location_orders.map((order) => (
              <tr key={order.site_id}>
                <td>
                  <strong>{order.site}</strong>
                </td>
                <td>{order.drop_off ?? '–'}</td>
                <td>
                  {order.ordered ? (
                    order.lines.map((l) => `${l.boxes} ${l.product}`).join(', ')
                  ) : (
                    <span className="tag tag-waiting">Not ordered yet</span>
                  )}
                </td>
                <td className="num">{order.boxes}</td>
                <td className="num">{money(order.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ConfirmationStatus({ confirmation }) {
  if (!confirmation) return null
  const link = `${window.location.origin}/confirm/${confirmation.token}`
  const tag = { waiting: 'tag-waiting', confirmed: 'tag-confirmed', cant: 'tag-cant-fill' }[confirmation.status]
  return (
    <div className="confirmation-status">
      <span className={'tag ' + tag}>
        {confirmation.status === 'confirmed' ? '✓ ' : confirmation.status === 'cant' ? '✗ ' : ''}
        {confirmation.status_label}
      </span>
      {confirmation.reply && <span>“{confirmation.reply}”</span>}
      <span className="no-print">
        {confirmation.sent_at ? 'Emailed. ' : 'Not emailed (no address on file). '}
        <CopyLink link={link} />
      </span>
    </div>
  )
}

function CopyLink({ link }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="link-button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link)
          setCopied(true)
        } catch {
          window.prompt('Copy this link:', link)
        }
      }}
    >
      {copied ? 'Link copied' : 'Copy the confirmation link'}
    </button>
  )
}

// What each supplier was sent: Ketty Brow's by drop-off point, farms by location.
function SupplierOrders({ form }) {
  return (
    <section className="block block-white">
      <h3>What each supplier sends</h3>
      {form.supplier_orders.map((order) => (
        <article key={order.supplier} className="supplier-order">
          <header className="order-head">
            <div>
              <h4>{order.supplier}</h4>
              <p className="muted">
                {boxes(order.boxes)} · {money(order.cost)} · by {order.grouped_by}
              </p>
            </div>
          </header>
          <ConfirmationStatus confirmation={order.confirmation} />
          <ul className="plain-list what-goes-where">
            {order.groups.map((group) => (
              <li key={group.name}>
                <strong>{group.name}</strong> ({boxes(group.boxes)}): {group.items.map((i) => `${i.boxes} × ${i.product}${i.box_size ? ` (${i.box_size})` : ''}`).join(', ')}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}

// Each route's truck stops, printable as route sheets for the drivers.
function TransportRuns({ form }) {
  return (
    <section className="block block-white route-sheets">
      <div className="order-head">
        <h3>Trucks</h3>
        <button className="btn btn-small no-print" onClick={() => window.print()}>
          Print route sheets
        </button>
      </div>
      {form.transport_runs.map((run) => (
        <article key={run.route} className="route-sheet">
          <h4>
            {run.route} route · {longDate(run.delivery_date)} · {boxes(run.boxes)}
          </h4>
          <p className="muted">
            {run.company ?? 'No transport company set (see Routes).'}
          </p>
          <ConfirmationStatus confirmation={run.confirmation} />
          <ol className="route-stops">
            {run.stops.map((stop) => (
              <li key={stop.name}>
                <strong>{stop.name}</strong>: {boxes(stop.boxes)} ({Object.entries(stop.from_suppliers).map(([s, n]) => `${n} from ${s}`).join(', ')})
                {stop.sites.length > 1 && <span className="muted"> · for {stop.sites.join(', ')}</span>}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  )
}
