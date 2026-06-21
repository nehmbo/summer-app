'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { Sparkles, Phone, AlertCircle, CheckCircle2, CalendarCheck, LogOut } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────────────
const COMPLIMENTS = [
  'סחתיין עלייך! 🌟',
  'כל הכבוד לך! 🏆',
  'את אלופת עולם! 👑',
  'אין דברים כמוך! 💎',
];

const HEB_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const FONT = "var(--font-heebo), 'Heebo', sans-serif";
const GOLD_GRAD = 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)';
const BG_GRAD = 'linear-gradient(160deg, #FDFAF4 0%, #F7F0E0 45%, #EFE5CC 100%)';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function randomCompliment(): string {
  return COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
}

function fireGoldConfetti(intensity: 'full' | 'light' = 'full') {
  const count = intensity === 'full' ? 160 : 80;
  confetti({
    particleCount: count, spread: 90, origin: { y: 0.6 },
    colors: ['#C9A84C', '#E8D5A3', '#F5ECD7', '#D4A96A', '#B8860B', '#EDD9A3'],
    scalar: intensity === 'full' ? 1.1 : 0.9,
  });
  if (intensity === 'full') {
    setTimeout(() => {
      confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, colors: ['#C9A84C', '#E8D5A3', '#D4B896'] });
      confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors: ['#C9A84C', '#F5ECD7', '#D4A96A'] });
    }, 180);
  }
}

interface MissingDay { iso: string; name: string }

