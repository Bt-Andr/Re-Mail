import { Select } from '../../components/ui/Select'
import type { SenderAddress } from '../../types/api'

export function SenderSelect({ senders, value, onChange, disabled }: { senders: SenderAddress[]; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  if (disabled) {
    return (
      <div>
        <p className="block text-xs font-medium text-muted-foreground mb-1.5">De</p>
        <input readOnly value={value} className="w-full px-3 py-2 text-sm border border-input rounded-md outline-none bg-muted text-muted-foreground" />
      </div>
    )
  }
  return (
    <Select label="De (expéditeur)" value={value} onChange={e => onChange(e.target.value)}>
      {senders.map(s => (
        <option key={s.email} value={s.email}>{s.label} — {s.email}</option>
      ))}
    </Select>
  )
}
