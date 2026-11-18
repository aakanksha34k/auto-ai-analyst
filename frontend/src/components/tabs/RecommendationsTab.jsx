import React from 'react'
import { Card, SectionLabel, EmptyState, Spinner } from '../Primitives'
import { PALETTE } from '../ChartRenderer'

export default function RecommendationsTab({ recommendations, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, gap: 12 }}>
        <Spinner size={24} />
        <div style={{ color: 'var(--ink-soft)', fontSize: 14, fontWeight: 600 }}>Generating recommendations…</div>
      </div>
    )
  }

  if (!recommendations || recommendations.length === 0) {
    return <Card><EmptyState title="No recommendations yet" description="Run a model in the ML models tab for more targeted recommendations." /></Card>
  }

  return (
    <div>
      <SectionLabel>Recommendations</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recommendations.map((r, i) => (
          <Card key={i} style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: PALETTE[i % 8], border: '2px solid var(--line)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, color: i % 8 === 7 ? '#fff' : 'var(--ink)' }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, paddingTop: 4 }}>{r}</div>
          </Card>
        ))}
      </div>
    </div>
  )
}