// ─── Component ───────────────────────────────────────────────────────────────
export default function ClassVotingPage({ params }: { params: Promise<{ class_id: string }> }) {
  const { class_id } = use(params);
  
  // Class Details
  const [classDetails, setClassDetails] = useState<any>(null);
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Voting State
  const [isLoading, setIsLoading] = useState(true);
  const [points, setPoints] = useState<number | null>(null);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [hasVotedToday, setHasVotedToday] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compliment, setCompliment] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // Makeup votes
  const [missingDays, setMissingDays] = useState<MissingDay[]>([]);
  const [completedMakeups, setCompletedMakeups] = useState<Set<string>>(new Set());
  const [makeupMessages, setMakeupMessages] = useState<Map<string, string>>(new Map());
  const [submittingMakeup, setSubmittingMakeup] = useState<string | null>(null);

  // 1. Initial Load (Fetch class details & check session)
  useEffect(() => {
    async function fetchClass() {
      try {
        const { data: clsData, error: clsError } = await supabase
          .from('classes')
          .select('*')
          .eq('id', class_id)
          .single();
        
        if (clsError) throw clsError;
        setClassDetails(clsData);

        if (typeof window !== 'undefined') {
          const savedPhone = localStorage.getItem(`student_${class_id}`);
          if (savedPhone) {
            await verifyStudent(savedPhone, true);
          } else {
            setIsLoading(false);
          }
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error fetching class:', err);
        setIsLoading(false);
      }
    }
    fetchClass();
  }, [class_id]);

  // Verify student by phone number
  const verifyStudent = async (phone: string, autoLogin: boolean = false) => {
    const normalizePhone = (p: string) => {
      if (!p) return '';
      let digits = p.toString().replace(/\D/g, '');
      if (digits.startsWith('972')) {
        digits = '0' + digits.slice(3);
      } else if (digits.length === 9 && !digits.startsWith('0')) {
        digits = '0' + digits;
      }
      return digits;
    };

    const targetPhone = normalizePhone(phone);
    if (!targetPhone) return false;

    // Fetch all students for this class to do robust phone matching
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', class_id);

    if (error || !data) {
      if (autoLogin && typeof window !== 'undefined') {
        localStorage.removeItem(`student_${class_id}`);
      }
      return false;
    }

    const matchedStudent = data.find(s => normalizePhone(s.phone_number) === targetPhone);

    if (!matchedStudent) {
      if (autoLogin && typeof window !== 'undefined') {
        localStorage.removeItem(`student_${class_id}`);
      }
      return false;
    }

    setStudentInfo(matchedStudent);
    setIsAuthenticated(true);
    await loadVotingData(matchedStudent.id);
    return true;
  };

  // Load voting data after successful auth
  const loadVotingData = async (studentId: string) => {
    try {
      // Get all students in this class to count class points
      const { data: classStudents } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', class_id);
      
      let classPoints = 0;
      if (classStudents && classStudents.length > 0) {
        const studentIds = classStudents.map(s => s.id);
        const { count } = await supabase
          .from('votes')
          .select('*', { count: 'exact', head: true })
          .in('student_id', studentIds);
        classPoints = count ?? 0;
      }
      setPoints(classPoints);
      setTotalStudentsCount(classStudents ? classStudents.length : 0);

      // Compute this week's Saturday
      const today = new Date();
      const todayLocal = toISO(today);
      const dayOfWeek = today.getDay(); // 0 = Sunday... 6 = Saturday
      const dayOffset = (dayOfWeek + 1) % 7; // if Sat: 0, if Sun: 1

      const saturday = new Date(today);
      saturday.setDate(today.getDate() - dayOffset);
      const saturdayISO = toISO(saturday);

      // Fetch student's votes since Saturday
      const { data: weekVotes } = await supabase
        .from('votes')
        .select('created_at')
        .eq('student_id', studentId)
        .gte('created_at', `${saturdayISO}T00:00:00`);

      const votedDates = new Set(
        (weekVotes ?? []).map(v => toISO(new Date(v.created_at)))
      );

      setHasVotedToday(votedDates.has(todayLocal));

      // Calculate missing days
      const missing: MissingDay[] = [];
      for (let i = 0; i < dayOffset; i++) {
        const d = new Date(saturday);
        d.setDate(saturday.getDate() + i);
        const iso = toISO(d);
        if (!votedDates.has(iso)) {
          missing.push({ iso, name: HEB_DAY_NAMES[d.getDay()] });
        }
      }
      setMissingDays(missing);
    } catch (err) {
      console.error('Error loading voting data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput) return;

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const isValid = await verifyStudent(phoneInput);
      if (isValid) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`student_${class_id}`, phoneInput);
        }
      } else {
        setLoginError('מספר הטלפון לא מזוהה במערכת. אנא פנה למורה.');
      }
    } catch (err) {
      setLoginError('אירעה שגיאה. אנא נסה שוב.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`student_${class_id}`);
    }
    setIsAuthenticated(false);
    setStudentInfo(null);
    setPhoneInput('');
  };

  // ── Today's vote ──────────────────────────────────────────────────────────
  const handleVote = useCallback(async () => {
    if (isSubmitting || hasVotedToday || !studentInfo) return;
    setIsSubmitting(true);

    const { error } = await supabase
      .from('votes')
      .insert({ student_id: studentInfo.id });

    if (!error) {
      setPoints(prev => (prev ?? 0) + 1);
      setHasVotedToday(true);
      setJustVoted(true);
      setCompliment(randomCompliment());
      setAnimKey(k => k + 1);
      fireGoldConfetti('full');
    }
    setIsSubmitting(false);
  }, [isSubmitting, hasVotedToday, studentInfo]);

  // ── Makeup vote ───────────────────────────────────────────────────────────
  const handleMakeup = useCallback(async (day: MissingDay) => {
    if (submittingMakeup || completedMakeups.has(day.iso) || !studentInfo) return;
    setSubmittingMakeup(day.iso);

    // Insert vote with explicit created_at for the missing day
    const { error } = await supabase
      .from('votes')
      .insert({ student_id: studentInfo.id, created_at: `${day.iso}T09:00:00.000Z` });

    if (!error) {
      setPoints(prev => (prev ?? 0) + 1);
      setCompletedMakeups(prev => new Set([...prev, day.iso]));
      setMakeupMessages(prev => new Map([...prev, [day.iso, `ההצבעה ליום ${day.name} נקלטה! ✨`]]));
      fireGoldConfetti('light');
    }
    setSubmittingMakeup(null);
  }, [submittingMakeup, completedMakeups, studentInfo]);


  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FDFAF4]" dir="rtl">
      <div style={{ animation: 'spin 1s linear infinite', width: '30px', height: '30px', border: '3px solid #C9A84C', borderTopColor: 'transparent', borderRadius: '50%' }} />
    </div>;
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFAF4]" dir="rtl">
        <div className="text-center p-8 bg-white rounded-3xl shadow-sm border border-red-100 max-w-md w-full mx-4">
          <AlertCircle className="mx-auto text-red-400 mb-4" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">שגיאה</h2>
          <p className="text-slate-600">הכיתה לא נמצאה.</p>
        </div>
      </div>
    );
  }

  // ── Login Screen ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <main dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG_GRAD, fontFamily: FONT, padding: '1.5rem' }}>
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '24px', border: '1.5px solid rgba(201,168,76,0.25)', boxShadow: '0 20px 60px rgba(180,140,60,0.12), 0 4px 16px rgba(0,0,0,0.06)', padding: '2.75rem 2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
          
          <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: GOLD_GRAD, boxShadow: '0 8px 32px rgba(180,140,60,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={34} color="#fff" strokeWidth={1.6} />
          </div>

          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, color: '#1E1508', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>
              התחברות לכיתה
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#8A7550', fontWeight: 300, margin: 0, lineHeight: 1.7, letterSpacing: '0.01em' }}>
              {classDetails.class_name} | מורה: {classDetails.teacher_name}
            </p>
          </div>

          <div style={{ width: '50px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />

          <form onSubmit={handleLoginSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                <Phone size={18} strokeWidth={1.8} />
              </span>
              <input
                type="tel"
                dir="ltr"
                required
                placeholder="050-0000000"
                value={phoneInput}
                onChange={e => { setPhoneInput(e.target.value); setLoginError(''); }}
                style={{
                  width: '100%', padding: '0.9rem 3rem 0.9rem 1rem', borderRadius: '12px',
                  border: loginError ? '1.5px solid rgba(220,80,60,0.5)' : '1.5px solid rgba(201,168,76,0.35)',
                  background: 'rgba(255,255,255,0.8)', fontSize: '1.1rem', fontWeight: 500, color: '#1E1508',
                  fontFamily: FONT, outline: 'none', transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                  textAlign: 'left'
                }}
              />
            </div>

            {loginError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(220,80,60,0.07)', border: '1px solid rgba(220,80,60,0.2)', color: '#B83020', fontSize: '0.95rem', fontWeight: 500, animation: 'shakeIn 0.35s ease both' }}>
                <AlertCircle size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !phoneInput.trim()}
              style={{
                width: '100%', padding: '0.95rem 1.5rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 700, color: '#fff',
                background: isLoggingIn || !phoneInput.trim() ? 'linear-gradient(135deg, #D4C4A0, #BBA870)' : GOLD_GRAD,
                boxShadow: isLoggingIn || !phoneInput.trim() ? 'none' : '0 8px 28px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
                border: '1.5px solid rgba(255,255,255,0.25)', cursor: isLoggingIn || !phoneInput.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoggingIn ? 'בודק...' : 'היכנס להצבעה'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Voting Screen ─────────────────────────────────────────────────────────
  const pendingMissing = missingDays.filter(d => !completedMakeups.has(d.iso));
  const hasMakeupSection = pendingMissing.length > 0 || completedMakeups.size > 0;

  // Calculate Goal
  let targetGoal = 0;
  if (classDetails && classDetails.created_at && totalStudentsCount > 0) {
    const start = new Date(classDetails.created_at);
    start.setHours(0,0,0,0);
    const end = new Date(start.getFullYear(), 7, 31); // Aug 31
    if (end >= start) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      const targetPercent = classDetails.target_percentage || 70;
      targetGoal = Math.max(1, Math.floor(totalStudentsCount * totalDays * (targetPercent / 100)));
    }
  }

  const currentPoints = points ?? 0;
  const rawProgress = targetGoal > 0 ? (currentPoints / targetGoal) * 100 : 0;
  const isBonus = currentPoints >= targetGoal && targetGoal > 0;
  const progressPercent = Math.min(100, rawProgress);
  const bonusGoal = targetGoal > 0 ? Math.floor(targetGoal * 1.5) : 0;
  const rawBonusProgress = isBonus ? ((currentPoints - targetGoal) / (bonusGoal - targetGoal)) * 100 : 0;
  const bonusProgressPercent = Math.min(100, Math.max(0, rawBonusProgress));

  return (
    <main dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', background: BG_GRAD, fontFamily: FONT }}>

      {/* Background blobs */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
      </div>

      {/* Top Navbar */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.6)', padding: '0.4rem 1rem', borderRadius: '999px', backdropFilter: 'blur(10px)', border: '1px solid rgba(201,168,76,0.3)', color: '#5C3D0E', fontSize: '0.9rem', fontWeight: 600 }}>
          <Sparkles size={16} color="#C9A84C" /> {studentInfo?.name}
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#8A7550', fontSize: '0.85rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
          התנתק <LogOut size={14} />
        </button>
      </div>

      {/* Points banner */}
      <div id="class-points-banner" style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        padding: '0.9rem 1.5rem', background: 'linear-gradient(90deg, #1A1A2E 0%, #2D2D44 100%)',
        color: '#E8D5A3', fontSize: '1rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase',
        boxShadow: '0 2px 16px rgba(0,0,0,0.15)', fontFamily: FONT, zIndex: 10,
      }}>
        <Sparkles size={18} color="#C9A84C" />
        <span style={{ color: '#D4C4A0' }}>הנקודות של {classDetails.class_name}</span>
        <span id="class-points-value" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '2.4rem', height: '2.4rem', padding: '0 0.5rem', borderRadius: '999px',
          background: GOLD_GRAD, color: '#fff', fontSize: '1.1rem', fontWeight: 800, boxShadow: '0 2px 10px rgba(180,140,60,0.4)', transition: 'transform 0.3s ease',
        }}>
          {points === null ? '—' : points}
        </span>
      </div>

      {/* Progress Bar Banner */}
      {targetGoal > 0 && (
        <div style={{ width: '100%', maxWidth: '600px', padding: '1rem 1.5rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#5C3D0E', fontWeight: 700 }}>
            <span>יעד כיתתי {isBonus && <span style={{ color: '#C9A84C', animation: 'popIn 0.5s' }}>— יעד בונוס! 🌟</span>}</span>
            <span>{currentPoints} / {isBonus ? bonusGoal : targetGoal}</span>
          </div>
          <div style={{ width: '100%', height: '14px', background: 'rgba(201,168,76,0.2)', borderRadius: '999px', overflow: 'hidden', position: 'relative', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ 
              width: `${isBonus ? bonusProgressPercent : progressPercent}%`, 
              height: '100%', 
              background: isBonus ? 'linear-gradient(90deg, #FAD961 0%, #F76B1C 100%)' : GOLD_GRAD, 
              borderRadius: '999px', transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: '0 0 10px rgba(201,168,76,0.5)'
            }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#8A7550', margin: 0, textAlign: 'center' }}>
            {isBonus ? 'השגנו את היעד! עכשיו עולים ליעד בונוס! 🚀' : `הכיתה בדרך ליעד! חסרות עוד ${targetGoal - currentPoints} נקודות.`}
          </p>
        </div>
      )}

      {/* Hero */}
      <div style={{
        position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '1.75rem', padding: '2.5rem 1.5rem', textAlign: 'center', maxWidth: '580px', margin: '0 auto', width: '100%',
      }}>

        <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: GOLD_GRAD, boxShadow: '0 8px 32px rgba(180,140,60,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={40} color="#fff" strokeWidth={1.6} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3rem)', fontWeight: 900, color: '#1E1508', lineHeight: 1.15, margin: 0, letterSpacing: '-0.02em', fontFamily: FONT, whiteSpace: 'pre-wrap' }}>
            {classDetails.welcome_message || 'ברוכה הבאה'}
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#8A7550', fontWeight: 300, margin: 0, lineHeight: 1.75, letterSpacing: '0.01em', whiteSpace: 'pre-wrap' }}>
            {classDetails.voting_text || 'כל פעולה חיובית שלך משפיעה ומשנה את העולם סביבך'}
          </p>
        </div>

        <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />

        {/* ══════════ TODAY'S VOTE ══════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', width: '100%' }}>
          {hasVotedToday ? (
            <div id="already-voted-msg" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', padding: '1.25rem 2rem', borderRadius: '16px',
              background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(201,168,76,0.3)', boxShadow: '0 4px 24px rgba(180,140,60,0.12)', animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              <CheckCircle2 size={36} color="#C9A84C" strokeWidth={1.8} />
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#5C3D0E', letterSpacing: '0.01em' }}>
                {justVoted ? 'ההצבעה נקלטה! אין כמוך ✨' : 'כבר הצבעת היום — כל הכבוד! ✨'}
              </span>
              <span style={{ fontSize: '0.9rem', color: '#9A8060', fontWeight: 300 }}>אפשר לחזור ולהצביע מחר</span>
            </div>
          ) : (
            <button
              onClick={handleVote}
              disabled={isSubmitting}
              className="relative overflow-hidden cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-transform"
              style={{
                padding: '1.1rem 3rem', borderRadius: '14px', fontSize: '1.2rem', fontWeight: 700, color: '#fff',
                letterSpacing: '0.06em', fontFamily: FONT, background: GOLD_GRAD,
                boxShadow: '0 8px 32px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)', border: '1.5px solid rgba(255,255,255,0.3)',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>{isSubmitting ? '...' : classDetails?.button_text || '✔️ עשיתי משהו חיובי'}</span>
            </button>
          )}

          {compliment && justVoted && (
            <div key={animKey} id="compliment-display" dir="rtl" style={{
              fontSize: '1.75rem', fontWeight: 700, textAlign: 'center', padding: '1rem 2.5rem', borderRadius: '14px',
              background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 24px rgba(180,140,60,0.15)', border: '1.5px solid rgba(201,168,76,0.35)', color: '#5C3D0E',
              animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>
              {compliment}
            </div>
          )}
        </div>

        {/* ══════════ MAKEUP VOTES SECTION ══════════ */}
        {hasMakeupSection && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.35))' }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#A08040', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                <CalendarCheck size={15} color="#C9A84C" strokeWidth={2} />
                השלמת הצבעות חסרות השבוע
              </span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(201,168,76,0.35), transparent)' }} />
            </div>

            {pendingMissing.map(day => (
              <button
                key={day.iso}
                onClick={() => handleMakeup(day)}
                disabled={submittingMakeup === day.iso}
                className="hover:bg-white/80 transition-colors"
                style={{
                  width: '100%', padding: '0.8rem 1.5rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, color: '#5C3D0E', fontFamily: FONT,
                  background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(201,168,76,0.4)', boxShadow: '0 2px 12px rgba(180,140,60,0.1)',
                  cursor: submittingMakeup === day.iso ? 'wait' : 'pointer', opacity: submittingMakeup === day.iso ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                <CalendarCheck size={17} color="#C9A84C" strokeWidth={2} />
                {submittingMakeup === day.iso ? 'שולחת...' : `השלמת הצבעה ליום ${day.name}`}
              </button>
            ))}

            {[...completedMakeups].map(iso => {
              const msg = makeupMessages.get(iso);
              if (!msg) return null;
              return (
                <div key={iso} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.2rem', borderRadius: '12px',
                  background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', color: '#7A5C1E', fontSize: '0.95rem', fontWeight: 600, animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
                }}>
                  <CheckCircle2 size={17} color="#C9A84C" strokeWidth={2} />
                  {msg}
                </div>
              );
            })}
          </div>
        )}

        {/* Personal note */}
        <div style={{ marginTop: '0.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', lineHeight: 1.7 }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 300, fontStyle: 'italic', color: '#7A6A4A', letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}>
            {classDetails.bottom_message || `אוהבת ומעריכה אותך וכאן בשבילך\n${classDetails.teacher_name}`}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          0%   { transform: scale(0.5) translateY(16px); opacity: 0; }
          70%  { transform: scale(1.06) translateY(-3px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes shakeIn {
          0%   { transform: translateX(6px); opacity: 0; }
          30%  { transform: translateX(-4px); opacity: 1; }
          60%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </main>
  );
}
