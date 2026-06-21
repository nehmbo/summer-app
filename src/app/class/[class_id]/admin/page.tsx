'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, Lock, Link as LinkIcon, Copy, LogOut, Sparkles, 
  CheckCircle2, CalendarDays, Star, BarChart3, RefreshCw, Save, Eye, EyeOff, AlertCircle, Plus, Upload, Phone, User as UserIcon
} from 'lucide-react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const FONT      = "var(--font-heebo), 'Heebo', sans-serif";
const GOLD_GRAD = 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)';
const BG_GRAD   = 'linear-gradient(160deg, #FDFAF4 0%, #F7F0E0 45%, #EFE5CC 100%)';
const HEB_DAY   = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

// ─── Shared Helpers ───────────────────────────────────────────────────────────
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLabel(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return {
    abbr: HEB_DAY[d.getDay()],
    date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
  };
}

interface Week { label: string; dates: string[] }

function buildWeeks(earliestISO: string): Week[] {
  const weeks: Week[] = [];
  const today = toISO(new Date());
  const anchor = new Date(earliestISO + 'T12:00:00');
  const dayOffset = (anchor.getDay() + 1) % 7;
  anchor.setDate(anchor.getDate() - dayOffset);
  let n = 1;
  while (toISO(anchor) <= today) {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      dates.push(toISO(d));
    }
    weeks.push({ label: `שבוע ${n}`, dates });
    anchor.setDate(anchor.getDate() + 7);
    n++;
  }
  return weeks;
}

function countActiveDays(fromISO: string, toISO2: string): number {
  let c = 0;
  const cur = new Date(fromISO + 'T12:00:00');
  const end = new Date(toISO2 + 'T12:00:00');
  while (cur <= end) {
    c++;
    cur.setDate(cur.getDate() + 1);
  }
  return c;
}

const TH: React.CSSProperties = {
  padding: '0.65rem 0.7rem', fontWeight: 700, fontSize: '0.78rem',
  color: '#5C4A20', letterSpacing: '0.03em', borderBottom: '2px solid rgba(201,168,76,0.25)',
  whiteSpace: 'nowrap', textAlign: 'center', fontFamily: FONT,
};
const TD: React.CSSProperties = {
  padding: '0.6rem 0.7rem', borderBottom: '1px solid rgba(201,168,76,0.1)',
  whiteSpace: 'nowrap', fontFamily: FONT,
};

type Tab = 'summary' | number;

