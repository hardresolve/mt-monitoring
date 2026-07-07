'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const userId = authData.user.id
    console.log('Logged in user ID:', userId)

    let attempts = 0
    let userProfile = null

    while (attempts < 3 && !userProfile) {
      const { data, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      console.log('Profile fetch attempt', attempts + 1, ':', data, profileError)

      if (data) {
        userProfile = data
      } else {
        attempts++
        await new Promise(res => setTimeout(res, 500))
      }
    }

    if (!userProfile) {
      setError(`No profile found for user ID: ${userId} — show this to your ICT Coordinator.`)
      setLoading(false)
      return
    }

    if (userProfile.role === 'master_teacher') {
      router.push('/dashboard/mt')
    } else if (userProfile.role === 'mentee') {
      router.push('/dashboard/mentee')
    } else if (userProfile.role === 'principal') {
      router.push('/dashboard/principal')
    } else if (userProfile.role === 'assistant_principal') {
      router.push('/dashboard/principal')
    } else if (userProfile.role === 'head_teacher') {
      router.push('/dashboard/head_teacher')
    } else {
      setError('Unknown role. Contact your administrator.')
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background image */}
      <Image
        src="/bg.webp"
        alt="School background"
        fill
        priority
        style={{ objectFit: 'cover', objectPosition: 'center' }}
      />

      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10, 30, 70, 0.65)',
        backdropFilter: 'blur(2px)',
      }} />

      {/* Login card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255, 255, 255, 0.10)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '2.5rem 2.5rem',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>

        {/* School logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <Image
            src="/school.webp"
            alt="Sta. Ana National High School Logo"
            width={52}
            height={52}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }}
          />
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(180, 210, 255, 0.85)', marginBottom: '2px' }}>
              Sta. Ana National High School
            </p>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
              MT Monitoring System
            </h1>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          marginBottom: '24px',
        }} />

        {/* Email */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(200,220,255,0.8)', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            EMAIL
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#ffffff',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(200,220,255,0.8)', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
            PASSWORD
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#ffffff',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(220, 50, 50, 0.15)',
            border: '1px solid rgba(255,100,100,0.4)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#ffaaaa',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px',
            background: loading ? 'rgba(100,130,200,0.5)' : 'linear-gradient(135deg, #1a56db, #6d28d9)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 14px rgba(26,86,219,0.5)',
            letterSpacing: '0.03em',
          }}
        >
          {loading ? 'Logging in...' : 'Log In →'}
        </button>

        <p style={{ fontSize: '12px', color: 'rgba(180,200,255,0.5)', textAlign: 'center', marginTop: '20px' }}>
          Forgot your password? Contact your ICT Coordinator.
        </p>
      </div>
    </main>
  )
}
