import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { longDate } from '../../../format'
import PageHero from '../../../components/PageHero'
import { PastePriceList, PriceListTable } from '../../../components/ordering/PriceListParts'

// Admin screen: each supplier's price list for a cycle, and what changed since their last one.
// Suppliers can send their own from the portal; the team can paste in the ones that arrive by email.
export default function PriceListsPage() {
  const [cycles, setCycles] = useState(null)
  const [cycleId, setCycleId] = useState(null)
  const [data, setData] = useState(null)
  const [pasting, setPasting] = useState(null)

  useEffect(() => {
    api('/admin/ordering/').then((setup) => {
      setCycles(setup.cycles)
      setCycleId((setup.cycles.find((c) => c.ordering_open) ?? setup.cycles.find((c) => c.upcoming) ?? setup.cycles.at(-1))?.id)
    })
  }, [])

  useEffect(() => {
    if (!cycleId) return
    setData(null)
    api(`/admin/price-lists/?cycle=${cycleId}`).then(setData)
  }, [cycleId])

  async function save(supplierId, text) {
    await api('/admin/price-lists/', { method: 'POST', body: { supplier: supplierId, cycle: cycleId, text } })
    setPasting(null)
    setData(await api(`/admin/price-lists/?cycle=${cycleId}`))
  }

  return (
    <>
      <PageHero title="Price Lists" lead="What each supplier has this cycle and the price per box, with what changed since last time." />
      <section className="section">
        <div className="container">
          {cycles && (
            <div className="field drop-picker">
              <label htmlFor="price-cycle">Which drop?</label>
              <select id="price-cycle" value={cycleId ?? ''} onChange={(e) => setCycleId(Number(e.target.value))}>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.upcoming ? '' : ' (past)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!data && <p className="muted">Loading…</p>}
          {data?.suppliers.length === 0 && <p className="muted">No suppliers are on a route yet. Add them on the Routes screen.</p>}
          {data?.suppliers.map((supplier) => (
            <article key={supplier.id} className="block block-white price-list-card">
              <header className="order-head">
                <div>
                  <h2>{supplier.name}</h2>
                  <p className="muted">
                    {supplier.kind}
                    {supplier.price_list && ` · received ${longDate(supplier.price_list.received_on)}`}
                  </p>
                </div>
                {supplier.price_list ? (
                  <span className="tag tag-confirmed">{supplier.price_list.items.length} items</span>
                ) : (
                  <span className="tag tag-waiting">Not in yet</span>
                )}
              </header>
              {supplier.price_list && pasting !== supplier.id && (
                <>
                  <PriceListTable list={supplier.price_list} />
                  <button className="link-button" onClick={() => setPasting(supplier.id)}>
                    Replace this list
                  </button>
                </>
              )}
              {(!supplier.price_list || pasting === supplier.id) && (
                <PastePriceList
                  onSave={(text) => save(supplier.id, text)}
                  onCancel={supplier.price_list ? () => setPasting(null) : null}
                />
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
