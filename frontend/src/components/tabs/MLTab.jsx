import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter,
  ReferenceLine, LineChart, Line, Legend,
} from 'recharts'
import api from '../../api/client'
import { Badge, Button, Card, Chip, EmptyState, Field, SectionLabel, Spinner, Stat, selectStyle } from '../Primitives'
import { PALETTE } from '../ChartRenderer'

const tip = { background: '#1B1340', border: '2px solid #1B1340', borderRadius: 10, fontSize: 12.5, color: '#fff', padding: '8px 12px' }
const axis = { fontSize: 11, fill: '#473F73', fontFamily: 'var(--font-mono)' }
const KIND_COLOR = { numeric: 'var(--accent)', categorical: 'var(--pink)', datetime: '#0FC58C', boolean: 'var(--tangerine)' }
const TASK_LABEL = { regression: 'Regression · predicts a number', classification: 'Classification · predicts a category', clustering: 'Clustering · finds groups' }

export const DEFAULT_ML_FORM = { target: '', task: 'auto', selected: null, model: 'auto', nClusters: 'auto', testSize: 20 }

/** Turn the form into the request body the API expects. */
export function buildMlConfig(form, columns, ptype) {
  const nonTarget = columns.map((c) => c.name).filter((n) => n !== form.target)
  const features = form.selected === null ? null : nonTarget.filter((n) => form.selected.includes(n))
  return {
    target: form.target || null,
    task: form.task === 'auto' ? null : form.task,
    features,
    model: form.model === 'auto' ? null : form.model,
    n_clusters: ptype === 'clustering' && form.nClusters !== 'auto' ? Number(form.nClusters) : null,
    test_size: form.testSize / 100,
  }
}

