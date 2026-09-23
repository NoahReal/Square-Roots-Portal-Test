import { useLanguage } from '../i18n'
import { recipeFor } from '../recipes'

// The produce in a bundle, with the farms it came from and, where we have them, storage tips and ideas.
// `items` comes from the API: [{ produce, pounds_per_bundle, farms: [{ name, location }] }]
export default function BundleItems({ items, withRecipes = false }) {
  const { t, lang } = useLanguage()
  return (
    <ul className="bundle-items">
      {items.map((item) => {
        const recipe = recipeFor(item.produce, lang)
        return (
          <li key={item.produce}>
            <p className="bundle-item-name">
              <strong>{lang === 'en' || !recipe ? item.produce : recipe.name}</strong>
              {item.pounds_per_bundle && <span className="muted">, {t.about(item.pounds_per_bundle)}</span>}
            </p>
            <p className="muted bundle-item-farms">
              {t.from} {item.farms.map((farm) => `${farm.name} (${farm.location})`).join(', ')}
            </p>
            {withRecipes && recipe && <RecipeTips recipe={recipe} />}
          </li>
        )
      })}
    </ul>
  )
}

export function RecipeTips({ recipe }) {
  const { t } = useLanguage()
  return (
    <div className="recipe-tips">
      <p>
        <strong>{t.howToStore}:</strong> {recipe.store}
      </p>
      <p>
        <strong>{t.ideas}:</strong>
      </p>
      <ul>
        {recipe.ideas.map((idea) => (
          <li key={idea}>{idea}</li>
        ))}
      </ul>
    </div>
  )
}
