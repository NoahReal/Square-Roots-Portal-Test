import { useEffect, useState } from 'react'
import { useSiteText } from '../siteText'

// The green band under the home page photo. Like the live site, it switches between
// these two lines every few seconds (the spacing in the second one is copied from the live site).
// The words are editable on the admin Website Text screen (see siteText.jsx).
const TAGLINES = ['home.tagline1', 'home.tagline2']

export default function RotatingTagline() {
  const text = useSiteText()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % TAGLINES.length), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="tagline-band">
      <p key={index} className="tagline" aria-live="off">
        {text(TAGLINES[index])}
      </p>
    </div>
  )
}
