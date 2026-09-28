import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import { FacebookIcon, InstagramIcon } from '../../components/Icons'

const EMPTY = { first_name: '', last_name: '', email: '', message: '' }

export default function ContactPage() {
  const { t } = useLanguage()
  const words = t.contact
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await api('/contact/', { method: 'POST', body: form })
      setSent(true)
      setForm(EMPTY)
    } catch (err) {
      setErrors(err.data || { detail: err.message })
    }
    setBusy(false)
  }

  const errorFor = (name) => errors[name] && <p className="field-error">{errors[name].join(' ')}</p>

  return (
    <>
      <section className="contact-hero" style={{ backgroundImage: 'url(/photos/team-shirts.jpg)' }}>
        <h1>{words.title}</h1>
      </section>

      <section className="contact-section">
        <div className="container contact-inner">
          <div>
            <h2>{words.workTogether}</h2>
            <p>{words.getInTouch}</p>
            <div className="contact-social">
              <a href="https://www.instagram.com/squarerootssmu/" target="_blank" rel="noreferrer" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="https://www.facebook.com/squarerootssmu/" target="_blank" rel="noreferrer" aria-label="Facebook">
                <FacebookIcon />
              </a>
            </div>
            <p className="contact-signup-note">
              {words.partnerNote}
              <Link to="/signup">{words.partnerLink}</Link>.
            </p>
          </div>

          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            {sent && (
              <div className="notice notice-success" role="status">
                {words.thanks}
              </div>
            )}
            {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
            <div className="contact-form-fields">
              <div className="field">
                <label htmlFor="contact-first">{words.firstName} *</label>
                <input id="contact-first" name="first_name" value={form.first_name} onChange={update} required />
                {errorFor('first_name')}
              </div>
              <div className="field">
                <label htmlFor="contact-last">{words.lastName}</label>
                <input id="contact-last" name="last_name" value={form.last_name} onChange={update} />
              </div>
              <div className="field">
                <label htmlFor="contact-email">{words.email} *</label>
                <input id="contact-email" name="email" type="email" value={form.email} onChange={update} required />
                {errorFor('email')}
              </div>
              <div className="field field-message">
                <label htmlFor="contact-message">{words.message} *</label>
                <textarea id="contact-message" name="message" rows={6} value={form.message} onChange={update} required />
                {errorFor('message')}
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? t.common.sending : words.send}
            </button>
            <p className="form-footnote">
              {words.keepFor} <Link to="/privacy">{t.common.privacy}</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  )
}
