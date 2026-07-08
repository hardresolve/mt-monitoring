import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_RESET_PASSWORD = 'Sanhs2026!'

const SUBJECT_ALIASES: Record<string, string> = {
  'ap': 'araling panlipunan',
  'values education': 'esp',
}

function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return ''
  const base = subject.replace(/\s*\d+\s*$/, '').trim().toLowerCase()
  return SUBJECT_ALIASES[base] || base
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    // Identify the caller
    const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(token)
    if (callerAuthError || !callerAuth?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const { data: caller, error: callerProfileError } = await supabaseAdmin
      .from('users')
      .select('id, role, subject_area')
      .eq('id', callerAuth.user.id)
      .single()

    if (callerProfileError || !caller) {
      return NextResponse.json({ error: 'Caller profile not found' }, { status: 403 })
    }

    const body = await req.json()
    const { action, targetUserId, newEmail } = body as {
      action: 'update_email' | 'reset_password'
      targetUserId: string
      newEmail?: string
    }

    if (!action || !targetUserId) {
      return NextResponse.json({ error: 'Missing action or targetUserId' }, { status: 400 })
    }

    const { data: target, error: targetError } = await supabaseAdmin
      .from('users')
      .select('id, role, subject_area, email')
      .eq('id', targetUserId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 })
    }

    // ---- Authorization ----
    const isTopLevel = caller.role === 'principal' || caller.role === 'assistant_principal'
    const isHeadTeacherOwnDept =
      caller.role === 'head_teacher' &&
      (target.role === 'master_teacher' || target.role === 'mentee') &&
      normalizeSubject(target.subject_area) === normalizeSubject(caller.subject_area)

    if (!isTopLevel && !isHeadTeacherOwnDept) {
      return NextResponse.json({ error: 'Not authorized to modify this user' }, { status: 403 })
    }

    // ---- Actions ----
    if (action === 'update_email') {
      if (!newEmail) {
        return NextResponse.json({ error: 'newEmail is required' }, { status: 400 })
      }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { email: newEmail, email_confirm: true }
      )
      if (authUpdateError) {
        return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
      }

      const { error: profileUpdateError } = await supabaseAdmin
        .from('users')
        .update({ email: newEmail })
        .eq('id', targetUserId)

      if (profileUpdateError) {
        return NextResponse.json({ error: profileUpdateError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: `Email updated to ${newEmail}` })
    }

    if (action === 'reset_password') {
      const { error: authResetError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password: DEFAULT_RESET_PASSWORD }
      )
      if (authResetError) {
        return NextResponse.json({ error: authResetError.message }, { status: 500 })
      }

      const { error: flagError } = await supabaseAdmin
        .from('users')
        .update({ must_change_password: true })
        .eq('id', targetUserId)

      if (flagError) {
        return NextResponse.json({ error: flagError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `Password reset to default. They will be asked to set a new one on next login.`,
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}