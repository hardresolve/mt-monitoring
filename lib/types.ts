export type Role = 'master_teacher' | 'mentee' | 'principal' | 'assistant_principal' | 'head_teacher'

export type ActivityType =
  | 'classroom_observation'
  | 'mentoring_coaching'
  | 'lac_session'
  | 'in_house_training'
  | 'instructional_material_review'
  | 'curriculum_support'
  | 'assessment_guidance'
  | 'action_research'
  | 'documentation'
  | 'collaborative_planning'
  | 'performance_monitoring'
  | 'resource_management'

export type ActivityStatus = 'pending' | 'verified' | 'disputed'

export type Term = 'term1' | 'term2' | 'term3'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: Role
  subject_area: string | null
  assigned_mt_id: string | null
  created_at: string
  is_super_admin?: boolean
  must_change_password?: boolean
}

export interface Activity {
  id: string
  mt_id: string
  mentee_id: string
  activity_type: ActivityType
  date_conducted: string
  term: Term
  school_year: string
  notes: string | null
  file_url: string | null
  status: ActivityStatus
  dispute_reason: string | null
  created_at: string
}

export interface Confirmation {
  id: string
  activity_id: string
  mentee_id: string
  confirmed: boolean
  reason: string | null
  confirmed_at: string
}

export interface ActivityTarget {
  id: string
  activity_type: ActivityType
  required_count: number
  term: Term
  school_year: string
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  classroom_observation: 'Classroom Observation',
  mentoring_coaching: 'Mentoring & Coaching',
  lac_session: 'LAC Session',
  in_house_training: 'In-House Training',
  instructional_material_review: 'Instructional Material Review',
  curriculum_support: 'Curriculum Support',
  assessment_guidance: 'Assessment Guidance',
  action_research: 'Action Research',
  documentation: 'Documentation & Reporting',
  collaborative_planning: 'Collaborative Planning',
  performance_monitoring: 'Performance Monitoring',
  resource_management: 'Resource Management',
}

export const TERM_LABELS: Record<Term, string> = {
  term1: 'Term 1 (June–August 2026)',
  term2: 'Term 2 (September–November 2026)',
  term3: 'Term 3 (January–March 2027)',
}
