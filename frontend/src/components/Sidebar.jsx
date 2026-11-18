import React from 'react'

const TABS = [
  { id: 'overview', label: 'Overview', color: 'var(--lemon)' },
  { id: 'data', label: 'Full dataset', color: 'var(--sky)' },
  { id: 'cleaning', label: 'Data quality', color: 'var(--mint)' },
  { id: 'stats', label: 'Statistics', color: 'var(--tangerine)' },
  { id: 'charts', label: 'Charts', color: 'var(--pink)' },
  { id: 'correlation', label: 'Correlations', color: 'var(--accent-soft)' },
  { id: 'ml', label: 'ML models', color: 'var(--lemon)' },
  { id: 'recommendations', label: 'Recommendations', color: 'var(--mint)' },
  { id: 'report', label: 'PDF report', color: 'var(--sky)' },
]

export default function Sidebar({ active, onSelect, filename, rowCount, colCount, onNewDataset }) {
  return (
    <div
      style={{
        width: 244, flexShrink: 0, background: 'var(--ink)', color: '#fff',
        borderRight: '2px solid var(--line)', display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1.2px, transparent 1.3px)', backgroundSize: '16px 16px',
      }}
    >
      <div style={{ padding: '22px 18px 18px', borderBottom: '2px dashed rgba(255,255,255,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--pink)', border: '2px solid #fff', display: 'grid', placeItems: 'center', transform: 'rotate(-6deg)', boxShadow: '3px 3px 0 var(--lemon)' }}>
            <svg width="24" height="14" viewBox="0 0 70 34" fill="none">
              <polyline points="0,26 10,26 15,8 22,32 29,14 34,26 70,26" stroke="var(--ink)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            Data<br />Analyst
          </div>
        </div>
        <div title={filename} style={{ marginTop: 16, padding: '6px 10px', background: 'var(--lemon)', color: 'var(--ink)', borderRadius: 8, border: '2px solid #fff', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          {rowCount?.toLocaleString()} rows · {colCount} columns
        </div>
      </div>

      <nav style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '9px 12px', marginBottom: 6, borderRadius: 10, cursor: 'pointer',
                border: isActive ? '2px solid #fff' : '2px solid transparent',
                background: isActive ? 'var(--accent)' : 'transparent',
                boxShadow: isActive ? '3px 3px 0 var(--pink)' : 'none',
                color: '#fff', fontWeight: isActive ? 700 : 500, fontSize: 14.5,
                transform: isActive ? 'translateX(3px)' : 'none',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 4, background: tab.color, border: '2px solid #fff', flexShrink: 0, transform: 'rotate(12deg)' }} />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div style={{ padding: 14, borderTop: '2px dashed rgba(255,255,255,0.25)' }}>
        <button
          onClick={onNewDataset}
          className="btn"
          style={{ '--btn-bg': 'var(--paper-raised)', '--btn-fg': 'var(--ink)', width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0 var(--pink)' }}
        >
          ← Upload new dataset
        </button>
      </div>
    </div>
  )
}