export default function AdminPage({ params }: { params: Promise<{ class_id: string }> }) {
  const { class_id } = use(params);

  // ── Auth & Class State ──────────────────────────────────────────────────────────
  const [classDetails, setClassDetails] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // ── Edit Texts State ────────────────────────────────────────────────────────────
  const [texts, setTexts] = useState({
    welcome_message: '',
    voting_text: '',
    bottom_message: '',
    button_text: ''
  });
  const [targetPercentage, setTargetPercentage] = useState<string>('70');
  const [isSavingTexts, setIsSavingTexts] = useState(false);

  // ── Dashboard Data State ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [students, setStudents] = useState<any[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [voteMap, setVoteMap] = useState<Map<string, Set<string>>>(new Map());
  const [voteCounts, setVoteCounts] = useState<Map<string, number>>(new Map());
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [activeDayCount, setActiveDayCount] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  // ── Student Addition State ──────────────────────────────────────────────────────
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Load basic class details first to check auth
  useEffect(() => {
    async function loadClassInfo() {
      try {
        const { data, error } = await supabase.from('classes').select('*').eq('id', class_id).single();
        if (error) throw error;
        setClassDetails(data);
        setTexts({
          welcome_message: data.welcome_message || '',
          voting_text: data.voting_text || '',
          bottom_message: data.bottom_message || '',
          button_text: data.button_text || '✔️ עשיתי משהו חיובי'
        });
        setTargetPercentage((data.target_percentage || 70).toString());

        if (typeof window !== 'undefined') {
          const isAuth = localStorage.getItem(`admin_auth_${class_id}`);
          if (isAuth === 'true') {
            setIsAuthenticated(true);
          } else {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Error loading class:', err);
        setIsLoading(false);
      }
    }
    loadClassInfo();
  }, [class_id]);

  // Load dashboard data if authenticated
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch students for this class
      const { data: studentData, error: stdError } = await supabase
        .from('students').select('id, name, phone_number')
        .eq('class_id', class_id)
        .order('name');
      if (stdError) throw stdError;

      const studentList = studentData || [];
      const studentIds = studentList.map(s => s.id);

      // Fetch votes for these students
      let voteData: any[] = [];
      let total = 0;
      if (studentIds.length > 0) {
        const { data, count, error: vError } = await supabase
          .from('votes')
          .select('student_id, created_at', { count: 'exact' })
          .in('student_id', studentIds)
          .order('created_at', { ascending: true });
        
        if (vError) throw vError;
        voteData = data || [];
        total = count ?? 0;
      }

      setTotalPoints(total);

      const allVotes = voteData;
      const map = new Map<string, Set<string>>();
      const counts = new Map<string, number>();

      for (const v of allVotes) {
        const iso = toISO(new Date(v.created_at));
        if (!map.has(v.student_id)) map.set(v.student_id, new Set());
        map.get(v.student_id)!.add(iso);
        counts.set(v.student_id, (counts.get(v.student_id) ?? 0) + 1);
      }

      const todayISO = toISO(new Date());
      const earliest = allVotes.length > 0 ? toISO(new Date(allVotes[0].created_at)) : todayISO;
      const generated = buildWeeks(earliest);
      const dayCount = countActiveDays(earliest, todayISO);

      setStudents(studentList);
      setVoteMap(map);
      setVoteCounts(counts);
      setWeeks(generated);
      setActiveDayCount(dayCount);
      setLastRefreshed(new Date());
      
      // Default to last week or summary
      if (generated.length > 0 && activeTab === 'summary') {
        setActiveTab(generated.length - 1);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (classDetails && passwordInput === classDetails.admin_password) {
      setIsAuthenticated(true);
      setAuthError('');
      if (typeof window !== 'undefined') {
        localStorage.setItem(`admin_auth_${class_id}`, 'true');
      }
    } else {
      setAuthError('סיסמה שגויה');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`admin_auth_${class_id}`);
    }
    setIsAuthenticated(false);
    setPasswordInput('');
  };

  const copyJoinLink = () => {
    const link = `${window.location.origin}/class/${class_id}`;
    navigator.clipboard.writeText(link);
    alert('קישור ההצבעה הועתק! שלח אותו לתלמידים.');
  };

  const saveTexts = async () => {
    setIsSavingTexts(true);
    try {
      const { error } = await supabase
        .from('classes')
        .update({ 
          welcome_message: texts.welcome_message,
          voting_text: texts.voting_text,
          bottom_message: texts.bottom_message,
          button_text: texts.button_text,
          target_percentage: parseInt(targetPercentage, 10) || 70
        })
        .eq('id', class_id);
      
      if (error) throw error;
      setClassDetails({ ...classDetails, ...texts });
      alert('הטקסטים נשמרו בהצלחה!');
    } catch (err) {
      console.error('Error saving texts:', err);
      alert('שגיאה בשמירת הטקסטים');
    } finally {
      setIsSavingTexts(false);
    }
  };

  const handleAddSingleStudent = async () => {
    if (!newStudentName || !newStudentPhone) return;
    setIsAddingStudent(true);
    const { data, error } = await supabase.from('students').insert({ name: newStudentName, phone_number: newStudentPhone, class_id }).select().single();
    if (!error && data) {
      alert('תלמיד נוסף בהצלחה!');
      setNewStudentName('');
      setNewStudentPhone('');
      fetchData(); // Refresh list
    } else {
      if (error?.code === '23505') { // 23505 is PostgreSQL unique violation code
        alert('התלמיד לא הוסף: מספר הטלפון הזה כבר קיים במערכת (ייתכן שיש הגבלת Unique ב-Supabase).');
      } else {
        alert(`שגיאה בהוספת תלמיד: ${error?.message || 'שגיאה לא ידועה'}`);
      }
    }
    setIsAddingStudent(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAddingStudent(true);
    
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          const toInsert = data.map(row => {
            const nameKey = Object.keys(row).find(k => k.includes('שם') || k.includes('name')) || Object.keys(row)[0];
            const phoneKey = Object.keys(row).find(k => k.includes('טלפון') || k.includes('phone') || k.includes('נייד')) || Object.keys(row)[1];
            
            return {
              class_id,
              name: row[nameKey]?.toString() || '',
              phone_number: row[phoneKey]?.toString() || ''
            };
          }).filter(s => s.name && s.phone_number);

          if (toInsert.length > 0) {
            const { error } = await supabase.from('students').insert(toInsert);
            if (!error) {
              alert(`נוספו בהצלחה ${toInsert.length} תלמידים!`);
              fetchData();
            } else {
              alert('שגיאה בשמירת התלמידים במסד הנתונים');
            }
          } else {
            alert('לא נמצאו נתונים תקינים בקובץ (יש לוודא שיש עמודות "שם" ו"טלפון")');
          }
        } catch (err) {
          alert('שגיאה בקריאת הקובץ. ודא שזהו קובץ אקסל תקין.');
        }
        setIsAddingStudent(false);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      alert('שגיאה בטעינת קורא האקסל');
      setIsAddingStudent(false);
    }
    e.target.value = ''; // Reset input
  };

  if (isLoading && !classDetails) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FDFAF4]" dir="rtl"><div style={{ animation: 'spin 1s linear infinite', width: '30px', height: '30px', border: '3px solid #C9A84C', borderTopColor: 'transparent', borderRadius: '50%' }} /></div>;
  }

  if (!isAuthenticated) {
    return (
      <main dir="rtl" style={{ minHeight: '100vh', background: BG_GRAD, fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', bottom: '5%', left: '-100px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,185,140,0.10) 0%, transparent 70%)' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRadius: '22px', border: '1.5px solid rgba(201,168,76,0.28)', boxShadow: '0 20px 60px rgba(180,140,60,0.13)', padding: '2.5rem 2.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.75rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: GOLD_GRAD, boxShadow: '0 8px 28px rgba(180,140,60,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={30} color="#fff" strokeWidth={1.8} />
          </div>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1E1508', margin: 0, letterSpacing: '-0.02em', fontFamily: FONT }}>ניהול: {classDetails?.class_name}</h1>
            <p style={{ fontSize: '0.92rem', color: '#8A7550', fontWeight: 300, margin: 0 }}>הזיני את סיסמת הניהול להמשך</p>
          </div>
          <div style={{ width: '44px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px' }} />
          
          <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <span style={{ position: 'absolute', top: '50%', right: '1rem', transform: 'translateY(-50%)', color: '#C9A84C', pointerEvents: 'none', display: 'flex' }}>
                <Lock size={16} strokeWidth={1.8} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="סיסמת מנהל"
                value={passwordInput}
                onChange={e => { setPasswordInput(e.target.value); setAuthError('') }}
                style={{
                  width: '100%', padding: '0.85rem 2.8rem 0.85rem 2.8rem', borderRadius: '11px',
                  border: authError ? '1.5px solid rgba(200,80,60,0.5)' : '1.5px solid rgba(201,168,76,0.35)',
                  background: 'rgba(255,255,255,0.85)', fontSize: '1rem', fontWeight: 500, color: '#1E1508',
                  fontFamily: FONT, outline: 'none', boxShadow: authError ? '0 0 0 3px rgba(200,80,60,0.1)' : 'none',
                  textAlign: 'right', direction: 'rtl', transition: 'all 0.18s ease'
                }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', top: '50%', left: '0.85rem', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#B0956A', display: 'flex' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {authError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 0.9rem', borderRadius: '9px', background: 'rgba(200,80,60,0.07)', border: '1px solid rgba(200,80,60,0.2)', color: '#A03020', fontSize: '0.88rem', fontWeight: 500, animation: 'shakeIn 0.35s ease both' }}>
                <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0 }} /> סיסמה שגויה
              </div>
            )}
            <button type="submit" disabled={!passwordInput.trim()} style={{ width: '100%', padding: '0.9rem', borderRadius: '11px', fontSize: '1rem', fontWeight: 700, color: '#fff', fontFamily: FONT, background: passwordInput.trim() ? GOLD_GRAD : 'linear-gradient(135deg,#D4C4A0,#BBA870)', cursor: passwordInput.trim() ? 'pointer' : 'not-allowed', border: 'none', boxShadow: passwordInput.trim() ? '0 8px 24px rgba(180,140,60,0.32)' : 'none' }}>
              כניסה למערכת
            </button>
          </form>
        </div>
        <style>{`@keyframes shakeIn { 0% { transform: translateX(6px); opacity: 0; } 30% { transform: translateX(-4px); opacity: 1; } 60% { transform: translateX(3px); } 100% { transform: translateX(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }

  const today = toISO(new Date());
  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: 'summary', label: 'סיכום כולל', icon: <BarChart3 size={14} /> },
    ...weeks.map((w, i) => ({ key: i as number, label: w.label })),
  ];
  const selectedWeek = typeof activeTab === 'number' ? weeks[activeTab] : null;

  return (
    <main dir="rtl" style={{ minHeight: '100vh', background: BG_GRAD, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>

      {/* Admin Top Navbar */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(201,168,76,0.3)', position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#5C3D0E', fontSize: '1rem', fontWeight: 700 }}>
          <Lock size={18} color="#C9A84C" />
          ניהול כיתה: {classDetails?.class_name}
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#8A7550', fontSize: '0.85rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
          יציאה מהניהול <LogOut size={14} />
        </button>
      </div>

      {/* ════════════════ LIVE PREVIEW SECTION ════════════════ */}
      <div style={{ position: 'relative', width: '100%', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.12) 0%, transparent 70%)' }} />
        </div>

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', width: '100%', maxWidth: '600px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8A7550', fontSize: '0.9rem', fontWeight: 600, background: 'rgba(255,255,255,0.6)', padding: '0.4rem 1rem', borderRadius: '999px', border: '1px solid rgba(201,168,76,0.2)' }}>
            <Eye size={16} /> תצוגת תלמיד (ניתן לערוך את הטקסטים)
          </div>

          <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: GOLD_GRAD, boxShadow: '0 8px 32px rgba(180,140,60,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={40} color="#fff" strokeWidth={1.6} />
          </div>

          {/* Editable Texts Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', alignItems: 'center' }}>
            {/* Title */}
            <input 
              value={texts.welcome_message}
              onChange={e => setTexts({...texts, welcome_message: e.target.value})}
              style={{
                width: '100%', textAlign: 'center', fontSize: 'clamp(2.2rem, 5vw, 3rem)', fontWeight: 900, color: '#1E1508', 
                background: 'rgba(255,255,255,0.4)', border: '1.5px dashed rgba(201,168,76,0.5)', borderRadius: '12px', padding: '0.2rem',
                fontFamily: FONT, letterSpacing: '-0.02em', outline: 'none'
              }}
              placeholder="כותרת (למשל: ברוכה הבאה)"
            />

            {/* Subtitle */}
            <textarea 
              value={texts.voting_text}
              onChange={e => setTexts({...texts, voting_text: e.target.value})}
              style={{
                width: '100%', textAlign: 'center', fontSize: '1.05rem', color: '#8A7550', fontWeight: 300, 
                background: 'rgba(255,255,255,0.4)', border: '1.5px dashed rgba(201,168,76,0.5)', borderRadius: '12px', padding: '0.5rem',
                fontFamily: FONT, lineHeight: 1.5, resize: 'none', minHeight: '60px', outline: 'none'
              }}
              placeholder="משפט ההצבעה"
            />

            <div style={{ width: '60px', height: '2px', background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)', borderRadius: '2px', margin: '0.5rem 0' }} />

            {/* Editable Vote Button */}
            <input 
              value={texts.button_text}
              onChange={e => setTexts({...texts, button_text: e.target.value})}
              style={{
                width: '100%', maxWidth: '320px', textAlign: 'center', padding: '1.1rem', borderRadius: '14px', 
                fontSize: '1.2rem', fontWeight: 700, color: '#fff', letterSpacing: '0.06em', fontFamily: FONT, 
                background: GOLD_GRAD, boxShadow: '0 8px 32px rgba(180,140,60,0.35)', border: '2px dashed #fff',
                outline: 'none'
              }}
              placeholder="טקסט כפתור ההצבעה (למשל: ✔️ עשיתי משהו חיובי)"
            />

            {/* Bottom Message */}
            <textarea 
              value={texts.bottom_message}
              onChange={e => setTexts({...texts, bottom_message: e.target.value})}
              style={{
                width: '100%', textAlign: 'center', fontSize: '1.25rem', color: '#7A6A4A', fontWeight: 300, fontStyle: 'italic',
                background: 'rgba(255,255,255,0.4)', border: '1.5px dashed rgba(201,168,76,0.5)', borderRadius: '12px', padding: '0.5rem',
                fontFamily: FONT, lineHeight: 1.5, resize: 'none', minHeight: '80px', marginTop: '1rem', outline: 'none'
              }}
              placeholder="חתימה למטה"
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <label style={{ fontSize: '1rem', color: '#5C3D0E', fontWeight: 600 }}>יעד כיתתי (%):</label>
              <input 
                type="number"
                min="1"
                max="1000"
                value={targetPercentage}
                onChange={e => setTargetPercentage(e.target.value)}
                style={{
                  width: '80px', textAlign: 'center', padding: '0.5rem', borderRadius: '8px', 
                  fontSize: '1.1rem', fontWeight: 700, color: '#1E1508', fontFamily: FONT, 
                  background: 'rgba(255,255,255,0.8)', border: '1.5px solid rgba(201,168,76,0.5)',
                  outline: 'none'
                }}
              />
            </div>

            <button 
              onClick={saveTexts}
              disabled={isSavingTexts}
              style={{
                marginTop: '1rem', padding: '0.8rem 2rem', borderRadius: '12px', background: '#2D2D44', color: '#fff',
                fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', transition: 'all 0.2s ease'
              }}
            >
              <Save size={18} /> {isSavingTexts ? 'שומר...' : 'שמור עיצוב לתלמידים'}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════ DIVIDER ════════════════ */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(201,168,76,0.1)' }}>
        <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4))' }} />
        <span style={{ padding: '0 1rem', fontSize: '0.9rem', fontWeight: 700, color: '#A08040', letterSpacing: '0.05em' }}>
          👆 עד כאן מה שהתלמיד רואה &nbsp; | &nbsp; מכאן אזור הניהול 👇
        </span>
        <div style={{ flex: 1, height: '2px', background: 'linear-gradient(90deg, rgba(201,168,76,0.4), transparent)' }} />
      </div>

      {/* ════════════════ ADMIN DASHBOARD ════════════════ */}
      <div style={{ flex: 1, maxWidth: '1400px', margin: '0 auto', padding: '2rem 1.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Actions & Link */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(201,168,76,0.2)', padding: '1rem', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#5C3D0E', fontWeight: 600 }}>קישור להצבעה לתלמידים:</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/class/${class_id}`} style={{ width: '180px', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.8rem', background: '#fff' }} dir="ltr" />
              <button onClick={copyJoinLink} style={{ background: '#C9A84C', color: '#fff', border: 'none', padding: '0 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, fontSize: '0.85rem' }}>
                <Copy size={14} /> העתק
              </button>
            </div>
          </div>
        </div>

        {/* ── Student Management Section ── */}
        <div style={{ background: 'rgba(255,255,255,0.85)', padding: '1.5rem', borderRadius: '16px', border: '1.5px solid rgba(201,168,76,0.2)', boxShadow: '0 8px 30px rgba(180,140,60,0.06)' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1E1508', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="#C9A84C" />
            ניהול רשימת תלמידים
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            {/* Single Student Add */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ fontSize: '0.9rem', color: '#5C3D0E', fontWeight: 600 }}>הוספת תלמיד בודד</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <UserIcon size={16} style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)', color: '#C9A84C' }} />
                  <input type="text" placeholder="שם מלא" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} style={{ width: '100%', padding: '0.7rem 2.2rem 0.7rem 0.7rem', borderRadius: '10px', border: '1.5px solid rgba(201,168,76,0.3)', outline: 'none' }} />
                </div>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Phone size={16} style={{ position: 'absolute', top: '50%', right: '0.8rem', transform: 'translateY(-50%)', color: '#C9A84C' }} />
                  <input type="tel" dir="ltr" placeholder="050-0000000" value={newStudentPhone} onChange={e => setNewStudentPhone(e.target.value)} style={{ width: '100%', padding: '0.7rem 2.2rem 0.7rem 0.7rem', borderRadius: '10px', border: '1.5px solid rgba(201,168,76,0.3)', outline: 'none', textAlign: 'left' }} />
                </div>
              </div>
              <button onClick={handleAddSingleStudent} disabled={isAddingStudent || !newStudentName || !newStudentPhone} style={{ padding: '0.7rem', borderRadius: '10px', background: GOLD_GRAD, color: '#fff', fontWeight: 700, border: 'none', cursor: (isAddingStudent || !newStudentName || !newStudentPhone) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Plus size={16} /> הוסף תלמיד
              </button>
            </div>

            {/* Divider in flex */}
            <div style={{ width: '1px', background: 'rgba(201,168,76,0.2)', display: 'block' }} />

            {/* Excel Upload */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <label style={{ fontSize: '0.9rem', color: '#5C3D0E', fontWeight: 600 }}>הוספה מקובץ אקסל (.xlsx)</label>
              <p style={{ fontSize: '0.8rem', color: '#8A7550', margin: 0 }}>הקובץ חייב להכיל עמודה בשם "שם" ועמודה בשם "טלפון".</p>
              <label style={{ cursor: isAddingStudent ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem', border: '2px dashed rgba(201,168,76,0.5)', borderRadius: '10px', background: 'rgba(255,255,255,0.6)', transition: 'all 0.2s', opacity: isAddingStudent ? 0.6 : 1 }}>
                <Upload size={24} color="#C9A84C" />
                <span style={{ fontSize: '0.9rem', color: '#5C3D0E', fontWeight: 600 }}>{isAddingStudent ? 'טוען נתונים...' : 'לחץ להעלאת קובץ אקסל'}</span>
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} disabled={isAddingStudent} />
              </label>
            </div>
          </div>
        </div>

        {/* ── Progress Bar (Admin) ── */}
        {(() => {
          let targetGoal = 0;
          if (classDetails && classDetails.created_at && students.length > 0) {
            const start = new Date(classDetails.created_at);
            start.setHours(0,0,0,0);
            const end = new Date(start.getFullYear(), 7, 31);
            if (end >= start) {
              const diffTime = Math.abs(end.getTime() - start.getTime());
              const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              const tp = classDetails.target_percentage || 70;
              targetGoal = Math.max(1, Math.floor(students.length * totalDays * (tp / 100)));
            }
          }

          if (targetGoal === 0) return null;

          const currentPoints = totalPoints;
          const rawProgress = targetGoal > 0 ? (currentPoints / targetGoal) * 100 : 0;
          const isBonus = currentPoints >= targetGoal && targetGoal > 0;
          const progressPercent = Math.min(100, rawProgress);
          const bonusGoal = targetGoal > 0 ? Math.floor(targetGoal * 1.5) : 0;
          const rawBonusProgress = isBonus ? ((currentPoints - targetGoal) / (bonusGoal - targetGoal)) * 100 : 0;
          const bonusProgressPercent = Math.min(100, Math.max(0, rawBonusProgress));

          return (
            <div style={{ background: 'rgba(255,255,255,0.85)', padding: '1.5rem', borderRadius: '16px', border: '1.5px solid rgba(201,168,76,0.2)', boxShadow: '0 8px 30px rgba(180,140,60,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', color: '#5C3D0E', fontWeight: 700, marginBottom: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Star size={18} color="#C9A84C" /> יעד כיתתי {isBonus && <span style={{ color: '#C9A84C' }}>— יעד בונוס! 🌟</span>}
                </span>
                <span>{currentPoints} / {isBonus ? bonusGoal : targetGoal}</span>
              </div>
              <div style={{ width: '100%', height: '14px', background: 'rgba(201,168,76,0.2)', borderRadius: '999px', overflow: 'hidden', position: 'relative' }}>
                <div style={{ 
                  width: `${isBonus ? bonusProgressPercent : progressPercent}%`, 
                  height: '100%', 
                  background: isBonus ? 'linear-gradient(90deg, #FAD961 0%, #F76B1C 100%)' : GOLD_GRAD, 
                  borderRadius: '999px', transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)'
                }} />
              </div>
            </div>
          );
        })()}

        {/* ── Summary cards ── */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[
            { icon: <Star size={15} color="#C9A84C" />, label: 'נקודות כיתתיות', value: totalPoints, golden: true },
            { icon: <Users size={15} color="#C9A84C" />, label: 'תלמידים בטבלה', value: students.length, golden: false },
            { icon: <CalendarDays size={15} color="#C9A84C" />, label: 'ימי פעילות', value: activeDayCount, golden: false },
            { icon: <CalendarDays size={15} color="#C9A84C" />, label: 'שבועות מוקלטים', value: weeks.length, golden: false },
          ].map(({ icon, label, value, golden }) => (
            <div key={label} style={{ flex: '1 1 160px', padding: '1.4rem 1.2rem', borderRadius: '14px', background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(12px)', border: '1.5px solid rgba(201,168,76,0.25)', boxShadow: '0 4px 20px rgba(180,140,60,0.08)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#A08040', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                {icon}{label}
              </div>
              <div style={{ fontSize: '2.6rem', fontWeight: 900, lineHeight: 1, ...(golden ? { background: GOLD_GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' } : { color: '#2A2015' }) }}>
                {isLoading ? '—' : value}
              </div>
            </div>
          ))}

          {/* Refresh */}
          <div style={{ flex: '0 0 auto', padding: '1.4rem 1.2rem', borderRadius: '14px', background: 'rgba(255,255,255,0.55)', border: '1.5px solid rgba(201,168,76,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <button onClick={fetchData} disabled={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.3rem', borderRadius: '10px', background: GOLD_GRAD, color: '#fff', fontSize: '0.88rem', fontWeight: 600, fontFamily: FONT, border: 'none', cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.7 : 1, boxShadow: '0 4px 16px rgba(180,140,60,0.28)', transition: 'all 0.18s ease' }}>
              <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              רענן טבלאות
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
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={String(tab.key)}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.6rem 1.15rem',
                    borderRadius: '8px 8px 0 0', border: 'none', borderBottom: isActive ? '2px solid #C9A84C' : '2px solid transparent',
                    marginBottom: '-2px', cursor: 'pointer', fontFamily: FONT, fontSize: '0.88rem', fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#7A5C1E' : '#9A8060', background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                    transition: 'all 0.18s ease', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table Area ── */}
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1.5px solid rgba(201,168,76,0.22)', boxShadow: '0 4px 28px rgba(180,140,60,0.09)', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)' }}>
          <div style={{ padding: '0.9rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.18)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeTab === 'summary'
              ? <><BarChart3 size={16} color="#C9A84C" /><span style={{ fontWeight: 700, color: '#2A2015', fontSize: '0.95rem' }}>סיכום כולל — כל התקופה</span></>
              : <><CalendarDays size={16} color="#C9A84C" /><span style={{ fontWeight: 700, color: '#2A2015', fontSize: '0.95rem' }}>{selectedWeek?.label} — מעקב יומי</span></>
            }
            <span style={{ fontSize: '0.78rem', color: '#A08040', fontWeight: 400 }}>({students.length} תלמידים)</span>
          </div>

          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#A08040', fontWeight: 300 }}>
              <div style={{ width: '38px', height: '38px', border: '3px solid rgba(201,168,76,0.2)', borderTopColor: '#C9A84C', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
              טוען נתונים...
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#A08040' }}>אין תלמידים רשומים בכיתה זו. צרפו תלמידים למעלה!</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {/* SUMMARY TAB */}
              {activeTab === 'summary' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, rgba(245,236,215,0.9), rgba(237,217,163,0.4))' }}>
                      <th style={{ ...TH, textAlign: 'right', minWidth: '150px', position: 'sticky', right: 0, background: '#F2E9D4', zIndex: 2, borderLeft: '1px solid rgba(201,168,76,0.22)' }}>שם התלמיד/ה</th>
                      <th style={{ ...TH, minWidth: '128px' }}>טלפון</th>
                      <th style={{ ...TH, minWidth: '90px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><Star size={12} color="#C9A84C" />נקודות</div>
                      </th>
                      <th style={{ ...TH, minWidth: '110px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><BarChart3 size={12} color="#C9A84C" />השתתפות</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => {
                      const pts  = voteCounts.get(s.id) ?? 0;
                      const pct  = activeDayCount > 0 ? Math.round((pts / activeDayCount) * 100) : 0;
                      const even = idx % 2 === 0;
                      const stickyBg = even ? 'rgba(253,250,244,0.98)' : 'rgba(247,240,224,0.98)';
                      return (
                        <tr key={s.id} style={{ background: even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }}>
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#2A2015', position: 'sticky', right: 0, background: stickyBg, zIndex: 1, borderLeft: '1px solid rgba(201,168,76,0.15)' }}>{s.name}</td>
                          <td style={{ ...TD, color: '#7A6A4A', direction: 'ltr', textAlign: 'center' }}>{s.phone_number}</td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', height: '28px', padding: '0 6px', borderRadius: '999px', background: pts > 0 ? GOLD_GRAD : 'rgba(200,190,170,0.3)', color: pts > 0 ? '#fff' : '#A09070', fontWeight: 800, fontSize: '0.8rem' }}>{pts}</span>
                          </td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                              <div style={{ width: '60px', height: '6px', borderRadius: '99px', background: 'rgba(200,190,170,0.3)', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '99px', background: pct >= 80 ? '#2E7D52' : pct >= 50 ? '#C9A84C' : '#C87070', transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: pct >= 80 ? '#2E7D52' : pct >= 50 ? '#7A5C1E' : '#8B3030', minWidth: '34px', textAlign: 'right' }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* WEEK TAB */}
              {typeof activeTab === 'number' && selectedWeek && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', fontFamily: FONT }}>
                  <thead>
                    <tr style={{ background: 'linear-gradient(90deg, rgba(245,236,215,0.9), rgba(237,217,163,0.4))' }}>
                      <th style={{ ...TH, textAlign: 'right', minWidth: '150px', position: 'sticky', right: 0, background: '#F2E9D4', zIndex: 2, borderLeft: '1px solid rgba(201,168,76,0.22)' }}>שם התלמיד/ה</th>
                      <th style={{ ...TH, minWidth: '128px' }}>טלפון</th>
                      <th style={{ ...TH, minWidth: '78px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><Star size={12} color="#C9A84C" />נקודות</div>
                      </th>
                      {selectedWeek.dates.map(iso => {
                        const { abbr, date } = formatLabel(iso);
                        const isToday = iso === today;
                        const isFuture = iso > today;
                        return (
                          <th key={iso} style={{ ...TH, minWidth: '54px', background: isToday ? 'rgba(201,168,76,0.22)' : undefined, borderBottom: isToday ? '2px solid #C9A84C' : TH.borderBottom, opacity: isFuture ? 0.45 : 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <span style={{ fontSize: '0.63rem', color: '#A08040' }}>{abbr}</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#7A5C1E' : '#4A3A20' }}>{date}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => {
                      const votedDates = voteMap.get(s.id) ?? new Set<string>();
                      const pts  = voteCounts.get(s.id) ?? 0;
                      const even = idx % 2 === 0;
                      const stickyBg = even ? 'rgba(253,250,244,0.98)' : 'rgba(247,240,224,0.98)';
                      return (
                        <tr key={s.id} style={{ background: even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.07)' }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = even ? 'rgba(255,255,255,0.65)' : 'rgba(245,236,215,0.38)' }}>
                          <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#2A2015', position: 'sticky', right: 0, background: stickyBg, zIndex: 1, borderLeft: '1px solid rgba(201,168,76,0.15)' }}>{s.name}</td>
                          <td style={{ ...TD, color: '#7A6A4A', direction: 'ltr', textAlign: 'center' }}>{s.phone_number}</td>
                          <td style={{ ...TD, textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '26px', height: '26px', padding: '0 5px', borderRadius: '999px', background: pts > 0 ? GOLD_GRAD : 'rgba(200,190,170,0.3)', color: pts > 0 ? '#fff' : '#A09070', fontWeight: 800, fontSize: '0.78rem' }}>{pts}</span>
                          </td>
                          {selectedWeek.dates.map(iso => {
                            const hasVote  = votedDates.has(iso);
                            const isPast   = iso < today;
                            const isToday  = iso === today;
                            const isFuture = iso > today;
                            let symbol: string; let color: string; let cellBg: string;
                            if (hasVote) { symbol = '✔'; color = '#2E7D52'; cellBg = 'rgba(46,125,82,0.07)'; } 
                            else if (isPast || isToday) { symbol = '✖'; color = '#C4B8A0'; cellBg = 'transparent'; } 
                            else { symbol = '—'; color = 'rgba(180,165,140,0.5)'; cellBg = 'transparent'; }
                            return (
                              <td key={iso} style={{ ...TD, textAlign: 'center', background: isToday ? `rgba(201,168,76,0.06)` : cellBg }}>
                                <span style={{ fontSize: hasVote ? '1rem' : '0.82rem', color, fontWeight: hasVote ? 700 : 400 }}>{symbol}</span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* ── Legends ── */}
        {typeof activeTab === 'number' && (
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { s: '✔', c: '#2E7D52', bg: 'rgba(46,125,82,0.08)', l: 'הצביע/ה' },
              { s: '✖', c: '#C4B8A0', bg: 'transparent', l: 'לא הצביע/ה (יום שעבר)' },
              { s: '—', c: '#C4B8A0', bg: 'transparent', l: 'טרם הגיע' },
            ].map(({ s, c, bg, l }) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#7A6A4A' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '5px', background: bg, color: c, fontWeight: 700, fontSize: '0.85rem' }}>{s}</span>
                {l}
              </div>
            ))}
          </div>
        )}

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
    </main>
  );
}