export default function MLTab({ datasetId, columns, form, setForm, onRun, result, running, recommendations, recLoading }) {
  const [catalog, setCatalog] = useState(null)
  const patch = (p) => setForm((f) => ({ ...f, ...p }))

  useEffect(() => {
    let live = true
    api.mlModels(datasetId, form.target || null, form.task === 'auto' ? null : form.task)
      .then((c) => {
        if (!live) return
        setCatalog(c)
        const keys = ['auto', 'all', ...c.models.map((m) => m.key)]
        if (!keys.includes(form.model)) patch({ model: 'auto' })
      })
      .catch(() => live && setCatalog(null))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, form.target, form.task])

  const ptype = catalog?.problem_type || (form.target ? 'classification' : 'clustering')
  const candidates = columns.filter((c) => c.name !== form.target)
  const isOn = (n) => form.selected === null || form.selected.includes(n)
  const chosen = candidates.filter((c) => isOn(c.name))
  const toggle = (n) => {
    const cur = form.selected === null ? candidates.map((c) => c.name) : form.selected
    patch({ selected: cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n] })
  }
  const modelInfo = catalog?.models.find((m) => m.key === form.model)

  return (
    <div>
      <SectionLabel>Machine learning</SectionLabel>

      <Card style={{ padding: '22px 24px', marginBottom: 28 }} tint="var(--lemon-soft)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="1. What do you want to predict?" hint="Leave empty to let the model find groups of similar rows (clustering).">
              <select style={selectStyle} value={form.target} onChange={(e) => patch({ target: e.target.value })}>
                <option value="">Nothing: find clusters</option>
                {columns.map((c) => <option key={c.name} value={c.name}>{c.name} · {c.kind}</option>)}
              </select>
            </Field>

            {form.target && (
              <Field label="Task type" hint={`Detected: ${TASK_LABEL[ptype]}. Override it if the guess is wrong.`}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['auto', 'regression', 'classification'].map((t) => (
                    <Chip key={t} on={form.task === t} color="var(--ink)" onClick={() => patch({ task: t })}>{t}</Chip>
                  ))}
                </div>
              </Field>
            )}

            <Field label="3. Which model?" hint={modelInfo?.description
              || (form.model === 'all' ? 'Trains every model below on the same split and ranks them. Slower.'
                : 'Auto trains a quick pair of models and keeps the better one.')}>
              <select style={selectStyle} value={form.model} onChange={(e) => patch({ model: e.target.value })}>
                <option value="auto">Auto: quick comparison, best one wins</option>
                <option value="all">Compare all {catalog?.models.length || ''} models</option>
                {(catalog?.models || []).map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
              </select>
            </Field>

            {ptype === 'clustering' ? (
              <Field label="4. Number of clusters">
                <select style={selectStyle} value={form.nClusters} onChange={(e) => patch({ nClusters: e.target.value })}>
                  <option value="auto">Auto: best silhouette score (2–6)</option>
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => <option key={k} value={k}>{k} clusters</option>)}
                </select>
              </Field>
            ) : (
              <Field label={`4. Hold out ${form.testSize}% of rows for testing`} hint="Models are scored on rows they never saw while training.">
                <input type="range" min={10} max={40} step={5} value={form.testSize} onChange={(e) => patch({ testSize: +e.target.value })} style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </Field>
            )}
          </div>

          <Field label={`2. Which columns may the model use? (${chosen.length} of ${candidates.length})`}
            hint="Free-text or ID-like columns (more than 50 distinct values) are skipped automatically. Dates become “days since the earliest row”.">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Button size="sm" variant="ghost" onClick={() => patch({ selected: null })}>All</Button>
              <Button size="sm" variant="ghost" onClick={() => patch({ selected: [] })}>None</Button>
              <Button size="sm" variant="ghost" onClick={() => patch({ selected: candidates.filter((c) => c.kind === 'numeric').map((c) => c.name) })}>Numeric only</Button>
              <Button size="sm" variant="ghost" onClick={() => patch({ selected: candidates.filter((c) => !isOn(c.name)).map((c) => c.name) })}>Invert</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, maxHeight: 230, overflowY: 'auto', padding: 2 }}>
              {candidates.map((c) => {
                const skipped = c.kind === 'categorical' && c.unique_count > 50
                return (
                  <Chip key={c.name} on={isOn(c.name)} color={KIND_COLOR[c.kind]} onClick={() => toggle(c.name)}
                    title={skipped ? 'Too many distinct values: will be skipped' : c.kind}>
                    {c.name}{skipped ? ' ⚠' : ''}
                  </Chip>
                )
              })}
            </div>
          </Field>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 22, flexWrap: 'wrap' }}>
          <Button variant="accent" disabled={running || chosen.length === 0}
            onClick={() => onRun(buildMlConfig(form, columns, ptype))}>
            {running ? <Spinner size={14} /> : 'Run analysis'}
          </Button>
          <Badge tone="accent">{TASK_LABEL[ptype]}</Badge>
          {chosen.length === 0 && <span style={{ fontSize: 13, color: 'var(--alert)', fontWeight: 600 }}>Select at least one column.</span>}
        </div>
      </Card>

      {running && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 50, gap: 12 }}>
          <Spinner size={26} />
          <div style={{ color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600 }}>
            {form.model === 'all' ? 'Training every model. This can take a minute…' : 'Training and evaluating…'}
          </div>
        </div>
      )}
      {!running && !result && <Card><EmptyState title="No model run yet" description="Choose a target, the columns it may use and a model, then run the analysis." /></Card>}
      {!running && result?.error && <Card><EmptyState title="That run didn’t work" description={result.error} /></Card>}
      {!running && result && !result.error && (
        <>
          <MLResult result={result} />
          <Recommendations items={recommendations} loading={recLoading} />
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ results
function MLResult({ result }) {
  return (
    <div>
      <Card style={{ padding: '20px 22px', marginBottom: 22 }} tint="var(--mint-soft)">
        <div style={{ display: 'flex', gap: 36, marginBottom: 14, flexWrap: 'wrap' }}>
          <Stat label="Best model" value={result.best_model} mono={false} />
          {result.problem_type === 'regression' && <Stat label="R² score" value={result.best_r2} tone="accent" />}
          {result.problem_type === 'classification' && <Stat label="Accuracy" value={`${(result.best_accuracy * 100).toFixed(1)}%`} tone="accent" />}
          {result.problem_type === 'classification' && result.roc_auc != null && <Stat label="ROC AUC" value={result.roc_auc} />}
          {result.problem_type === 'clustering' && <Stat label="Clusters" value={result.n_clusters} tone="accent" />}
          {result.problem_type === 'clustering' && <Stat label="Silhouette" value={result.silhouette_score} />}
          {result.target && <Stat label="Target" value={result.target} mono={false} />}
          {result.n_train != null && <Stat label="Train / test rows" value={`${result.n_train.toLocaleString()} / ${result.n_test.toLocaleString()}`} mono={false} />}
        </div>
        <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.55 }}>{result.summary}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {result.features_used?.map((f) => <Badge key={f} tone="accent">{f}</Badge>)}
          {result.features_dropped?.map((f) => <Badge key={f} tone="alert">{f} skipped</Badge>)}
        </div>
      </Card>

      {(result.notes?.length > 0 || result.failed_models?.length > 0) && (
        <div style={{ padding: '12px 16px', background: 'var(--amber-soft)', border: '2px solid var(--line)', borderRadius: 12, fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
          {result.notes?.map((n, i) => <div key={i}>• {n}</div>)}
          {result.failed_models?.map((f, i) => <div key={i}>• {f.model} failed: {f.error}</div>)}
        </div>
      )}

      <SectionLabel>{result.models_compared.length > 1 ? 'Model leaderboard' : 'Model scores'}</SectionLabel>
      <CompareTable models={result.models_compared} best={result.best_model} />

      {result.problem_type === 'regression' && <ActualVsPredicted points={result.predictions} />}
      {result.problem_type === 'classification' && <Confusion matrix={result.confusion_matrix} names={result.class_names} />}
      {result.problem_type === 'clustering' && <Clusters result={result} />}
      <FeatureImportance features={result.feature_importance} />
    </div>
  )
}

function CompareTable({ models, best }) {
  const cols = Object.keys(models[0]).filter((k) => k !== 'model')
  return (
    <Card style={{ overflow: 'hidden', marginBottom: 26 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--ink)', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '10px 16px' }}>Model</th>
              {cols.map((c) => <th key={c} style={{ textAlign: 'right', padding: '10px 16px' }}>{c.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...models].sort((a, b) => (b[cols[0]] ?? 0) - (a[cols[0]] ?? 0)).map((m) => (
              <tr key={m.model} style={{ background: m.model === best ? 'var(--lemon)' : 'transparent', borderTop: '1px solid var(--hairline)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 700 }}>{m.model === best ? '★ ' : ''}{m.model}</td>
                {cols.map((c) => <td key={c} style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{m[c]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function ActualVsPredicted({ points }) {
  if (!points?.length) return null
  const vals = points.flatMap((p) => [p.actual, p.predicted])
  const lo = Math.min(...vals), hi = Math.max(...vals)
  return (
    <>
      <SectionLabel>Actual vs predicted</SectionLabel>
      <Card style={{ padding: '18px 20px', marginBottom: 26 }}>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DAD3F5" />
            <XAxis type="number" dataKey="actual" name="actual" tick={axis} domain={['auto', 'auto']} />
            <YAxis type="number" dataKey="predicted" name="predicted" tick={axis} domain={['auto', 'auto']} width={50} />
            <Tooltip contentStyle={tip} itemStyle={{ color: '#fff' }} cursor={{ strokeDasharray: '3 3' }} />
            <ReferenceLine segment={[{ x: lo, y: lo }, { x: hi, y: hi }]} stroke="#FF3E9A" strokeWidth={2.5} strokeDasharray="6 4" />
            <Scatter data={points} fill="#6B3CFF" fillOpacity={0.65} stroke="#1B1340" strokeWidth={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>Dots on the pink line are perfect predictions. Test rows only.</div>
      </Card>
    </>
  )
}

function Confusion({ matrix, names }) {
  if (!matrix) return null
  const small = matrix.length > 8
  const size = small ? 40 : 60
  const rowTotals = matrix.map((r) => r.reduce((a, b) => a + b, 0))
  return (
    <>
      <SectionLabel>Confusion matrix</SectionLabel>
      <Card style={{ padding: 20, marginBottom: 26, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 3, margin: '0 auto' }}>
          <thead>
            <tr>
              <th />
              {names.map((n) => <th key={n} style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }} title={`predicted ${n}`}>{n.slice(0, 7)}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', textAlign: 'right', paddingRight: 8, whiteSpace: 'nowrap' }} title={`actual ${names[i]}`}>{names[i].slice(0, 12)}</th>
                {row.map((val, j) => {
                  const share = rowTotals[i] ? val / rowTotals[i] : 0
                  return (
                    <td key={j} title={`actual ${names[i]}, predicted ${names[j]}: ${val}`}
                      style={{ width: size, height: size, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: small ? 12 : 15, borderRadius: 8,
                        background: i === j ? `rgba(15,197,140,${0.15 + share * 0.8})` : val ? `rgba(255,62,154,${0.15 + Math.min(share * 2, 0.8)})` : 'var(--paper)',
                        color: 'var(--ink)', border: '2px solid var(--line)' }}>
                      {val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 12 }}>Rows = actual class, columns = predicted class. Green diagonal = correct.</div>
      </Card>
    </>
  )
}

function Clusters({ result }) {
  const byCluster = {}
  ;(result.pca_points || []).forEach((p) => { (byCluster[p.cluster] ||= []).push(p) })
  return (
    <>
      <SectionLabel>Cluster map</SectionLabel>
      <Card style={{ padding: '18px 20px', marginBottom: 26 }}>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DAD3F5" />
            <XAxis type="number" dataKey="x" tick={axis} name="PC1" />
            <YAxis type="number" dataKey="y" tick={axis} name="PC2" width={44} />
            <Tooltip contentStyle={tip} itemStyle={{ color: '#fff' }} />
            <Legend />
            {Object.entries(byCluster).map(([c, pts]) => (
              <Scatter key={c} name={`Cluster ${c}`} data={pts} fill={PALETTE[c % 8]} fillOpacity={0.75} stroke="#1B1340" strokeWidth={0.8} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>
          Every column squashed onto two axes (PCA), which keep {result.pca_explained_pct}% of the variation.
        </div>
      </Card>

      {result.k_search?.length > 0 && (
        <Card style={{ padding: '18px 20px', marginBottom: 26 }}>
          <div style={{ fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 8 }}>How the cluster count was chosen</div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={result.k_search}>
              <CartesianGrid strokeDasharray="3 3" stroke="#DAD3F5" vertical={false} />
              <XAxis dataKey="k" tick={axis} />
              <YAxis tick={axis} width={44} />
              <Tooltip contentStyle={tip} />
              <Line dataKey="silhouette_score" stroke="#FF3E9A" strokeWidth={3} dot={{ r: 5, stroke: '#1B1340', strokeWidth: 2, fill: '#FFE14D' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <SectionLabel>Cluster breakdown</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 26 }}>
        {result.cluster_summary?.map((c) => (
          <Card key={c.cluster} style={{ padding: '16px 18px', borderTop: `10px solid ${PALETTE[c.cluster % 8]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>Cluster {c.cluster}</span>
              <Badge tone="accent">{c.size} rows · {c.pct_of_data}%</Badge>
            </div>
            {c.highlights?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {c.highlights.map((h) => <Badge key={h.feature} tone={h.z >= 0 ? 'positive' : 'pink'}>{h.feature} {h.z >= 0 ? '+' : ''}{h.z}σ</Badge>)}
              </div>
            )}
            {Object.entries(c.mean_values || {}).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: 'var(--ink-soft)' }}>
                <span>{k}</span><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </Card>
        ))}
      </div>
    </>
  )
}

function FeatureImportance({ features }) {
  if (!features || features.length === 0) return null
  const data = [...features].reverse()
  return (
    <>
      <SectionLabel>What mattered most</SectionLabel>
      <Card style={{ padding: '18px 20px', marginBottom: 26 }}>
        <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#DAD3F5" horizontal={false} />
            <XAxis type="number" tick={axis} />
            <YAxis type="category" dataKey="feature" tick={{ ...axis, fontSize: 12 }} width={120} />
            <Tooltip contentStyle={tip} cursor={{ fill: 'rgba(107,60,255,0.08)' }} />
            <Bar dataKey="importance" fill="#6B3CFF" stroke="#1B1340" strokeWidth={1.5} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>Shares of predictive importance (they sum to 1). This shows association, not cause.</div>
      </Card>
    </>
  )
}

function Recommendations({ items, loading }) {
  return (
    <>
      <SectionLabel tone="accent">Recommendations</SectionLabel>
      {loading && <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--ink-faint)', padding: 10 }}><Spinner size={16} /> Reading the results…</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(items || []).map((r, i) => (
          <Card key={i} style={{ padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, background: PALETTE[i % 8], border: '2px solid var(--line)', display: 'grid', placeItems: 'center', fontWeight: 800, color: i % 8 === 7 ? '#fff' : 'var(--ink)', fontSize: 13 }}>{i + 1}</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, paddingTop: 2 }}>{r}</div>
          </Card>
        ))}
      </div>
    </>
  )
}
