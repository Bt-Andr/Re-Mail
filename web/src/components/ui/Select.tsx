import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, id, className = '', children, ...props }, ref) => (
  <div>
    {label && (
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
    )}
    <select
      ref={ref}
      id={id}
      className={`w-full px-3 py-2 text-sm border border-input rounded-md bg-card focus:ring-2 focus:ring-ring/30 focus:border-ring outline-none transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  </div>
))
Select.displayName = 'Select'
