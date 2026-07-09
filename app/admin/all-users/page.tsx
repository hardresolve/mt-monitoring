'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AdminUserActions from '@/app/components/AdminUserActions'
import type { UserProfile } from '@/lib/types'

const ROLE_LABELS: Record<string, string> = {
  principal: 'Principal',
  assistant_principal: 'Assistant Principal',
  head_teacher: 'Head Teacher',
  master_teacher: 'Master Teacher',
  mentee: 'Mentee',
}

const ROLE_ORDER = ['principal', 'assistant_principal', 'head_teacher', 'master_teacher', 'mentee']

export default function SuperAdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    checkAccessAndLoad()
  }, [])

  async function checkAccessAndLoad() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('users')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!prof?.is_super_admin) {
      router.push('/login')
      return
    }

    await loadUsers()
    setLoading(false)
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('full_name')
    setUsers(data || [])
  }

  const filtered = users.filter(u => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    return matchesRole && matchesSearch
  })

  const grouped = ROLE_ORDER.map(role => ({
    role,
    label: ROLE_LABELS[role],
    users: filtered.filter(u => u.role === role),
  })).filter(g => g.users.length > 0)

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
          Super Admin — All Accounts
        </h1>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
          Correct emails or reset passwords for any account in the system.
        </p>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            id="search-users"
            name="search-users"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #d1d5db', fontSize: '13px',
            }}
          />
          <select
            id="role-filter"
            name="role-filter"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '13px' }}
          >
            <option value="all">All Roles</option>
            {ROLE_ORDER.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>

        {grouped.map(group => (
          <div key={group.role} style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '13px', fontWeight: 700, color: '#1a56db',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              borderBottom: '2px solid #e5e7eb', paddingBottom: '6px', marginBottom: '10px',
            }}>
              {group.label} ({group.users.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {group.users.map(u => (
                <div key={u.id} style={{
                  background: '#fff', borderRadius: '10px', padding: '12px 16px',
                  border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{u.full_name}</span>
                      {u.subject_area && (
                        <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '8px' }}>{u.subject_area}</span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{u.email}</span>
                  </div>
                  <AdminUserActions
                    targetUserId={u.id}
                    currentEmail={u.email}
                    onUpdated={loadUsers}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>No accounts match your search/filter.</p>
        )}
      </div>
    </main>
  )
}