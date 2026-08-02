'use client'

import { useMemo, useState, CSSProperties } from 'react'
import { Activity, ACTIVITY_LABELS } from '@/lib/types'

interface Props {
  activities: Activity[]
  getMenteeName?: (id: string) => string
  getMtName?: (id: string) => string
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const statusColor: Record<string, string> = {
  pending: '#f59e0b',
  verified: '#10b981',
  disputed: '#ef4444',
}

export default function CalendarView({ activities, getMenteeName, getMtName }: Props) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const activitiesByDay = useMemo(() => {
    const map: Record<string, Activity[]> = {}
    activities.forEach(a => {
      const key = a.date_conducted.slice(0, 10) // YYYY-MM-DD
      if (!map[key]) map[key] = []
      map[key].push(a)
    })
    return map
  }, [activities])

  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const startWeekday = firstOfMonth.getDay() // 0 = Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function dayKey(d: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  function goPrev() {
    setSelectedDay(null)
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1)
  }
  function goNext() {
    setSelectedDay(null)
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1)
  }
  function goToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDay(null)
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()
  const selectedActivities = selectedDay ? (activitiesByDay[selectedDay] || []) : []

  return (
    <div>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={goPrev} style={navBtnStyle}>‹ Prev</button>
          <button onClick={goToday} style={{ ...navBtnStyle, fontWeight: isCurrentMonth ? 700 : 600, color: isCurrentMonth ? '#1a56db' : '#4b5563' }}>Today</button>
          <button onClick={goNext} style={navBtnStyle}>Next ›</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '11px', color: '#6b7280' }}>
        {Object.entries(statusColor).map(([status, color]) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textAlign: 'center', padding: '4px 0' }}>{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`empty-${i}`} />
          const key = dayKey(d)
          const dayActs = activitiesByDay[key] || []
          const isToday = key === today.toISOString().slice(0, 10)
          const isSelected = key === selectedDay
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              style={{
                minHeight: '64px',
                borderRadius: '8px',
                border: isSelected ? '2px solid #1a56db' : isToday ? '1px solid #93c5fd' : '1px solid #f3f4f6',
                backgroundColor: isSelected ? '#eff6ff' : dayActs.length > 0 ? '#fafbff' : 'white',
                padding: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: isToday ? 700 : 500, color: isToday ? '#1a56db' : '#374151' }}>{d}</span>
              {dayActs.slice(0, 2).map(a => (
                <span key={a.id} style={{
                  fontSize: '9px', color: 'white', backgroundColor: statusColor[a.status],
                  borderRadius: '4px', padding: '1px 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {ACTIVITY_LABELS[a.activity_type].split(' ')[0]}
                </span>
              ))}
              {dayActs.length > 2 && (
                <span style={{ fontSize: '9px', color: '#9ca3af' }}>+{dayActs.length - 2} more</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div style={{
          marginTop: '16px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: '10px', padding: '14px 16px'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '10px' }}>
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          {selectedActivities.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>No activities on this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedActivities.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                  <span style={{ color: '#374151' }}>
                    {ACTIVITY_LABELS[a.activity_type]}
                    {getMenteeName && <span style={{ color: '#9ca3af' }}> · {getMenteeName(a.mentee_id)}</span>}
                    {getMtName && <span style={{ color: '#9ca3af' }}> · {getMtName(a.mt_id)}</span>}
                  </span>
                  <span style={{
                    color: statusColor[a.status], fontWeight: 600, fontSize: '11px',
                    backgroundColor: `${statusColor[a.status]}1a`, padding: '2px 9px', borderRadius: '20px'
                  }}>
                    {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const navBtnStyle: CSSProperties = {
  padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
  backgroundColor: 'white', fontSize: '12px', fontWeight: 600, color: '#4b5563', cursor: 'pointer'
}
