import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { SIGNUP_ROLES } from '../signupRoles'

const NEW_LOCATION = 'new'

// Sign-up form for a Community Manager, Farm or Host Site.
// `roleSlug` is one of the keys in signupRoles.js, e.g. "farm".
export default function SignupForm({ roleSlug }) {
  const { role, button } = SIGNUP_ROLES[roleSlug]
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
      if (!input.value.trim()) missing[input.id.replace('signup-', '')] = 'Please fill this in.'
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
          {errors.detail || 'Please fix the highlighted boxes below.'}
        </div>
      )}

      <div className="field-row">
        <Field label="First name" required autoComplete="given-name" {...field('first_name')} />
        <Field label="Last name" required autoComplete="family-name" {...field('last_name')} />
      </div>
      <Field label="Email" type="email" required autoComplete="email" {...field('email')} />
      <Field label="Phone" type="tel" required={role !== 'farm'} autoComplete="tel" {...field('phone')} />

      {role === 'community_manager' && (
        <>
          <SelectField label="Where would you like to run drops?" required {...field('site')}>
            <option value="">Choose a location…</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
            <option value={NEW_LOCATION}>Somewhere new</option>
          </SelectField>
          {form.site === NEW_LOCATION && (
            <Field label="Planned location" hint="Town or neighbourhood" required {...field('planned_location')} />
          )}
          {errors.planned_location && form.site !== NEW_LOCATION && <FieldError error={errors.planned_location} />}
        </>
      )}

      {role === 'farm' && (
        <>
          <Field label="Farm name" required {...field('organization')} />
          <Field label="Where is your farm?" hint="Town or county" {...field('address')} />
          <Field label="What types of produce do you sell?" required multiline {...field('produce_types')} />
          <Field
            label="How many pounds do you have available on a bi-weekly basis?"
            required
            {...field('pounds_available')}
          />
        </>
      )}

      {role === 'host_site' && (
        <>
          <Field label="Name of your organization or space" required {...field('organization')} />
          <Field label="Address of your space" required autoComplete="street-address" {...field('address')} />
          <SelectField label="Do you already host a Square Roots location?" {...field('site')}>
            <option value="">No, this would be a new location</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                Yes: {site.name}
              </option>
            ))}
          </SelectField>
        </>
      )}

      <Field label="Message" hint="Optional" multiline {...field('message')} />

      <fieldset className="account-fields">
        <legend>Your partner portal login</legend>
        <Field label="Username" required autoComplete="username" autoCapitalize="none" {...field('username')} />
        <Field
          label="Password"
          type="password"
          required
          hint="At least 8 characters, and not just numbers"
          autoComplete="new-password"
          {...field('password')}
        />
      </fieldset>

      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Sending…' : button}
      </button>
      <p className="form-footnote">
        We'll review your application and email you when your account is approved. Already have an account?{' '}
        <Link to="/portal/login">Log in</Link>
      </p>
    </form>
  )
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="field-error">{Array.isArray(error) ? error.join(' ') : error}</p>
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
        rows={multiline ? 4 : undefined}
        {...inputProps}
      />
      <FieldError error={error} />
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
