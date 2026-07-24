export function StatusDropdown({ status, onChange }: { status: string; onChange: (status: string) => void }) {
  return (
    <select
      aria-label="Changer le statut"
      value={status}
      onChange={e => onChange(e.target.value)}
      className="text-xs border border-input rounded-md px-2 py-1.5 bg-card text-foreground focus:ring-2 focus:ring-ring/30 outline-none"
    >
      <option value="nouveau">Nouveau</option>
      <option value="en_cours">En cours</option>
      <option value="resolu">Résolu</option>
    </select>
  )
}
