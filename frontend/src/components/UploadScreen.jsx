import React, { useCallback, useRef, useState } from 'react'
import { Spinner, Ticker } from './Primitives'

const STEPS = [
  { t: 'Profile', c: 'var(--lemon)' }, { t: 'Statistics', c: 'var(--mint)' }, { t: 'Charts', c: 'var(--pink)' },
  { t: 'ML models', c: 'var(--sky)' }, { t: 'PDF report', c: 'var(--tangerine)' },
]

export default function UploadScreen({ onUpload, loading, error }) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback((files) => {
    if (files && files[0]) onUpload(files[0])
  }, [onUpload])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 28, position: 'relative', overflow: 'hidden' }}>
      {/* loud background shapes */}
      <div aria-hidden="true" style={{ position: 'absolute', top: -90, left: -70, width: 300, height: 300, borderRadius: '50%', background: 'var(--pink)', border: '3px solid var(--line)', opacity: 0.9 }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -80, right: -50, width: 260, height: 260, background: 'var(--lemon)', border: '3px solid var(--line)', transform: 'rotate(18deg)', borderRadius: 40 }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: '16%', right: '9%', width: 90, height: 90, background: 'var(--mint)', border: '3px solid var(--line)', borderRadius: '50%', boxShadow: 'var(--shadow-md)' }} />

      <div style={{ width: 'min(760px, 100%)', position: 'relative' }}><Ticker items={['Bring a dataset', 'Leave with a report', 'No SQL', 'No notebook']} /></div>

      <div style={{ maxWidth: 760, width: '100%', position: 'relative', background: 'var(--paper-raised)', border: '3px solid var(--line)', borderRadius: 28, boxShadow: '10px 10px 0 var(--line)', padding: 'clamp(24px, 5vw, 48px)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px, 7vw, 68px)', fontWeight: 800, lineHeight: 0.98, letterSpacing: '-0.035em', margin: '0 0 18px', color: 'var(--ink)' }}>
          Bring a dataset.<br />
          <span style={{ background: 'var(--accent)', color: '#fff', padding: '0 14px', borderRadius: 14, display: 'inline-block', transform: 'rotate(-1.5deg)', border: '3px solid var(--line)', boxShadow: '5px 5px 0 var(--pink)' }}>Leave with a report.</span>
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 17, lineHeight: 1.6, maxWidth: 520, margin: '0 0 28px' }}>
          Upload a CSV, Excel or JSON file. It reads the data, profiles it, cleans it, charts it, models it and writes up what it found.
        </p>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files) }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '44px 24px', border: '3px dashed var(--line)', borderRadius: 20,
            background: dragActive ? 'var(--lemon)' : 'var(--accent-soft)', cursor: 'pointer',
            transform: dragActive ? 'scale(1.015) rotate(-0.5deg)' : 'none', transition: 'background 0.12s ease, transform 0.12s ease',
          }}
        >
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.json,.tsv" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
          {loading ? (
            <>
              <Spinner size={28} />
              <div style={{ color: 'var(--ink)', fontSize: 15, fontWeight: 700, marginTop: 4 }}>Reading and profiling your data…</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Drop a file here, or click to browse</div>
              <div style={{ color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600 }}>.csv · .xlsx · .xls · .json · .tsv</div>
            </>
          )}
        </label>

        {error && (
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'var(--alert-soft)', color: 'var(--alert)', border: '2px solid var(--alert)', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 28, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <span key={s.t} style={{ background: s.c, border: '2px solid var(--line)', borderRadius: 999, padding: '5px 14px', fontWeight: 700, fontSize: 13.5, transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)`, boxShadow: 'var(--shadow-sm)' }}>{s.t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
