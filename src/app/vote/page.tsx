'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import confetti from 'canvas-confetti'
import { Sparkles, CheckCircle2, CalendarCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Constants ───────────────────────────────────────────────────────────────
const COMPLIMENTS = [
  'סחתיין עלייך! 🌟',
  'כל הכבוד לך! 🏆',
  'את אלופת עולם! 👑',
  'אין דברים כמוך! 💎',
]

const HEB_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const FONT      = "var(--font-heebo), 'Heebo', sans-serif"
const GOLD_GRAD = 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)'
const BG_GRAD   = 'linear-gradient(160deg, #FDFAF4 0%, #F7F0E0 45%, #EFE5CC 100%)'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function randomCompliment(): string {
  return COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)]
}

function fireGoldConfetti(intensity: 'full' | 'light' = 'full') {
  const count = intensity === 'full' ? 160 : 80
  confetti({
    particleCount: count, spread: 90, origin: { y: 0.6 },
    colors: ['#C9A84C', '#E8D5A3', '#F5ECD7', '#D4A96A', '#B8860B', '#EDD9A3'],
    scalar: intensity === 'full' ? 1.1 : 0.9,
  })
  if (intensity === 'full') {
    setTimeout(() => {
      confetti({ particleCount: 70, angle: 60,  spread: 65, origin: { x: 0, y: 0.7 }, colors: ['#C9A84C', '#E8D5A3', '#D4B896'] })
      confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors: ['#C9A84C', '#F5ECD7', '#D4A96A'] })
    }, 180)
  }
}

interface MissingDay { iso: string; name: string }

