'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const ROLE_REDIRECTS: Record<string, string> = {
  master_teacher: '/dashboard/mt',
  mentee: '/dashboard/mentee',
  principal: '/dashboard/principal',
  assistant_principal: '/dashboard/principal',
  head_teacher: '/dashboard/head_teacher',
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    checkAccess()
  }, [])

  async function checkAccess() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('users')
      .select('role, must_change_password')
      .eq('id', user.id)
      .single()

    if (!prof) { router.push('/login'); return }

    // If they don't actually need to change it, don't let them
    // linger on this page — send them to their dashboard.
    if (!prof.must_change_password) {
      router.push(ROLE_REDIRECTS[prof.role] || '/login')
      return
    }

    setRole(prof.role)
  }

  async function handleSubmit() {
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (newPassword === 'Sanhs2026!') {
      setError('Please choose a different password from the default one.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      setError('Could not confirm your session after password change. Please log in again.')
      setLoading(false)
      return
    }

    const clearRes = await fetch('/api/auth/complete-password-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })
    const clearData = await clearRes.json()

    if (!clearRes.ok || !clearData.success) {
      setError(`Password was changed, but the flag update failed: ${JSON.stringify(clearData)}. Please contact your ICT coordinator.`)
      setLoading(false)
      return
    }

    setLoading(false)
    router.push(ROLE_REDIRECTS[role || ''] || '/login')
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      background: 'linear-gradient(135deg, #0a1e46, #1a2f6d)',
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.10)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(16px)',
        padding: '2.5rem',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          Set a New Password
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(200,215,255,0.75)', marginBottom: '24px', lineHeight: 1.5 }}>
          For security, you must set your own password before continuing.
        </p>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: 'rgba(200,220,255,0.8)', display: 'block', marginBottom: '6px' }}>
            NEW PASSWORD
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={{
              width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '14px',
              color: '#fff', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', color: 'rgba(200,220,255,0.8)', display: 'block', marginBottom: '6px' }}>
            CONFIRM PASSWORD
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '14px',
              color: '#fff', boxSizing: 'border-box', outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{
            backgroundColor: 'rgba(220, 50, 50, 0.15)', border: '1px solid rgba(255,100,100,0.4)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#ffaaaa', marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '11px',
            background: loading ? 'rgba(100,130,200,0.5)' : 'linear-gradient(135deg, #1a56db, #6d28d9)',
            color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Saving...' : 'Save & Continue →'}
        </button>
      </div>
    </main>
  )
}
