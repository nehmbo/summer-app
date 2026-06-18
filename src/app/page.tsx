'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Phone, ArrowLeft, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const FONT = "var(--font-heebo), 'Heebo', sans-serif"
const GOLD_GRAD = 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    const trimmed = phone.trim()
    if (!trimmed) return

    // Extract only digits to handle cases where users type dashes or spaces (e.g. 050-1234567)
    const digitsOnly = trimmed.replace(/\D/g, '')
    
    // If they typed something but it has no digits, don't proceed
    if (!digitsOnly) {
      setError('נא להזין מספר תקין')
      return
    }

    // Create variations to allow logging in with or without the leading zero
    // We also include the original trimmed input just in case the DB has exact matches with dashes
    const variations = [trimmed, digitsOnly]
    
    if (digitsOnly.startsWith('0')) {
      // If it starts with 0 (e.g. 0501234567), add the version without 0 (e.g. 501234567)
      variations.push(digitsOnly.slice(1)) 
    } else {
      // If it doesn't start with 0 (e.g. 501234567), add the version with 0 (e.g. 0501234567)
      variations.push(`0${digitsOnly}`)    
    }

    // Remove duplicates
    const uniqueVariations = Array.from(new Set(variations))

    setIsLoading(true)
    setError(null)

    const { data, error: dbError } = await supabase
      .from('students')
      .select('id')
      .in('phone_number', uniqueVariations)
      .limit(1)
      .maybeSingle()

    setIsLoading(false)

    if (dbError) {
      setError('אירעה שגיאה. אנא נסי שוב.')
      return
    }

    if (!data) {
      setError('המספר לא מזוהה במערכת')
      return
    }

    localStorage.setItem('student_id', data.id)
    router.push('/vote')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #FDFAF4 0%, #F7F0E0 45%, #EFE5CC 100%)',
        fontFamily: FONT,
        padding: '1.5rem',
      }}
    >
      {/* Background blobs */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
      </div>

      {/* Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1.5px solid rgba(201,168,76,0.25)',
          boxShadow: '0 20px 60px rgba(180,140,60,0.12), 0 4px 16px rgba(0,0,0,0.06)',
          padding: '2.75rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2rem',
        }}
      >
        {/* Badge */}
        <div style={{
          width: '76px', height: '76px', borderRadius: '50%',
          background: GOLD_GRAD,
          boxShadow: '0 8px 32px rgba(180,140,60,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={34} color="#fff" strokeWidth={1.6} />
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <h1 style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 900,
            color: '#1E1508',
            lineHeight: 1.15,
            margin: 0,
            letterSpacing: '-0.02em',
            fontFamily: FONT,
          }}>
            כניסה לאפליקציה
          </h1>
          <p style={{
            fontSize: '0.95rem',
            color: '#8A7550',
            fontWeight: 300,
            margin: 0,
            lineHeight: 1.7,
            letterSpacing: '0.01em',
          }}>
            הזיני את מספר הטלפון שלך כדי להמשיך
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />

        {/* Form */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Phone input */}
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{
              position: 'absolute', top: '50%', right: '1rem',
              transform: 'translateY(-50%)',
              color: '#C9A84C', pointerEvents: 'none',
              display: 'flex', alignItems: 'center',
            }}>
              <Phone size={18} strokeWidth={1.8} />
            </span>
            <input
              id="phone-input"
              type="tel"
              dir="ltr"
              placeholder="050-0000000"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(null) }}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '0.9rem 3rem 0.9rem 1rem',
                borderRadius: '12px',
                border: error ? '1.5px solid rgba(220,80,60,0.5)' : '1.5px solid rgba(201,168,76,0.35)',
                background: 'rgba(255,255,255,0.8)',
                fontSize: '1.1rem',
                fontWeight: 500,
                color: '#1E1508',
                fontFamily: FONT,
                outline: 'none',
                transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                boxShadow: error
                  ? '0 0 0 3px rgba(220,80,60,0.1)'
                  : 'none',
                textAlign: 'left',
              }}
              onFocus={e => {
                if (!error) e.currentTarget.style.borderColor = '#C9A84C'
                e.currentTarget.style.boxShadow = error
                  ? '0 0 0 3px rgba(220,80,60,0.15)'
                  : '0 0 0 3px rgba(201,168,76,0.2)'
              }}
              onBlur={e => {
                if (!error) e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'
                if (!error) e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Error message */}
          {error && (
            <div
              id="login-error"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(220,80,60,0.07)',
                border: '1px solid rgba(220,80,60,0.2)',
                color: '#B83020',
                fontSize: '0.95rem',
                fontWeight: 500,
                animation: 'shakeIn 0.35s ease both',
              }}
            >
              <AlertCircle size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            id="login-btn"
            onClick={handleLogin}
            disabled={isLoading || !phone.trim()}
            style={{
              width: '100%',
              padding: '0.95rem 1.5rem',
              borderRadius: '12px',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.05em',
              fontFamily: FONT,
              background: isLoading || !phone.trim()
                ? 'linear-gradient(135deg, #D4C4A0, #BBA870)'
                : GOLD_GRAD,
              boxShadow: isLoading || !phone.trim()
                ? 'none'
                : '0 8px 28px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              cursor: isLoading || !phone.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.18s ease',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={e => {
              if (!isLoading && phone.trim()) {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(180,140,60,0.45), inset 0 1px 0 rgba(255,255,255,0.25)'
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
            }}
          >
            <span aria-hidden="true" style={{
              position: 'absolute', inset: 0, borderRadius: '12px', pointerEvents: 'none',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 55%)',
            }} />
            {isLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', position: 'relative', zIndex: 1 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%' }} />
                מתחברת...
              </span>
            ) : (
              <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                כניסה
                <ArrowLeft size={18} strokeWidth={2} style={{ transform: 'scaleX(-1)' }} />
              </span>
            )}
          </button>
        </div>

        {/* Tamar signature */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', lineHeight: 1.7, marginTop: '-0.5rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 300, fontStyle: 'italic', color: '#9A8060', letterSpacing: '0.02em' }}>
            אוהבת ומעריכה אותך וכאן בשבילך
          </span>
          <span style={{
            fontWeight: 900, fontStyle: 'normal', fontSize: '1.2rem',
            letterSpacing: '0.12em', textTransform: 'uppercase' as const,
            background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            תמר
          </span>
        </div>
      </div>

      <style>{`
        @keyframes shakeIn {
          0%   { transform: translateX(6px); opacity: 0; }
          30%  { transform: translateX(-4px); opacity: 1; }
          60%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  )
}
