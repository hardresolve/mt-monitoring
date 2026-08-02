'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Activity, ACTIVITY_LABELS } from '@/lib/types'

interface Props {
  activity: Activity
  menteeName: string
  onClose: () => void
  onResolved: (updated: Activity) => void
}

// Drop into the principal dashboard: render this when a principal clicks
// "Resolve" on a disputed activity row.
//   {resolvingActivity && (
//     <AdminOverrideModal
//       activity={resolvingActivity}
//       menteeName={getUserName(resolvingActivity.mentee_id)}
//       onClose={() => setResolvingActivity(null)}
//       onResolved={(updated) => {
//         setAllActivities(prev => prev.map(a => a.id === updated.id ? updated : a))
//         setResolvingActivity(null)
//       }}
//     />
//   )}
export default function AdminOverrideModal({ activity, menteeName, onClose, onResolved }: Props) {
  const [decision, setDecision] = useState<'verified' | 'pending'>('verified')
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleResolve() {
    setError('')
    if (!rationale.trim()) {
      setError('Please provide a rationale — this is logged for accountability.')
      return
    }
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitting(false); return }

    const { data: updated, error: updateError } = await supabase
      .from('activities')
      .update({ status: decision, dispute_reason: null })
      .eq('id', activity.id)
      .select()
      .single()

    if (updateError || !updated) {
      setError('Failed to update the activity. Please try again.')
      setSubmitting(false)
      return
    }

    const { error: logError } = await supabase.from('admin_override_log').insert({
      activity_id: activity.id,
      resolved_by: user.id,
      previous_status: 'disputed',
      new_status: decision,
      rationale: rationale.trim(),
    })

    if (logError) {
      // Activity was already updated; still surface this so it isn't silently lost.
      setError('Activity resolved, but the accountability log entry failed to save.')
    }

    setSubmitting(false)
    onResolved(updated)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(10,20,50,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 50
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem',
        width: '100%', maxWidth: '480px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
      }}>
        <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Resolve Dispute</h2>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
            {ACTIVITY_LABELS[activity.activity_type]} · {menteeName}
          </p>
        </div>

        {activity.dispute_reason && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
            <p style={{ fontSize: '11px', color: '#991b1b', fontWeight: 600, marginBottom: '2px' }}>MENTEE'S DISPUTE REASON</p>
            <p style={{ fontSize: '12.5px', color: '#7f1d1d' }}>{activity.dispute_reason}</p>
          </div>
        )}

        <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '8px' }}>DECISION</label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          <button
            onClick={() => setDecision('verified')}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: decision === 'verified' ? '2px solid #059669' : '1px solid #e5e7eb',
              backgroundColor: decision === 'verified' ? '#ecfdf5' : 'white',
              color: decision === 'verified' ? '#059669' : '#6b7280'
            }}
          >
            ✓ Uphold as Verified
          </button>
          <button
            onClick={() => setDecision('pending')}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: decision === 'pending' ? '2px solid #d97706' : '1px solid #e5e7eb',
              backgroundColor: decision === 'pending' ? '#fffbeb' : 'white',
              color: decision === 'pending' ? '#d97706' : '#6b7280'
            }}
          >
            ↩ Return to Pending
          </button>
        </div>

        <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>
          RATIONALE <span style={{ color: '#9ca3af', fontWeight: 400 }}>(required — logged with your name & timestamp)</span>
        </label>
        <textarea
          value={rationale}
          onChange={e => setRationale(e.target.value)}
          rows={3}
          placeholder="Explain the basis for this decision..."
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', outline: 'none', marginBottom: '14px' }}
        />

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#991b1b', marginBottom: '12px', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={submitting}
            style={{
              padding: '10px 20px', background: submitting ? 'rgba(100,130,200,0.4)' : 'linear-gradient(135deg, #1a56db, #6d28d9)',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? 'Resolving...' : 'Resolve & Log'}
          </button>
        </div>
      </div>
    </div>
  )
}
