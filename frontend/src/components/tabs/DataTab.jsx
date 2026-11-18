import React, { useCallback, useEffect, useRef, useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { Badge, Button, Card, SectionLabel, Spinner } from '../Primitives'

const KIND_TONE = { numeric: 'accent', categorical: 'pink', datetime: 'positive', boolean: 'amber' }
const PAGE_SIZES = [25, 50, 100, 200]

export default function DataTab({ datasetId, columns = [] }) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ by: null, desc: false })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [full, setFull] = useState(false)
  const reqId = useRef(0)

  const kindOf = Object.fromEntries(columns.map((c) => [c.name, c.kind]))

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true); setError('')
    try {
      const res = await api.getData(datasetId, {
        offset: page * pageSize, limit: pageSize, search: search || undefined,
        sort_by: sort.by || undefined, descending: sort.desc,
      })
      if (id === reqId.current) setData(res)
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e, 'Could not load the data.'))
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [datasetId, page, pageSize, search, sort])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!full) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  const cycleSort = (col) => setSort((s) => {
    if (s.by !== col) return { by: col, desc: false }
    if (!s.desc) return { by: col, desc: true }
    return { by: null, desc: false }
  })

  const total = data?.filtered_rows ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total ? page * pageSize + 1 : 0
  const to = Math.min(total, (page + 1) * pageSize)
  const cols = data?.columns || columns.map((c) => c.name)

  const shell = full
    ? { position: 'fixed', inset: 12, zIndex: 50, display: 'flex', flexDirection: 'column', padding: 16, background: 'var(--paper-raised)', boxShadow: 'var(--shadow-lg)' }
    : { display: 'flex', flexDirection: 'column', padding: 16 }

  return (
    <div>
      {!full && <SectionLabel>Full dataset</SectionLabel>}
      <Card style={shell}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <input
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search every column…" aria-label="Search the dataset"
            style={{ flex: '1 1 240px', padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '2px solid var(--line)', fontSize: 14, fontFamily: 'var(--font-body)', background: 'var(--lemon-soft)', color: 'var(--ink)' }}
          />
          <select value={pageSize} onChange={(e) => { setPageSize(+e.target.value); setPage(0) }} aria-label="Rows per page"
            style={{ padding: '9px 10px', borderRadius: 'var(--radius-md)', border: '2px solid var(--line)', fontSize: 13.5, background: 'var(--paper-raised)', color: 'var(--ink)', fontWeight: 600 }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} rows / page</option>)}
          </select>
          <a href={api.dataDownloadUrl(datasetId)} download style={{ textDecoration: 'none' }}><Button variant="mint" size="sm">Download CSV ↓</Button></a>
          <Button variant="ghost" size="sm" onClick={() => setFull((f) => !f)}>{full ? 'Close (Esc)' : 'Expand'}</Button>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--alert-soft)', color: 'var(--alert)', borderRadius: 10, fontSize: 13.5, marginBottom: 12, fontWeight: 600 }}>{error}</div>}

        <div style={{ position: 'relative', overflow: 'auto', flex: 1, maxHeight: full ? 'none' : '66vh', border: '2px solid var(--line)', borderRadius: 12, background: 'var(--paper-raised)', opacity: loading ? 0.6 : 1 }}>
          {!data && loading && <div style={{ padding: 60, textAlign: 'center' }}><Spinner size={24} /></div>}
          {data && (
            <table className="zebra" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...th, position: 'sticky', left: 0, zIndex: 3, textAlign: 'right', background: 'var(--ink)', color: 'var(--lemon)' }}>#</th>
                  {cols.map((c) => {
                    const active = sort.by === c
                    return (
                      <th key={c} onClick={() => cycleSort(c)} style={{ ...th, cursor: 'pointer', background: active ? 'var(--accent)' : 'var(--ink)' }} title="Click to sort">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>{c}</span>
                          <span style={{ color: 'var(--lemon)' }}>{active ? (sort.desc ? '▼' : '▲') : '⇅'}</span>
                        </div>
                        {kindOf[c] && <div style={{ marginTop: 3 }}><Badge tone={KIND_TONE[kindOf[c]] || 'default'}>{kindOf[c]}</Badge></div>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, i) => (
                  <tr key={data.row_numbers[i]}>
                    <td style={{ ...td, position: 'sticky', left: 0, background: 'var(--lemon-soft)', color: 'var(--ink-faint)', textAlign: 'right', fontWeight: 700, borderRight: '2px solid var(--line)' }}>
                      {data.row_numbers[i].toLocaleString()}
                    </td>
                    {cols.map((c) => {
                      const v = row[c]
                      const isNum = kindOf[c] === 'numeric'
                      return (
                        <td key={c} style={{ ...td, textAlign: isNum ? 'right' : 'left' }}>
                          {v === null || v === undefined
                            ? <span style={{ color: 'var(--alert)', background: 'var(--alert-soft)', borderRadius: 6, padding: '1px 7px', fontWeight: 700, fontSize: 11 }}>missing</span>
                            : isNum && typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : String(v)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={cols.length + 1} style={{ ...td, textAlign: 'center', padding: 40, color: 'var(--ink-faint)' }}>No rows match “{search}”.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', fontWeight: 600 }}>
            Rows {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
            {data && total !== data.total_rows && <> (filtered from {data.total_rows.toLocaleString()})</>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(0)}>« First</Button>
            <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹ Prev</Button>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>
              page <input type="number" min={1} max={pages} value={page + 1}
                onChange={(e) => setPage(Math.min(pages, Math.max(1, +e.target.value || 1)) - 1)}
                style={{ width: 62, padding: '4px 6px', border: '2px solid var(--line)', borderRadius: 8, fontFamily: 'var(--font-mono)', textAlign: 'center' }} /> / {pages.toLocaleString()}
            </span>
            <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next ›</Button>
            <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage(pages - 1)}>Last »</Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

const th = { textAlign: 'left', padding: '10px 14px', color: '#fff', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2, borderBottom: '2px solid var(--line)' }
const td = { padding: '8px 14px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', borderBottom: '1px solid var(--hairline)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }
