import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const DEFAULT_PASSWORD = 'Sanhs2026!'

// The 34 accounts that need their auth account recreated after the
// broken auth.users row was deleted via SQL. Remove this list (or
// leave it empty) once the one-time repair has been run.
const REPAIR_TARGETS = [
  { id: 'af840dc8-d918-4170-8f0d-defbe5f99154', email: 'aj.cepe@deped.gov.ph' },
  { id: 'a602000e-738e-4785-b38c-daf12842e15a', email: 'aprilrose.francisquete@deped.gov.ph' },
  { id: 'cb1b7cf4-0a22-4aac-b465-43ee70cd4d87', email: 'benigno.malaran001@deped.gov.ph' },
  { id: '1d3c4c61-353e-4ae8-9e1e-2f52b33259d6', email: 'bernard.baguinon001@deped.gov.ph' },
  { id: '59f6ee47-96f1-40d3-bda4-ca91b36412dc', email: 'bonifacio.josol001@deped.gov.ph' },
  { id: 'b8ec7c16-a387-43fc-bda3-cc87c9c72518', email: 'camilo.natad001@deped.gov.ph' },
  { id: '2a2be776-3a2f-4896-a366-f8ec9119f1fa', email: 'carmae.llanos001@deped.gov.ph' },
  { id: '58b294de-931d-4e6a-99e7-beed73a06855', email: 'christopher.castro001@deped.gov.ph' },
  { id: '10eb6125-2e68-494e-9633-e41c9bc18e43', email: 'flordeliz.velasco001@deped.gov.ph' },
  { id: '37ebd560-d53a-43c2-b5a7-92a671a30ceb', email: 'irene.abordo001@deped.gov.ph' },
  { id: 'e01f41e4-cae3-43aa-bab4-a48ec03f0187', email: 'jahzeel.masabong@deped.gov.ph' },
  { id: 'c592bbd6-3967-4522-9409-6725d0345888', email: 'jangeraldine.natividad@deped.gov.ph' },
  { id: 'a0e19dae-59b8-4472-bf4b-fb4db9268531', email: 'january.dairo001@deped.gov.ph' },
  { id: '4dc644ed-e607-4007-a03a-61adffa50273', email: 'jenny.bernales001@deped.gov.ph' },
  { id: 'c3cafb6b-35fe-4f91-bdd7-1e8e75e95c95', email: 'joel.libre001@deped.gov.ph' },
  { id: '8cdb02fa-06a3-4e17-a798-8719ed2c8d61', email: 'johnrey.abella@deped.gov.ph' },
  { id: '9c9f4fbe-383a-4ac4-941f-abbb874df419', email: 'joshajanique.salucop001@deped.gov.ph' },
  { id: '31d665ce-d069-4087-adc9-a12cabc82562', email: 'juana.cepe001@deped.gov.ph' },
  { id: 'd85a82fe-de73-4bc1-b198-64e64d6da53c', email: 'khonie.muring001@deped.gov.ph' },
  { id: '119ba0aa-596e-4bab-9867-3429a7adeade', email: 'liza.turga001@deped.gov.ph' },
  { id: 'e6905415-705b-4227-bdef-a8d8f48fb413', email: 'luey.sorongon001@deped.gov.ph' },
  { id: '29252a82-fa27-46a7-86fc-a7044d6cf10e', email: 'marydeth.vallejos@deped.gov.ph' },
  { id: '202bfa4b-a9d6-4431-972e-1a30361998e9', email: 'maryjane.giangan001@deped.gov.ph' },
  { id: 'fcee2672-f3f2-4800-bc3c-f6137b291e81', email: 'mirasol.maasin001@deped.gov.ph' },
  { id: '2b42efb5-f5cf-4c15-8011-80f0b4b700da', email: 'monaliza.belonta@deped.gov.ph' },
  { id: '500d275c-7e3e-4667-a2de-226ffc855e78', email: 'nvaedralin01@gmail.com' },
  { id: '7236471b-3f40-4472-91bb-45ff170a55ec', email: 'odessa.limpot001@deped.gov.ph' },
  { id: '04e4341d-7108-4dfd-968f-5442a250e322', email: 'oliva.besite001@deped.gov.ph' },
  { id: '6f6199d1-9e96-43d5-83b9-b104577d79dd', email: 'reynaldo.pardillo001@deped.gov.ph' },
  { id: 'bf66f68d-53c0-4376-99a1-c2a3b5ec42ba', email: 'rinahlou.carpio001@deped.gov.ph' },
  { id: '4ef4dbe9-1193-4782-b9de-884a3e2eca24', email: 'rosemarie.cejuela@deped.gov.ph' },
  { id: '2636f6d8-5c88-4b62-a946-58655aabc91a', email: 'sarahjane.monotilla001@deped.gov.ph' },
  { id: 'c61c9c63-15cf-4b85-ad74-0c51d3578442', email: 'shynetteclaire.calitas001@deped.gov.ph' },
  { id: '0d532ba0-1c10-42b0-a034-8142d8aea5c0', email: 'verna.ungcad001@deped.gov.ph' },
]

