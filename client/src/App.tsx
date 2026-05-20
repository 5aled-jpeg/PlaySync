import { useState, useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Gamepad2, Timer, Coins, Receipt, Settings, Volume2, VolumeX, AlertTriangle, Check, RefreshCw, User, Calendar } from "lucide-react"
import { GooeyFilter } from "@/components/ui/gooey-filter"
import { TimerTab } from "@/components/ui/timer-tab"
import { MatchesTab } from "@/components/ui/matches-tab"
import { MoneyTab } from "@/components/ui/money-tab"
import { DebtsTab } from "@/components/ui/debts-tab"
import { SettingsTab } from "@/components/ui/settings-tab"
import { HistoryTab } from "@/components/ui/history-tab"
import { GlassTimeCard } from "@/components/ui/glass-time-card"
import { TitleBar } from "@/components/ui/title-bar"
import { useScreenSize } from "@/hooks/use-screen-size"

const TAB_CONTENT = [
  { id: "matches", title: "Matches", icon: Gamepad2, color: "#1e1e1e" },
  { id: "timer", title: "Timer", icon: Timer, color: "#1e1e1e" },
  { id: "money", title: "Money", icon: Coins, color: "#1e1e1e" },
  { id: "debts", title: "Debts", icon: Receipt, color: "#1e1e1e" },
  { id: "history", title: "History", icon: Calendar, color: "#1e1e1e" },
  { id: "settings", title: "Settings", icon: Settings, color: "#1e1e1e" },
]

