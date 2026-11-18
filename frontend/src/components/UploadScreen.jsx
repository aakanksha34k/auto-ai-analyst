import React, { useCallback, useRef, useState } from 'react'
import { Spinner } from './Primitives'

const STEPS = ['Profiling', 'Statistics', 'Charts', 'ML models', 'PDF report']

export default function UploadScreen({ onUpload, loading, error }) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = useCallback((files) => {
    if (files && files[0]) onUpload(files[0])
  }, [onUpload])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--paper-raised)' }}>
      <div style={{ width: 'min(520px, 100%)', textAlign: 'center' }}>
        <svg width="40" height="20" viewBox="0 0 22 12" fill="none" style={{ marginBottom: 22 }}>
          <polyline points="0,9 4,9 6,3 9,11 12,5 14,9 22,9" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 5vw, 40px)', fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.01em', margin: '0 0 14px', color: 'var(--ink)' }}>
          Bring a dataset.<br />Leave with a report.
        </h1>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, lineHeight: 1.65, margin: '0 auto 30px', maxWidth: 420 }}>
          Upload a CSV, Excel or JSON file. It reads the data, profiles it, cleans it, models it and writes up what it found. No SQL, no notebook.
        </p>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files) }}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '38px 24px', border: '1px dashed var(--hairline-strong)', borderRadius: 14,
            background: dragActive ? 'var(--accent-soft)' : 'var(--paper-raised)', cursor: 'pointer',
            boxShadow: 'var(--shadow-md)', transition: 'background 0.12s ease, border-color 0.12s ease',
            borderColor: dragActive ? 'var(--accent)' : undefined,
          }}
        >
          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls,.json,.tsv" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
          {loading ? (
            <>
              <Spinner size={24} />
              <div style={{ color: 'var(--ink-soft)', fontSize: 13.5, marginTop: 4 }}>Reading and profiling your data…</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-ink)' }}>
                Drop file or click to browse
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-faint)' }}>.csv · .xlsx · .xls · .json · .tsv</div>
            </>
          )}
        </label>

        {error && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--alert-soft)', color: 'var(--alert)', borderRadius: 8, fontSize: 13.5, textAlign: 'left' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 30, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span aria-hidden="true">·</span>}
              <span>{s}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
