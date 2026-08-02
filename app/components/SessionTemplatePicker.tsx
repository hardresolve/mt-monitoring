'use client'

import { SESSION_TEMPLATES } from '@/lib/sessionTemplates'
import { ActivityType } from '@/lib/types'

interface Props {
  onPick: (activity_type: ActivityType, notes: string) => void
  selectedId?: string | null
}

// Drop this above the "Log Activity" form fields in app/dashboard/mt/page.tsx.
// Clicking a template calls onPick with the activity type + starter notes text,
// which the parent then sets into its form state.
export default function SessionTemplatePicker({ onPick, selectedId }: Props) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '8px' }}>
        QUICK FILL FROM TEMPLATE <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
      </label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {SESSION_TEMPLATES.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.activity_type, t.notes_template)}
            title={t.description}
            style={{
              padding: '7px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: selectedId === t.id ? '1px solid #1a56db' : '1px solid #e5e7eb',
              backgroundColor: selectedId === t.id ? '#eff6ff' : '#f9fafb',
              color: selectedId === t.id ? '#1a56db' : '#4b5563'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
