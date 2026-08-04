import { InputHTMLAttributes, forwardRef, useId } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

// Génère un id si aucun n'est fourni : sans ça, `label htmlFor` pointait vers
// `undefined` sur presque tous les call sites (aucun ne passait `id`), donc le
// label n'était jamais associé au champ pour un lecteur d'écran, et cliquer
// dessus ne donnait pas le focus au champ.
export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, id, className = '', ...props }, ref) => {
  const generatedId = useId()
  const inputId = id ?? generatedId
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full px-3 py-2 text-sm bg-card border border-input rounded-md placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/30 focus:border-ring outline-none transition-colors ${className}`}
        {...props}
      />
    </div>
  )
})
Input.displayName = 'Input'
