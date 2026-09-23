import { useEffect, useState } from 'react'
import { api } from '../../../api'
import { money } from '../../../format'
import { forgetPricing } from '../../../pricing'
import PageHero from '../../../components/PageHero'

// Admin screen: bundle prices, the first-drop incentive, the delivery fee and where produce is sorted.
export default function SettingsPage() {
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/admin/settings/').then(setForm)
  }, [])

  const update = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value })
    setSaved(false)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      const { manager_share, ...body } = form
      setForm(await api('/admin/settings/', { method: 'PATCH', body }))
      forgetPricing()
      setSaved(true)
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  const share = form ? Number(form.standard_price || 0) - Number(form.at_cost_price || 0) : 0

  const price = (name, label, hint) => (
    <div className="field">
      <label htmlFor={`setting-${name}`}>
        {label} {hint && <span className="field-hint">({hint})</span>}
      </label>
      <div className="money-input">
        <span aria-hidden="true">$</span>
        <input id={`setting-${name}`} name={name} type="number" inputMode="decimal" min="0" step="0.01" value={form[name]} onChange={update} />
      </div>
      {errors[name] && <p className="field-error">{[].concat(errors[name]).join(' ')}</p>}
    </div>
  )

  return (
    <>
      <PageHero title="Settings" lead="Bundle prices, the first-drop incentive, the delivery fee and where produce is sorted." />
      <section className="section">
        <div className="container container-narrow">
          {!form && <p className="muted">Loading…</p>}
          {form && (
            <form className="block block-white" onSubmit={handleSubmit} noValidate>
              {saved && (
                <div className="notice notice-success" role="status">
                  Saved. New prices apply to statements and the website straight away.
                </div>
              )}
              {errors.detail && <div className="notice notice-error">{errors.detail}</div>}

              <h2>Sliding-scale prices (per 10 lb bundle)</h2>
              <div className="field-row">
                {price('standard_price', 'Standard / pay-it-forward')}
                {price('at_cost_price', 'At cost', 'for people who need it')}
              </div>
              <p className="muted">
                Free bundles are $0. From each standard bundle, the Community Manager keeps{' '}
                <strong>{money(share)}</strong>; they owe Square Roots the at-cost price for every paid bundle.
              </p>

              <h2>Incentives and delivery</h2>
              <div className="field-row">
                {price('first_drop_cost', 'First-drop price', 'what a new location owes per paid bundle')}
                {price('delivery_fee', 'Home delivery fee')}
              </div>

              <h2>Logistics</h2>
              <div className="field">
                <label htmlFor="setting-staging">Sorting space</label>
                <input
                  id="setting-staging"
                  name="staging_location"
                  value={form.staging_location}
                  onChange={update}
                  placeholder="Where farm produce is dropped off and packed into bundles"
                />
              </div>

              <button className="btn btn-primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save settings'}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
