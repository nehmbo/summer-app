'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Users, Star, RefreshCw, BarChart3, CalendarDays, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONT      = "var(--font-heebo), 'Heebo', sans-serif"
const GOLD_GRAD = 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)'
const BG_GRAD   = 'linear-gradient(160deg, #FDFAF4 0%, #F7F0E0 45%, #EFE5CC 100%)'
const HEB_DAY   = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return {
    abbr: HEB_DAY[d.getDay()],
    date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
  }
}

interface Week { label: string; dates: string[] }   // dates = Sun–Fri only

function buildWeeks(earliestISO: string): Week[] {
  const weeks: Week[] = []
  const today = toISO(new Date())

  // Rewind to the Sunday of the earliest week
  const anchor = new Date(earliestISO + 'T12:00:00')
  anchor.setDate(anchor.getDate() - anchor.getDay())

  let n = 1
  while (toISO(anchor) <= today) {
    const dates: string[] = []
    for (let i = 0; i < 6; i++) {          // i=0 Sun … i=5 Fri
      const d = new Date(anchor)
      d.setDate(anchor.getDate() + i)
      dates.push(toISO(d))
    }
    weeks.push({ label: `שבוע ${n}`, dates })
    anchor.setDate(anchor.getDate() + 7)
    n++
  }
  return weeks
}

function countActiveDays(fromISO: string, toISO2: string): number {
  let c = 0
  const cur = new Date(fromISO + 'T12:00:00')
  const end = new Date(toISO2 + 'T12:00:00')
  while (cur <= end) {
    if (cur.getDay() !== 6) c++
    cur.setDate(cur.getDate() + 1)
  }
  return c
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Student { id: string; name: string; phone_number: string }
type Tab = 'summary' | number

// ─── Shared cell styles ───────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  padding: '0.65rem 0.7rem', fontWeight: 700, fontSize: '0.78rem',
  color: '#5C4A20', letterSpacing: '0.03em',
  borderBottom: '2px solid rgba(201,168,76,0.25)',
  whiteSpace: 'nowrap', textAlign: 'center', fontFamily: FONT,
}
const TD: React.CSSProperties = {
  padding: '0.6rem 0.7rem',
  borderBottom: '1px solid rgba(201,168,76,0.1)',
  whiteSpace: 'nowrap', fontFamily: FONT,
}

