'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  UserProfile,
  Activity,
  ACTIVITY_LABELS,
  TERM_LABELS,
  Term
} from '@/lib/types'
import LogoutButton from '@/app/components/LogoutButton'
import Image from 'next/image'

export default function MenteeDashboard() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [mtProfile, setMtProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterTerm, setFilterTerm] = useState<Term>('term1')
  const [disputeActivityId, setDisputeActivityId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null)
  const [liveNotice, setLiveNotice] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    loadData()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  useEffect(() => {
    if (!liveNotice) return
    const t = setTimeout(() => setLiveNotice(null), 6000)
    return () => clearTimeout(t)
  }, [liveNotice])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!prof || prof.role !== 'mentee') {
      router.push('/login')
      return
    }

    setProfile(prof)

    if (prof.assigned_mt_id) {
      const { data: mt } = await supabase
        .from('users')
        .select('*')
        .eq('id', prof.assigned_mt_id)
        .single()
      setMtProfile(mt)
    }

    const { data: acts } = await supabase
      .from('activities')
      .select('*')
      .eq('mentee_id', user.id)
      .order('date_conducted', { ascending: false })

    setActivities(acts || [])
    setLoading(false)

    // Live sync: reflect edits/deletes the MT makes to this mentee's
    // logs immediately, without requiring a page refresh.
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const channel = supabase
      .channel(`mentee-activities-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activities', filter: `mentee_id=eq.${user.id}` },
        (payload) => {
          setActivities(prev => [payload.new as Activity, ...prev])
          setLiveNotice('A new session was logged by your Master Teacher.')
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'activities', filter: `mentee_id=eq.${user.id}` },
        (payload) => {
          setActivities(prev => prev.map(a => a.id === (payload.new as Activity).id ? (payload.new as Activity) : a))
          setLiveNotice('A logged session was updated by your Master Teacher — please review it again.')
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'activities', filter: `mentee_id=eq.${user.id}` },
        (payload) => {
          setActivities(prev => prev.filter(a => a.id !== (payload.old as Activity).id))
          setLiveNotice('A logged session was removed by your Master Teacher.')
        }
      )
      .subscribe()

    channelRef.current = channel
  }

  async function handleConfirm(activity: Activity) {
    setActionMsg(null)

    const { error: updateError } = await supabase
      .from('activities')
      .update({ status: 'verified' })
      .eq('id', activity.id)

    if (updateError) {
      setActionMsg({ id: activity.id, msg: 'Failed to confirm. Please try again.', type: 'error' })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('confirmations').insert({
        activity_id: activity.id,
        mentee_id: user.id,
        confirmed: true,
        reason: null,
      })
    }

    setActionMsg({ id: activity.id, msg: 'Session confirmed. Thank you!', type: 'success' })
    setActivities(prev =>
      prev.map(a => a.id === activity.id ? { ...a, status: 'verified' } : a)
    )
  }

  async function handleDispute(activity: Activity) {
    setActionMsg(null)

    if (!disputeReason.trim()) {
      setActionMsg({ id: activity.id, msg: 'Please enter a reason before disputing.', type: 'error' })
      return
    }

    const { error: updateError } = await supabase
      .from('activities')
      .update({ status: 'disputed', dispute_reason: disputeReason.trim() })
      .eq('id', activity.id)

    if (updateError) {
      setActionMsg({ id: activity.id, msg: 'Failed to dispute. Please try again.', type: 'error' })
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('confirmations').insert({
        activity_id: activity.id,
        mentee_id: user.id,
        confirmed: false,
        reason: disputeReason.trim(),
      })
    }

    setActionMsg({ id: activity.id, msg: 'Session disputed. Your principal has been notified.', type: 'error' })
    setActivities(prev =>
      prev.map(a => a.id === activity.id ? { ...a, status: 'disputed', dispute_reason: disputeReason.trim() } : a)
    )
    setDisputeActivityId(null)
    setDisputeReason('')
  }

  const filteredActivities = activities.filter(a => a.term === filterTerm)
  const pendingCount = activities.filter(a => a.status === 'pending').length
  const verifiedCount = activities.filter(a => a.status === 'verified').length
  const disputedCount = activities.filter(a => a.status === 'disputed').length

  const statusColor: Record<string, string> = {
    pending: '#f59e0b',
    verified: '#10b981',
    disputed: '#ef4444',
  }

  const statusBg: Record<string, string> = {
    pending: '#fffbeb',
    verified: '#ecfdf5',
    disputed: '#fef2f2',
  }

  if (loading) {
    return (
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid rgba(255,255,255,0.15)',
            borderTop: '3px solid #4d94ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: 'rgba(200,220,255,0.6)', fontSize: '13px' }}>Loading your dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    )
  }

  return (
    <main style={{
      fontFamily: 'sans-serif',
      backgroundColor: '#f0f4ff',
      minHeight: '100vh'
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1e46 0%, #1a1040 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0.85rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image
            src="/school.webp"
            alt="School Logo"
            width={38}
            height={38}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }}
          />
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(180,210,255,0.7)', marginBottom: '1px' }}>
              Sta. Ana National High School
            </p>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
              MT Monitoring System
              <span style={{
                marginLeft: '10px',
                fontSize: '11px',
                fontWeight: 500,
                background: 'rgba(99,102,241,0.35)',
                color: '#c4b5fd',
                padding: '2px 10px',
                borderRadius: '20px',
                verticalAlign: 'middle'
              }}>Mentee</span>
            </h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{profile?.full_name}</p>
            {mtProfile && (
              <p style={{ fontSize: '11px', color: 'rgba(180,210,255,0.65)' }}>
                MT: {mtProfile.full_name}
              </p>
            )}
          </div>
          <LogoutButton />
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: '960px', margin: '0 auto' }}>

        {/* Live update banner */}
        {liveNotice && (
          <div style={{
            backgroundColor: '#eff6ff',
            border: '1px solid #93c5fd',
            borderRadius: '10px',
            padding: '10px 16px',
            marginBottom: '18px',
            fontSize: '13px',
            color: '#1e40af',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🔔 {liveNotice}</span>
            <button
              onClick={() => setLiveNotice(null)}
              style={{ background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px',
          marginBottom: '24px'
        }}>
          {[
            { label: 'Awaiting Confirmation', count: pendingCount, color: '#d97706', bg: 'white', accent: '#fde68a', icon: '⏳' },
            { label: 'Confirmed by You', count: verifiedCount, color: '#059669', bg: 'white', accent: '#6ee7b7', icon: '✅' },
            { label: 'Disputed by You', count: disputedCount, color: '#dc2626', bg: 'white', accent: '#fca5a5', icon: '⚠️' },
          ].map(card => (
            <div key={card.label} style={{
              backgroundColor: card.bg,
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '1.1rem 1.25rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              borderLeft: `4px solid ${card.accent}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{card.label}</p>
                  <p style={{ fontSize: '32px', fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.count}</p>
                </div>
                <span style={{ fontSize: '22px', opacity: 0.6 }}>{card.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Pending banner */}
        {pendingCount > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            You have <strong>{pendingCount} session{pendingCount > 1 ? 's' : ''}</strong> waiting for your confirmation. Please review and respond below.
          </div>
        )}

        {/* Activity list */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #f3f4f6'
          }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
                Sessions Logged About You
              </h2>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                {filteredActivities.length} session{filteredActivities.length !== 1 ? 's' : ''} this term
              </p>
            </div>
            <select
              value={filterTerm}
              onChange={e => setFilterTerm(e.target.value as Term)}
              style={{
                padding: '7px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
                backgroundColor: '#f9fafb',
                color: '#374151',
                fontWeight: 500,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {Object.entries(TERM_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {filteredActivities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📭</p>
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>No sessions logged for this term yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredActivities.map(act => (
                <div key={act.id} style={{
                  border: `1px solid ${act.status === 'pending' ? '#fde68a' : '#f3f4f6'}`,
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  backgroundColor: act.status === 'pending' ? '#fffdf5' : '#fafafa',
                  transition: 'box-shadow 0.15s'
                }}>

                  {/* Activity header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '3px' }}>
                        {ACTIVITY_LABELS[act.activity_type]}
                      </p>
                      <p style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {new Date(act.date_conducted).toLocaleDateString('en-PH', {
                          month: 'long', day: 'numeric', year: 'numeric'
                        })} · {TERM_LABELS[act.term]}
                      </p>
                    </div>
                    <span style={{
                      backgroundColor: statusBg[act.status],
                      color: statusColor[act.status],
                      padding: '3px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      border: `1px solid ${statusColor[act.status]}33`
                    }}>
                      {act.status.charAt(0).toUpperCase() + act.status.slice(1)}
                    </span>
                  </div>

                  {/* Notes */}
                  {act.notes && (
                    <p style={{
                      fontSize: '13px',
                      color: '#4b5563',
                      backgroundColor: '#f9fafb',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      borderLeft: '3px solid #e5e7eb'
                    }}>
                      {act.notes}
                    </p>
                  )}

                  {/* Dispute reason */}
                  {act.status === 'disputed' && act.dispute_reason && (
                    <p style={{
                      fontSize: '12px',
                      color: '#991b1b',
                      backgroundColor: '#fef2f2',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      borderLeft: '3px solid #fca5a5'
                    }}>
                      Your dispute: {act.dispute_reason}
                    </p>
                  )}

                  {/* Action message */}
                  {actionMsg && actionMsg.id === act.id && (
                    <div style={{
                      fontSize: '12px',
                      color: actionMsg.type === 'success' ? '#065f46' : '#991b1b',
                      backgroundColor: actionMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      fontWeight: 500
                    }}>
                      {actionMsg.msg}
                    </div>
                  )}

                  {/* Confirm / Dispute buttons */}
                  {act.status === 'pending' && (
                    <div>
                      {disputeActivityId === act.id ? (
                        <div>
                          <textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            rows={2}
                            placeholder="Explain why you are disputing this session..."
                            style={{
                              width: '100%',
                              padding: '8px 10px',
                              border: '1px solid #fca5a5',
                              borderRadius: '8px',
                              fontSize: '13px',
                              marginBottom: '8px',
                              boxSizing: 'border-box',
                              resize: 'vertical',
                              outline: 'none',
                              backgroundColor: '#fff5f5'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => handleDispute(act)}
                              style={{
                                padding: '7px 18px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Submit Dispute
                            </button>
                            <button
                              onClick={() => { setDisputeActivityId(null); setDisputeReason('') }}
                              style={{
                                padding: '7px 18px',
                                backgroundColor: 'transparent',
                                color: '#6b7280',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                fontSize: '13px',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleConfirm(act)}
                            style={{
                              padding: '7px 18px',
                              background: 'linear-gradient(135deg, #059669, #047857)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(5,150,105,0.3)'
                            }}
                          >
                            ✓ Confirm Session
                          </button>
                          <button
                            onClick={() => { setDisputeActivityId(act.id); setDisputeReason('') }}
                            style={{
                              padding: '7px 18px',
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              border: '1px solid #fca5a5',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ⚠ Dispute
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
