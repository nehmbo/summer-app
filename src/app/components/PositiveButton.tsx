'use client'

import { useState, useCallback } from 'react'
import confetti from 'canvas-confetti'

const COMPLIMENTS = [
  'סחתיין עלייך! 🌟',
  'כל הכבוד לך! 🏆',
  'את אלופת עולם! 👑',
  'אין דברים כמוך! 💎',
]

export default function PositiveButton() {
  const [compliment, setCompliment] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const handleClick = useCallback(() => {
    const random = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)]
    setCompliment(random)
    setIsAnimating(true)

    // Elegant gold & rose confetti
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#C9A84C', '#E8D5A3', '#F5ECD7', '#D4A96A', '#B8860B', '#EDD9A3'],
      scalar: 1.1,
    })

    setTimeout(() => {
      confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, colors: ['#C9A84C', '#E8D5A3', '#D4B896'] })
      confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors: ['#C9A84C', '#F5ECD7', '#D4A96A'] })
    }, 180)

    setTimeout(() => setIsAnimating(false), 600)
  }, [])

  return (
    <div className="flex flex-col items-center gap-8" dir="rtl">
      {/* Main button */}
      <button
        id="positive-action-btn"
        onClick={handleClick}
        disabled={isAnimating}
        className="relative overflow-hidden cursor-pointer"
        style={{
          padding: '1.1rem 3rem',
          borderRadius: '14px',
          fontSize: '1.2rem',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.06em',
          fontFamily: "var(--font-heebo), 'Heebo', sans-serif",
          background: 'linear-gradient(135deg, #C9A84C 0%, #D4A96A 50%, #B8860B 100%)',
          boxShadow: '0 8px 32px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget
          el.style.transform = 'translateY(-2px) scale(1.03)'
          el.style.boxShadow = '0 14px 40px rgba(180,140,60,0.45), inset 0 1px 0 rgba(255,255,255,0.25)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.transform = 'translateY(0) scale(1)'
          el.style.boxShadow = '0 8px 32px rgba(180,140,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
        }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)' }}
      >
        {/* Subtle shine */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, borderRadius: '14px', pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 55%)',
          }}
        />
        <span style={{ position: 'relative', zIndex: 1 }}>✔️ עשיתי משהו חיובי</span>
      </button>

      {/* Compliment display */}
      {compliment && (
        <div
          key={compliment + Date.now()}
          id="compliment-display"
          dir="rtl"
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            textAlign: 'center',
            padding: '1rem 2.5rem',
            borderRadius: '14px',
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 24px rgba(180,140,60,0.15)',
            border: '1.5px solid rgba(201,168,76,0.35)',
            color: '#5C3D0E',
            letterSpacing: '0.02em',
            fontFamily: "var(--font-heebo), 'Heebo', sans-serif",
            animation: 'popIn 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          {compliment}
        </div>
      )}
    </div>
  )
}
