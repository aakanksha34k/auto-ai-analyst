import React from 'react'

const GROUPS = [
  { label: null, tabs: [{ id: 'overview', label: 'Overview' }] },
  {
    label: 'Analysis',
    tabs: [
      { id: 'data', label: 'Full dataset' },
      { id: 'cleaning', label: 'Data quality' },
      { id: 'stats', label: 'Statistics' },
      { id: 'charts', label: 'Charts' },
      { id: 'correlation', label: 'Correlations' },
      { id: 'ml', label: 'ML models' },
      { id: 'recommendations', label: 'Recommendations' },
      { id: 'report', label: 'PDF report' },
    ],
  },
]

export default function Sidebar({ active, onSelect, filename, rowCount, colCount, onNewDataset }) {
  return (
    <div
      style={{
        width: 224, flexShrink: 0, background: 'var(--paper-raised)', color: 'var(--ink)',
        borderRight: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0,
      }}
    >
      <div style={{ padding: '20px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
            <polyline points="0,9 4,9 6,3 9,11 12,5 14,9 22,9" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontWeight: 600, fontSize: 14.5, letterSpacing: '-0.01em' }}>Data Analyst</div>
        </div>
        <div title={filename} style={{ marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {rowCount?.toLocaleString()} rows · {colCount} cols
        </div>
      </div>

      <nav style={{ flex: 1, padding: '4px 10px', overflowY: 'auto' }}>
        {GROUPS.map((g, gi) => (
          <div key={gi} style={{ marginBottom: 14 }}>
            {g.label && (
              <div style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                {g.label}
              </div>
            )}
            {g.tabs.map((tab) => {
              const isActive = active === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelect(tab.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 10px', marginBottom: 1, borderRadius: 8, cursor: 'pointer',
                    border: 'none',
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent-ink)' : 'var(--ink-soft)',
                    fontWeight: isActive ? 600 : 500, fontSize: 13,
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--paper)' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
        <button
          onClick={onNewDataset}
          className="btn"
          style={{ '--btn-bg': 'var(--paper-raised)', '--btn-fg': 'var(--ink-soft)', '--btn-border': 'var(--hairline-strong)', width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
        >
          ← Upload new dataset
        </button>
      </div>
    </div>
  )
}