const ADMIN_PASSWORD = 'tamar1168'
const ADMIN_LS_KEY   = 'admin_auth'

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminPage() {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password,        setPassword       ] = useState('')
  const [showPassword,    setShowPassword   ] = useState(false)
  const [authError,       setAuthError      ] = useState(false)

  // ── Dashboard state ───────────────────────────────────────────────────────
  const [isLoading,     setIsLoading    ] = useState(false)
  const [totalPoints,   setTotalPoints  ] = useState(0)
  const [students,      setStudents     ] = useState<Student[]>([])
  const [voteMap,       setVoteMap      ] = useState<Map<string, Set<string>>>(new Map())
  const [voteCounts,    setVoteCounts   ] = useState<Map<string, number>>(new Map())
  const [weeks,         setWeeks        ] = useState<Week[]>([])
  const [activeDayCount,setActiveDayCount] = useState(0)
  const [lastRefreshed, setLastRefreshed] = useState(new Date())
  const [activeTab,     setActiveTab    ] = useState<Tab>('summary')

  // ── Auth handler ─────────────────────────────────────────────────────────
  function handleAuth() {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_LS_KEY, 'true')
      setIsAuthenticated(true)
      setAuthError(false)
    } else {
      setAuthError(true)
    }
  }

  // ── Data fetch ───────────────────────────────────────────────────────────
  async function fetchData() {
    setIsLoading(true)

    const { count: total } = await supabase
      .from('votes').select('*', { count: 'exact', head: true })
    setTotalPoints(total ?? 0)

    const { data: studentData } = await supabase
      .from('students').select('id, name, phone_number').order('name', { ascending: true })

    const { data: voteData } = await supabase
      .from('votes').select('student_id, created_at').order('created_at', { ascending: true })

    if (!studentData) { setIsLoading(false); return }

    const allVotes = voteData ?? []
    const map    = new Map<string, Set<string>>()
    const counts = new Map<string, number>()

    for (const v of allVotes) {
      const iso = toISO(new Date(v.created_at))
      if (!map.has(v.student_id)) map.set(v.student_id, new Set())
      map.get(v.student_id)!.add(iso)
      counts.set(v.student_id, (counts.get(v.student_id) ?? 0) + 1)
    }

    const todayISO  = toISO(new Date())
    const earliest  = allVotes.length > 0 ? toISO(new Date(allVotes[0].created_at)) : todayISO
    const generated = buildWeeks(earliest)
    const dayCount  = countActiveDays(earliest, todayISO)

    setStudents(studentData)
    setVoteMap(map)
    setVoteCounts(counts)
    setWeeks(generated)
    setActiveDayCount(dayCount)
    setLastRefreshed(new Date())
    // Default: current (last) week
    setActiveTab(generated.length > 0 ? generated.length - 1 : 'summary')
    setIsLoading(false)
  }

  // On mount: check localStorage for saved auth; if present, go straight to dashboard
  useEffect(() => {
    if (localStorage.getItem(ADMIN_LS_KEY) === 'true') {
      setIsAuthenticated(true)
      fetchData()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data whenever we become authenticated
  useEffect(() => {
    if (isAuthenticated && students.length === 0 && !isLoading) {
      fetchData()
    }
  }, [isAuthenticated]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = toISO(new Date())

  // ── Tab list: [summary, week0, week1, …] ──────────────────────────────
  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: 'summary', label: 'סיכום כולל', icon: <BarChart3 size={14} /> },
    ...weeks.map((w, i) => ({ key: i as number, label: w.label })),
  ]

  const selectedWeek = typeof activeTab === 'number' ? weeks[activeTab] : null

  // ─────────────────────────────────────────────────────────────────────────

  // ── PASSWORD GATE ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main dir="rtl" style={{ minHeight: '100vh', background: BG_GRAD, fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        {/* Background blobs */}
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
        </div>

        {/* Card */}
        <div style={{
          position: 'relative', zIndex: 10,
          width: '100%', maxWidth: '400px',
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '22px',
          border: '1.5px solid rgba(201,168,76,0.28)',
          boxShadow: '0 20px 60px rgba(180,140,60,0.13), 0 4px 16px rgba(0,0,0,0.06)',
          padding: '2.5rem 2.25rem',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.75rem',
        }}>
          {/* Lock badge */}
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: GOLD_GRAD,
            boxShadow: '0 8px 28px rgba(180,140,60,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={30} color="#fff" strokeWidth={1.8} />
          </div>

          {/* Heading */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1E1508', margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>לוח ניהול</h1>
            <p style={{ fontSize: '0.92rem', color: '#8A7550', fontWeight: 300, margin: 0, letterSpacing: '0.01em' }}>הזיני את סיסמת המנהל להמשך</p>
          </div>

          {/* Divider */}
          <div style={{ width: '44px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />

          {/* Form */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Password input */}
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', display: 'flex' }}>
                <Lock size={16} strokeWidth={1.8} />
              </span>
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="סיסמת מנהל"
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthError(false) }}
                onKeyDown={e => { if (e.key === 'Enter') handleAuth() }}
                style={{
                  width: '100%', padding: '0.85rem 2.8rem 0.85rem 2.8rem',
                  borderRadius: '11px',
                  border: authError ? '1.5px solid rgba(200,80,60,0.5)' : '1.5px solid rgba(201,168,76,0.35)',
                  background: 'rgba(255,255,255,0.85)',
                  fontSize: '1rem', fontWeight: 500, color: '#1E1508',
                  fontFamily: FONT, outline: 'none',
                  boxShadow: authError ? '0 0 0 3px rgba(200,80,60,0.1)' : 'none',
                  transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                  textAlign: 'right', direction: 'rtl',
                }}
                onFocus={e => { if (!authError) e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.boxShadow = authError ? '0 0 0 3px rgba(200,80,60,0.15)' : '0 0 0 3px rgba(201,168,76,0.18)' }}
                onBlur={e => { if (!authError) { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'; e.currentTarget.style.boxShadow = 'none' } }}
              />
              {/* Show/hide toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', top: '50%', left: '0.85rem', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B0956A', padding: '0.2rem', display: 'flex' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error */}
            {authError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.65rem 0.9rem', borderRadius: '9px',
                background: 'rgba(200,80,60,0.07)', border: '1px solid rgba(200,80,60,0.2)',
                color: '#A03020', fontSize: '0.88rem', fontWeight: 500,
                animation: 'shakeIn 0.35s ease both',
              }}>
                <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} />
                סיסמה שגויה
              </div>
            )}

            {/* Submit */}
            <button
              id="admin-login-btn"
              onClick={handleAuth}
              disabled={!password.trim()}
              style={{
                width: '100%', padding: '0.9rem',
                borderRadius: '11px', fontSize: '1rem', fontWeight: 700,
                color: '#fff', fontFamily: FONT,
                background: password.trim() ? GOLD_GRAD : 'linear-gradient(135deg,#D4C4A0,#BBA870)',
                boxShadow: password.trim() ? '0 8px 24px rgba(180,140,60,0.32), inset 0 1px 0 rgba(255,255,255,0.22)' : 'none',
                border: '1.5px solid rgba(255,255,255,0.22)',
                cursor: password.trim() ? 'pointer' : 'not-allowed',
                transition: 'all 0.18s ease', position: 'relative', overflow: 'hidden',
              }}
            >
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '11px', pointerEvents: 'none', background: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 55%)' }} />
              <span style={{ position: 'relative', zIndex: 1 }}>כניסה למערכת</span>
            </button>
          </div>
        </div>

        <style>{`
          @keyframes shakeIn {
            0%   { transform: translateX(6px); opacity: 0; }
            30%  { transform: translateX(-4px); opacity: 1; }
            60%  { transform: translateX(3px); }
            100% { transform: translateX(0); }
          }
        `}</style>
      </main>
    )
  }

  return (
    <main dir="rtl" style={{ minHeight: '100vh', background: BG_GRAD, fontFamily: FONT, paddingBottom: '3rem' }}>

      {/* Top bar */}
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        padding: '0.9rem 1.5rem',
        background: 'linear-gradient(90deg, #1A1A2E 0%, #2D2D44 100%)',
        color: '#E8D5A3', fontSize: '1rem', fontWeight: 500,
        letterSpacing: '0.06em', boxShadow: '0 2px 16px rgba(0,0,0,0.15)', fontFamily: FONT,
      }}>
        <Sparkles size={18} color="#C9A84C" />
        <span style={{ color: '#D4C4A0' }}>לוח ניהול · י&quot;א 1 · תמר</span>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

        {/* ── Summary cards ── */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Star size={15} color="#C9A84C" />, label: 'נקודות כיתתיות', value: totalPoints, golden: true },
            { icon: <Users size={15} color="#C9A84C" />, label: 'תלמידות', value: students.length, golden: false },
            { icon: <CalendarDays size={15} color="#C9A84C" />, label: 'ימי פעילות', value: activeDayCount, golden: false },
            { icon: <CalendarDays size={15} color="#C9A84C" />, label: 'שבועות', value: weeks.length, golden: false },
          ].map(({ icon, label, value, golden }) => (
            <div key={label} style={{
              flex: '1 1 160px', padding: '1.4rem 1.2rem', borderRadius: '14px',
              background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(201,168,76,0.25)',
              boxShadow: '0 4px 20px rgba(180,140,60,0.08)',
              display: 'flex', flexDirection: 'column', gap: '0.4rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#A08040', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                {icon}{label}
              </div>
              <div style={{
                fontSize: '2.6rem', fontWeight: 900, lineHeight: 1,
                ...(golden
                  ? { background: GOLD_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }
                  : { color: '#2A2015' }),
              }}>
                {isLoading ? '—' : value}
              </div>
            </div>
          ))}

          {/* Refresh */}
          <div style={{
            flex: '0 0 auto', padding: '1.4rem 1.2rem', borderRadius: '14px',
            background: 'rgba(255,255,255,0.55)', border: '1.5px solid rgba(201,168,76,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}>
            <button onClick={fetchData} disabled={isLoading} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.65rem 1.3rem', borderRadius: '10px', background: GOLD_GRAD,
              color: '#fff', fontSize: '0.88rem', fontWeight: 600, fontFamily: FONT,
              border: 'none', cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(180,140,60,0.28)',
              transition: 'all 0.18s ease',
            }}>
              <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              רענן
            </button>
            <span style={{ fontSize: '0.72rem', color: '#B0956A', fontWeight: 300 }}>
              {lastRefreshed.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* ── Tab navigation ── */}
        <div style={{ borderBottom: '2px solid rgba(201,168,76,0.2)', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0' }}>
            {tabs.map(tab => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={String(tab.key)}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.6rem 1.15rem',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: isActive ? '2px solid #C9A84C' : '2px solid transparent',
                    marginBottom: '-2px',
                    cursor: 'pointer', fontFamily: FONT,
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#7A5C1E' : '#9A8060',
                    background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                    transition: 'all 0.18s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TABLE AREA
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{
          borderRadius: '16px', overflow: 'hidden',
          border: '1.5px solid rgba(201,168,76,0.22)',
          boxShadow: '0 4px 28px rgba(180,140,60,0.09)',
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)',
        }}>
          {/* Table label row */}
          <div style={{
            padding: '0.9rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.18)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}>
            {activeTab === 'summary'
              ? <><BarChart3 size={16} color="#C9A84C" /><span style={{ fontWeight: 700, color: '#2A2015', fontSize: '0.95rem' }}>סיכום כולל — כל התקופה</span></>
              : <><CalendarDays size={16} color="#C9A84C" /><span style={{ fontWeight: 700, color: '#2A2015', fontSize: '0.95rem' }}>{selectedWeek?.label} — מעקב יומי</span></>
            }
            <span style={{ fontSize: '0.78rem', color: '#A08040', fontWeight: 400 }}>
              ({students.length} תלמידות)
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#A08040', fontWeight: 300 }}>
              <div style={{ width: '38px', height: '38px', border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
              טוען נתונים...
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#A08040' }}>אין תלמידות רשומות</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>

              {/* ── SUMMARY TAB ── */}
              {activeTab === 'summary' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, rgba(245,236,215,0.9), rgba(237,217,163,0.4))' }}>
                      <th style={{ ...TH, textAlign: 'right', minWidth: '150px', position: 'sticky', right: 0, background: '#F2E9D4', zIndex: 2, borderLeft: '1px solid rgba(201,168,76,0.22)' }}>שם התלמידה</th>
                      <th style={{ ...TH, minWidth: '128px' }}>טלפון</th>
                      <th style={{ ...TH, minWidth: '90px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          <Star size={12} color="#C9A84C" />נקודות
                        </div>
                      </th>
                      <th style={{ ...TH, minWidth: '110px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          <BarChart3 size={12} color="#C9A84C" />השתתפות
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => {
                      const pts  = voteCounts.get(s.id) ?? 0
                      const pct  = activeDayCount > 0 ? Math.round((pts / activeDayCount) * 100) : 0
                      const even = idx % 2 === 0
                      const stickyBg = even ? 'rgba(253,250,244,0.98)' : 'rgba(247,240,224,0.98)'

                      return (
                        <tr key={s.id}
                          style={{ background: even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }}
                        >
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#2A2015', position: 'sticky', right: 0, background: stickyBg, zIndex: 1, borderLeft: '1px solid rgba(201,168,76,0.15)' }}>{s.name}</td>
                          <td style={{ ...TD, color: '#7A6A4A', direction: 'ltr', textAlign: 'center' }}>{s.phone_number}</td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              minWidth: '28px', height: '28px', padding: '0 6px', borderRadius: '999px',
                              background: pts > 0 ? GOLD_GRAD : 'rgba(200,190,170,0.3)',
                              color: pts > 0 ? '#fff' : '#A09070', fontWeight: 800, fontSize: '0.8rem',
                            }}>{pts}</span>
                          </td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              {/* Progress bar */}
                              <div style={{ width: '60px', height: '6px', borderRadius: '99px', background: 'rgba(200,190,170,0.3)', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: pct >= 80 ? '#2E7D52' : pct >= 50 ? '#C9A84C' : '#C87070', transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: pct >= 80 ? '#2E7D52' : pct >= 50 ? '#7A5C1E' : '#8B3030', minWidth: '34px', textAlign: 'right' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* ── WEEK TAB ── */}
              {typeof activeTab === 'number' && selectedWeek && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, rgba(245,236,215,0.9), rgba(237,217,163,0.4))' }}>
                      <th style={{ ...TH, textAlign: 'right', minWidth: '150px', position: 'sticky', right: 0, background: '#F2E9D4', zIndex: 2, borderLeft: '1px solid rgba(201,168,76,0.22)' }}>שם התלמידה</th>
                      <th style={{ ...TH, minWidth: '128px' }}>טלפון</th>
                      <th style={{ ...TH, minWidth: '78px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                          <Star size={12} color="#C9A84C" />נקודות
                        </div>
                      </th>
                      {selectedWeek.dates.map(iso => {
                        const { abbr, date } = formatLabel(iso)
                        const isToday = iso === today
                        const isFuture = iso > today
                        return (
                          <th key={iso} style={{
                            ...TH, minWidth: '54px',
                            background: isToday ? 'rgba(201,168,76,0.22)' : undefined,
                            borderBottom: isToday ? '2px solid #C9A84C' : TH.borderBottom,
                            opacity: isFuture ? 0.45 : 1,
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <span style={{ fontSize: '0.63rem', color: '#A08040' }}>{abbr}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#7A5C1E' : '#4A3A20' }}>{date}</span>
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => {
                      const votedDates = voteMap.get(s.id) ?? new Set<string>()
                      const pts  = voteCounts.get(s.id) ?? 0
                      const even = idx % 2 === 0
                      const stickyBg = even ? 'rgba(253,250,244,0.98)' : 'rgba(247,240,224,0.98)'

                      return (
                        <tr key={s.id}
                          style={{ background: even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }}
                        >
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#2A2015', position: 'sticky', right: 0, background: stickyBg, zIndex: 1, borderLeft: '1px solid rgba(201,168,76,0.15)' }}>{s.name}</td>
                          <td style={{ ...TD, color: '#7A6A4A', direction: 'ltr', textAlign: 'center' }}>{s.phone_number}</td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              minWidth: '26px', height: '26px', padding: '0 5px', borderRadius: '999px',
                              background: pts > 0 ? GOLD_GRAD : 'rgba(200,190,170,0.3)',
                              color: pts > 0 ? '#fff' : '#A09070', fontWeight: 800, fontSize: '0.78rem',
                            }}>{pts}</span>
                          </td>
                          {selectedWeek.dates.map(iso => {
                            const hasVote  = votedDates.has(iso)
                            const isPast   = iso < today
                            const isToday  = iso === today
                            const isFuture = iso > today

                            let symbol: string
                            let color:  string
                            let cellBg: string

                            if (hasVote) {
                              symbol = '✔'; color = '#2E7D52'; cellBg = 'rgba(46,125,82,0.07)'
                            } else if (isPast || isToday) {
                              symbol = '✖'; color = '#C4B8A0'; cellBg = 'transparent'
                            } else {
                              symbol = '—'; color = 'rgba(180,165,140,0.5)'; cellBg = 'transparent'
                            }

                            return (
                              <td key={iso} style={{
                                ...TD, textAlign: 'center',
                                background: isToday ? `rgba(201,168,76,0.06)` : cellBg,
                              }}>
                                <span style={{ fontSize: hasVote ? '1rem' : '0.82rem', color, fontWeight: hasVote ? 700 : 400 }}>
                                  {symbol}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ── Legend ── */}
        {typeof activeTab === 'number' && (
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { s: '✔', c: '#2E7D52', bg: 'rgba(46,125,82,0.08)',  l: 'הצביעה' },
              { s: '✖', c: '#C4B8A0', bg: 'transparent',            l: 'לא הצביעה (יום שעבר)' },
              { s: '—', c: '#C4B8A0', bg: 'transparent',            l: 'טרם הגיע' },
            ].map(({ s, c, bg, l }) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#7A6A4A' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '5px', background: bg, color: c, fontWeight: 700, fontSize: '0.85rem' }}>{s}</span>
                {l}
              </div>
            ))}
          </div>
        )}

        {/* Summary legend */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { color: '#2E7D52', label: '80%+ — מצוין' },
              { color: '#C9A84C', label: '50–79% — טוב' },
              { color: '#C87070', label: 'מתחת ל-50%' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#7A6A4A' }}>
                <div style={{ width: '28px', height: '6px', borderRadius: '99px', background: color }} />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  )
}