function App() {
  const [activeTab, setActiveTab] = useState(4)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const screenSize = useScreenSize()

  // --- NATIVE DESKTOP CLOSE LISTENER ---
  useEffect(() => {
    const handleElectronClose = () => {
      setActiveTab(5) // Switch to settings tab
      setTimeout(() => window.dispatchEvent(new Event('trigger-exit-modal')), 100)
    }
    window.addEventListener('electron-close-request', handleElectronClose)
    return () => window.removeEventListener('electron-close-request', handleElectronClose)
  }, [])

  // --- KEYBOARD SHORTCUTS FOR NAVIGATION ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering navigation when typing in inputs/textareas
      const activeEl = document.activeElement
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      )

      if (isTyping) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur()
        }
        return
      }

      // Catch Ctrl+S combinations globally to trigger instant CSV history download
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        try {
          fetch("http://localhost:3000/api/history/all")
            .then(res => res.json())
            .then(transactions => {
              if (!transactions || transactions.length === 0) {
                alert("No transaction history available to export.")
                return
              }
              const headers = [
                "Transaction ID",
                "Timestamp",
                "Console Screen",
                "Game/Activity",
                "Pricing Method",
                "Duration",
                "Amount Billed (DA)"
              ]
              const rows = transactions.map((t: any) => [
                t.id,
                t.created_at,
                t.device_name || "Manual drawer adjustment",
                t.game_type || "Safe Action",
                t.pricing_method || "Direct Cash",
                t.duration ? `${t.duration} ${t.pricing_method === 'match' ? 'Matches' : 'Mins'}` : "N/A",
                t.amount
              ])
              const totalRevenue = transactions.reduce((sum: number, t: any) => sum + t.amount, 0)

              const csvContent = [
                headers.join(","),
                ...rows.map((row: any[]) => row.map(val => {
                  const stringVal = String(val).replace(/"/g, '""')
                  return `"${stringVal}"`
                }).join(",")),
                "",
                `"Total Billed Revenue",,,,,,"${totalRevenue} DA"`
              ].join("\n")
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
              const url = URL.createObjectURL(blob)
              const link = document.createElement("a")
              link.href = url
              link.setAttribute("download", `GameRoom_History_Export_${new Date().toISOString().split('T')[0]}.csv`)
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
            })
        } catch (err) {
          console.error("Ctrl+S export failed:", err)
        }
        return
      }

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          setActiveTab(0)
          break
        case 'F2':
          e.preventDefault()
          setActiveTab(1)
          break
        case 'F3':
          e.preventDefault()
          setActiveTab(2)
          break
        case 'F4':
          e.preventDefault()
          setActiveTab(3)
          break
        case 'F5':
          e.preventDefault()
          setActiveTab(4)
          break
        case 'Escape':
          e.preventDefault()
          setActiveTab(5)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Protect shift data and timers by showing a confirmation prompt on accidental tab closures
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const msg = "Are you sure you want to exit? Active timers and unsaved shift history will be lost."
      e.returnValue = msg
      return msg
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // --- GLOBAL TIMER COUNTDOWN & ALARM SYSTEM ---
  const [globalTimedSessions, setGlobalTimedSessions] = useState<any[]>([])
  const [alarmingSession, setAlarmingSession] = useState<any | null>(null)
  const [isAlarmMuted, setIsAlarmMuted] = useState(false)

  // Sub-modal state for closing session from alarm
  const [isStoppingFromAlarm, setIsStoppingFromAlarm] = useState(false)
  const [isAlarmDebt, setIsAlarmDebt] = useState(false)
  const [alarmCustomerName, setAlarmCustomerName] = useState("")

  const audioIntervalRef = useRef<any>(null)

  // Fetch all devices to check for active timed sessions
  const fetchGlobalTimedSessions = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/devices")
      const data = await res.json()
      
      const activeTimers: any[] = []
      data.forEach((dev: any) => {
        if (dev.status === "active" && dev.pricing_method === "time" && dev.duration > 0) {
          const startTimeMs = new Date(dev.start_time).getTime()
          const totalSeconds = dev.duration * 60
          const elapsedSeconds = Math.floor((Date.now() - startTimeMs) / 1000)
          const secondsLeft = Math.max(0, totalSeconds - elapsedSeconds)
          
          activeTimers.push({
            id: dev.current_session_id,
            deviceId: dev.id,
            deviceName: dev.name,
            gameType: dev.game_type,
            totalSeconds,
            secondsLeft,
            priceRate: dev.price_rate,
            controllerCount: dev.controller_count,
            startTime: dev.start_time,
            totalCost: dev.total_cost || (dev.duration * dev.price_rate)
          })
        }
      })

      setGlobalTimedSessions(activeTimers)

      // Find the first timer that has expired and hasn't been handled yet
      const expired = activeTimers.find(s => s.secondsLeft <= 0)
      if (expired) {
        // Only set if not already set, or if it is a different session
        if (!alarmingSession || alarmingSession.id !== expired.id) {
          setAlarmingSession(expired)
        }
      } else {
        setAlarmingSession(null)
      }
    } catch (e) {
      console.error("Global timer fetch error:", e)
    }
  }

  // Periodic polling to stay perfectly synced with backend
  useEffect(() => {
    fetchGlobalTimedSessions()
    const interval = setInterval(fetchGlobalTimedSessions, 4000)
    return () => clearInterval(interval)
  }, [alarmingSession])

  // Second-by-second high-precision ticking in browser background
  useEffect(() => {
    const tick = setInterval(() => {
      setGlobalTimedSessions((prev) =>
        prev.map((s) => {
          if (s.secondsLeft <= 0) {
            return s
          }
          const nextSec = s.secondsLeft - 1
          if (nextSec <= 0) {
            // Trigger alarm instantly in browser memory
            setAlarmingSession(s)
            return { ...s, secondsLeft: 0 }
          }
          return { ...s, secondsLeft: nextSec }
        })
      )
    }, 1000)

    return () => clearInterval(tick)
  }, [])

  // Looping audio synthesizer for the screen alarm
  useEffect(() => {
    const playAlarmChime = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const now = audioCtx.currentTime

        const playBeep = (time: number, freq: number, duration: number) => {
          const osc = audioCtx.createOscillator()
          const gainNode = audioCtx.createGain()

          osc.type = "sine"
          osc.frequency.setValueAtTime(freq, time)

          gainNode.gain.setValueAtTime(0, time)
          gainNode.gain.linearRampToValueAtTime(0.3, time + 0.05)
          gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration)

          osc.connect(gainNode)
          gainNode.connect(audioCtx.destination)

          osc.start(time)
          osc.stop(time + duration)
        }

        // Apple-style triple pitch alert
        playBeep(now, 523.25, 0.15) // C5
        playBeep(now + 0.18, 659.25, 0.15) // E5
        playBeep(now + 0.36, 783.99, 0.35) // G5
      } catch (e) {
        console.error("Failed to play synthesized alarm beep:", e)
      }
    }

    if (alarmingSession && !isAlarmMuted) {
      if (!audioIntervalRef.current) {
        playAlarmChime()
        audioIntervalRef.current = setInterval(playAlarmChime, 2500)
      }
    } else {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current)
        audioIntervalRef.current = null
      }
    }

    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current)
        audioIntervalRef.current = null
      }
    }
  }, [alarmingSession, isAlarmMuted])

  // Handle manual stop and billing from the overlay
  const handleStopFromAlarm = async () => {
    if (!alarmingSession) return

    try {
      const res = await fetch("http://localhost:3000/api/sessions/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: alarmingSession.id,
          deviceId: alarmingSession.deviceId,
          totalCost: alarmingSession.totalCost,
          isDebt: isAlarmDebt,
          customerName: isAlarmDebt ? alarmCustomerName : ""
        })
      })

      const result = await res.json()
      if (result.success) {
        setAlarmingSession(null)
        setIsStoppingFromAlarm(false)
        setIsAlarmDebt(false)
        setAlarmCustomerName("")
        fetchGlobalTimedSessions()
      }
    } catch (e) {
      console.error("Failed to stop session from alarm:", e)
    }
  }

  // Handle timer extension from the alarm overlay
  const handleExtendFromAlarm = async (additionalMinutes: number) => {
    if (!alarmingSession) return

    const currentDuration = Math.round(alarmingSession.totalSeconds / 60)
    const newDuration = currentDuration + additionalMinutes
    const newCost = newDuration * alarmingSession.priceRate

    try {
      const res = await fetch("http://localhost:3000/api/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: alarmingSession.id,
          duration: newDuration,
          totalCost: newCost,
          matchesPlayed: 0,
          controllerCount: alarmingSession.controllerCount,
          priceRate: alarmingSession.priceRate
        })
      })

      const result = await res.json()
      if (result.success) {
        setAlarmingSession(null)
        fetchGlobalTimedSessions()
      }
    } catch (e) {
      console.error("Failed to extend session from alarm:", e)
    }
  }

  // Track if any active overlay is open to slide page down
  const isAnyModalActive = isModalOpen || alarmingSession !== null

  return (
    <div className="relative w-full h-screen min-h-[600px] flex flex-col items-center bg-black text-[#FFFFFC] font-sans rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      <TitleBar />
      <GooeyFilter
        id="gooey-filter"
        strength={screenSize.lessThan("md") ? 8 : 15}
      />

      {/* Glass Top Bar with dynamic blur transitions */}
      <div className={`w-full h-24 flex items-center justify-between px-8 border-b border-white/5 bg-white/5 backdrop-blur-[24px] transition-all duration-500 relative ${
        isAnyModalActive ? "opacity-0 blur-xl scale-95 pointer-events-none" : "opacity-100 blur-none scale-100"
      }`}>
        
        {/* Left: GlassTimeCard */}
        <div className="flex items-center mt-8">
          <GlassTimeCard compact />
        </div>

        {/* Center: Gooey Nav Container */}
        <div className="absolute left-1/2 -translate-x-1/2 w-11/12 md:w-3/5 lg:w-1/2 mt-8 z-10">
          <div
            className="absolute inset-0"
            style={{ filter: "url(#gooey-filter)" }}
          >
            <div className="flex w-full">
              {TAB_CONTENT.map((_, index) => (
                <div key={index} className="relative flex-1 h-12 md:h-14">
                  {activeTab === index && (
                    <motion.div
                      layoutId="active-tab"
                      className="absolute inset-0 bg-[#9A031E] rounded-[24px]"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Interactive text overlay, no filter */}
          <div className="relative flex w-full">
            {TAB_CONTENT.map((tab, index) => {
              const Icon = tab.icon
              return (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className="flex-1 h-12 md:h-14 focus:outline-none"
                >
                  <span
                    className={`
                    w-full h-full flex items-center justify-center gap-2 font-medium transition-colors duration-300
                    ${activeTab === index ? "text-white" : "text-white/50 hover:text-white/80"}
                  `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{tab.title}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Balanced Empty Spacer */}
        <div className="w-[180px] hidden md:block mt-8" />

      </div>

      {/* Main Content Pane */}
      <div className="w-full flex-1 p-8 overflow-hidden relative">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full h-full bg-white/5 border border-white/5 rounded-[24px] backdrop-blur-[24px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col"
          >
            {activeTab === 0 ? (
              <MatchesTab onModalOpenChange={setIsModalOpen} />
            ) : activeTab === 1 ? (
              <TimerTab onModalOpenChange={setIsModalOpen} />
) : activeTab === 2 ? (
              <MoneyTab />
            ) : activeTab === 3 ? (
              <DebtsTab />
            ) : activeTab === 4 ? (
              <HistoryTab />
            ) : (
              <SettingsTab />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* --- FORCED SCREEN OVERRIDING ALARM OVERLAY MODAL --- */}
      <AnimatePresence>
        {alarmingSession && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Liquid-blur black back drop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />

            {/* Glowing Alarm Container Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-[#0c0506] border border-red-500/20 rounded-[32px] p-8 shadow-[0_0_60px_rgba(239,68,68,0.25)] z-10 overflow-hidden flex flex-col"
            >
              {/* Top blinking warning stripe */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500 animate-pulse" />

              {/* Header Title with animated warning sign */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 animate-bounce">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight uppercase">
                    Console Session Ended!
                  </h2>
                  <p className="text-xs text-white/40">Timer has expired. Choose a billing option below.</p>
                </div>

                {/* Alarm Mute toggle inside overlay */}
                <button
                  onClick={() => setIsAlarmMuted(!isAlarmMuted)}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 ml-auto ${
                    isAlarmMuted 
                      ? "border-red-500/20 bg-red-500/10 text-red-500" 
                      : "border-white/5 bg-white/5 text-white/60 hover:text-white"
                  }`}
                >
                  {isAlarmMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              {/* Console & Session Info Panel */}
              <div className="bg-white/[0.02] border border-white/5 rounded-[24px] p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Console name</span>
                    <span className="text-white font-bold text-lg">{alarmingSession.deviceName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Game Active</span>
                    <span className="text-red-400 font-bold text-lg">{alarmingSession.gameType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Controllers</span>
                    <span className="text-white/80 font-semibold text-sm">{alarmingSession.controllerCount} Players</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Billed Cost</span>
                    <span className="text-[#9A031E] font-extrabold text-2xl tracking-tight">{alarmingSession.totalCost} DA</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Billing Form toggle */}
              {isStoppingFromAlarm ? (
                <div className="bg-white/[0.01] border border-white/5 rounded-[24px] p-6 mb-6 space-y-4">
                  <div>
                    <label className="block text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                      Payment Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setIsAlarmDebt(false)}
                        className={`py-3.5 rounded-[16px] border font-semibold text-sm transition-all duration-300 ${
                          !isAlarmDebt
                            ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                            : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        Paid Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAlarmDebt(true)}
                        className={`py-3.5 rounded-[16px] border font-semibold text-sm transition-all duration-300 ${
                          isAlarmDebt
                            ? "bg-[#9A031E]/10 border-[#9A031E] text-red-400"
                            : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        Save as Debt
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isAlarmDebt && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <label className="block text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                          Debtor Name
                        </label>
                        <input
                          type="text"
                          value={alarmCustomerName}
                          onChange={(e) => setAlarmCustomerName(e.target.value)}
                          placeholder="e.g. Khaled"
                          className="w-full bg-black/40 border border-white/10 rounded-[16px] px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#9A031E] transition-colors"
                          autoFocus
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsStoppingFromAlarm(false)}
                      className="flex-1 py-3.5 rounded-[16px] text-white/40 hover:bg-white/5 hover:text-white transition-all duration-300 font-semibold border border-transparent hover:border-white/5"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleStopFromAlarm}
                      disabled={isAlarmDebt && !alarmCustomerName}
                      className="flex-1 py-3.5 rounded-[16px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-semibold transition-all duration-300 shadow-lg shadow-emerald-600/20"
                    >
                      Confirm Bill & Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Action 1: Extend Timer Options */}
                  <div>
                    <label className="block text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                      Extend Session duration
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[15, 30, 60].map((mins) => (
                        <button
                          key={mins}
                          onClick={() => handleExtendFromAlarm(mins)}
                          className="py-3 rounded-[16px] bg-white/5 border border-white/5 hover:bg-white/10 text-white hover:scale-[1.02] font-semibold text-xs transition-all duration-300"
                        >
                          +{mins} Min
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action 2: Stop & Checkout Button */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => setIsStoppingFromAlarm(true)}
                      className="w-full py-4 rounded-[20px] bg-red-600 hover:bg-red-500 text-white font-bold text-base transition-all duration-300 shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 hover:scale-[1.01]"
                    >
                      🔌 Stop & Bill Session
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