// ─── Component ───────────────────────────────────────────────────────────────
export default function VotePage() {
  const router = useRouter()

  // Global
  const [isLoading,     setIsLoading    ] = useState(true)
  const [points,        setPoints       ] = useState<number | null>(null)

  // Today's vote
  const [hasVotedToday, setHasVotedToday] = useState(false)
  const [justVoted,     setJustVoted    ] = useState(false)
  const [isSubmitting,  setIsSubmitting ] = useState(false)
  const [compliment,    setCompliment   ] = useState<string | null>(null)
  const [animKey,       setAnimKey      ] = useState(0)

  // Makeup votes
  const [missingDays,      setMissingDays     ] = useState<MissingDay[]>([])
  const [completedMakeups, setCompletedMakeups] = useState<Set<string>>(new Set())
  const [makeupMessages,   setMakeupMessages  ] = useState<Map<string, string>>(new Map())
  const [submittingMakeup, setSubmittingMakeup] = useState<string | null>(null)

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const studentId = localStorage.getItem('student_id')
    if (!studentId) { router.push('/'); return }

    async function init() {
      setIsLoading(true)

      // 1. Total class points
      const { count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
      setPoints(count ?? 0)

      // 2. Compute this week's Sunday
      const today      = new Date()
      const todayLocal = toISO(today)
      const dayOfWeek  = today.getDay()          // 0 = Sunday

      const sunday = new Date(today)
      sunday.setDate(today.getDate() - dayOfWeek)
      const sundayISO = toISO(sunday)

      // 3. Fetch all votes for this student since Sunday
      const { data: weekVotes } = await supabase
        .from('votes')
        .select('created_at')
        .eq('student_id', studentId)
        .gte('created_at', `${sundayISO}T00:00:00`)

      // Convert server timestamps → local date strings
      const votedDates = new Set(
        (weekVotes ?? []).map(v => toISO(new Date(v.created_at)))
      )

      // 4. Voted today?
      setHasVotedToday(votedDates.has(todayLocal))

      // 5. Missing days: Sunday up to (not including) today
      const missing: MissingDay[] = []
      for (let i = 0; i < dayOfWeek; i++) {
        const d = new Date(sunday)
        d.setDate(sunday.getDate() + i)
        const iso = toISO(d)
        if (!votedDates.has(iso)) {
          missing.push({ iso, name: HEB_DAY_NAMES[d.getDay()] })
        }
      }
      setMissingDays(missing)
      setIsLoading(false)
    }

    init()
  }, [router])

  // ── Today's vote ──────────────────────────────────────────────────────────
  const handleVote = useCallback(async () => {
    if (isSubmitting || hasVotedToday) return
    setIsSubmitting(true)

    const studentId = localStorage.getItem('student_id')
    if (!studentId) { router.push('/'); return }

    const { error } = await supabase
      .from('votes')
      .insert({ student_id: studentId })

    if (!error) {
      setPoints(prev => (prev ?? 0) + 1)
      setHasVotedToday(true)
      setJustVoted(true)
      setCompliment(randomCompliment())
      setAnimKey(k => k + 1)
      fireGoldConfetti('full')
    }

    setIsSubmitting(false)
  }, [isSubmitting, hasVotedToday, router])

  // ── Makeup vote ───────────────────────────────────────────────────────────
  const handleMakeup = useCallback(async (day: MissingDay) => {
    if (submittingMakeup || completedMakeups.has(day.iso)) return
    setSubmittingMakeup(day.iso)

    const studentId = localStorage.getItem('student_id')
    if (!studentId) { router.push('/'); return }

    // Insert vote with explicit created_at for the missing day (09:00 UTC = noon Israel)
    const { error } = await supabase
      .from('votes')
      .insert({ student_id: studentId, created_at: `${day.iso}T09:00:00.000Z` })

    if (!error) {
      setPoints(prev => (prev ?? 0) + 1)
      setCompletedMakeups(prev => new Set([...prev, day.iso]))
      setMakeupMessages(prev => new Map([...prev, [day.iso, `ההצבעה ליום ${day.name} נקלטה! ✨`]]))
      fireGoldConfetti('light')
    }

    setSubmittingMakeup(null)
  }, [submittingMakeup, completedMakeups, router])

  // ── Derived ───────────────────────────────────────────────────────────────
  const pendingMissing = missingDays.filter(d => !completedMakeups.has(d.iso))
  const hasMakeupSection = !isLoading && (pendingMissing.length > 0 || completedMakeups.size > 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: BG_GRAD, fontFamily: FONT }}>

      {/* Background blobs */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
      </div>

      {/* Points banner */}
      <div id="class-points-banner" style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        padding: '0.9rem 1.5rem',
        background: 'linear-gradient(90deg, #1A1A2E 0%, #2D2D44 100%)',
        color: '#E8D5A3', fontSize: '1rem', fontWeight: 500,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        boxShadow: '0 2px 16px rgba(0,0,0,0.15)', fontFamily: FONT,
      }}>
        <Sparkles size={18} color="#C9A84C" />
        <span style={{ color: '#D4C4A0' }}>הנקודות של י&quot;א 1</span>
        <span id="class-points-value" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: '2.4rem', height: '2.4rem', padding: '0 0.5rem', borderRadius: '999px',
          background: GOLD_GRAD, color: '#fff', fontSize: '1.1rem', fontWeight: 800,
          boxShadow: '0 2px 10px rgba(180,140,60,0.4)', transition: 'transform 0.3s ease',
        }}>
          {points === null ? '—' : points}
        </span>
      </div>

      {/* Hero */}
      <div style={{
        position: 'relative', zIndex: 10, flex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '1.75rem',
        padding: '2.5rem 1.5rem', textAlign: 'center',
        maxWidth: '580px', margin: '0 auto', width: '100%',
      }}>

        {/* Badge */}
        <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: GOLD_GRAD, boxShadow: '0 8px 32px rgba(180,140,60,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={40} color="#fff" strokeWidth={1.6} />
        </div>

        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3rem)', fontWeight: 900, color: '#1E1508', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>
            ברוכה הבאה
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#8A7550', fontWeight: 300, margin: 0, lineHeight: 1.75, letterSpacing: '0.01em' }}>
            כל פעולה חיובית שלך משפיעה ומשנה את העולם סביבך
          </p>
        </div>

        {/* Divider */}
        <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />

        {/* ══════════ TODAY'S VOTE ══════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
          {isLoading ? (
            <div style={{ width: '220px', height: '56px', borderRadius: '14px', background: 'linear-gradient(90deg, #EDE0C8 25%, #F5ECD7 50%, #EDE0C8 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
          ) : hasVotedToday ? (
            <div id="already-voted-msg" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem',
              padding: '1.25rem 2rem', borderRadius: '16px',
              background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(201,168,76,0.3)', boxShadow: '0 4px 24px rgba(180,140,60,0.12)',
              animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              <CheckCircle2 size={36} color="#C9A84C" strokeWidth={1.8} />
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#5C3D0E', letterSpacing: '0.01em' }}>
                {justVoted ? 'ההצבעה נקלטה! אין כמוך ✨' : 'כבר הצבעת היום — כל הכבוד! ✨'}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#9A8060', fontWeight: 300 }}>אפשר לחזור ולהצביע מחר</span>
            </div>
          ) : (
            <button
              id="positive-action-btn"
              onClick={handleVote}
              disabled={isSubmitting}
              className="relative overflow-hidden cursor-pointer"
              style={{
                padding: '1.1rem 3rem', borderRadius: '14px',
                fontSize: '1.2rem', fontWeight: 700, color: '#fff',
                letterSpacing: '0.06em', fontFamily: FONT, background: GOLD_GRAD,
                boxShadow: '0 8px 32px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                opacity: isSubmitting ? 0.75 : 1,
              }}
              onMouseEnter={e => { if (!isSubmitting) { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(180,140,60,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' }}
              onMouseDown={e => { if (!isSubmitting) e.currentTarget.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { if (!isSubmitting) e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)' }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '14px', pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)' }} />
              <span style={{ position: 'relative', zIndex: 1 }}>{isSubmitting ? '...' : '✔️ עשיתי משהו חיובי'}</span>
            </button>
          )}

          {/* Compliment — only right after a fresh vote */}
          {compliment && justVoted && (
            <div key={animKey} id="compliment-display" dir="rtl" style={{
              fontSize: '1.75rem', fontWeight: 700, textAlign: 'center',
              padding: '1rem 2.5rem', borderRadius: '14px',
              background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(180,140,60,0.15)', border: '1.5px solid rgba(201,168,76,0.35)',
              color: '#5C3D0E', letterSpacing: '0.02em', fontFamily: FONT,
              animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {compliment}
            </div>
          )}
        </div>

        {/* ══════════ MAKEUP VOTES SECTION ══════════ */}
        {hasMakeupSection && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.35))' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#A08040', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <CalendarCheck size={15} color="#C9A84C" strokeWidth={2} />
                השלמת הצבעות חסרות השבוע
              </span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(201,168,76,0.35), transparent)' }} />
            </div>

            {/* Pending makeup buttons */}
            {pendingMissing.map(day => (
              <button
                key={day.iso}
                onClick={() => handleMakeup(day)}
                disabled={submittingMakeup === day.iso}
                style={{
                  width: '100%', padding: '0.8rem 1.5rem',
                  borderRadius: '12px', fontSize: '1rem', fontWeight: 600,
                  color: '#5C3D0E', letterSpacing: '0.03em', fontFamily: FONT,
                  background: 'rgba(255,255,255,0.6)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1.5px solid rgba(201,168,76,0.4)',
                  boxShadow: '0 2px 12px rgba(180,140,60,0.1)',
                  cursor: submittingMakeup === day.iso ? 'wait' : 'pointer',
                  transition: 'all 0.18s ease',
                  opacity: submittingMakeup === day.iso ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
                onMouseEnter={e => {
                  if (!submittingMakeup) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.85)'
                    e.currentTarget.style.borderColor = '#C9A84C'
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(180,140,60,0.2)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.6)'
                  e.currentTarget.style.borderColor = 'rgba(201,168,76,0.4)'
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(180,140,60,0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <CalendarCheck size={17} color="#C9A84C" strokeWidth={2} />
                {submittingMakeup === day.iso ? 'שולחת...' : `השלמת הצבעה ליום ${day.name}`}
              </button>
            ))}

            {/* Completed makeup confirmations */}
            {[...completedMakeups].map(iso => {
              const msg = makeupMessages.get(iso)
              if (!msg) return null
              return (
                <div key={iso} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.7rem 1.2rem', borderRadius: '12px',
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
                  color: '#7A5C1E', fontSize: '0.95rem', fontWeight: 600,
                  animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                }}>
                  <CheckCircle2 size={17} color="#C9A84C" strokeWidth={2} />
                  {msg}
                </div>
              )
            })}
          </div>
        )}

        {/* Personal note */}
        <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', lineHeight: 1.7 }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 300, fontStyle: 'italic', color: '#7A6A4A', letterSpacing: '0.02em' }}>
            אוהבת ומעריכה אותך וכאן בשבילך
          </span>
          <span style={{ fontWeight: 900, fontStyle: 'normal', fontSize: '1.55rem', letterSpacing: '0.12em', textTransform: 'uppercase', background: 'linear-gradient(135deg, #C9A84C, #8B6914)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            תמר
          </span>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0.5) translateY(16px); opacity: 0; }
          70%  { transform: scale(1.06) translateY(-3px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </main>
  )
}
