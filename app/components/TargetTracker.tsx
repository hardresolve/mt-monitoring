'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, ActivityType, Term, ACTIVITY_LABELS } from '@/lib/types'

// Fallback if activity_targets table has no rows yet for a given term/year
// (keeps the dashboard working even before the migration is run).
const FALLBACK_TARGETS: Record<string, number> = {
  classroom_observation: 5,
  mentoring_coaching: 5,
  lac_session: 1,
}

interface Props {
  activities: Activity[]   // already filtered to the relevant MT/mentee + term
  term: Term
  schoolYear: string
}

export default function TargetTracker({ activities, term, schoolYear }: Props) {
  const [targets, setTargets] = useState<Record<string, number>>(FALLBACK_TARGETS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTargets()
  }, [term, schoolYear])

  async function loadTargets() {
    const { data } = await supabase
      .from('activity_targets')
      .select('*')
      .eq('term', term)
      .eq('school_year', schoolYear)

    if (data && data.length > 0) {
      const map: Record<string, number> = {}
      data.forEach(t => { map[t.activity_type] = t.required_count })
      setTargets(map)
    } else {
      setTargets(FALLBACK_TARGETS)
    }
    setLoading(false)
  }

  function getCount(type: string) {
    return activities.filter(a => a.activity_type === type).length
  }
  function getVerifiedCount(type: string) {
    return activities.filter(a => a.activity_type === type && a.status === 'verified').length
  }

  if (loading) return null

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Object.keys(targets).length}, 1fr)`,
      gap: '14px',
      marginBottom: '24px'
    }}>
      {Object.entries(targets).map(([type, target]) => {
        const logged = getCount(type)
        const verified = getVerifiedCount(type)
        const pct = Math.min(Math.round((logged / target) * 100), 100)
        const color = pct >= 100 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626'
        const trackColor = pct >= 100 ? '#6ee7b7' : pct >= 50 ? '#fde68a' : '#fca5a5'
        return (
          <div key={type} style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderLeft: `4px solid ${trackColor}`,
            borderRadius: '12px',
            padding: '1.1rem 1.25rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px', fontWeight: 500 }}>
              {ACTIVITY_LABELS[type as ActivityType] || type}
            </p>
            <p style={{ fontSize: '26px', fontWeight: 700, color, marginBottom: '2px', lineHeight: 1 }}>
              {logged}
              <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}> / {target}</span>
            </p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '10px' }}>
              {verified} verified · {logged - verified} pending/disputed
            </p>
            <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, backgroundColor: trackColor,
                borderRadius: '99px', transition: 'width 0.4s ease'
              }} />
            </div>
            <p style={{ fontSize: '11px', color, marginTop: '4px', fontWeight: 600 }}>{pct}% complete</p>
          </div>
        )
      })}
    </div>
  )
}
