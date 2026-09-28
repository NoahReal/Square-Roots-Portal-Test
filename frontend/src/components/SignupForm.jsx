import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useLanguage } from '../i18n'
import { SIGNUP_ROLES } from '../signupRoles'

const NEW_LOCATION = 'new'

// Sign-up form for a Community Manager, Farm or Host Site.
// `roleSlug` is one of the keys in signupRoles.js, e.g. "farm".
export default function SignupForm({ roleSlug }) {
  const { role } = SIGNUP_ROLES[roleSlug]
  const { t } = useLanguage()
  const words = t.signup
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({})
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [sites, setSites] = useState([])

  useEffect(() => {
    if (role !== 'farm') api('/sites/').then(setSites).catch(() => setSites([]))
  }, [role])

  function update(name, value) {
    setForm({ ...form, [name]: value })
  }

  async function handleSubmit(event) {
    event.preventDefault()

    // Point out every empty required box at once, before asking the server.
    const missing = {}
    for (const input of event.target.querySelectorAll('[required]')) {
      if (!input.value.trim()) missing[input.id.replace('signup-', '')] = t.common.pleaseFill
    }
    if (Object.keys(missing).length > 0) {
      setErrors(missing)
      return
    }

    setBusy(true)
    setErrors({})
    const site = form.site && form.site !== NEW_LOCATION ? Number(form.site) : null
    try {
      await signup({ ...form, role, site })
      navigate('/portal/pending')
    } catch (err) {
      setErrors(err.data && typeof err.data === 'object' ? err.data : { detail: err.message })
      setBusy(false)
    }
  }

  // Shared props for each input: its value, what to do on change, and its error.
  const field = (name) => ({ name, value: form[name] ?? '', onChange: update, error: errors[name] })

  return (
    <form className="signup-form" onSubmit={handleSubmit} noValidate>
      {Object.keys(errors).length > 0 && (
        <div className="notice notice-error" role="alert">
          {errors.detail || words.fixBoxes}
        </div>
      )}

      <div className="field-row">
        <Field label={words.firstName} required autoComplete="given-name" {...field('first_name')} />
        <Field label={words.lastName} required autoComplete="family-name" {...field('last_name')} />
      </div>
      <Field label={words.email} type="email" required autoComplete="email" {...field('email')} />
      <Field label={words.phone} type="tel" required={role !== 'farm'} autoComplete="tel" {...field('phone')} />

      {role === 'community_manager' && (
        <>
          <SelectField label={words.whereRun} required {...field('site')}>
            <option value="">{words.chooseLocation}</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
            <option value={NEW_LOCATION}>{words.somewhereNew}</option>
          </SelectField>
          {form.site === NEW_LOCATION && (
            <Field
              label={words.plannedLocation}
              hint={words.townOrNeighbourhood}
              required
              {...field('planned_location')}
            />
          )}
          {errors.planned_location && form.site !== NEW_LOCATION && <FieldError error={errors.planned_location} />}
        </>
      )}

      {role === 'farm' && (
        <>
          <Field label={words.farmName} required {...field('organization')} />
          <Field label={words.whereFarm} hint={words.townOrCounty} {...field('address')} />
          <Field label={words.produceTypes} required multiline {...field('produce_types')} />
          <Field label={words.pounds} required {...field('pounds_available')} />
        </>
      )}

      {role === 'host_site' && (
        <>
          <Field label={words.orgName} required {...field('organization')} />
          <Field label={words.spaceAddress} required autoComplete="street-address" {...field('address')} />
          <SelectField label={words.alreadyHost} {...field('site')}>
            <option value="">{words.newLocation}</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {words.yesSite(site.name)}
              </option>
            ))}
          </SelectField>
        </>
      )}

      <Field label={words.message} hint={words.optional} multiline {...field('message')} />

      <fieldset className="account-fields">
        <legend>{words.loginLegend}</legend>
        <Field label={words.username} required autoComplete="username" autoCapitalize="none" {...field('username')} />
        <Field
          label={words.password}
          type="password"
          required
          hint={words.passwordHint}
          autoComplete="new-password"
          {...field('password')}
        />
      </fieldset>

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? t.common.sending : words.roles[roleSlug].button}
      </button>
      <p className="form-footnote">
        {words.review}
        <Link to="/portal/login">{t.common.logIn}</Link>
        {words.howWeUse}
        <Link to="/privacy">{t.common.privacy}</Link>
      </p>
    </form>
  )
}

function FieldError({ error, id }) {
  if (!error) return null
  return (
    <p className="field-error" id={id}>
      {Array.isArray(error) ? error.join(' ') : error}
    </p>
  )
}

function Field({ label, hint, name, value, onChange, error, required, multiline, ...inputProps }) {
  const id = 'signup-' + name
  const Input = multiline ? 'textarea' : 'input'
  return (
    <div className={'field' + (error ? ' has-error' : '')}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {hint && <span className="field-hint"> ({hint})</span>}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? id + '-error' : undefined}
        rows={multiline ? 4 : undefined}
        {...inputProps}
      />
      <FieldError error={error} id={id + '-error'} />
    </div>
  )
}

function SelectField({ label, name, value, onChange, error, required, children }) {
  const id = 'signup-' + name
  return (
    <div className={'field' + (error ? ' has-error' : '')}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(name, e.target.value)} required={required}>
        {children}
      </select>
      <FieldError error={error} />
    </div>
  )
}
