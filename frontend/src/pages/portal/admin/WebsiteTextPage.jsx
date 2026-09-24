import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../../api'
import { SITE_TEXT, useSiteTextChanges } from '../../../siteText'
import PageHero from '../../../components/PageHero'

const PAGE_LINKS = {
  Home: '/',
  About: '/about',
  'Drop Dates & Locations': '/drop-dates-locations',
  'For Farms': '/for-farms',
  'Become a Community Manager': '/become-a-community-manager',
}

// Admin screen: change the main text on the public website without a developer.
// Every block can go back to its original wording.
export default function WebsiteTextPage() {
  const [pageName, setPageName] = useState(SITE_TEXT[0].page)
  const page = SITE_TEXT.find((p) => p.page === pageName)

  return (
    <>
      <PageHero
        title="Website Text"
        lead="Change the words on the public website. Changes show as soon as you save, and every block can go back to the original."
      />
      <section className="section">
        <div className="container container-narrow">
          <div className="field">
            <label htmlFor="text-page">Page</label>
            <select id="text-page" value={pageName} onChange={(e) => setPageName(e.target.value)}>
              {SITE_TEXT.map((p) => (
                <option key={p.page}>{p.page}</option>
              ))}
            </select>
            <p className="muted">
              <Link to={PAGE_LINKS[pageName]} target="_blank">
                Open the {pageName} page
              </Link>{' '}
              in a new tab to see your changes.
            </p>
          </div>
          {page.blocks.map((block) => (
            <TextBlock key={block.key} block={block} />
          ))}
        </div>
      </section>
    </>
  )
}

function TextBlock({ block }) {
  const { changed, setChanged } = useSiteTextChanges()
  const current = changed[block.key] ?? block.text
  const [value, setValue] = useState(current)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const isChanged = block.key in changed
  const Input = block.long ? 'textarea' : 'input'

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      setChanged(await api('/admin/site-text/', { method: 'PUT', body: { key: block.key, text: value } }))
      setSaved(true)
    } catch (err) {
      setError([].concat(err.data?.text ?? err.message).join(' '))
    }
  }

  async function reset() {
    setChanged(await api('/admin/site-text/', { method: 'DELETE', body: { key: block.key } }))
    setValue(block.text)
    setSaved(false)
  }

  return (
    <form className="block block-white text-block" onSubmit={save}>
      <div className="field">
        <label htmlFor={'text-' + block.key}>
          {block.label} {isChanged && <span className="tag">Changed</span>}
        </label>
        <Input
          id={'text-' + block.key}
          rows={block.long ? 4 : undefined}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
        />
        {error && <p className="field-error">{error}</p>}
      </div>
      <div className="button-row">
        <button className="btn btn-primary btn-small" disabled={value.trim() === current}>
          Save
        </button>
        {isChanged && (
          <button type="button" className="btn btn-small" onClick={reset}>
            Reset to the original
          </button>
        )}
        {saved && <span className="saved-note">Saved. It’s on the website now.</span>}
      </div>
    </form>
  )
}
