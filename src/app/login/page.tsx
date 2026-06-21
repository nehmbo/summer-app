'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowLeft, Lock, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const FONT = "var(--font-heebo), 'Heebo', sans-serif"
const GOLD_GRAD = 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)'
const BG_GRAD = 'linear-gradient(160deg, #FDFAF4 0%, #F7F0E0 45%, #EFE5CC 100%)'

export default function LoginPage() {
  const router = useRouter()

  const [teacherPhone, setTeacherPhone] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    if (!teacherPhone || !adminPassword) {
      setError('נא למלא את כל השדות')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Find the class by phone and password
      const { data: classData, error: fetchError } = await supabase
        .from('classes')
        .select('id')
        .eq('teacher_phone', teacherPhone)
        .eq('admin_password', adminPassword)
        .single()

      if (fetchError || !classData) {
        throw new Error('פרטי ההתחברות אינם נכונים, או שהכיתה לא קיימת.')
      }

      // Authenticate the admin automatically
      if (typeof window !== 'undefined') {
        localStorage.setItem(`admin_auth_${classData.id}`, 'true')
      }

      // Redirect directly to the admin dashboard
      router.push(`/class/${classData.id}/admin`)

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'אירעה שגיאה. אנא נסה שוב.')
      setIsLoading(false)
    }
  }

  return (
    <main dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG_GRAD, fontFamily: FONT, padding: '1.5rem' }}>
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '460px', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '24px', border: '1.5px solid rgba(201,168,76,0.25)', boxShadow: '0 20px 60px rgba(180,140,60,0.12)', padding: '2.75rem 2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
        <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: GOLD_GRAD, boxShadow: '0 8px 32px rgba(180,140,60,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={34} color="#fff" strokeWidth={1.6} />
        </div>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, color: '#1E1508', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>
            התחברות מורים
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#8A7550', fontWeight: 300, margin: 0 }}>
            הזיני את הפרטים איתם פתחת את הכיתה שלך.
          </p>
        </div>

        <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#5C3D0E', fontWeight: 600, marginBottom: '0.4rem' }}>מספר טלפון</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', color: '#C9A84C' }}>
                <Phone size={18} strokeWidth={1.8} />
              </span>
              <input type="tel" dir="ltr" placeholder="050-0000000" value={teacherPhone} onChange={e => setTeacherPhone(e.target.value)}
                style={{ width: '100%', padding: '0.9rem 3rem 0.9rem 1rem', borderRadius: '12px', border: '1.5px solid rgba(201,168,76,0.35)', background: 'rgba(255,255,255,0.8)', fontSize: '1.1rem', color: '#1E1508', fontFamily: FONT, outline: 'none', textAlign: 'left' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', color: '#5C3D0E', fontWeight: 600, marginBottom: '0.4rem' }}>סיסמת הניהול שלך</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', color: '#C9A84C' }}>
                <Lock size={18} strokeWidth={1.8} />
              </span>
              <input type="password" placeholder="סיסמת הכיתה" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                style={{ width: '100%', padding: '0.9rem 3rem 0.9rem 1rem', borderRadius: '12px', border: '1.5px solid rgba(201,168,76,0.35)', background: 'rgba(255,255,255,0.8)', fontSize: '1.1rem', color: '#1E1508', fontFamily: FONT, outline: 'none' }}
              />
            </div>
          </div>

          {error && <div style={{ color: '#B83020', fontSize: '0.95rem', fontWeight: 500, textAlign: 'center', background: 'rgba(220,80,60,0.07)', padding: '0.5rem', borderRadius: '8px' }}>{error}</div>}

          <button onClick={handleLogin} disabled={isLoading || !adminPassword || !teacherPhone}
            style={{ width: '100%', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#fff', background: isLoading || !adminPassword || !teacherPhone ? 'linear-gradient(135deg, #D4C4A0, #BBA870)' : GOLD_GRAD, border: 'none', cursor: isLoading || !adminPassword || !teacherPhone ? 'not-allowed' : 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: isLoading || !adminPassword || !teacherPhone ? 'none' : '0 8px 28px rgba(180,140,60,0.35)' }}
          >
            {isLoading ? 'מתחבר...' : 'היכנסי לפאנל הניהול'}
            {!isLoading && <ArrowLeft size={18} />}
          </button>

          <Link href="/register" style={{ textAlign: 'center', marginTop: '1rem', color: '#8A7550', fontSize: '0.95rem', textDecoration: 'none', fontWeight: 500 }}>
            עוד אין לך כיתה? לחצי כאן כדי לפתוח
          </Link>
        </div>
      </div>
    </main>
  )
}
