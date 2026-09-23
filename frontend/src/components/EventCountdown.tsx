import { useEffect, useRef, useState } from 'react'

const EVENT_START = new Date('2026-09-30T10:30:00+05:30').getTime()

type TimeRemaining = {
  days: number
  hours: number
  minutes: number
  seconds: number
  isLive: boolean
}

function getTimeRemaining(now = Date.now()): TimeRemaining {
  const remaining = Math.max(0, EVENT_START - now)

  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor((remaining / 3_600_000) % 24),
    minutes: Math.floor((remaining / 60_000) % 60),
    seconds: Math.floor((remaining / 1_000) % 60),
    isLive: remaining === 0,
  }
}

const units: Array<{ key: keyof Omit<TimeRemaining, 'isLive'>; label: string }> = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
]

function FlipCalendarCard({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [previousValue, setPreviousValue] = useState(value)
  const [isFlipping, setIsFlipping] = useState(false)
  const displayValueRef = useRef(value)

  useEffect(() => {
    if (value === displayValueRef.current) return

    setPreviousValue(displayValueRef.current)
    setDisplayValue(value)
    displayValueRef.current = value
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setIsFlipping(true)
    const timer = window.setTimeout(() => setIsFlipping(false), 650)
    return () => window.clearTimeout(timer)
  }, [value])

  return <div className={`countdown-card${isFlipping ? ' is-flipping' : ''}`} aria-hidden="true">
    <span className="countdown-half countdown-half-top"><span>{displayValue}</span></span>
    <span className="countdown-half countdown-half-bottom"><span>{isFlipping ? previousValue : displayValue}</span></span>
    {isFlipping && <>
      <span className="countdown-flap countdown-flap-top"><span>{previousValue}</span></span>
      <span className="countdown-flap countdown-flap-bottom"><span>{displayValue}</span></span>
    </>}
  </div>
}

export function EventCountdown() {
  const [time, setTime] = useState(getTimeRemaining)

  useEffect(() => {
    const update = () => setTime(getTimeRemaining())
    update()
    const timer = window.setInterval(update, 1_000)
    return () => window.clearInterval(timer)
  }, [])

  return <section className="event-countdown" aria-label="Countdown to Tech Roulette">
    <div className="countdown-heading">
      <span>NEXT SPIN STARTS IN</span>
      <time dateTime="2026-09-30T10:30:00+05:30">30 SEP 2026 · 10:30 AM IST</time>
    </div>
    {time.isLive
      ? <p className="countdown-live" role="status">TECH ROULETTE IS LIVE <span aria-hidden="true">✳</span></p>
      : <div className="countdown-grid" role="timer" aria-label={`${time.days} days, ${time.hours} hours, ${time.minutes} minutes, and ${time.seconds} seconds remaining`}>
        {units.map(unit => {
          const value = String(time[unit.key]).padStart(2, '0')
          return <div className="countdown-unit" key={unit.key}>
            <FlipCalendarCard value={value} />
            <span className="countdown-label">{unit.label}</span>
          </div>
        })}
      </div>}
  </section>
}
