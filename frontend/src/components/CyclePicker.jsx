import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { shortDate, todayIso } from '../format'

// Hook for admin screens that work on one drop cycle at a time.
// The chosen cycle is kept in the address (?cycle=12), so links and the back button keep it.
export function useChosenCycle({ upcomingOnly = false } = {}) {
  const [params, setParams] = useSearchParams()
  const [cycles, setCycles] = useState(null)

  useEffect(() => {
    api('/admin/cycles/').then((all) => {
      const today = todayIso()
      setCycles(upcomingOnly ? all.filter((c) => c.drop_date > today) : all)
    })
  }, [upcomingOnly])

  const today = todayIso()
  // Default: the next drop that hasn't happened yet (the list is newest first).
  const fallback = cycles && ([...cycles].reverse().find((c) => c.drop_date >= today) ?? cycles[0])
  const chosen = cycles?.find((c) => String(c.id) === params.get('cycle')) ?? fallback

  function choose(id) {
    setParams({ cycle: String(id) }, { replace: true })
  }

  return { cycles, chosen, choose }
}

export default function CyclePicker({ cycles, chosen, onChoose, label = 'Drop cycle' }) {
  if (!cycles) return null
  const today = todayIso()
  return (
    <div className="field cycle-picker">
      <label htmlFor="cycle">{label}</label>
      <select id="cycle" value={chosen?.id ?? ''} onChange={(e) => onChoose(Number(e.target.value))}>
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>
            {cycle.name} ({shortDate(cycle.drop_date)}){cycle.drop_date < today ? ', past' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
