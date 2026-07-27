'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// One-time tool to recreate the auth accounts for the 34 legacy users
// after their broken auth.users rows were removed via SQL. Safe to
// delete this component and its usage in all-users/page.tsx once
// you've run it successfully.
export default function AdminRepairLegacyAccounts() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ repaired: number; failed: any[] } | null>(null)

  async function handleRepair() {
    if (!confirm('This recreates auth accounts for the 34 legacy users. Only run this after deleting their broken auth.users rows via SQL. Continue?')) return

    setRunning(true)
    setResult(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setRunning(false); return }

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ mode: 'repair_batch' }),
    })

    const data = await res.json()
    setRunning(false)
    setResult({ repaired: data.repaired || 0, failed: data.failed || [] })
  }

  return (
    <div style={{
      background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px',
      padding: '14px 16px', marginBottom: '20px', fontSize: '13px',
    }}>
      <p style={{ margin: '0 0 8px 0', color: '#92400e', fontWeight: 600 }}>
        One-time: Repair Legacy Accounts
      </p>
      <p style={{ margin: '0 0 10px 0', color: '#78350f' }}>
        Run this ONLY after deleting the 34 broken auth.users rows via SQL. Everyone gets the default password
        <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: '4px' }}> Sanhs2026! </code>
        and will be asked to change it on next login.
      </p>
      <button
        onClick={handleRepair}
        disabled={running}
        style={{
          padding: '8px 14px', borderRadius: '8px', border: 'none',
          background: running ? '#fbbf24' : '#d97706', color: '#fff',
          fontSize: '13px', fontWeight: 600, cursor: running ? 'default' : 'pointer',
        }}
      >
        {running ? 'Repairing…' : 'Run Repair Now'}
      </button>

      {result && (
        <div style={{ marginTop: '10px', color: '#78350f' }}>
          <p style={{ margin: 0 }}>Repaired: {result.repaired} / 34</p>
          {result.failed.length > 0 && (
            <ul style={{ marginTop: '6px' }}>
              {result.failed.map((f: any) => (
                <li key={f.email}>{f.email}: {f.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}