import { useState } from 'react'
import { money } from '../../format'

// Paste rows straight from Excel or Google Sheets, or choose a CSV file.
// The server reads them (backend/ordering/price_lists.py); nothing is saved if a row has a problem.
export function PastePriceList({ onSave, submitLabel = 'Save price list', onCancel }) {
  const [text, setText] = useState('')
  const [problems, setProblems] = useState([])
  const [busy, setBusy] = useState(false)

  async function readFile(event) {
    const file = event.target.files[0]
    if (file) setText(await file.text())
  }

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setProblems([])
    try {
      await onSave(text)
      setText('')
    } catch (err) {
      setProblems([].concat(err.data?.text ?? err.message))
    }
    setBusy(false)
  }

  return (
    <form className="paste-price-list" onSubmit={save} noValidate>
      <div className="field">
        <label htmlFor="price-rows">
          Paste the rows <span className="field-hint">(copy them from the spreadsheet, with or without the header row)</span>
        </label>
        <textarea
          id="price-rows"
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Product\tBox size\tPrice per box\tBoxes available\nCarrots\t50 lb\t22.00\t40'}
        />
        <p className="field-hint">
          Columns: product, box size, price per box, boxes available (optional), notes (optional). Or{' '}
          <label className="file-link">
            choose a CSV file
            <input type="file" accept=".csv,text/csv,text/plain" onChange={readFile} />
          </label>
          .
        </p>
      </div>
      {problems.length > 0 && (
        <div className="notice notice-error" role="alert">
          Nothing was saved. Please fix {problems.length === 1 ? 'this' : 'these'}:
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy || !text.trim()}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

const CHANGE_WORDS = {
  up: (old) => `▲ up from ${money(old)}`,
  down: (old) => `▼ down from ${money(old)}`,
  new: () => 'New',
  same: () => '',
  '': () => '',
}

// A price list, with what changed since the supplier's last one (arrows and words, never colour alone).
export function PriceListTable({ list }) {
  return (
    <>
      <div className="table-scroll">
        <table className="data-table price-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Box</th>
              <th scope="col" className="num">
                Price per box
              </th>
              <th scope="col" className="num">
                Available
              </th>
              <th scope="col">Since last time</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.product}
                  {item.notes && <span className="muted"> · {item.notes}</span>}
                </td>
                <td>{item.box_size}</td>
                <td className="num">{money(item.price)}</td>
                <td className="num">{item.available ?? <span className="muted">–</span>}</td>
                <td>
                  {item.change && item.change !== 'same' && (
                    <span className={'price-change price-change-' + item.change}>{CHANGE_WORDS[item.change](item.old_price)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.gone.length > 0 && (
        <p className="muted">
          Not on this list any more: {list.gone.map((g) => `${g.product} (${money(g.price)})`).join(', ')}.
        </p>
      )}
      {list.compared_with && <p className="muted">Compared with their list for the {list.compared_with}.</p>}
    </>
  )
}
