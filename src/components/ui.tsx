import type { ReactNode } from 'react'

export function ScreenHeader({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/88 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-end justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          {sub && <p className="text-[0.85rem] font-medium text-ink-3">{sub}</p>}
          <h1 className="font-display truncate text-[1.85rem] leading-[1.1] font-bold">{title}</h1>
        </div>
        {aside}
      </div>
    </header>
  )
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto max-w-xl px-5 pb-36 ${className}`}>{children}</main>
}

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg'
  className?: string
  type?: 'button' | 'submit'
  ariaLabel?: string
  disabled?: boolean
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  className = '',
  type = 'button',
  ariaLabel,
  disabled,
}: ButtonProps) {
  const styles = {
    primary: 'bg-primary text-on-primary shadow-[0_8px_20px_-10px_var(--c-primary)]',
    secondary: 'bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--c-line)]',
    ghost: 'text-primary',
    danger: 'bg-warn/10 text-warn',
  }[variant]
  const sizes = { md: 'min-h-11 px-5 text-[0.95rem]', lg: 'min-h-13 px-6 text-[1rem]' }[size]
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 ${sizes} ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

/** A row of options where exactly one is chosen. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
}: {
  value: T
  options: { id: T; label: ReactNode }[]
  onChange: (v: T) => void
  label?: string
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-2xl bg-surface-2 p-1 ${className}`}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`min-h-10 flex-1 rounded-xl px-3 text-[0.9rem] font-semibold transition-all ${
              on ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(29_27_75/0.12)]' : 'text-ink-3'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Chip({
  on,
  onClick,
  children,
  className = '',
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[0.9rem] font-medium transition-colors ${
        on ? 'bg-ink text-bg' : 'bg-surface text-ink-2 shadow-[inset_0_0_0_1.5px_var(--c-line)]'
      } ${className}`}
    >
      {children}
    </button>
  )
}

/** Section title inside a screen. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between">
      <h2 className="font-display text-[1.2rem] font-bold">{children}</h2>
      {action}
    </div>
  )
}

/** A titled group on the Settings screen. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 px-1 text-[0.8rem] font-semibold text-ink-3">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  )
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-4 ${className}`}>{children}</div>
}

/** A small rounded square holding an icon, tinted. */
export function IconTile({ children, tint = 'bg-primary-soft text-primary' }: { children: ReactNode; tint?: string }) {
  return <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tint}`}>{children}</span>
}

/** Bottom sheet dialog. */
export function Sheet({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[rgb(18_18_40/0.45)] p-3" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="sheet-up mb-safe mx-auto w-full max-w-md rounded-[1.75rem] bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
