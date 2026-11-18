import React, { useCallback, useEffect, useRef, useState } from 'react'
import api, { errorMessage } from '../../api/client'
import { Badge, Button, Card, Chip, EmptyState, Field, SectionLabel, Spinner, selectStyle } from '../Primitives'
import ChartRenderer from '../ChartRenderer'

// What each chart type needs from the form.
const KINDS = [
  { id: 'bar', label: 'Bar', hint: 'Compare groups', glyph: '▮▯▮', color: 'var(--pink)', x: 'any', y: 'optional', color_by: true, agg: true },
  { id: 'line', label: 'Line', hint: 'Trends over time', glyph: '⟋⟍⟋', color: 'var(--sky)', x: 'any', y: 'optional', color_by: true, agg: true },
  { id: 'area', label: 'Area', hint: 'Stacked trends', glyph: '◢◣◢', color: 'var(--mint)', x: 'any', y: 'optional', color_by: true, agg: true },
  { id: 'histogram', label: 'Histogram', hint: 'How values spread', glyph: '▂▅▇▅▂', color: 'var(--lemon)', x: null, y: 'many', bins: true },
  { id: 'scatter', label: 'Scatter', hint: 'Two numbers compared', glyph: '∴ ∵ ∴', color: 'var(--tangerine)', x: 'numeric', y: 'many', color_by: true },
  { id: 'pie', label: 'Donut', hint: 'Share of a whole', glyph: '◔◕', color: 'var(--accent-soft)', x: 'any', y: 'one', agg: true },
  { id: 'box', label: 'Box plot', hint: 'Median and outliers', glyph: '⊢▭⊣', color: 'var(--pink-soft)', x: null, y: 'many', color_by: true },
  { id: 'heatmap', label: 'Heatmap', hint: 'Correlations at a glance', glyph: '▦▦▦', color: 'var(--mint-soft)', x: null, y: 'many' },
]
const AGGS = ['sum', 'mean', 'median', 'min', 'max', 'count', 'nunique']
const KIND_COLOR = { numeric: 'var(--accent)', categorical: 'var(--pink)', datetime: '#0FC58C', boolean: 'var(--tangerine)' }
const GROUP_ORDER = ['Trends', 'Distributions', 'Categories', 'Relationships']
const uid = () => `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`

function defaultsFor(kind, cols) {
  const nums = cols.filter((c) => c.kind === 'numeric').map((c) => c.name)
  const cats = cols.filter((c) => c.kind === 'categorical' || c.kind === 'boolean').map((c) => c.name)
  const dates = cols.filter((c) => c.kind === 'datetime').map((c) => c.name)
  if (kind === 'line' || kind === 'area') return { x: dates[0] || nums[0] || cats[0] || '', y: nums[0] ? [nums[0]] : [] }
  if (kind === 'bar') return { x: cats[0] || dates[0] || nums[0] || '', y: nums[0] ? [nums[0]] : [] }
  if (kind === 'pie') return { x: cats[0] || '', y: [] }
  if (kind === 'scatter') return { x: nums[0] || '', y: nums[1] ? [nums[1]] : [] }
  if (kind === 'heatmap') return { x: '', y: nums.slice(0, 6) }
  return { x: '', y: nums[0] ? [nums[0]] : [] }
}

