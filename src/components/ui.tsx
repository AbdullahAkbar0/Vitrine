import type { ReactNode } from 'react'

export function ScreenHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-end justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h1 className="font-display text-[2rem] leading-tight font-medium tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}

export function Screen({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-xl px-5 pb-36">{children}</main>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-surface p-5 ${className}`}>{children}</section>
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
  type?: 'button' | 'submit'
}) {
  const styles = {
    primary: 'bg-accent text-on-accent shadow-sm',
    secondary: 'bg-surface-2 text-ink',
    ghost: 'text-ink-2',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-semibold transition active:scale-[0.98] ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  art,
  title,
  body,
  action,
}: {
  art: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="animate-rise flex flex-col items-center px-4 pt-10 text-center">
      <div className="mb-6">{art}</div>
      <h2 className="font-display text-2xl font-medium">{title}</h2>
      <p className="mt-2 max-w-xs text-[0.95rem] leading-relaxed text-ink-2">{body}</p>
      {action && <div className="mt-7">{action}</div>}
    </div>
  )
}

/** A soft, round illustration plate used by empty states. */
export function ArtPlate({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-40 place-items-center rounded-full bg-surface-2 text-ink-2 shadow-[inset_0_-12px_30px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  )
}
