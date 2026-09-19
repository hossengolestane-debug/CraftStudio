import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes
} from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  const styles = {
    primary: 'bg-ink text-white hover:bg-ink-soft disabled:bg-[#9a9a96] disabled:text-white',
    secondary: 'border border-ink bg-white text-ink hover:bg-[#ecece8] disabled:border-[#b9b9b4] disabled:text-[#8a8a85]',
    ghost: 'text-ink underline-offset-2 hover:underline disabled:text-[#8a8a85] disabled:no-underline',
    danger: 'border border-[#8a1f1f] bg-white text-[#8a1f1f] hover:bg-[#fbf4f4]'
  }[variant]

  return (
    <button
      className={`inline-flex items-center justify-center px-4 py-2 text-[15px] font-medium disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  htmlFor,
  children
}: {
  label: string
  hint?: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
    </div>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-line bg-white px-3 py-2 text-[16px] text-ink disabled:bg-[#efefe9] ${props.className ?? ''}`}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-line bg-white px-3 py-2 text-[16px] text-ink ${props.className ?? ''}`}
    />
  )
}

export function Card({
  children,
  className = '',
  id
}: {
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={`border border-line bg-paper-raised p-5 ${className}`}>
      {children}
    </section>
  )
}

export function Badge({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'warn' | 'danger' | 'ok'
}) {
  const styles = {
    neutral: 'border-line text-ink',
    warn: 'border-[#6b4f00] text-[#6b4f00]',
    danger: 'border-[#8a1f1f] text-[#8a1f1f]',
    ok: 'border-ink text-ink'
  }[tone]
  return (
    <span className={`inline-flex border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles}`}>
      {children}
    </span>
  )
}

export function ChoiceButton({
  selected,
  title,
  description,
  disabled,
  onClick,
  badge
}: {
  selected: boolean
  title: string
  description: string
  disabled?: boolean
  onClick: () => void
  badge?: ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full border px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? 'border-ink bg-[#ecece8]' : 'border-line bg-white hover:border-ink'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="font-semibold">{title}</span>
        {badge}
      </div>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </button>
  )
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={`block font-medium ${props.className ?? ''}`} />
}

export function ComingSoon({ title, phase, children }: { title: string; phase: string; children: ReactNode }) {
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{phase}</p>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-[15px] text-ink-soft">{children}</div>
    </Card>
  )
}
