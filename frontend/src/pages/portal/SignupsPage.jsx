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

  useEffect(() => {
    setApplications(null)
    api(`/applications/?status=${status}`).then(setApplications)
  }, [status])

  async function review(application, action) {
    const name = `${application.user.first_name} ${application.user.last_name}`
    try {
      await api(`/applications/${application.id}/${action}/`, { method: 'POST' })
      setApplications(applications.filter((a) => a.id !== application.id))
      setNotice({
        ok: true,
        text:
          action === 'approve'
            ? `${name} is approved and can now use the portal. We've emailed them.`
            : `${name}'s application was declined. We've emailed them.`,
      })
    } catch (err) {
      setNotice({ ok: false, text: err.message })
    }
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
            <Application key={application.id} application={application} onReview={review} />
          ))}
        </div>
      </section>
    </>
  )
}

function Application({ application, onReview }) {
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
        <div className="button-row">
          <button className="btn btn-primary" onClick={() => onReview(application, 'approve')}>
            Approve
          </button>
          <button className="btn" onClick={() => onReview(application, 'decline')}>
            Decline
          </button>
        </div>
      ) : (
        <p className="muted">
          {user.status_label}
          {application.reviewed_by_name && ` by ${application.reviewed_by_name}`}
          {application.reviewed_at &&
            ` on ${new Date(application.reviewed_at).toLocaleDateString('en-CA', { dateStyle: 'medium' })}`}
          .
        </p>
      )}
    </article>
  )
}
