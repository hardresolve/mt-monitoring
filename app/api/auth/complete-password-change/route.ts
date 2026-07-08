import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Missing auth token' }, { status: 401 })
    }

    const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(token)
    if (callerAuthError || !callerAuth?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // A user may only ever clear their OWN flag — no targetUserId accepted here.
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ must_change_password: false })
      .eq('id', callerAuth.user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}