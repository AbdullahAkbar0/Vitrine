import type { ReactNode } from 'react'

export function ScreenHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-6 pt-4 pb-3">
        <h1 className="font-display text-[1.9rem] leading-none font-normal tracking-[-0.01em]">{title}</h1>
        {aside}
      </div>
    </header>
  )
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto max-w-xl px-6 pb-40 ${className}`}>{children}</main>
}

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'brass' | 'outline' | 'quiet'
  className?: string
  type?: 'button' | 'submit'
  ariaLabel?: string
}

export function Button({ children, onClick, variant = 'brass', className = '', type = 'button', ariaLabel }: ButtonProps) {
  const styles = {
    brass: 'brass-fill',
    outline: 'border border-brass/50 text-ink',
    quiet: 'text-ink-2 underline decoration-brass/50 underline-offset-4',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex min-h-13 items-center justify-center gap-2.5 rounded-full px-7 text-[1rem] font-medium tracking-[0.02em] transition-transform duration-150 active:scale-[0.97] ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

/** A titled group on the Settings screen. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9 first:mt-5">
      <h2 className="mb-3 px-1 font-display text-[1.25rem] font-normal">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-[1.4rem] border border-line bg-surface">{children}</div>
    </section>
  )
}

export function Row({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>
}
