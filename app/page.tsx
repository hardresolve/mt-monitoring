import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
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

      {/* Dark overlay for readability */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(10, 30, 70, 0.65)',
        backdropFilter: 'blur(2px)',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        background: 'rgba(255, 255, 255, 0.10)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '2.5rem 3rem',
        borderRadius: '16px',
        textAlign: 'center',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}>

        {/* School logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Image
            src="/school.webp"
            alt="Sta. Ana National High School Logo"
            width={90}
            height={90}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.4)' }}
          />
        </div>

        {/* School name */}
        <p style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(200, 220, 255, 0.85)',
          marginBottom: '6px',
        }}>
          Sta. Ana National High School
        </p>

        {/* App title */}
        <h1 style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '6px',
          lineHeight: 1.3,
        }}>
          Master Teacher<br />Monitoring System
        </h1>

        <div style={{
          width: '40px',
          height: '3px',
          background: 'linear-gradient(90deg, #4d94ff, #a78bfa)',
          borderRadius: '2px',
          margin: '14px auto 20px',
        }} />

        <p style={{
          fontSize: '13px',
          color: 'rgba(200, 215, 255, 0.75)',
          marginBottom: '28px',
          lineHeight: 1.5,
        }}>
          Track, manage, and monitor teacher performance and records in one place.
        </p>

        <Link href="/login" style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, #1a56db, #6d28d9)',
          color: 'white',
          padding: '11px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '0.03em',
          boxShadow: '0 4px 14px rgba(26, 86, 219, 0.5)',
          transition: 'opacity 0.2s',
        }}>
          Go to Login →
        </Link>
      </div>
    </main>
  )
}