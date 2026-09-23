import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { LanguageSwitch, useLanguage } from '../../i18n'
import { RECIPES, recipeFor } from '../../recipes'
import BundleItems, { RecipeTips } from '../../components/BundleItems'

// What's in the bundle: this week's produce and its farms, with storage tips and simple ideas,
// then tips for other produce that often comes in a bundle.
export default function BundlePage() {
  const { t, lang, format } = useLanguage()
  const [bundle, setBundle] = useState(null)

  useEffect(() => {
    api('/bundle/').then(setBundle).catch(() => setBundle({ items: [] }))
  }, [])

  // Recipes for produce that isn't in this bundle, so the page is useful every week.
  const inBundle = new Set((bundle?.items ?? []).map((item) => recipeFor(item.produce, 'en')?.name))
  const others = RECIPES.filter((entry) => !inBundle.has(entry.en.name))

  return (
    <>
      <section className="title-block title-block-compact">
        <h1>{t.bundleTitle}</h1>
        <p>{t.bundleLead}</p>
        <LanguageSwitch />
      </section>

      <section className="reserve-section">
        <div className="reserve-container">
          {!bundle && <p className="muted">{t.loading}</p>}
          {bundle && bundle.items.length === 0 && <p className="notice notice-info">{t.bundleNotYet}</p>}
          {bundle && bundle.items.length > 0 && (
            <>
              <h2 className="bundle-date">
                {bundle.upcoming ? t.nextBundle(format.longDate(bundle.drop_date)) : t.lastBundle(format.longDate(bundle.drop_date))}
              </h2>
              <BundleItems items={bundle.items} withRecipes />
              <p className="muted">{t.bundleMayVary}</p>
            </>
          )}

          <Link to="/reserve" className="btn btn-primary btn-large bundle-reserve">
            {t.reserveABundle}
          </Link>

          <h2 className="bundle-more-title">{t.moreProduce}</h2>
          <div className="recipe-list">
            {others.map((entry) => {
              const recipe = entry[lang] ?? entry.en
              return (
                <details key={entry.en.name} className="recipe-card">
                  <summary>{recipe.name}</summary>
                  <RecipeTips recipe={recipe} />
                </details>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
