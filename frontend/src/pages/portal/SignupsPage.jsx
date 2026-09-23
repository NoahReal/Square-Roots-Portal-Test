import { useEffect, useState } from 'react'
import { api } from '../../api'
import PageHero from '../../components/PageHero'

const TABS = [
  { status: 'pending', label: 'Waiting' },
  { status: 'approved', label: 'Approved' },
  { status: 'declined', label: 'Not approved' },
]

// Admin screen: review people who signed up on the website.
export default function SignupsPage() {
  const [status, setStatus] = useState('pending')
  const [applications, setApplications] = useState(null)
  const [notice, setNotice] = useState(null)
  const [sites, setSites] = useState([])

  useEffect(() => {
    setApplications(null)
    api(`/applications/?status=${status}`).then(setApplications)
  }, [status])

  useEffect(() => {
    api('/sites/').then(setSites)
  }, [])

  // `body` carries the chosen location when approving, or the reason when declining.
  // Errors are passed back so the card can show them next to the right box.
  async function review(application, action, body = {}) {
    const name = `${application.user.first_name} ${application.user.last_name}`
    const reviewed = await api(`/applications/${application.id}/${action}/`, { method: 'POST', body })
    setApplications(applications.filter((a) => a.id !== application.id))
    const where = reviewed.site_name ? ` to run ${reviewed.site_name}` : ''
    setNotice({
      ok: true,
      text:
        action === 'approve'
          ? `${name} is approved${where} and can now use the portal. We've emailed them.`
          : `${name}'s application was declined. We've emailed them.`,
    })
  }

  return (
    <>
      <PageHero title="Sign-ups" lead="People who signed up on the website. Approve them to give them access to the portal." />
      <section className="section">
        <div className="container">
          <div className="tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.status}
                role="tab"
                aria-selected={status === tab.status}
                className={'tab' + (status === tab.status ? ' active' : '')}
                onClick={() => {
                  setStatus(tab.status)
                  setNotice(null)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {notice && (
            <div className={'notice ' + (notice.ok ? 'notice-success' : 'notice-error')} role="status">
              {notice.text}
            </div>
          )}

          {!applications && <p className="muted">Loading…</p>}
          {applications?.length === 0 && (
            <div className="block block-white">
              <p className="muted">
                {status === 'pending' ? 'Nobody is waiting for approval. 🎉' : 'Nothing here yet.'}
              </p>
            </div>
          )}
          {applications?.map((application) => (
            <Application key={application.id} application={application} sites={sites} onReview={review} />
          ))}
        </div>
      </section>
    </>
  )
}

function Application({ application, sites, onReview }) {
  const { user } = application
  const details = [
    ['Email', application.email && <a href={`mailto:${application.email}`}>{application.email}</a>],
    ['Phone', application.phone],
    [user.role === 'farm' ? 'Farm' : 'Organization', application.organization],
    ['Existing location', application.site_name],
    ['Planned location', application.planned_location],
    ['Address', application.address],
    ['Produce', application.produce_types],
    ['Lbs every 2 weeks', application.pounds_available],
    ['Message', application.message],
    ['Username', user.username],
  ].filter(([, value]) => value)

  return (
    <article className="block block-white application">
      <div className="application-head">
        <div>
          <h3>
            {user.first_name} {user.last_name}
          </h3>
          <p className="muted">Signed up {new Date(application.submitted_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })}</p>
        </div>
        <span className="tag">{user.role_label}</span>
      </div>

      <dl className="details">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {user.status === 'pending' ? (
        <ReviewActions application={application} sites={sites} onReview={onReview} />
      ) : (
        <p className="muted">
          {user.status_label}
          {application.reviewed_by_name && ` by ${application.reviewed_by_name}`}
          {application.reviewed_at &&
            ` on ${new Date(application.reviewed_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })}`}
          .{application.decline_reason && ` Reason given: “${application.decline_reason}”`}
        </p>
      )}
    </article>
  )
}

const NEW_LOCATION = 'new'

// Approve (choosing a location for Community Managers and Host Sites) or decline (with an optional reason).
function ReviewActions({ application, sites, onReview }) {
  const needsLocation = ['community_manager', 'host_site'].includes(application.user.role)
  const [mode, setMode] = useState(null) // null, 'approve' or 'decline'
  const [site, setSite] = useState('')
  const [newName, setNewName] = useState(application.planned_location ?? '')
  const [newAddress, setNewAddress] = useState(application.address ?? '')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function send(action, body) {
    setBusy(true)
    setError('')
    try {
      await onReview(application, action, body)
    } catch (err) {
      const data = err.data || {}
      setError([].concat(data.site ?? data.new_site ?? data.detail ?? err.message).join(' '))
      setBusy(false)
    }
  }

  // Start from what they asked for: the location they chose, or "new" if they suggested somewhere.
  function startApproving() {
    const chosen = sites.find((s) => s.name === application.site_name)
    setSite(chosen ? String(chosen.id) : application.planned_location ? NEW_LOCATION : '')
    setMode('approve')
  }

  function approve() {
    if (!needsLocation) return send('approve')
    if (site === NEW_LOCATION) return send('approve', { new_site: { name: newName, address: newAddress } })
    return send('approve', { site: site ? Number(site) : null })
  }

  if (mode === 'approve' && needsLocation) {
    return (
      <div className="review-box">
        <div className="field">
          <label htmlFor={`site-${application.id}`}>Which location will they {application.user.role === 'host_site' ? 'host' : 'run'}?</label>
          <select id={`site-${application.id}`} value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Choose a location…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_LOCATION}>A new location…</option>
          </select>
        </div>
        {site === NEW_LOCATION && (
          <div className="field-row">
            <div className="field">
              <label htmlFor={`new-name-${application.id}`}>New location name</label>
              <input id={`new-name-${application.id}`} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Bedford" />
            </div>
            <div className="field">
              <label htmlFor={`new-address-${application.id}`}>Street address</label>
              <input id={`new-address-${application.id}`} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            </div>
          </div>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="button-row">
          <button className="btn btn-primary" disabled={busy || !site} onClick={approve}>
            {busy ? 'Approving…' : 'Approve'}
          </button>
          <button className="link-button" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'decline') {
    return (
      <div className="review-box">
        <div className="field">
          <label htmlFor={`reason-${application.id}`}>
            Reason for {application.user.first_name} <span className="field-hint">(optional, included in the email)</span>
          </label>
          <textarea
            id={`reason-${application.id}`}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. We already have a Community Manager in Bedford, but we'll keep your details for next season."
          />
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="button-row">
          <button className="btn btn-primary" disabled={busy} onClick={() => send('decline', { reason })}>
            {busy ? 'Sending…' : 'Decline and email them'}
          </button>
          <button className="link-button" onClick={() => setMode(null)}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="button-row">
      {error && <p className="field-error">{error}</p>}
      <button className="btn btn-primary" disabled={busy} onClick={() => (needsLocation ? startApproving() : approve())}>
        Approve
      </button>
      <button className="btn" onClick={() => setMode('decline')}>
        Decline
      </button>
    </div>
  )
}
