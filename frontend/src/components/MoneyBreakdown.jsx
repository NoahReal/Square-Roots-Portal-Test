import { useLanguage } from '../i18n'

// "Where does your $10 go?": the standard price split between farms, Square Roots and the
// Community Manager, worked out from this year's real numbers (see money_json in views_reserve.py).
export default function MoneyBreakdown({ money: m }) {
  const { t, format } = useLanguage()
  const toManager = Number(m.to_manager)
  const toSquareRoots = Number(m.to_square_roots)
  const toFarms = m.to_farms === null ? null : Number(m.to_farms)

  const parts = [
    ...(toFarms === null
      ? [{ key: 'sr', amount: toSquareRoots, text: t.moneySquareRootsAll }]
      : [
          { key: 'farms', amount: toFarms, text: t.moneyFarms },
          { key: 'sr', amount: toSquareRoots - toFarms, text: t.moneySquareRootsRest },
        ]),
    { key: 'manager', amount: toManager, text: t.moneyManager },
  ]

  return (
    <details className="money-breakdown">
      <summary>{t.moneyQuestion(format.money(m.standard))}</summary>
      <div className="money-bar" aria-hidden="true">
        {parts.map((part) => (
          <span key={part.key} className={'money-bar-' + part.key} style={{ flexGrow: part.amount }} />
        ))}
      </div>
      <ul>
        {parts.map((part) => (
          <li key={part.key}>
            <span className={'money-swatch money-bar-' + part.key} aria-hidden="true" />
            <span>
              <strong>{format.money(part.amount)}</strong> {part.text}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted">{t.moneyNote(format.money(toSquareRoots))}</p>
    </details>
  )
}
