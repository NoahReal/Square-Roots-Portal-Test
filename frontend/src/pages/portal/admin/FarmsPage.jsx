import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { money, pounds, shortDate } from '../../../format'
import PageHero from '../../../components/PageHero'
import CyclePicker, { useChosenCycle } from '../../../components/CyclePicker'
import Stepper from '../../../components/Stepper'

// Admin screen: everything farms have posted, and buying from it for an upcoming drop.
export default function FarmsPage() {
  const { cycles, chosen, choose } = useChosenCycle({ upcomingOnly: true })
  const [farms, setFarms] = useState(null)
  const [detail, setDetail] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    api('/admin/produce/').then(setFarms)
  }, [])

  useEffect(() => {
    if (!chosen) return
    setDetail(null)
    api(`/admin/cycles/${chosen.id}/`).then(setDetail)
  }, [chosen?.id])

  const stillNeeded = detail ? Math.max(0, detail.pounds_needed - detail.pounds_bought) : 0
  const bought = (farmName) =>
    detail?.farm_orders.find((o) => o.farm_name === farmName)?.lines.reduce((sum, l) => sum + l.pounds, 0) ?? 0

  async function buy(listing, farm, amount) {
    const order = await api(`/admin/cycles/${chosen.id}/buy/`, { method: 'POST', body: { listing: listing.id, pounds: amount } })
    setNotice(
      `Added ${pounds(amount)} of ${listing.produce} to ${farm.name}'s order for the ${chosen.name}. ` +
        `We've asked them to confirm (order total now ${money(order.total)}).`,
    )
    // Refresh both lists: pounds left on the listing, and pounds bought for the cycle.
    const [newFarms, newDetail] = await Promise.all([api('/admin/produce/'), api(`/admin/cycles/${chosen.id}/`)])
    setFarms(newFarms)
    setDetail(newDetail)
  }

  return (
    <>
      <PageHero title="Farms" lead="See what farms have available and decide who supplies what." />

      <section className="section">
        <div className="container">
          <div className="toolbar">
            <CyclePicker cycles={cycles} chosen={chosen} onChoose={choose} label="Buying for" />
            {detail && (
              <div className="needed-summary">
                <span>
                  Needed <strong>{pounds(detail.pounds_needed)}</strong> · bought <strong>{pounds(detail.pounds_bought)}</strong>
                </span>
                {stillNeeded > 0 ? (
                  <span className="tag tag-waiting">{pounds(stillNeeded)} still to buy</span>
                ) : (
                  detail.pounds_needed > 0 && <span className="tag tag-confirmed">All bought</span>
                )}
              </div>
            )}
          </div>
          {cycles?.length === 0 && (
            <div className="notice notice-error">
              There are no upcoming drop cycles to buy for. <Link to="/portal/admin/cycles">Create one first.</Link>
            </div>
          )}

          {notice && (
            <div className="notice notice-success" role="status">
              {notice}{' '}
              <Link to={`/portal/admin/orders?cycle=${chosen?.id}`}>See the purchase lists</Link>
            </div>
          )}

          {(!farms || (chosen && !detail)) && <p className="muted">Loading…</p>}
          {farms?.length === 0 && <p className="muted">No farm has posted produce right now.</p>}

          {/* Wait for the cycle's totals, so each card can suggest how much is still needed. */}
          {(!chosen || detail) && farms?.map((farm) => (
            <section key={farm.id} className="farm-section">
              <div className="list-heading">
                <h2>{farm.name}</h2>
                <span className="muted">
                  {farm.location}
                  {bought(farm.name) > 0 && ` · ${pounds(bought(farm.name))} already on this order`}
                </span>
              </div>
              <ul className="listing-grid">
                {farm.listings.map((listing) => (
                  <ListingCard
                    // A new key resets the suggested amount when the cycle or amount still needed changes.
                    key={`${listing.id}-${chosen?.id}-${stillNeeded}`}
                    listing={listing}
                    suggested={Math.min(listing.pounds, Math.max(10, Math.round(stillNeeded / 10) * 10))}
                    canBuy={Boolean(chosen)}
                    onBuy={(amount) => buy(listing, farm, amount)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </>
  )
}

function ListingCard({ listing, suggested, canBuy, onBuy }) {
  const [amount, setAmount] = useState(suggested)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toBuy = Math.min(amount, listing.pounds)

  async function handleBuy() {
    setBusy(true)
    setError('')
    try {
      await onBuy(toBuy)
    } catch (err) {
      setError([].concat(err.data?.pounds ?? err.data?.detail ?? err.message).join(' '))
    }
    setBusy(false)
  }

  return (
    <li className="listing-card">
      <h3>{listing.produce}</h3>
      <p className="produce-amount">
        <strong>{pounds(listing.pounds)}</strong> · {money(listing.price_per_pound)}/lb
      </p>
      <p className="muted">{listing.available_until ? `Until ${shortDate(listing.available_until)}` : 'No end date'}</p>
      {listing.notes && <p className="produce-notes">{listing.notes}</p>}
      {canBuy && (
        <div className="buy-row">
          <Stepper
            id={`buy-${listing.id}`}
            value={toBuy}
            onChange={setAmount}
            min={Math.min(10, listing.pounds)}
            max={listing.pounds}
            step={10}
            size="small"
            label={`pounds of ${listing.produce}`}
          />
          <button className="btn btn-small btn-primary" onClick={handleBuy} disabled={busy}>
            {busy ? 'Adding…' : `Buy · ${money(toBuy * listing.price_per_pound)}`}
          </button>
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </li>
  )
}
