'use client'

import { UserProfile, Term } from '@/lib/types'

// Same normalization used across the dashboards, so department grouping
// stays consistent (handles "AP" -> "Araling Panlipunan", "Values
// Education" -> "ESP", and strips trailing grade-level numbers).
const SUBJECT_ALIASES: Record<string, string> = {
  'ap': 'araling panlipunan',
  'values education': 'esp',
}

function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return ''
  const base = subject.replace(/\s*\d+\s*$/, '').trim().toLowerCase()
  return SUBJECT_ALIASES[base] || base
}

function displayLabel(subject: string | null | undefined): string {
  if (!subject) return 'Unassigned'
  const base = subject.replace(/\s*\d+\s*$/, '').trim()
  return base
    .split(' ')
    .map(w => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

interface DepartmentComplianceChartProps {
  /** ALL master teachers school-wide (not just one department) */
  masterTeachers: UserProfile[]
  getOverallStatus: (mtId: string, term: Term) => string
  filterTerm: Term
  /** Pass the viewer's own subject_area (head teachers) to highlight their row. Omit for principals. */
  ownDepartment?: string | null
  title?: string
}

export default function DepartmentComplianceChart({
  masterTeachers,
  getOverallStatus,
  filterTerm,
  ownDepartment,
  title = 'Department Compliance Comparison',
}: DepartmentComplianceChartProps) {
  const ownNormalized = ownDepartment ? normalizeSubject(ownDepartment) : null

  const groups = new Map<string, { label: string; total: number; complied: number }>()

  masterTeachers.forEach(mt => {
    const key = normalizeSubject(mt.subject_area) || '\u2014unassigned\u2014'
    const status = getOverallStatus(mt.id, filterTerm)
    const existing = groups.get(key)
    if (existing) {
      existing.total += 1
      if (status === 'on-track') existing.complied += 1
    } else {
      groups.set(key, {
        label: displayLabel(mt.subject_area),
        total: 1,
        complied: status === 'on-track' ? 1 : 0,
      })
    }
  })

  const rows = Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      label: g.label,
      total: g.total,
      complied: g.complied,
      pct: g.total > 0 ? Math.round((g.complied / g.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  if (rows.length === 0) return null

  return (
    <div style={{
      backgroundColor: 'white',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      marginBottom: '24px',
    }}>
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>
        Share of Master Teachers fully on track this term, by department
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rows.map(row => {
          const isOwn = ownNormalized !== null && row.key === ownNormalized
          const barColor = row.pct >= 100 ? '#059669' : row.pct >= 50 ? '#d97706' : '#dc2626'
          return (
            <div
              key={row.key}
              style={{
                padding: isOwn ? '8px 10px' : '0',
                borderRadius: '8px',
                background: isOwn ? '#eff6ff' : 'transparent',
                border: isOwn ? '1px solid #bfdbfe' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: isOwn ? 700 : 600, color: isOwn ? '#1a56db' : '#374151' }}>
                  {row.label}{isOwn ? ' (Your Department)' : ''}
                </span>
                <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>
                  {row.complied}/{row.total} on track &middot; {row.pct}%
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${row.pct}%`,
                  backgroundColor: barColor,
                  borderRadius: '99px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
