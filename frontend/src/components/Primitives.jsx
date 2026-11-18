import React from 'react'

export function Card({ children, style, className = '', tint }) {
  return (
    <div
      className={className}
      style={{
        background: tint || 'var(--paper-raised)',
        border: '2px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Sticker-style section heading. */
export function SectionLabel({ children, tone = 'default' }) {
  const accent = tone === 'accent'
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: '-0.01em',
        color: accent ? '#fff' : 'var(--ink)',
        background: accent ? 'var(--accent)' : 'var(--lemon)',
        border: '2px solid var(--line)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-sm)',
        padding: '5px 13px 5px 10px',
        transform: 'rotate(-1deg)',
        marginBottom: 18,
      }}
    >
      <SignalTicks tone={accent ? 'light' : 'dark'} />
      {children}
    </div>
  )
}

/** Small oscilloscope-style tick strip used inside section labels. */
export function SignalTicks({ animated = false, tone = 'dark' }) {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" fill="none" style={{ flexShrink: 0 }}>
      <polyline
        points="0,9 4,9 6,3 9,11 12,5 14,9 22,9"
        stroke={tone === 'light' ? '#fff' : 'var(--ink)'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {animated && <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />}
      </polyline>
    </svg>
  )
}

export function Stat({ label, value, unit, tone = 'default', mono = true }) {
  const toneColor = {
    default: 'var(--ink)',
    accent: 'var(--accent)',
    positive: 'var(--positive)',
    alert: 'var(--alert)',
  }[tone]
  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-display)' : 'var(--font-display)',
          fontSize: mono ? 32 : 24,
          fontWeight: 800,
          color: toneColor,
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {unit && <span style={{ fontSize: 14, color: 'var(--ink-faint)', marginLeft: 4, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'default' }) {
  const styles = {
    default: { bg: 'var(--paper-raised)', fg: 'var(--ink-soft)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' },
    positive: { bg: 'var(--positive-soft)', fg: 'var(--positive)' },
    alert: { bg: 'var(--alert-soft)', fg: 'var(--alert)' },
    amber: { bg: 'var(--amber-soft)', fg: 'var(--amber)' },
    pink: { bg: 'var(--pink-soft)', fg: '#B3135F' },
    sky: { bg: 'var(--sky-soft)', fg: '#0B6A9E' },
    lemon: { bg: 'var(--lemon-soft)', fg: '#7A5F00' },
  }[tone] || { bg: 'var(--paper-raised)', fg: 'var(--ink-soft)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 9px',
        borderRadius: 100,
        fontSize: 11.5,
        fontWeight: 700,
        fontFamily: 'var(--font-body)',
        background: styles.bg,
        color: styles.fg,
        border: '1.5px solid currentColor',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

const VARIANTS = {
  primary: { '--btn-bg': 'var(--ink)', '--btn-fg': 'var(--lemon)' },
  accent: { '--btn-bg': 'var(--accent)', '--btn-fg': '#fff' },
  pink: { '--btn-bg': 'var(--pink)', '--btn-fg': 'var(--ink)' },
  mint: { '--btn-bg': 'var(--mint)', '--btn-fg': 'var(--ink)' },
  lemon: { '--btn-bg': 'var(--lemon)', '--btn-fg': 'var(--ink)' },
  ghost: { '--btn-bg': 'var(--paper-raised)', '--btn-fg': 'var(--ink)' },
  subtle: { '--btn-bg': 'var(--paper)', '--btn-fg': 'var(--ink-soft)' },
}

export function Button({ children, onClick, variant = 'primary', disabled, style, type = 'button', size = 'md', title }) {
  return (
    <button
      type={type}
      className="btn"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...(VARIANTS[variant] || VARIANTS.primary),
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontSize: size === 'sm' ? 13 : 14.5,
        padding: size === 'sm' ? '6px 12px' : '10px 18px',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Toggle chip: pass `on` and an optional colour to light it up. */
export function Chip({ children, on = false, onClick, color, fg, title, disabled }) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ '--chip-on': color || 'var(--accent)', '--chip-on-fg': fg || '#fff', opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  )
}

/** Label + control wrapper used by the forms. */
export function Field({ label, hint, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 5, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  )
}

export const selectStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--line)',
  background: 'var(--paper-raised)', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
}

export function EmptyState({ title, description }) {
  return (
    <div style={{ padding: '44px 24px', textAlign: 'center', color: 'var(--ink-faint)' }}>
      <svg width="64" height="26" viewBox="0 0 64 26" fill="none" style={{ marginBottom: 10 }}>
        <polyline points="0,18 12,18 18,4 26,24 34,10 40,18 64,18" stroke="var(--pink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 21, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>{description}</div>
    </div>
  )
}

export function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" stroke="var(--hairline-strong)" strokeWidth="3.5" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--pink)" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Scrolling strip of words. Duplicates its content so the loop is seamless. */
export function Ticker({ items }) {
  const row = items.map((t, i) => <span key={i}>{t} ✦</span>)
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">{row}{row}</div>
    </div>
  )
}
