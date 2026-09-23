// Big "−  24  +" control for counting bundles. Easy to use with a thumb at a drop.
export default function Stepper({ id, value, onChange, min = 0, max = 300, step = 1, size = 'large', label }) {
  const set = (next) => onChange(Math.min(max, Math.max(min, next)))
  return (
    <div className={'stepper stepper-' + size}>
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} aria-label={`Fewer ${label}`}>
        −
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => set(e.target.value === '' ? min : Number(e.target.value))}
        aria-label={label}
      />
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} aria-label={`More ${label}`}>
        +
      </button>
    </div>
  )
}
