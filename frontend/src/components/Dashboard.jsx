// Building blocks for the home page dashboards: a to-do list and a grid of every screen.

import { Link } from 'react-router-dom'
import { ROLES } from '../roles'

// A list of things that need doing. Each item: { tone, count, title, detail, to, action }.
// tone is 'alert' (yellow, needs doing) or 'ok' (green, done).
export function TodoList({ items, doneText }) {
  if (items.length === 0) {
    return <div className="notice notice-success todo-done">{doneText}</div>
  }
  return (
    <ul className="todo-list">
      {items.map((item) => (
        <li key={item.title} className={'todo todo-' + (item.tone ?? 'alert')}>
          {item.count !== undefined && <span className="todo-count">{item.count}</span>}
          <div className="todo-text">
            <strong>{item.title}</strong>
            {item.detail && <span className="muted">{item.detail}</span>}
          </div>
          {item.to && (
            <Link to={item.to} className="btn btn-small">
              {item.action}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

// Every screen for this role, with a short description, so everything is one tap from home
// (on phones, some screens are only reachable from here).
export function ScreenCards({ role }) {
  const config = ROLES[role]
  const screens = config.nav.filter((item) => item.to !== config.home)
  return (
    <section className="order-group">
      <h2>Everything else</h2>
      <div className="grid grid-3 screen-cards">
        {screens.map((item) => (
          <Link key={item.to} to={item.to} className={'block block-white screen-card' + (item.hidden ? ' screen-card-quiet' : '')}>
            <h3>{item.label}</h3>
            <p>{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
