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

// Supabase's own client labels certain Auth API failures as
// "retryable" (network blips talking to the Auth server, not
// permission/data errors) — AuthRetryableFetchError is the main one.
// admin.* methods return {data, error} rather than throwing, so this
// retries based on the returned error's shape, not a caught exception.
async function withRetry<T extends { data: any; error: any }>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let result: T
  for (let i = 0; i < attempts; i++) {
    result = await fn()
    const err = result.error as any
    const isRetryable = err && (err.name === 'AuthRetryableFetchError' || err.status === 500)
    if (!err || !isRetryable || i === attempts - 1) return result
    await new Promise(res => setTimeout(res, 500 * (i + 1)))
  }
  return result!
}

export async function POST(req: NextRequest) {
  try {
    // ---- Fail loudly if server env vars are missing ----
    // This is the #1 cause of "admin actions silently do nothing in
    // production but work locally" — the service role key not being
    // set (or set for the wrong environment) in Vercel.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[manage-user] Missing env vars', {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      })
      return NextResponse.json(
        {
          error:
            'Server is missing SUPABASE_SERVICE_ROLE_KEY (or the Supabase URL). ' +
            'Check Vercel → Project → Settings → Environment Variables, and make sure ' +
            'it is enabled for the Production environment, then redeploy.',
        },
        { status: 500 }
      )
    }

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
      .select('id, role, subject_area, is_super_admin')
      .eq('id', callerAuth.user.id)
      .single()

    if (callerProfileError || !caller) {
      return NextResponse.json(
        { error: 'Caller profile not found', debugAuthUserId: callerAuth.user.id, debugProfileError: callerProfileError?.message },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { action, targetUserId } = body as {
      action: 'update_email' | 'reset_password'
      targetUserId: string
      newEmail?: string
    }
    let newEmail = body.newEmail as string | undefined

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
    const isSuperAdmin = caller.is_super_admin === true
    const isTopLevel = caller.role === 'principal' || caller.role === 'assistant_principal'
    const isHeadTeacherOwnDept =
      caller.role === 'head_teacher' &&
      (target.role === 'master_teacher' || target.role === 'mentee') &&
      normalizeSubject(target.subject_area) === normalizeSubject(caller.subject_area)

    if (!isSuperAdmin && !isTopLevel && !isHeadTeacherOwnDept) {
      return NextResponse.json({ error: 'Not authorized to modify this user' }, { status: 403 })
    }

    // ---- Actions ----
    if (action === 'update_email') {
      if (!newEmail) {
        return NextResponse.json({ error: 'newEmail is required' }, { status: 400 })
      }

      newEmail = newEmail.trim().toLowerCase()

      // Pre-flight duplicate check so we can give a clear message
      // instead of a raw Postgres unique-violation error.
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', newEmail)
        .neq('id', targetUserId)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: `${newEmail} is already used by another account.` },
          { status: 409 }
        )
      }

      const { data: authUpdateData, error: authUpdateError } = await withRetry(() =>
        supabaseAdmin.auth.admin.updateUserById(targetUserId, { email: newEmail!, email_confirm: true })
      )
      if (authUpdateError) {
        console.error('[manage-user] auth.admin.updateUserById failed', authUpdateError)
        return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
      }

      const { error: profileUpdateError } = await supabaseAdmin
        .from('users')
        .update({ email: newEmail })
        .eq('id', targetUserId)

      if (profileUpdateError) {
        console.error('[manage-user] profile table update failed', profileUpdateError)
        return NextResponse.json({ error: profileUpdateError.message }, { status: 500 })
      }

      // Verify the auth-side change actually stuck before reporting
      // success — catches edge cases where Supabase queues the change
      // instead of applying it immediately.
      const { data: verifyAuth } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
      if (verifyAuth?.user?.email?.toLowerCase() !== newEmail) {
        console.error('[manage-user] post-update verification mismatch', {
          expected: newEmail,
          actual: verifyAuth?.user?.email,
        })
        return NextResponse.json(
          {
            error:
              'Email update was submitted but did not take effect immediately. ' +
              'Check your Supabase Auth settings for "Secure email change" — if enabled, ' +
              'the change may require confirmation. Consider disabling it for admin-driven updates.',
          },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true, message: `Email updated to ${newEmail}` })
    }

    if (action === 'reset_password') {
      const { error: authResetError } = await withRetry(() =>
        supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: DEFAULT_RESET_PASSWORD })
      )
      if (authResetError) {
        console.error('[manage-user] password reset failed', authResetError)
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
    console.error('[manage-user] unexpected error', err)
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}
