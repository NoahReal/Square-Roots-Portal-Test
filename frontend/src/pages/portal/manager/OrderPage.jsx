import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import { dateAndTime, longDate, pounds, timeLeft, timeRange } from '../../../format'
import PageHero from '../../../components/PageHero'
import Stepper from '../../../components/Stepper'
import LocationOrderForm from '../../../components/ordering/LocationOrderForm'

// Community Manager screen: order for your location before the cutoff. Locations whose route has
// switched to order forms choose boxes of each item; the others choose a number of bundles.
export default function OrderPage() {
  const { user } = useAuth()
  if (user.uses_order_forms) {
    return (
      <>
        <PageHero title="Order" lead="Choose how many boxes of each item you need, before the deadline.">
          {user.site_name && <p className="hero-meta">Ordering for {user.site_name}</p>}
        </PageHero>
        <section className="section">
          <div className="container container-narrow">
            <LocationOrderForm siteName={user.site_name} />
          </div>
        </section>
      </>
    )
  }
  return <BundleOrderPage />
}

// Ordering a number of 10 lb bundles (for routes that haven't switched to order forms).
function BundleOrderPage() {
  const { user } = useAuth()
  const [drops, setDrops] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    api('/manager/drops/')
      .then(setDrops)
      .catch((err) => setError(err.message))
  }, [])

  const open = drops?.filter((d) => d.ordering_open) ?? []
  const closedUpcoming = drops?.filter((d) => !d.ordering_open && !d.has_happened) ?? []
  const lastReport = drops?.filter((d) => d.report).at(-1)
  const selected = open.find((d) => d.id === selectedId) ?? open[0]

  function replace(updated) {
    setDrops(drops.map((d) => (d.id === updated.id ? updated : d)))
  }

  return (
    <>
      <PageHero title="Order" lead="Choose how many bundles you need before the cutoff.">
        {user.site_name && <p className="hero-meta">Ordering for {user.site_name}</p>}
      </PageHero>

      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!drops && !error && <p className="muted">Loading…</p>}

          {closedUpcoming.map((drop) => (
            <div key={drop.id} className="block block-white closed-order">
              <div>
                <span className="tag">Ordering closed</span>
                <h3>{drop.cycle_name}</h3>
                <p className="muted">
                  {longDate(drop.drop_date)} · {timeRange(drop.starts_at, drop.ends_at)}
                </p>
              </div>
              <p className="closed-order-amount">
                {drop.bundles === null ? (
                  <>You didn't order for this drop.</>
                ) : (
                  <>
                    You ordered <strong>{drop.bundles} bundles</strong> ({pounds(drop.bundles * 10)}).
                  </>
                )}{' '}
                {drop.preorder_count > 0 && (
                  <Link to="/portal/manager/preorders">
                    {drop.preorder_count} preorders ({drop.preorder_bundles} bundles)
                  </Link>
                )}
              </p>
            </div>
          ))}

          {drops && open.length === 0 && (
            <div className="block block-white">
              <h3>No drops open for ordering</h3>
              <p className="muted">The Square Roots team hasn't opened the next drop yet. Check back soon.</p>
            </div>
          )}

          {selected && <OrderCard key={selected.id} drop={selected} lastReport={lastReport} onSaved={replace} />}

          {open.length > 1 && (
            <section className="later-drops">
              <h2>All open drops</h2>
              <p className="muted">Tap a drop to set or change its order.</p>
              <ul className="drop-list">
                {open.map((drop) => (
                  <li key={drop.id} className={drop.id === selected?.id ? 'selected' : ''}>
                    <button onClick={() => setSelectedId(drop.id)}>
                      <span>
                        <strong>{drop.cycle_name}</strong>
                        <br />
                        <span className="muted">Order by {dateAndTime(drop.order_cutoff)}</span>
                      </span>
                      <span className="drop-list-amount">
                        {drop.bundles === null ? 'Not ordered' : `${drop.bundles} bundles`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </>
  )
}

function OrderCard({ drop, lastReport, onSaved }) {
  const suggested = Math.max(drop.preorder_bundles, lastReport?.report.bundles_sold ?? 20)
  const [bundles, setBundles] = useState(drop.bundles ?? suggested)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  const unsaved = drop.bundles !== bundles

  async function save() {
    setBusy(true)
    setNotice(null)
    try {
      const updated = await api(`/manager/drops/${drop.id}/order/`, { method: 'PUT', body: { bundles } })
      onSaved(updated)
      setNotice({ ok: true, text: `Saved: ${bundles} bundles (${pounds(bundles * 10)}) for the ${drop.cycle_name}.` })
    } catch (err) {
      setNotice({ ok: false, text: err.data?.bundles || err.message })
    }
    setBusy(false)
  }

  return (
    <article className="block block-white order-builder">
      <header className="order-builder-head">
        <div>
          <h2>{drop.cycle_name}</h2>
          <p>
            {longDate(drop.drop_date)} · {timeRange(drop.starts_at, drop.ends_at)}
          </p>
        </div>
        <span className="tag tag-waiting">{timeLeft(drop.order_cutoff)}</span>
      </header>
      <p className="muted">You can place or change your order until {dateAndTime(drop.order_cutoff)}</p>

      <label className="order-builder-label" htmlFor="bundles">
        How many bundles?
      </label>
      <Stepper id="bundles" value={bundles} onChange={setBundles} label="bundles" />
      <p className="order-builder-pounds">{pounds(bundles * 10)} of produce</p>

      <ul className="order-hints">
        {drop.preorder_bundles > 0 && (
          <li>
            <strong>{drop.preorder_bundles} bundles</strong> are already preordered by {drop.preorder_count} customers.
          </li>
        )}
        {lastReport && (
          <li>
            At the {lastReport.cycle_name} you sold <strong>{lastReport.report.bundles_sold}</strong> of{' '}
            {lastReport.bundles ?? lastReport.report.bundles_sold} bundles.
          </li>
        )}
      </ul>

      {notice && (
        <div className={'notice ' + (notice.ok ? 'notice-success' : 'notice-error')} role="status">
          {notice.text}
        </div>
      )}

      <div className="button-row">
        <button className="btn btn-primary" onClick={save} disabled={busy || (!unsaved && drop.bundles !== null)}>
          {busy ? 'Saving…' : drop.bundles === null ? 'Place order' : unsaved ? 'Save changes' : 'Order saved'}
        </button>
        {unsaved && drop.bundles !== null && (
          <button className="btn" onClick={() => setBundles(drop.bundles)}>
            Undo changes
          </button>
        )}
      </div>
    </article>
  )
}
