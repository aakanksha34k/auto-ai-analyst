import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { Badge } from './Primitives'

export const PALETTE = ['#4F46E5', '#E0699B', '#34B38A', '#F0A04B', '#4DA3E8', '#C9A227', '#8B5CF6', '#1F2430']
const INK = '#1A1A24'
const GRID = '#ECECF1'
const tip = { background: '#fff', border: '1px solid #DCDCE6', borderRadius: 8, fontSize: 12.5, color: INK, padding: '8px 12px', boxShadow: '0 4px 14px rgba(20,20,40,0.08)' }
const tipLabel = { color: INK, fontWeight: 600 }
const axis = { fontSize: 11, fill: '#8B8B9E', fontFamily: 'var(--font-mono)' }
const grid = <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />

const fmt = (v) => {
  if (typeof v !== 'number') return v
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}k`
  return Number.isInteger(v) ? v : +v.toFixed(2)
}

/** Draws any payload returned by /charts/custom or /charts/recommended. */
export default function ChartRenderer({ payload, opts = {}, height = 270 }) {
  if (!payload) return null
  const k = payload.kind

  if (k === 'histogram') {
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={payload.data} barCategoryGap={1}>
            {grid}
            <XAxis dataKey="_start" tick={axis} tickFormatter={fmt} interval="preserveStartEnd" minTickGap={28} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={axis} tickFormatter={fmt} width={46} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tip} labelStyle={tipLabel} labelFormatter={(_, p) => p?.[0]?.payload?._x} cursor={{ fill: 'rgba(79,70,229,0.06)' }} />
            {payload.series.length > 1 && <Legend />}
            {payload.series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={PALETTE[i % 8]} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {payload.stats.map((s, i) => (
            <span key={s.name} style={{ fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--font-mono)' }}>
              <b style={{ color: PALETTE[i % 8] }}>■</b> {s.name}: mean {fmt(s.mean)} · median {fmt(s.median)} · σ {fmt(s.std)} · n {s.n.toLocaleString()}
            </span>
          ))}
        </div>
      </>
    )
  }

  if (k === 'bar') {
    const horizontal = !!opts.horizontal
    const single = payload.series.length === 1 && !opts.stacked
    const many = payload.data.length > 8
    return (
      <>
        <ResponsiveContainer width="100%" height={Math.max(height, horizontal ? payload.data.length * 30 + 40 : 0)}>
          <BarChart data={payload.data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ bottom: many && !horizontal ? 18 : 0 }}>
            {horizontal ? <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} /> : grid}
            {horizontal ? <XAxis type="number" tick={axis} tickFormatter={fmt} axisLine={false} tickLine={false} /> : (
              <XAxis dataKey="_x" tick={axis} interval={0} angle={many ? -30 : 0} textAnchor={many ? 'end' : 'middle'} height={many ? 60 : 30} axisLine={{ stroke: GRID }} tickLine={false} />
            )}
            {horizontal ? <YAxis type="category" dataKey="_x" tick={axis} width={96} axisLine={false} tickLine={false} /> : <YAxis tick={axis} tickFormatter={fmt} width={46} axisLine={false} tickLine={false} />}
            <Tooltip contentStyle={tip} labelStyle={tipLabel} cursor={{ fill: 'rgba(79,70,229,0.06)' }} />
            {payload.series.length > 1 && <Legend />}
            {payload.series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={PALETTE[i % 8]} stackId={opts.stacked ? 'a' : undefined}
                radius={opts.stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                {single && payload.data.map((_, j) => <Cell key={j} fill={PALETTE[0]} />)}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        {payload.truncated && <Note>Showing the top {payload.data.length} of {payload.n_x_values.toLocaleString()} values.</Note>}
      </>
    )
  }

  if (k === 'line' || k === 'area') {
    const Chart = k === 'line' ? LineChart : AreaChart
    const dots = payload.data.length <= 40
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <Chart data={payload.data}>
            {grid}
            <XAxis dataKey="_x" tick={axis} minTickGap={36} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis tick={axis} tickFormatter={fmt} width={46} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tip} labelStyle={tipLabel} />
            {payload.series.length > 1 && <Legend />}
            {payload.series.map((s, i) => k === 'line' ? (
              <Line key={s} dataKey={s} stroke={PALETTE[i % 8]} strokeWidth={2} type={opts.smooth === false ? 'linear' : 'monotone'}
                dot={dots ? { r: 3, strokeWidth: 0, fill: PALETTE[i % 8] } : false} connectNulls />
            ) : (
              <Area key={s} dataKey={s} stroke={PALETTE[i % 8]} strokeWidth={2} fill={PALETTE[i % 8]} fillOpacity={0.18}
                type={opts.smooth === false ? 'linear' : 'monotone'} stackId={opts.stacked ? 'a' : undefined} connectNulls />
            ))}
          </Chart>
        </ResponsiveContainer>
        {payload.truncated && <Note>Showing the latest {payload.data.length} points.</Note>}
      </>
    )
  }

  if (k === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height + 20}>
        <PieChart>
          <Pie data={payload.data} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="78%" stroke="#fff" strokeWidth={2}
            label={({ percent }) => (percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : '')} labelLine={false}>
            {payload.data.map((_, i) => <Cell key={i} fill={PALETTE[i % 8]} />)}
          </Pie>
          <Tooltip contentStyle={tip} labelStyle={tipLabel} />
          <Legend verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  if (k === 'scatter') {
    return (
      <>
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis type="number" dataKey="x" name={payload.x_label} tick={axis} tickFormatter={fmt} domain={['auto', 'auto']} axisLine={{ stroke: GRID }} tickLine={false} />
            <YAxis type="number" dataKey="y" name={payload.y_label} tick={axis} tickFormatter={fmt} width={46} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tip} labelStyle={tipLabel} cursor={{ strokeDasharray: '3 3' }} />
            {payload.series.length > 1 && <Legend />}
            {payload.series.map((s, i) => (
              <Scatter key={s.name} name={s.name} data={s.points} fill={PALETTE[i % 8]} fillOpacity={0.6} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {payload.series.map((s) => (
            <Badge key={s.name} tone={s.r === null ? 'default' : Math.abs(s.r) >= 0.7 ? 'accent' : Math.abs(s.r) >= 0.4 ? 'amber' : 'default'}>
              {s.name}: {s.r === null ? 'r n/a' : `r = ${s.r.toFixed(2)}`} · n {s.n.toLocaleString()}
            </Badge>
          ))}
        </div>
      </>
    )
  }

  if (k === 'box') return <BoxPlot groups={payload.groups} height={height} />
  if (k === 'heatmap') return <Heatmap columns={payload.columns} matrix={payload.matrix} />
  return <Note>This chart type is not supported.</Note>
}

const Note = ({ children }) => <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>{children}</div>

function BoxPlot({ groups, height }) {
  const W = 640, H = Math.max(height, 240), pad = { l: 56, r: 16, t: 14, b: 44 }
  const lo = Math.min(...groups.map((g) => g.min)), hi = Math.max(...groups.map((g) => g.max))
  const span = hi - lo || 1
  const y = (v) => pad.t + (1 - (v - lo) / span) * (H - pad.t - pad.b)
  const step = (W - pad.l - pad.r) / groups.length
  const bw = Math.min(72, step * 0.55)
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (span * i) / 4)
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Box plot">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray="3 3" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" style={axis}>{fmt(t)}</text>
          </g>
        ))}
        {groups.map((g, i) => {
          const cx = pad.l + step * (i + 0.5)
          const c = PALETTE[i % 8]
          return (
            <g key={g.name}>
              <title>{`${g.name}: median ${fmt(g.median)}, mean ${fmt(g.mean)}, n ${g.n}`}</title>
              <line x1={cx} x2={cx} y1={y(g.whisker_high)} y2={y(g.whisker_low)} stroke="#8B8B9E" strokeWidth="1.5" />
              <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(g.whisker_high)} y2={y(g.whisker_high)} stroke="#8B8B9E" strokeWidth="1.5" />
              <line x1={cx - bw / 4} x2={cx + bw / 4} y1={y(g.whisker_low)} y2={y(g.whisker_low)} stroke="#8B8B9E" strokeWidth="1.5" />
              <rect x={cx - bw / 2} y={y(g.q3)} width={bw} height={Math.max(2, y(g.q1) - y(g.q3))} rx="4" fill={c} fillOpacity="0.25" stroke={c} strokeWidth="1.5" />
              <line x1={cx - bw / 2} x2={cx + bw / 2} y1={y(g.median)} y2={y(g.median)} stroke={c} strokeWidth="2.5" />
              <circle cx={cx} cy={y(g.mean)} r="3.5" fill="#fff" stroke={c} strokeWidth="1.5" />
              {g.outliers.map((o, j) => <circle key={j} cx={cx + ((j % 5) - 2) * 3} cy={y(o)} r="2.5" fill="none" stroke="#8B8B9E" strokeWidth="1.2" />)}
              <text x={cx} y={H - pad.b + 20} textAnchor="middle" style={{ ...axis, fontSize: 12, fill: INK }}>
                {g.name.length > 14 ? `${g.name.slice(0, 13)}…` : g.name}
              </text>
            </g>
          )
        })}
      </svg>
      <Note>Solid line = median · hollow dot = mean · circles = outliers ({groups.reduce((a, g) => a + g.n_outliers, 0).toLocaleString()} total)</Note>
    </>
  )
}

function Heatmap({ columns, matrix }) {
  const color = (r) => (r === null ? 'transparent' : r >= 0 ? `rgba(79,70,229,${0.08 + Math.abs(r) * 0.8})` : `rgba(224,105,155,${0.08 + Math.abs(r) * 0.8})`)
  return (
    <div style={{ overflow: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11.5 }}>
        <thead>
          <tr>
            <th />
            {columns.map((c) => (
              <th key={c} style={{ ...axis, fontWeight: 600, writingMode: 'vertical-rl', maxHeight: 96, padding: '2px 4px' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((rowCol, i) => (
            <tr key={rowCol}>
              <td style={{ ...axis, fontWeight: 600, whiteSpace: 'nowrap', paddingRight: 8, textAlign: 'right' }}>{rowCol}</td>
              {columns.map((c, j) => (
                <td key={c} title={`${rowCol} × ${c}: ${matrix[i][j] ?? 'n/a'}`}
                  style={{ width: 46, height: 32, textAlign: 'center', borderRadius: 4, background: color(matrix[i][j]), color: Math.abs(matrix[i][j] ?? 0) > 0.55 ? '#fff' : INK, fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 11 }}>
                  {matrix[i][j] === null ? '—' : matrix[i][j].toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
