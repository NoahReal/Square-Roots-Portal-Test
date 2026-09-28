// Hides the logo loading animation from index.html once the site is ready.
// It plays on every visit or refresh (not when moving between pages), so we let it
// finish before fading it out. The timing matches the animation in index.html.
const ANIMATION_MS = 1700

export function hideSplash() {
  const splash = document.getElementById('splash')
  if (!splash || splash.dataset.hiding) return
  splash.dataset.hiding = 'yes'

  // performance.now() counts from when the page started loading
  const lessMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const wait = lessMotion ? 0 : Math.max(0, ANIMATION_MS - performance.now())

  setTimeout(() => {
    splash.classList.add('splash-done')
    setTimeout(() => splash.remove(), 700) // after the fade in index.html
  }, wait)
}
