import { SessionTemplate } from './types'

// Pre-built templates for the most common session types. Selecting one in
// the "Log Activity" form pre-fills activity type + a notes starting point,
// so MTs fill in fewer fields. Purely client-side — no schema change needed.
export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    id: 'pre_observation',
    label: 'Pre-Observation Conference',
    activity_type: 'mentoring_coaching',
    description: 'Planning talk before a classroom observation',
    notes_template:
      'Pre-observation conference conducted. Discussed lesson objectives, ' +
      'planned strategies, and areas the mentee would like feedback on.',
  },
  {
    id: 'actual_observation',
    label: 'Actual Observation',
    activity_type: 'classroom_observation',
    description: 'The classroom observation itself',
    notes_template:
      'Classroom observation conducted for the full period. Focus areas: ' +
      'classroom management, instructional delivery, and learner engagement.',
  },
  {
    id: 'post_observation',
    label: 'Post-Observation Conference',
    activity_type: 'mentoring_coaching',
    description: 'Feedback session after a classroom observation',
    notes_template:
      'Post-observation conference conducted. Reviewed strengths observed, ' +
      'discussed areas for growth, and agreed on next steps for improvement.',
  },
  {
    id: 'lac_facilitation',
    label: 'LAC Session Facilitation',
    activity_type: 'lac_session',
    description: 'Facilitating a Learning Action Cell session',
    notes_template:
      'LAC session facilitated. Topic and key takeaways discussed with ' +
      'attending teachers; action points identified for follow-through.',
  },
  {
    id: 'im_review',
    label: 'Instructional Material Review',
    activity_type: 'instructional_material_review',
    description: 'Reviewing a mentee\u2019s instructional materials',
    notes_template:
      'Reviewed instructional materials (lesson plan / worksheets / ' +
      'assessment tools) and provided feedback for improvement.',
  },
  {
    id: 'coaching_checkin',
    label: 'Coaching Check-in',
    activity_type: 'mentoring_coaching',
    description: 'Informal follow-up coaching conversation',
    notes_template:
      'Informal coaching check-in conducted to follow up on previously ' +
      'agreed action points and address any current concerns.',
  },
]
