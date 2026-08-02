'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AdminOverrideLog, Activity, UserProfile, ACTIVITY_LABELS } from '@/lib/types'

interface Props {
  activities: Activity[]   // already-loaded activities list, used to label each log entry
  allUsers: UserProfile[]  // already-loaded users list, used to resolve names
}

// Drop anywhere in the principal dashboard (e.g. a collapsible section) to
// show the full history of dispute resolutions with timestamp + rationale.
export default function OverrideLogPanel({ activities, allUsers }: Props) {
  const [log, setLog] = useState<AdminOverrideLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('admin_override_log')
      .select('*')
      .order('created_at', { ascending: false })
    setLog(data || [])
    setLoading(false)
  }

  function getUserName(id: string) {
    return allUsers.find(u => u.id === id)?.full_name || '—'
  }
  function getActivity(id: string) {
    return activities.find(a => a.id === id)
  }

  if (loading) return null
  if (log.length === 0) {
    return <p style={{ fontSize: '12px', color: '#9ca3af' }}>No disputes have been resolved yet.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {log.map(entry => {
        const act = getActivity(entry.activity_id)
        return (
          <div key={entry.id} style={{ border: '1px solid #f3f4f6', borderRadius: '10px', padding: '12px 14px', backgroundColor: '#fafafa' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>
                {act ? ACTIVITY_LABELS[act.activity_type] : 'Activity'} · {act ? getUserName(act.mentee_id) : ''}
              </p>
              <span style={{
                fontSize: '11px', fontWeight: 600,
                color: entry.new_status === 'verified' ? '#059669' : '#d97706'
              }}>
                → {entry.new_status.charAt(0).toUpperCase() + entry.new_status.slice(1)}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#4b5563', marginBottom: '6px' }}>{entry.rationale}</p>
            <p style={{ fontSize: '10.5px', color: '#9ca3af' }}>
              Resolved by {getUserName(entry.resolved_by)} · {new Date(entry.created_at).toLocaleString('en-PH', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
              })}
            </p>
          </div>
        )
      })}
    </div>
  )
}
