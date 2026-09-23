import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../../api'
import { useAuth } from '../../../auth'
import PageHero from '../../../components/PageHero'

const ROLE_FILTERS = [
  { value: '', label: 'Everyone' },
  { value: 'community_manager', label: 'Community Managers' },
  { value: 'farm', label: 'Farms' },
  { value: 'host_site', label: 'Host Sites' },
  { value: 'admin', label: 'Admins' },
]

// Admin screen: everyone with an account, what they're linked to, and their access.
export default function PeoplePage() {
  const [params] = useSearchParams()
  const [role, setRole] = useState(params.get('role') ?? '')
  const [query, setQuery] = useState('')
  const [data, setData] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    const search = new URLSearchParams({ role, q: query.trim() })
    // Wait a moment after typing before searching.
    const timer = setTimeout(() => api(`/admin/people/?${search}`).then(setData), 250)
    return () => clearTimeout(timer)
  }, [role, query])

  function replace(person) {
    setData({ ...data, people: data.people.map((p) => (p.id === person.id ? person : p)) })
  }

  return (
    <>
      <PageHero title="People" lead="Everyone with an account: their location or farm, access and passwords." />
      <section className="section">
        <div className="container">
          <div className="toolbar">
            <div className="tabs" role="tablist">
              {ROLE_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  role="tab"
                  aria-selected={role === filter.value}
                  className={'tab' + (role === filter.value ? ' active' : '')}
                  onClick={() => setRole(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <input
              className="search-box"
              type="search"
              placeholder="Find a name, username or email"
              aria-label="Find a person"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="muted">
            People who signed up and are waiting for approval are on the <Link to="/portal/admin/signups">Sign-ups</Link>{' '}
            screen.
          </p>

          {notice && (
            <div className={'notice ' + (notice.ok ? 'notice-success' : 'notice-error')} role="status">
              {notice.text}
            </div>
          )}
          {!data && <p className="muted">Loading…</p>}
          {data?.people.length === 0 && <p className="muted">Nobody matches.</p>}

          <ul className="people-list">
            {data?.people.map((person) => (
              <PersonRow key={person.id} person={person} sites={data.sites} farms={data.farms} onSaved={replace} onNotice={setNotice} />
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}

function PersonRow({ person, sites, farms, onSaved, onNotice }) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = `${person.first_name} ${person.last_name}`.trim() || person.username
  const linkedTo = person.site_name || person.farm_name
  const needsLink = ['community_manager', 'host_site', 'farm'].includes(person.role) && !linkedTo && person.status === 'approved'

  async function run(request, success) {
    setBusy(true)
    try {
      const result = await request()
      if (result?.id) onSaved(result)
      onNotice({ ok: true, text: success(result) })
      setEditing(false)
    } catch (err) {
      onNotice({ ok: false, text: err.data?.detail || err.message })
    }
    setBusy(false)
  }

  const save = (changes) => api(`/admin/people/${person.id}/`, { method: 'PATCH', body: changes })

  return (
    <li className={'person' + (person.is_active ? '' : ' person-off')}>
      <div className="person-main">
        <div>
          <strong>{name}</strong> <span className="tag">{person.role_label}</span>
          {!person.is_active && <span className="tag tag-cant-fill">Switched off</span>}
          {person.status !== 'approved' && <span className="tag tag-waiting">{person.status_label}</span>}
        </div>
        <span className="muted">
          {person.username}
          {person.email && ` · ${person.email}`}
          {person.phone && ` · ${person.phone}`}
        </span>
        <span className={needsLink ? 'text-warning' : 'muted'}>
          {linkedTo
            ? `${person.role === 'farm' ? 'Farm' : 'Location'}: ${linkedTo}`
            : needsLink
              ? `Not linked to a ${person.role === 'farm' ? 'farm' : 'location'} yet, so they can't use their screens`
              : ''}
        </span>
        <span className="muted">
          {person.last_login ? `Last logged in ${new Date(person.last_login).toLocaleDateString('en-CA', { dateStyle: 'medium' })}` : 'Never logged in'}
        </span>
      </div>

      {editing ? (
        <LinkEditor
          person={person}
          sites={sites}
          farms={farms}
          busy={busy}
          onSave={(changes) => run(() => save(changes), () => `Saved ${name}.`)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="person-actions">
          {person.role !== 'admin' && (
            <button className="btn btn-small" onClick={() => setEditing(true)}>
              {person.role === 'farm' ? 'Change farm' : 'Change location'}
            </button>
          )}
          <button
            className="btn btn-small"
            disabled={busy}
            onClick={() => run(() => api(`/admin/people/${person.id}/password-reset/`, { method: 'POST' }), (r) => r.detail)}
          >
            Send password reset
          </button>
          {person.id !== user.id && (
            <button
              className="btn btn-small"
              disabled={busy}
              onClick={() =>
                run(
                  () => save({ is_active: !person.is_active }),
                  (p) => (p.is_active ? `${name} can log in again.` : `${name} is switched off and can't log in.`),
                )
              }
            >
              {person.is_active ? 'Switch off' : 'Switch back on'}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function LinkEditor({ person, sites, farms, busy, onSave, onCancel }) {
  const isFarm = person.role === 'farm'
  const options = isFarm ? farms : sites
  const [value, setValue] = useState(String((isFarm ? person.farm : person.site) ?? ''))
  return (
    <div className="person-actions">
      <select value={value} onChange={(e) => setValue(e.target.value)} aria-label={isFarm ? 'Farm' : 'Location'}>
        <option value="">{isFarm ? 'No farm' : 'No location'}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <button
        className="btn btn-small btn-primary"
        disabled={busy}
        onClick={() => onSave({ [isFarm ? 'farm' : 'site']: value ? Number(value) : null })}
      >
        Save
      </button>
      <button className="link-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
