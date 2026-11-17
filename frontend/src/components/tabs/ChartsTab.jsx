import React, { useEffect, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, LineChart, Line } from 'recharts'
import { Card, SectionLabel, EmptyState, Spinner, Button } from '../Primitives'
import api from '../../api/client'

const COLORS = ['#6658e8', '#12a47b', '#e36b4d', '#d49a24', '#8b7ff0', '#55a992', '#c77b9b', '#718096']
const tooltipStyle = { background: 'var(--ink)', border: 'none', borderRadius: 8, fontSize: 12, color: '#fff', padding: '8px 12px' }
const fieldStyle = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--hairline-strong)', background: 'var(--paper)', color: 'var(--ink)', fontSize: 13 }

export default function ChartsTab({ datasetId }) {
  const [meta, setMeta] = useState(null)
  const [kind, setKind] = useState('bar')
  const [column, setColumn] = useState('')
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadMeta = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await api.getChartSuggestions(datasetId)
      setMeta(data)
      const nums = data.numeric_columns || [], cats = data.categorical_columns || [], dates = data.date_columns || []
      setColumn((prev) => prev || cats[0] || nums[0] || '')
      setX((prev) => prev || nums[0] || '')
      setY((prev) => prev || nums[1] || nums[0] || '')
      setKind(cats.length ? 'bar' : nums.length ? 'histogram' : 'bar')
    } catch (e) { setError(e?.response?.data?.detail || 'Could not load chartable columns.') }
    finally { setLoading(false) }
  }, [datasetId])
  useEffect(() => { loadMeta() }, [loadMeta])

  const buildChart = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      let data
      if (kind === 'histogram') data = await api.chartHistogram(datasetId, column)
      else if (kind === 'bar') data = await api.chartBar(datasetId, column)
      else if (kind === 'pie') data = await api.chartPie(datasetId, column)
      else if (kind === 'scatter') data = await api.chartScatter(datasetId, x, y)
      else data = await api.chartTimeseries(datasetId, x, y)
      setResult(data)
    } catch (e) { setError(e?.response?.data?.detail || 'Chart could not be generated. Check the selected columns and try again.') }
    finally { setLoading(false) }
  }

  if (loading && !meta) return <div style={{ padding: 70, textAlign: 'center' }}><Spinner size={22} /><p>Preparing chart workspace…</p></div>
  if (!meta) return <Card><EmptyState title="Charts unavailable" description={error || 'Could not inspect this dataset.'} /></Card>
  const nums = meta.numeric_columns || [], cats = meta.categorical_columns || [], dates = meta.date_columns || []
  const oneColumn = kind === 'histogram' ? nums : (kind === 'bar' || kind === 'pie') ? [...cats, ...nums] : []
  const xOptions = kind === 'timeseries' ? dates : nums
  const canBuild = (kind === 'scatter' ? x && y && x !== y : kind === 'timeseries' ? x && y : column)

  return <div>
    <SectionLabel>Chart studio</SectionLabel>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 330px)', gap: 18, alignItems: 'start' }}>
      <Card style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Build your visualization</div>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 18 }}>Choose the chart type and the exact columns. Nothing is selected or changed without your input.</div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Chart type</label>
        <select style={fieldStyle} value={kind} onChange={e => { setKind(e.target.value); setResult(null) }}>
          <option value="bar">Bar chart — compare category counts</option><option value="pie">Pie chart — category proportions</option>
          <option value="histogram">Histogram — numeric distribution</option><option value="scatter">Scatter plot — relationship between two numeric columns</option>
          <option value="timeseries" disabled={!dates.length}>Time series — numeric value over date</option>
        </select>
        {['bar','pie','histogram'].includes(kind) && <div style={{ marginTop: 14 }}><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Column</label><select style={fieldStyle} value={column} onChange={e => setColumn(e.target.value)}>{oneColumn.map(c => <option key={c} value={c}>{c}</option>)}</select></div>}
        {(kind === 'scatter' || kind === 'timeseries') && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{kind === 'timeseries' ? 'Date column' : 'X axis'}</label><select style={fieldStyle} value={x} onChange={e => setX(e.target.value)}>{xOptions.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{kind === 'timeseries' ? 'Value column' : 'Y axis'}</label><select style={fieldStyle} value={y} onChange={e => setY(e.target.value)}>{nums.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>}
        <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center' }}><Button variant="accent" onClick={buildChart} disabled={!canBuild || loading}>{loading ? <Spinner size={14}/> : 'Generate chart'}</Button><Button variant="subtle" onClick={() => setResult(null)}>Clear preview</Button></div>
        {error && <p style={{ color: 'var(--alert)', fontSize: 12, marginTop: 12 }}>{error}</p>}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--hairline)', fontSize: 11.5, color: 'var(--ink-faint)' }}>Available columns · {nums.length} numeric · {cats.length} categorical · {dates.length} date</div>
      </Card>
      <Card style={{ padding: 18, minHeight: 250 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Chart preview</div><div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 14 }}>{result ? `Generated ${kind} visualization` : 'Your chart will appear here'}</div>
        {!result && <div style={{ minHeight: 190, display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 12 }}>Select chart settings, then generate your chart.</div>}
        {result && <ChartPreview kind={kind} data={result} x={x} y={y} />}
      </Card>
    </div>
    <div style={{ marginTop: 18 }}><SectionLabel>Suggested chart ideas</SectionLabel><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{(meta.suggested?.histograms || []).slice(0,4).map(c => <button key={`h${c}`} onClick={() => {setKind('histogram');setColumn(c);setResult(null)}} style={chipStyle}>Distribution · {c}</button>)}{(meta.suggested?.bar_charts || []).slice(0,4).map(c => <button key={`b${c}`} onClick={() => {setKind('bar');setColumn(c);setResult(null)}} style={chipStyle}>Category counts · {c}</button>)}</div></div>
  </div>
}
const chipStyle = { border: '1px solid var(--hairline-strong)', background: 'var(--paper-raised)', color: 'var(--ink-soft)', borderRadius: 20, padding: '7px 11px', fontSize: 11.5, cursor: 'pointer' }
function ChartPreview({ kind, data, x, y }) {
  if (kind === 'histogram') return <ResponsiveContainer width="100%" height={230}><BarChart data={data.bins || []}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="bin" hide/><YAxis/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="count" fill={COLORS[0]} radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
  if (kind === 'bar') return <ResponsiveContainer width="100%" height={250}><BarChart data={data.data || []} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="category" width={85} tick={{fontSize:10}}/><Tooltip contentStyle={tooltipStyle}/><Bar dataKey="count" fill={COLORS[1]} radius={[0,4,4,0]}/></BarChart></ResponsiveContainer>
  if (kind === 'pie') return <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={data.data || []} dataKey="value" nameKey="name" outerRadius={82} label>{(data.data || []).map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle}/></PieChart></ResponsiveContainer>
  if (kind === 'scatter') return <ResponsiveContainer width="100%" height={250}><ScatterChart><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="x" name={x} type="number"/><YAxis dataKey="y" name={y} type="number"/><Tooltip cursor={{strokeDasharray:'3 3'}} contentStyle={tooltipStyle}/><Scatter data={data.data || []} fill={COLORS[2]}/></ScatterChart></ResponsiveContainer>
  return <ResponsiveContainer width="100%" height={250}><LineChart data={data.data || []}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{fontSize:9}}/><YAxis/><Tooltip contentStyle={tooltipStyle}/><Line dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>
}
