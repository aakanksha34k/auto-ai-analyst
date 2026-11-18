import React, { useState } from 'react'
import { Badge, Button, Card, SectionLabel, Spinner } from '../Primitives'

const SECTIONS = ['Executive summary', 'Dataset overview', 'Data quality', 'Charts', 'Statistics', 'Correlations', 'Model performance', 'Recommendations']

export default function ReportTab({ mlConfig, mlResult, onGenerate, downloadUrl, generating }) {
  const [includeML, setIncludeML] = useState(true)
  const ran = mlConfig && mlResult && !mlResult.error
  const modelNote = !ran
    ? 'No model has been run yet, so the report will include an automatic clustering.'
    : `Using your last run: ${mlConfig.target ? `predict ${mlConfig.target}` : 'clustering'} with ${mlResult.best_model}${mlConfig.features ? ` on ${mlConfig.features.length} chosen columns` : ''}.`

  return (
    <div>
      <SectionLabel>PDF report</SectionLabel>
      <Card style={{ padding: '28px 30px', maxWidth: 640 }} tint="var(--sky-soft)">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Your analysis, on paper
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 16 }}>
          Built from the current state of your dataset, so any cleaning you applied is included.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
          {SECTIONS.map((s) => <Badge key={s} tone="accent">{s}</Badge>)}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer', fontSize: 14.5, fontWeight: 600 }}>
          <input type="checkbox" checked={includeML} onChange={(e) => setIncludeML(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
          Include the machine learning section
        </label>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 22, paddingLeft: 28, lineHeight: 1.5 }}>
          {includeML ? modelNote : 'The model sections will be left out.'}
          {includeML && <> Change the target, columns or model in the ML models tab.</>}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button variant="accent" onClick={() => onGenerate(includeML)} disabled={generating}>
            {generating ? <Spinner size={14} /> : 'Generate PDF report'}
          </Button>
          {downloadUrl && !generating && (
            <a href={downloadUrl} download style={{ textDecoration: 'none' }}>
              <Button variant="mint">Download report ↓</Button>
            </a>
          )}
        </div>
      </Card>
    </div>
  )
}
