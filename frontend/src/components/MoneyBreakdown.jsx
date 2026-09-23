import { money } from '../format'

// "Where does your $10 go?": the standard price split between farms, Square Roots and the
// Community Manager, worked out from this year's real numbers (see money_json in views_reserve.py).
export default function MoneyBreakdown({ money: m }) {
  const standard = Number(m.standard)
  const toManager = Number(m.to_manager)
  const toSquareRoots = Number(m.to_square_roots)
  const toFarms = m.to_farms === null ? null : Number(m.to_farms)

  const parts = [
    ...(toFarms === null
      ? [{ key: 'sr', amount: toSquareRoots, text: 'goes to Square Roots, to buy produce from Nova Scotia farms and run the program' }]
      : [
          { key: 'farms', amount: toFarms, text: 'buys the produce from Nova Scotia farms (what we paid per bundle this year)' },
          { key: 'sr', amount: toSquareRoots - toFarms, text: 'covers the rest of Square Roots’ costs' },
        ]),
    { key: 'manager', amount: toManager, text: 'goes to your Community Manager, the local entrepreneur who runs your drop' },
  ]

  return (
    <details className="money-breakdown">
      <summary>Where does your {money(standard)} go?</summary>
      <div className="money-bar" aria-hidden="true">
        {parts.map((part) => (
          <span key={part.key} className={'money-bar-' + part.key} style={{ flexGrow: part.amount }} />
        ))}
      </div>
      <ul>
        {parts.map((part) => (
          <li key={part.key}>
            <span className={'money-swatch money-bar-' + part.key} aria-hidden="true" />
            <strong>{money(part.amount)}</strong> {part.text}
          </li>
        ))}
      </ul>
      <p className="muted">
        At {money(toSquareRoots)}, you cover Square Roots’ share without the extra for your Community Manager. Free
        bundles are covered by pay-it-forward gifts and sponsors.
      </p>
    </details>
  )
}