async function assertIsSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return { ok: false as const, status: 401, error: 'Missing auth token' }

  const { data: callerAuth, error: callerAuthError } = await supabaseAdmin.auth.getUser(token)
  if (callerAuthError || !callerAuth?.user) return { ok: false as const, status: 401, error: 'Invalid session' }

  const { data: caller } = await supabaseAdmin
    .from('users')
    .select('is_super_admin')
    .eq('id', callerAuth.user.id)
    .single()

  if (!caller?.is_super_admin) return { ok: false as const, status: 403, error: 'Only a super admin can add or repair accounts' }
  return { ok: true as const }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server is missing Supabase env vars.' }, { status: 500 })
    }

    const authCheck = await assertIsSuperAdmin(req)
    if (!authCheck.ok) return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })

    const body = await req.json()
    const mode = body.mode as 'new' | 'repair_batch'

    // ---- Repair the 34 legacy accounts ----
    // Recreates their auth account via the CREATE endpoint (not the
    // broken UPDATE endpoint) with the same id, so every existing
    // foreign key in public.users / activities / confirmations keeps
    // pointing at a valid account with zero data changes needed.
    if (mode === 'repair_batch') {
      const results: { email: string; success: boolean; error?: string }[] = []

      for (const target of REPAIR_TARGETS) {
        const { error } = await supabaseAdmin.auth.admin.createUser({
          id: target.id,
          email: target.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
        })

        if (error) {
          results.push({ email: target.email, success: false, error: error.message })
          continue
        }

        await supabaseAdmin
          .from('users')
          .update({ must_change_password: true })
          .eq('id', target.id)

        results.push({ email: target.email, success: true })
      }

      const failed = results.filter(r => !r.success)
      return NextResponse.json({
        success: failed.length === 0,
        repaired: results.length - failed.length,
        failed,
      })
    }

    // ---- Add a brand new user ----
    if (mode === 'new') {
      const { full_name, email, role, subject_area, assigned_mt_id } = body as {
        full_name: string
        email: string
        role: 'master_teacher' | 'mentee'
        subject_area?: string
        assigned_mt_id?: string
      }

      if (!full_name?.trim() || !email?.trim() || !role) {
        return NextResponse.json({ error: 'full_name, email, and role are required' }, { status: 400 })
      }
      if (role === 'mentee' && !assigned_mt_id) {
        return NextResponse.json({ error: 'A master teacher must be assigned for a mentee' }, { status: 400 })
      }

      const cleanEmail = email.trim().toLowerCase()

      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: `${cleanEmail} is already in use.` }, { status: 409 })
      }

      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
      })

      if (createError || !created?.user) {
        return NextResponse.json({ error: createError?.message || 'Failed to create auth account' }, { status: 500 })
      }

      const { error: profileError } = await supabaseAdmin.from('users').insert({
        id: created.user.id,
        full_name: full_name.trim(),
        email: cleanEmail,
        role,
        subject_area: subject_area?.trim() || null,
        assigned_mt_id: role === 'mentee' ? assigned_mt_id : null,
        must_change_password: true,
      })

      if (profileError) {
        // Roll back the orphaned auth account so we don't leave a
        // half-created user behind.
        await supabaseAdmin.auth.admin.deleteUser(created.user.id)
        return NextResponse.json({ error: profileError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: `${full_name} added. Default password: ${DEFAULT_PASSWORD} (they'll be asked to change it on first login).`,
      })
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 })
  } catch (err: any) {
    console.error('[create-user] unexpected error', err)
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 })
  }
}