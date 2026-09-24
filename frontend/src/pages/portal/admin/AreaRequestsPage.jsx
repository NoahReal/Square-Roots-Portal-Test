import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { shortDate } from '../../../format'
import PageHero from '../../../components/PageHero'

// Admin screen: where people are asking for a Square Roots location, busiest areas first.
export default function AreaRequestsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const load = () =>
    api('/admin/area-requests/')
      .then(setData)
      .catch((err) => setError(err.message))

  useEffect(() => {
    load()
  }, [])

  async function remove(request) {
    await api(`/admin/area-requests/${request.id}/`, { method: 'DELETE' })
    load()
  }

  return (
    <>
      <PageHero
        title="Location Requests"
        lead="People asking for a Square Roots location near them, from the website. An area is the first half of a postal code."
      />
      <section className="section">
        <div className="container">
          {error && <div className="notice notice-error">{error}</div>}
          {!data && !error && <p className="muted">Loading…</p>}
          {data?.areas.length === 0 && <p className="muted">No requests yet. They come from the “Bring Square Roots to your area” page.</p>}
          {data?.areas.length > 0 && (
            <>
              <h2>By area</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Area</th>
                    <th scope="col">Towns mentioned</th>
                    <th scope="col" className="num">Requests</th>
                    <th scope="col" className="num">Could help run or host</th>
                  </tr>
                </thead>
                <tbody>
                  {data.areas.map((area) => (
                    <tr key={area.area}>
                      <td>
                        <strong>{area.area}</strong>
                      </td>
                      <td>{area.towns.join(', ') || <span className="muted">none given</span>}</td>
                      <td className="num">{area.requests}</td>
                      <td className="num">{area.could_help}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2>Every request</h2>
              <ul className="preorder-list">
                {data.requests.map((r) => (
                  <li key={r.id} className="preorder">
                    <div className="preorder-who">
                      <strong>
                        {r.postal_code}
                        {r.town && ` · ${r.town}`}
                      </strong>
                      <span className="preorder-badges">{r.could_help && <span className="tag">Could help</span>}</span>
                      <span className="muted">
                        <a href={`mailto:${r.email}`}>{r.email}</a> · {shortDate(r.created_at.slice(0, 10))}
                      </span>
                      {r.note && <span>{r.note}</span>}
                    </div>
                    <div className="preorder-toggles">
                      <button className="link-button" onClick={() => remove(r)} aria-label={`Delete the request from ${r.email}`}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  )
}
