import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { FacebookIcon, InstagramIcon } from '../../components/Icons'

const EMPTY = { first_name: '', last_name: '', email: '', message: '' }

export default function ContactPage() {
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
        <h1>Contact Us</h1>
      </section>

      <section className="contact-section">
        <div className="container contact-inner">
          <div>
            <h2>Let’s Work Together</h2>
            <p>Get in touch.</p>
            <div className="contact-social">
              <a href="https://www.instagram.com/squarerootssmu/" target="_blank" rel="noreferrer" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="https://www.facebook.com/squarerootssmu/" target="_blank" rel="noreferrer" aria-label="Facebook">
                <FacebookIcon />
              </a>
            </div>
            <p className="contact-signup-note">
              Want to become a Community Manager, sell us your produce or host a drop?{' '}
              <Link to="/signup">Sign up as a partner</Link>.
            </p>
          </div>

          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            {sent && (
              <div className="notice notice-success" role="status">
                Thanks for submitting!
              </div>
            )}
            {errors.detail && <div className="notice notice-error">{errors.detail}</div>}
            <div className="contact-form-fields">
              <div className="field">
                <label htmlFor="contact-first">First Name *</label>
                <input id="contact-first" name="first_name" value={form.first_name} onChange={update} required />
                {errorFor('first_name')}
              </div>
              <div className="field">
                <label htmlFor="contact-last">Last Name</label>
                <input id="contact-last" name="last_name" value={form.last_name} onChange={update} />
              </div>
              <div className="field">
                <label htmlFor="contact-email">Email *</label>
                <input id="contact-email" name="email" type="email" value={form.email} onChange={update} required />
                {errorFor('email')}
              </div>
              <div className="field field-message">
                <label htmlFor="contact-message">Message *</label>
                <textarea id="contact-message" name="message" rows={6} value={form.message} onChange={update} required />
                {errorFor('message')}
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Sending…' : 'Send'}
            </button>
            <p className="form-footnote">
              We keep messages for one year. <Link to="/privacy">Privacy</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  )
}
