'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppNotification } from '@/lib/types'

// Drop this next to <LogoutButton /> in any dashboard header:
//   <NotificationBell />
// It reads the logged-in user itself, so no props are required.
export default function NotificationBell() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    load()
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    setNotifications(data || [])
    setLoading(false)

    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications(prev => [payload.new as AppNotification, ...prev])
      )
      .subscribe()
    channelRef.current = channel
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function markAllRead() {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  async function handleNotifClick(n: AppNotification) {
    if (!n.is_read) {
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    setOpen(false)
  }

  function timeAgo(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  const typeIcon: Record<string, string> = {
    new_activity: '📝',
    activity_updated: '✏️',
    activity_disputed: '⚠️',
    dispute_resolved: '✅',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) markAllRead() }}
        style={{
          position: 'relative',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.2)',
          backgroundColor: 'rgba(255,255,255,0.08)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px'
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            backgroundColor: '#ef4444',
            color: 'white',
            fontSize: '10px',
            fontWeight: 700,
            borderRadius: '999px',
            minWidth: '17px',
            height: '17px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            border: '2px solid #0a1e46'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '46px',
          right: 0,
          width: '340px',
          maxHeight: '420px',
          overflowY: 'auto',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          border: '1px solid #e5e7eb',
          zIndex: 100
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f3f4f6',
            fontSize: '13px',
            fontWeight: 700,
            color: '#111827'
          }}>
            Notifications
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
              No notifications yet.
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotifClick(n)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f9fafb',
                  cursor: 'pointer',
                  backgroundColor: n.is_read ? 'white' : '#eff6ff',
                  display: 'flex',
                  gap: '10px'
                }}
              >
                <span style={{ fontSize: '15px' }}>{typeIcon[n.type] || '🔔'}</span>
                <div>
                  <p style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.4, marginBottom: '3px' }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
