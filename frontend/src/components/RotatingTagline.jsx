import { useEffect, useState } from 'react'

// The green band under the home page photo. Like the live site, it switches between
// these two lines every few seconds (the spacing in the second one is copied from the live site).
const TAGLINES = [
  'Promoting entrepreneurship | Diverting waste from landfills',
  'Seconds produce across Nova Scotia     I    Food-secure communities',
]

export default function RotatingTagline() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % TAGLINES.length), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="tagline-band">
      <p key={index} className="tagline" aria-live="off">
        {TAGLINES[index]}
      </p>
    </div>
  )
}
