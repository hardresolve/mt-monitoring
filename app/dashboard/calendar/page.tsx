'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { UserProfile, Activity } from '@/lib/types'
import LogoutButton from '@/app/components/LogoutButton'
import NotificationBell from '@/app/components/NotificationBell'
import CalendarView from '@/app/components/CalendarView'

function dashboardPathForRole(role?: string) {
  if (role === 'master_teacher') return '/dashboard/mt'
  if (role === 'mentee') return '/dashboard/mentee'
  if (role === 'principal' || role === 'assistant_principal') return '/dashboard/principal'
  if (role === 'head_teacher') return '/dashboard/head_teacher'
  return '/login'
}

// Accessible to any logged-in role at /dashboard/calendar. Link to it from
// each dashboard's header, e.g.:
//   <a href="/dashboard/calendar" style={{...}}>📅 Calendar</a>
export default function CalendarPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase.from('users').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/login'); return }
    setProfile(prof)

    const { data: users } = await supabase.from('users').select('*')
    setAllUsers(users || [])

    let query = supabase.from('activities').select('*')

    if (prof.role === 'master_teacher') {
      query = query.eq('mt_id', user.id)
    } else if (prof.role === 'mentee') {
      query = query.eq('mentee_id', user.id)
    }
    // principal / assistant_principal / head_teacher: see everything (no filter)

    const { data: acts } = await query.order('date_conducted', { ascending: false })
    setActivities(acts || [])
    setLoading(false)
  }

  function getUserName(id: string) {
    return allUsers.find(u => u.id === id)?.full_name || '—'
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)' }}>
        <p style={{ color: 'rgba(200,220,255,0.6)', fontSize: '13px' }}>Loading calendar...</p>
      </main>
    )
  }

  const showMenteeNames = profile?.role === 'master_teacher' || profile?.role === 'principal' || profile?.role === 'assistant_principal' || profile?.role === 'head_teacher'
  const showMtNames = profile?.role === 'mentee' || profile?.role === 'principal' || profile?.role === 'assistant_principal' || profile?.role === 'head_teacher'

  return (
    <main style={{ fontFamily: 'sans-serif', backgroundColor: '#f0f4ff', minHeight: '100vh' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)',
        padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)'
      }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.7)', marginBottom: '1px' }}>
            Sta. Ana National High School
          </p>
          <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>MT Activity Calendar</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a href={dashboardPathForRole(profile?.role)} style={{ fontSize: '13px', color: 'rgba(200,220,255,0.85)', textDecoration: 'none' }}>← Back to Dashboard</a>
          <NotificationBell />
          <LogoutButton />
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <CalendarView
            activities={activities}
            getMenteeName={showMenteeNames ? getUserName : undefined}
            getMtName={showMtNames ? getUserName : undefined}
          />
        </div>
      </div>
    </main>
  )
}
