import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import PageHero from '../../../components/PageHero'
import { PastePriceList, PriceListTable } from '../../../components/ordering/PriceListParts'

// Supplier screen: send this cycle's price list by pasting it from your spreadsheet.
export default function PriceListPage() {
  const { user } = useAuth()
  const [cycles, setCycles] = useState(null)
  const [error, setError] = useState('')
  const [replacing, setReplacing] = useState(null)
  const [sent, setSent] = useState('')

  const load = () =>
    api('/supplier/price-lists/')
      .then((data) => setCycles(data.cycles))
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  async function send(cycle, text) {
    await api('/supplier/price-lists/', { method: 'POST', body: { cycle: cycle.id, text } })
    setReplacing(null)
    setSent(`Thanks! Your price list for the ${cycle.name} is in. The Square Roots team has been told.`)
    await load()
  }

  return (
    <>
      <PageHero title="Price List" lead="Tell Square Roots what you have and the price per box, for each drop.">
        {user.farm_name && <p className="hero-meta">{user.farm_name}</p>}
      </PageHero>
      <section className="section">
        <div className="container container-narrow">
          {error && <div className="notice notice-error">{error}</div>}
          {sent && (
            <div className="notice notice-success" role="status">
              {sent}
            </div>
          )}
          {!cycles && !error && <p className="muted">Loading…</p>}
          {cycles?.map((cycle) => (
            <article key={cycle.id} className="block block-white price-list-card">
              <h2>{cycle.name}</h2>
              {cycle.price_list && replacing !== cycle.id ? (
                <>
                  <PriceListTable list={cycle.price_list} />
                  <button className="link-button" onClick={() => setReplacing(cycle.id)}>
                    Send a new list for this drop
                  </button>
                </>
              ) : (
                <PastePriceList
                  submitLabel="Send price list"
                  onSave={(text) => send(cycle, text)}
                  onCancel={cycle.price_list ? () => setReplacing(null) : null}
                />
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
