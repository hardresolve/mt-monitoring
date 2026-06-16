'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: '7px 16px',
        backgroundColor: 'transparent',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#555',
        cursor: 'pointer'
      }}
    >
      Log out
    </button>
  )
}