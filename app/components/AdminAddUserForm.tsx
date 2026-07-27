'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/types'

export default function AdminAddUserForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'master_teacher' | 'mentee'>('mentee')
  const [subjectArea, setSubjectArea] = useState('')
  const [assignedMtId, setAssignedMtId] = useState('')
  const [masterTeachers, setMasterTeachers] = useState<UserProfile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (open) loadMasterTeachers()
  }, [open])

  async function loadMasterTeachers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'master_teacher')
      .order('full_name')
    setMasterTeachers(data || [])
  }

  function resetForm() {
    setFullName('')
    setEmail('')
    setRole('mentee')
    setSubjectArea('')
    setAssignedMtId('')
    setMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage({ text: 'Not signed in.', ok: false })
      setSubmitting(false)
      return
    }

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        mode: 'new',
        full_name: fullName,
        email,
        role,
        subject_area: subjectArea,
        assigned_mt_id: role === 'mentee' ? assignedMtId : undefined,
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setMessage({ text: data.error || 'Failed to add user.', ok: false })
      return
    }

    setMessage({ text: data.message, ok: true })
    onCreated()
    setTimeout(() => {
      resetForm()
      setOpen(false)
    }, 1800)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 16px', borderRadius: '8px', border: 'none',
          background: '#1a56db', color: '#fff', fontSize: '13px', fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Add User
      </button>
    )
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '10px', padding: '16px',
      border: '1px solid #e5e7eb', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Add New User</h3>
        <button
          onClick={() => { resetForm(); setOpen(false) }}
          style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px' }}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          required
          placeholder="Full name"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          style={inputStyle}
        />
        <input
          required
          type="email"
          placeholder="Email (e.g. name001@deped.gov.ph)"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Subject area (e.g. English 8)"
          value={subjectArea}
          onChange={e => setSubjectArea(e.target.value)}
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="radio"
              checked={role === 'master_teacher'}
              onChange={() => setRole('master_teacher')}
            />
            Master Teacher
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="radio"
              checked={role === 'mentee'}
              onChange={() => setRole('mentee')}
            />
            Mentee
          </label>
        </div>

        {role === 'mentee' && (
          <select
            required
            value={assignedMtId}
            onChange={e => setAssignedMtId(e.target.value)}
            style={inputStyle}
          >
            <option value="">— Assign a Master Teacher —</option>
            {masterTeachers.map(mt => (
              <option key={mt.id} value={mt.id}>{mt.full_name}{mt.subject_area ? ` (${mt.subject_area})` : ''}</option>
            ))}
          </select>
        )}

        {message && (
          <p style={{ fontSize: '12px', color: message.ok ? '#15803d' : '#dc2626', margin: 0 }}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px', borderRadius: '8px', border: 'none',
            background: submitting ? '#93c5fd' : '#1a56db', color: '#fff',
            fontSize: '13px', fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Adding…' : 'Add User'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px',
}