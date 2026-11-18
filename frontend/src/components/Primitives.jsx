import React from 'react'

export function Card({ children, style, className = '', tint }) {
  return (
    <div
      className={className}
      style={{
        background: tint || 'var(--paper-raised)',
        border: '1px solid var(--hairline)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Small section heading: signal icon + mono caps, no box. */
export function SectionLabel({ children, tone = 'default' }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: tone === 'accent' ? 'var(--accent-ink)' : 'var(--ink-soft)',
        marginBottom: 14,
      }}
    >
      <SignalTicks />
      {children}
    </div>
  )
}

/** Small pulse icon used in headings. */
export function SignalTicks({ animated = false, tone = 'dark' }) {
  return (
    <svg width="20" height="11" viewBox="0 0 22 12" fill="none" style={{ flexShrink: 0 }}>
      <polyline
        points="0,9 4,9 6,3 9,11 12,5 14,9 22,9"
        stroke={tone === 'light' ? '#fff' : 'var(--accent)'}
        strokeWidth="1.6"
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
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: mono ? 28 : 20,
          fontWeight: 600,
          color: toneColor,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {unit && <span style={{ fontSize: 13, color: 'var(--ink-faint)', marginLeft: 4, fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'default' }) {
  const styles = {
    default: { bg: 'var(--paper)', fg: 'var(--ink-soft)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)' },
    positive: { bg: 'var(--positive-soft)', fg: 'var(--positive)' },
    alert: { bg: 'var(--alert-soft)', fg: 'var(--alert)' },
    amber: { bg: 'var(--amber-soft)', fg: 'var(--amber)' },
    pink: { bg: 'var(--pink-soft)', fg: '#B3135F' },
    sky: { bg: 'var(--sky-soft)', fg: '#0B6A9E' },
    lemon: { bg: 'var(--lemon-soft)', fg: '#7A5F00' },
  }[tone] || { bg: 'var(--paper)', fg: 'var(--ink-soft)' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 9px',
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        background: styles.bg,
        color: styles.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

const SOLID = { '--btn-border': 'transparent' }
const OUTLINE = { '--btn-bg': 'var(--paper-raised)', '--btn-fg': 'var(--ink)', '--btn-border': 'var(--hairline-strong)' }
const VARIANTS = {
  primary: { ...SOLID, '--btn-bg': 'var(--ink)', '--btn-fg': '#fff' },
  accent: { ...SOLID, '--btn-bg': 'var(--accent)', '--btn-fg': '#fff' },
  pink: { ...SOLID, '--btn-bg': 'var(--accent)', '--btn-fg': '#fff' },
  mint: { ...OUTLINE },
  lemon: { ...OUTLINE },
  ghost: { ...OUTLINE },
  subtle: { '--btn-bg': 'var(--paper)', '--btn-fg': 'var(--ink-soft)', '--btn-border': 'transparent' },
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
        fontWeight: 600,
        borderRadius: 'var(--radius-md)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: size === 'sm' ? 12.5 : 14,
        padding: size === 'sm' ? '5px 11px' : '9px 16px',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/** Toggle chip. `color` is accepted for compatibility; the theme uses one accent for "on". */
export function Chip({ children, on = false, onClick, title, disabled }) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  )
}

/** Label + control wrapper used by the forms. */
export function Field({ label, hint, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 5, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  )
}

export const selectStyle = {
  width: '100%', padding: '8px 11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--hairline-strong)',
  background: 'var(--paper-raised)', color: 'var(--ink)', fontFamily: 'var(--font-body)', fontSize: 14,
}

export function EmptyState({ title, description }) {
  return (
    <div style={{ padding: '44px 24px', textAlign: 'center', color: 'var(--ink-faint)' }}>
      <svg width="48" height="20" viewBox="0 0 64 26" fill="none" style={{ marginBottom: 10 }}>
        <polyline points="0,18 12,18 18,4 26,24 34,10 40,18 64,18" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 20, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 14, maxWidth: 360, margin: '0 auto', lineHeight: 1.5 }}>{description}</div>
    </div>
  )
}

export function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" stroke="var(--hairline-strong)" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="var(--accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** The scrolling ticker is not part of the simple theme; kept as a no-op so existing imports still work. */
export function Ticker() {
  return null
}