export default function ChartsTab({ datasetId, columns = [], rec, setRec, mine, setMine }) {
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState('')
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const topRef = useRef(null)

  // builder form
  const [kind, setKind] = useState('bar')
  const [x, setX] = useState('')
  const [y, setY] = useState([])
  const [colorBy, setColorBy] = useState('')
  const [agg, setAgg] = useState('sum')
  const [bins, setBins] = useState(20)
  const [topN, setTopN] = useState(12)
  const [normalize, setNormalize] = useState(false)

  const meta = KINDS.find((k) => k.id === kind)
  const numeric = columns.filter((c) => c.kind === 'numeric')

  // ---- recommended gallery (auto-loaded, exactly like the original Charts tab) ----
  const loadRec = useCallback(async () => {
    setRecLoading(true); setRecError('')
    try { setRec(await api.getRecommendedCharts(datasetId)) }
    catch (e) { setRecError(errorMessage(e, 'Could not build the recommended charts.')) }
    finally { setRecLoading(false) }
  }, [datasetId, setRec])
  useEffect(() => { if (!rec && !recLoading && !recError) loadRec() }, [rec, recLoading, recError, loadRec])

  // ---- fetch data for any user chart that has none yet (new, edited, or invalidated by cleaning) ----
  useEffect(() => {
    mine.filter((c) => !c.payload && !c.loading && !c.error).forEach((c) => {
      setMine((prev) => prev.map((p) => (p.id === c.id ? { ...p, loading: true } : p)))
      api.chartCustom(datasetId, c.spec)
        .then((payload) => setMine((prev) => prev.map((p) => (p.id === c.id ? { ...p, payload, loading: false } : p))))
        .catch((e) => setMine((prev) => prev.map((p) => (p.id === c.id ? { ...p, loading: false, error: errorMessage(e, 'This chart could not be built.') } : p))))
    })
  }, [mine, datasetId, setMine])

  // ---- builder helpers ----
  const pickKind = (id) => {
    const d = defaultsFor(id, columns)
    setKind(id); setX(d.x); setY(d.y); setColorBy('')
    if (id === 'bar' || id === 'pie') setAgg('sum')
    if (id === 'line' || id === 'area') setAgg('mean')
  }
  const toggleY = (name) => {
    if (meta.y === 'one') return setY(y[0] === name ? [] : [name])
    setY(y.includes(name) ? y.filter((n) => n !== name) : [...y, name])
  }
  const yPool = meta.agg && (agg === 'count' || agg === 'nunique') ? columns : numeric
  const colorOk = meta.color_by && y.length <= 1

  const problem = (() => {
    if (meta.x && !x) return 'Pick an X column.'
    if (meta.y === 'many' && y.length === 0) return 'Pick at least one value column.'
    if (kind === 'heatmap' && y.length < 2) return 'Pick at least two numeric columns.'
    if (kind === 'scatter' && y.length === 0) return 'Pick at least one Y column.'
    return ''
  })()

  const currentSpec = () => ({
    kind, x: meta.x ? x : null, y: meta.y ? y : [], color: colorOk && colorBy ? colorBy : null,
    agg: meta.agg ? agg : 'sum', bins, top_n: topN, normalize,
  })

  const submit = () => {
    const spec = currentSpec()
    if (editId) {
      setMine((prev) => prev.map((c) => (c.id === editId ? { ...c, spec, payload: null, error: '', loading: false } : c)))
    } else {
      setMine((prev) => [{ id: uid(), spec, payload: null, loading: false, error: '', opts: {} }, ...prev])
    }
    setEditId(null)
  }

  const loadSpecIntoBuilder = (spec, id = null) => {
    const k = KINDS.find((m) => m.id === spec.kind) || KINDS[0]
    setKind(k.id); setX(spec.x || ''); setY(spec.y || []); setColorBy(spec.color || '')
    setAgg(spec.agg || 'sum'); setBins(spec.bins || 20); setTopN(spec.top_n || 12); setNormalize(!!spec.normalize)
    setEditId(id); setBuilderOpen(true)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pin = (r) => setMine((prev) => [{ id: uid(), spec: r.spec, payload: r.payload, loading: false, error: '', opts: {} }, ...prev])
  const remove = (id) => { setMine((prev) => prev.filter((c) => c.id !== id)); if (editId === id) setEditId(null) }
  const setOpt = (id, key, val) => setMine((prev) => prev.map((c) => (c.id === id ? { ...c, opts: { ...c.opts, [key]: val } } : c)))

  const groups = GROUP_ORDER
    .map((g) => ({ name: g, items: (rec?.charts || []).filter((c) => c.group === g) }))
    .filter((g) => g.items.length)

  return (
    <div>
      <div ref={topRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <SectionLabel>Charts</SectionLabel>
        <Button variant={builderOpen ? 'ghost' : 'pink'} onClick={() => { setBuilderOpen((o) => !o); if (builderOpen) setEditId(null) }}>
          {builderOpen ? 'Close builder' : '＋ Build your own chart'}
        </Button>
      </div>

      {builderOpen && (
        <Card tint="var(--lemon-soft)" style={{ padding: '22px 24px', marginBottom: 30 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {editId ? 'Edit this chart' : 'Build a chart'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 18 }}>
            Pick a type, then choose one or several columns. Each chart you add lands in “My charts” below the builder.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 10, marginBottom: 22 }}>
            {KINDS.map((k) => {
              const on = k.id === kind
              return (
                <button key={k.id} onClick={() => pickKind(k.id)} aria-pressed={on}
                  style={{ textAlign: 'left', padding: '10px 12px', cursor: 'pointer', borderRadius: 12, border: '2px solid var(--line)', background: on ? k.color : 'var(--paper-raised)', boxShadow: on ? 'var(--shadow-md)' : 'none', transform: on ? 'translate(-2px,-2px)' : 'none', color: 'var(--ink)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{k.glyph}</div>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{k.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{k.hint}</div>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {meta.x && (
              <Field label={kind === 'scatter' ? 'X axis (numeric)' : kind === 'pie' ? 'Slices (category)' : 'X axis'}>
                <select style={selectStyle} value={x} onChange={(e) => setX(e.target.value)}>
                  <option value="">Select a column…</option>
                  {(meta.x === 'numeric' ? numeric : columns).map((c) => <option key={c.name} value={c.name}>{c.name} · {c.kind}</option>)}
                </select>
              </Field>
            )}
            {meta.agg && (
              <Field label="Combine rows with" hint={y.length === 0 ? 'No value column selected: the chart counts rows.' : undefined}>
                <select style={selectStyle} value={agg} onChange={(e) => setAgg(e.target.value)}>
                  {AGGS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            )}
            {meta.color_by && (
              <Field label="Split by (optional)" hint={colorOk ? undefined : 'Splitting works with one value column.'}>
                <select style={selectStyle} value={colorOk ? colorBy : ''} disabled={!colorOk} onChange={(e) => setColorBy(e.target.value)}>
                  <option value="">None</option>
                  {columns.filter((c) => c.name !== x).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </Field>
            )}
            {meta.bins && (
              <Field label={`Bins: ${bins}`}>
                <input type="range" min={5} max={60} value={bins} onChange={(e) => setBins(+e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
                  Show % of rows (fair when columns have different sizes)
                </label>
              </Field>
            )}
            {(kind === 'bar' || kind === 'pie') && (
              <Field label={`Show top ${topN} categories`}>
                <input type="range" min={3} max={30} value={topN} onChange={(e) => setTopN(+e.target.value)} style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </Field>
            )}
          </div>

          {meta.y && (
            <Field style={{ marginTop: 20 }}
              label={meta.y === 'one' ? 'Value column (optional, one)' : meta.y === 'optional' ? 'Value columns (pick one or many, or none to count rows)' : 'Value columns (pick one or many)'}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {yPool.map((c) => (
                  <Chip key={c.name} on={y.includes(c.name)} color={KIND_COLOR[c.kind]} onClick={() => toggleY(c.name)} title={c.kind}>{c.name}</Chip>
                ))}
                {meta.y !== 'one' && yPool.length > 1 && (
                  <>
                    <Chip onClick={() => setY(numeric.map((c) => c.name).slice(0, 8))}>all numeric</Chip>
                    <Chip onClick={() => setY([])}>clear</Chip>
                  </>
                )}
              </div>
            </Field>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 22, flexWrap: 'wrap' }}>
            <Button variant="accent" onClick={submit} disabled={!!problem}>{editId ? 'Update chart' : 'Add to my charts'}</Button>
            {editId && <Button variant="ghost" onClick={() => setEditId(null)}>Cancel edit</Button>}
            {problem && <span style={{ fontSize: 13, color: 'var(--alert)', fontWeight: 600 }}>{problem}</span>}
          </div>
        </Card>
      )}

      {mine.length > 0 && (
        <section style={{ marginBottom: 36 }}>
          <Heading color="var(--pink)">My charts <span style={{ color: 'var(--ink-faint)', fontWeight: 600, fontSize: 16 }}>({mine.length})</span></Heading>
          <div style={gridStyle}>
            {mine.map((c) => (
              <ChartCard key={c.id} title={c.payload?.title || KINDS.find((k) => k.id === c.spec.kind)?.label}
                badge={<Badge tone="pink">{c.spec.kind}</Badge>}
                actions={<>
                  <Button size="sm" variant="ghost" onClick={() => loadSpecIntoBuilder(c.spec, c.id)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}>Remove</Button>
                </>}>
                <ChartBody item={c} onOpt={(k, v) => setOpt(c.id, k, v)} />
              </ChartCard>
            ))}
          </div>
        </section>
      )}

      <Heading color="var(--lemon)">Recommended for this dataset</Heading>
      {recLoading && !rec && <div style={{ padding: 60, textAlign: 'center', color: 'var(--ink-faint)' }}><Spinner size={24} /><p>Picking the charts worth looking at…</p></div>}
      {recError && <Card><EmptyState title="Charts unavailable" description={recError} /></Card>}
      {rec && groups.length === 0 && <Card><EmptyState title="Nothing to recommend yet" description="Use the builder to make your own chart from any column." /></Card>}
      {groups.map((g) => (
        <section key={g.name} style={{ marginBottom: 30 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {g.name}<span style={{ flex: 1, height: 0, borderTop: '2px dashed var(--hairline-strong)' }} />
          </div>
          <div style={gridStyle}>
            {g.items.map((r) => (
              <ChartCard key={r.id} title={r.title} subtitle={r.note}
                actions={<>
                  <Button size="sm" variant="ghost" onClick={() => pin(r)} title="Copy this chart into My charts">Pin</Button>
                  <Button size="sm" variant="ghost" onClick={() => loadSpecIntoBuilder(r.spec)} title="Open it in the builder to change columns or type">Remix</Button>
                </>}>
                <ChartRenderer payload={r.payload} />
              </ChartCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))', gap: 20, alignItems: 'start' }

function Heading({ children, color }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', margin: '6px 0 16px', display: 'inline-block', backgroundImage: `linear-gradient(transparent 62%, ${color} 62%)` }}>
      {children}
    </h2>
  )
}

function ChartCard({ title, subtitle, badge, actions, children }) {
  return (
    <Card style={{ padding: '16px 18px 18px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em', lineHeight: 1.2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>{subtitle}</div>}
          {badge && <div style={{ marginTop: 6 }}>{badge}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{actions}</div>
      </div>
      {children}
    </Card>
  )
}

function ChartBody({ item, onOpt }) {
  if (item.loading || (!item.payload && !item.error)) return <div style={{ padding: 50, textAlign: 'center' }}><Spinner size={22} /></div>
  if (item.error) return <div style={{ padding: '14px 16px', background: 'var(--alert-soft)', color: 'var(--alert)', borderRadius: 10, fontSize: 13.5, fontWeight: 600 }}>{item.error}</div>
  const p = item.payload
  const multi = (p.series?.length || 0) > 1
  return (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {p.kind === 'bar' && <Chip on={!!item.opts.horizontal} onClick={() => onOpt('horizontal', !item.opts.horizontal)}>horizontal</Chip>}
        {(p.kind === 'bar' || p.kind === 'area') && multi && <Chip on={!!item.opts.stacked} onClick={() => onOpt('stacked', !item.opts.stacked)}>stacked</Chip>}
        {(p.kind === 'line' || p.kind === 'area') && <Chip on={item.opts.smooth !== false} onClick={() => onOpt('smooth', item.opts.smooth === false)}>smooth</Chip>}
      </div>
      <ChartRenderer payload={p} opts={item.opts} />
    </>
  )
}
