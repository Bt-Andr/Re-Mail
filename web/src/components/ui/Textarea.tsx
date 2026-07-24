import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, id, className = '', ...props }, ref) => (
  <div>
    {label && (
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1.5">
        {label}
      </label>
    )}
    <textarea
      ref={ref}
      id={id}
      className={`w-full px-3 py-2 text-sm bg-card border border-input rounded-md placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/30 focus:border-ring outline-none transition-colors resize-none ${className}`}
      {...props}
    />
  </div>
))
Textarea.displayName = 'Textarea'
