'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface MasterTeacher {
  id: string
  full_name: string
}

interface AdminAssignMentorProps {
  menteeId: string
  currentMentorId: string | null | undefined
  currentMentorName: string | null
  onUpdated: () => void
}

export default function AdminAssignMentor({
  menteeId,
  currentMentorId,
  currentMentorName,
  onUpdated,
}: AdminAssignMentorProps) {
  const [open, setOpen] = useState(false)
  const [mentors, setMentors] = useState<MasterTeacher[]>([])
  const [loadingMentors, setLoadingMentors] = useState(false)
  const [saving, setSaving] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && mentors.length === 0) {
      loadMentors()
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadMentors() {
    setLoadingMentors(true)
    const { data } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'master_teacher')
      .order('full_name')
    setMentors(data || [])
    setLoadingMentors(false)
  }

  async function assignMentor(mentorId: string | null) {
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({ assigned_mt_id: mentorId })
      .eq('id', menteeId)
    setSaving(false)
    setOpen(false)

    if (error) {
      alert('Failed to update mentor: ' + error.message)
      return
    }
    onUpdated()
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 12px', borderRadius: '6px',
          border: '1px solid #d1d5db',
          background: currentMentorId ? '#eff6ff' : '#fef3c7',
          color: currentMentorId ? '#1a56db' : '#92400e',
          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        {saving
          ? 'Saving...'
          : currentMentorName
            ? `Mentor: ${currentMentorName}`
            : 'No Mentor Assigned'}
        <span style={{ fontSize: '10px' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
          background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '220px',
          maxHeight: '260px', overflowY: 'auto',
        }}>
          <div style={{
            padding: '6px 10px', fontSize: '11px', color: '#9ca3af',
            borderBottom: '1px solid #f3f4f6',
          }}>
            Assign Master Teacher
          </div>

          <button
            onClick={() => assignMentor(null)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
              fontSize: '12px', color: '#6b7280',
              background: !currentMentorId ? '#f3f4f6' : '#fff',
              border: 'none', cursor: 'pointer',
            }}
          >
            — None —
          </button>

          {loadingMentors && (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af' }}>
              Loading mentors...
            </div>
          )}

          {mentors.map(m => (
            <button
              key={m.id}
              onClick={() => assignMentor(m.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                fontSize: '12px', color: '#111827',
                background: currentMentorId === m.id ? '#eff6ff' : '#fff',
                border: 'none', cursor: 'pointer',
              }}
            >
              {m.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
