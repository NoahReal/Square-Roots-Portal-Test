import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../api'
import { boxes, longDate } from '../../format'

// For suppliers and transport companies, from the private link Square Roots sends them (no login):
// what they're asked to do, and a button to confirm. Replaces screenshots and "can you do it?" emails.
export default function ConfirmPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [cant, setCant] = useState(false)
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState('')

  useEffect(() => {
    api(`/confirm/${token}/`)
      .then(setData)
      .catch((err) => setError(err.message))
  }, [token])

  async function answer(status) {
    setReplyError('')
    try {
      setData(await api(`/confirm/${token}/`, { method: 'POST', body: { status, reply } }))
      setCant(false)
    } catch (err) {
      setReplyError([].concat(err.data?.reply ?? err.message).join(' '))
    }
  }

  if (error) {
    return (
      <section className="section">
        <div className="container container-narrow">
          <div className="notice notice-error">{error}</div>
        </div>
      </section>
    )
  }
  if (!data) return <p className="muted page-loading">Loading…</p>

  const isSupplier = data.kind === 'supplier'
  return (
    <>
      <section className="title-block title-block-compact">
        <h1>{isSupplier ? `Order for ${data.order.supplier}` : `${data.run.route} route`}</h1>
        <p>Delivery {longDate(data.delivery_date)}</p>
      </section>
      <section className="section">
        <div className="container container-narrow confirm-page">
          {data.status === 'confirmed' && (
            <div className="notice notice-success" role="status">
              ✓ Confirmed. Thank you! {data.reply && `Your note: “${data.reply}”`}
            </div>
          )}
          {data.status === 'cant' && (
            <div className="notice notice-error" role="status">
              You told us you can’t do this: “{data.reply}”. The Square Roots team will be in touch.
            </div>
          )}

          {isSupplier ? <SupplierOrder order={data.order} /> : <Run run={data.run} company={data.company} />}

          {data.can_reply && (
            <div className="block block-white confirm-actions">
              <h2>{data.status === 'waiting' ? 'Can you do this?' : 'Need to change your answer?'}</h2>
              {cant ? (
                <>
                  <div className="field">
                    <label htmlFor="confirm-reply">What can’t you do?</label>
                    <textarea id="confirm-reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="e.g. Only 20 boxes of carrots this week." />
                    {replyError && <p className="field-error">{replyError}</p>}
                  </div>
                  <div className="button-row">
                    <button className="btn btn-primary" onClick={() => answer('cant')}>
                      Send
                    </button>
                    <button className="btn" onClick={() => setCant(false)}>
                      Back
                    </button>
                  </div>
                </>
              ) : (
                <div className="button-row">
                  <button className="btn btn-primary btn-large" onClick={() => answer('confirmed')}>
                    Yes, confirmed
                  </button>
                  <button className="btn btn-large" onClick={() => setCant(true)}>
                    I can’t do all of it
                  </button>
                </div>
              )}
            </div>
          )}
          <p className="muted">Questions? Email squareroots@enactussmu.ca.</p>
        </div>
      </section>
    </>
  )
}

function SupplierOrder({ order }) {
  return (
    <div className="block block-white">
      <h2>
        {boxes(order.boxes)}, by {order.grouped_by}
      </h2>
      {order.groups.map((group) => (
        <div key={group.name} className="confirm-group">
          <h3>
            {group.name} <span className="muted">({boxes(group.boxes)})</span>
          </h3>
          <ul className="plain-list">
            {group.items.map((item) => (
              <li key={item.product + item.box_size}>
                <strong>{item.boxes}</strong> × {item.product}
                {item.box_size && <span className="muted"> ({item.box_size})</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Run({ run, company }) {
  return (
    <div className="block block-white">
      <h2>
        {run.stops.length} stops, {boxes(run.boxes)}
      </h2>
      {company && <p className="muted">{company}</p>}
      <ol className="route-stops">
        {run.stops.map((stop) => (
          <li key={stop.name}>
            <strong>{stop.name}</strong>: {boxes(stop.boxes)}
            {stop.sites.length > 1 && <span className="muted"> (for {stop.sites.join(', ')})</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
