// ============================================================================
// APPEND these to the end of your existing lib/types.ts
// (Do not replace the file — just add this block below what's already there.)
// ============================================================================

export type NotificationType = 'new_activity' | 'activity_updated' | 'activity_disputed' | 'dispute_resolved'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  activity_id: string | null
  message: string
  is_read: boolean
  created_at: string
}

export interface AdminOverrideLog {
  id: string
  activity_id: string
  resolved_by: string
  previous_status: string
  new_status: string
  rationale: string
  created_at: string
}

export interface GrowthNote {
  id: string
  mentee_id: string
  mt_id: string
  note: string
  created_at: string
}

export interface SessionTemplate {
  id: string
  label: string
  activity_type: ActivityType
  notes_template: string
  description: string
}
