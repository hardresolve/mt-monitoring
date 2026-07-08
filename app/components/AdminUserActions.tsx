'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  targetUserId: string
  currentEmail: string
  onUpdated?: () => void
}

export default function AdminUserActions({ targetUserId, currentEmail, onUpdated }: Props) {
  const [editing, setEditing] = useState(false)
  const [emailInput, setEmailInput] = useState(currentEmail)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function callAdminApi(action: 'update_email' | 'reset_password', extra: Record<string, any> = {}) {
    setBusy(true)
    setMessage(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, targetUserId, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: JSON.stringify(data) })
      } else {
        setMessage({ type: 'success', text: data.message || 'Done.' })
        setEditing(false)
        onUpdated?.()
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Network error.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
              border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer',
            }}
          >
            Edit Email
          </button>
        ) : (
          <>
            <input
              id={`edit-email-${targetUserId}`}
              name={`edit-email-${targetUserId}`}
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              style={{
                fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
                border: '1px solid #d1d5db', minWidth: '180px',
              }}
            />
            <button
              disabled={busy}
              onClick={() => callAdminApi('update_email', { newEmail: emailInput })}
              style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: 'none',
                background: '#1a56db', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Save
            </button>
            <button
              disabled={busy}
              onClick={() => { setEditing(false); setEmailInput(currentEmail) }}
              style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </>
        )}

        <button
          disabled={busy}
          onClick={() => {
            if (confirm(`Reset password to the default (Sanhs2026!) for ${currentEmail}? They will be asked to set a new password on next login.`)) {
              callAdminApi('reset_password')
            }
          }}
          style={{
            fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
            border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          Reset Password
        </button>
      </div>

      {message && (
        <span style={{ color: message.type === 'success' ? '#16a34a' : '#dc2626', fontSize: '11px' }}>
          {message.text}
        </span>
      )}
    </div>
  )
}
