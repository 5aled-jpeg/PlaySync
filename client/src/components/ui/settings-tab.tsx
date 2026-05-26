import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, Save, RefreshCw, AlertTriangle, Monitor, Coins, Timer, Check, Info, Download, Power } from "lucide-react"

interface Device {
  id: number
  name: string
  status: string
  current_session_id: number | null
}

export function SettingsTab() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [savingDeviceId, setSavingDeviceId] = useState<number | null>(null)
  const [renamedValues, setRenamedValues] = useState<Record<number, string>>({})
  const [successIndicatorId, setSuccessIndicatorId] = useState<number | null>(null)

  // Football Pricing Matrix (Match sessions)
  const [fifa1Player, setFifa1Player] = useState("100")
  const [fifa2Players, setFifa2Players] = useState("100")
  const [fifa3Players, setFifa3Players] = useState("150")
  const [fifa4Players, setFifa4Players] = useState("200")
  const [saveMatchSuccess, setSaveMatchSuccess] = useState(false)

  // Timed Games pricing rules (Hourly base)
  const [gtaRate, setGtaRate] = useState("300")
  const [mkRate, setMkRate] = useState("300")
  const [tekkenRate, setTekkenRate] = useState("300")
  const [vipRate, setVipRate] = useState("600") // default VIP to 600 DA/hr (200 DA/20m)
  const [saveTimeSuccess, setSaveTimeSuccess] = useState(false)

  // System Reset States
  const [isResetConfirming, setIsResetConfirming] = useState(false)
  const [resetInput, setResetInput] = useState("")
  const [isResetting, setIsResetting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [autoStart, setAutoStart] = useState(false)

  const handleAutoStartToggle = async () => {
    const newVal = !autoStart;
    setAutoStart(newVal);
    if ((window as any).electronAPI && (window as any).electronAPI.setAutostart) {
      await (window as any).electronAPI.setAutostart(newVal);
    }
  }

  const handleSaveData = async () => {
    // Just trigger the export. Do not auto-shutdown so the native Save dialog doesn't get interrupted.
    await handleExportCSV()
  }

  const handleExitDirect = async () => {
    window.onbeforeunload = null
    try {
      await fetch("http://localhost:3000/api/system/shutdown", { method: "POST" })
    } catch (e) {}
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch("http://localhost:3000/api/history/all")
      const transactions = await res.json()
      if (!transactions || transactions.length === 0) {
        alert("No transaction history available to export.")
        setExporting(false)
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
    } catch (e) {
      console.error("Failed to export daily history:", e)
    } finally {
      setExporting(false)
    }
  }

  // Ctrl+S key listener to trigger dynamic export
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleExportCSV()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Listen for native Electron window close requests
  useEffect(() => {
    const handleTriggerExit = () => setIsExitModalOpen(true)
    window.addEventListener("trigger-exit-modal", handleTriggerExit)
    return () => window.removeEventListener("trigger-exit-modal", handleTriggerExit)
  }, [])

  const fetchDevices = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/devices")
      const data = await res.json()
      setDevices(data)
      
      // Initialize inputs with current db names
      const initialRenames: Record<number, string> = {}
      data.forEach((d: Device) => {
        initialRenames[d.id] = d.name
      })
      setRenamedValues(initialRenames)
      setLoading(false)
    } catch (e) {
      console.error("Failed to fetch devices in Settings:", e)
      setLoading(false)
    }
  }

  // Load custom pricing matrixes from LocalStorage on mount
  useEffect(() => {
    fetchDevices()

    // Match sports pricing
    const savedMatch = localStorage.getItem("match_pricing")
    if (savedMatch) {
      try {
        const parsed = JSON.parse(savedMatch)
        if (parsed.p1) setFifa1Player(parsed.p1.toString())
        if (parsed.p2) setFifa2Players(parsed.p2.toString())
        if (parsed.p3) setFifa3Players(parsed.p3.toString())
        if (parsed.p4) setFifa4Players(parsed.p4.toString())
      } catch (e) {}
    }

    // Hourly timed pricing
    const savedTime = localStorage.getItem("timer_pricing")
    if (savedTime) {
      try {
        const parsed = JSON.parse(savedTime)
        if (parsed.gta) setGtaRate(parsed.gta.toString())
        if (parsed.mk) setMkRate(parsed.mk.toString())
        if (parsed.tekken) setTekkenRate(parsed.tekken.toString())
        if (parsed.vip) setVipRate(parsed.vip.toString())
      } catch (e) {}
    }

    // Load auto-start
    if ((window as any).electronAPI && (window as any).electronAPI.getAutostart) {
      (window as any).electronAPI.getAutostart().then(setAutoStart)
    }
  }, [])

  // Save device rename
  const handleRenameDevice = async (id: number) => {
    const newName = renamedValues[id]?.trim()
    if (!newName) return

    setSavingDeviceId(id)
    try {
      const res = await fetch("http://localhost:3000/api/devices/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: newName })
      })
      const result = await res.json()
      if (result.success) {
        setSuccessIndicatorId(id)
        setTimeout(() => setSuccessIndicatorId(null), 2500)
        fetchDevices()
      }
    } catch (e) {
      console.error("Failed to rename screen device:", e)
    } finally {
      setSavingDeviceId(null)
    }
  }

  // Save match sports pricing to LocalStorage
  const handleSaveMatchPricing = () => {
    const config = {
      p1: parseFloat(fifa1Player) || 100,
      p2: parseFloat(fifa2Players) || 100,
      p3: parseFloat(fifa3Players) || 150,
      p4: parseFloat(fifa4Players) || 200
    }
    localStorage.setItem("match_pricing", JSON.stringify(config))
    setSaveMatchSuccess(true)
    setTimeout(() => setSaveMatchSuccess(false), 3000)
  }

  // Save timed play hourly rates to LocalStorage
  const handleSaveTimePricing = () => {
    const config = {
      gta: parseFloat(gtaRate) || 300,
      mk: parseFloat(mkRate) || 300,
      tekken: parseFloat(tekkenRate) || 300,
      vip: parseFloat(vipRate) || 600
    }
    localStorage.setItem("timer_pricing", JSON.stringify(config))
    
    // Under the hood: compute rate per minute and notify active tab states
    // GTA rate is computed in DA/min (e.g. 300 DA / 60 min = 5 DA/min)
    setSaveTimeSuccess(true)
    setTimeout(() => setSaveTimeSuccess(false), 3000)
  }

  // Shift reset action
  const handleShiftReset = async () => {
    if (resetInput !== "RESET") return
    setIsResetting(true)
    try {
      const res = await fetch("http://localhost:3000/api/system/reset", {
        method: "POST"
      })
      const result = await res.json()
      if (result.success) {
        alert("Shift ledger and rooms fully reset. Starting completely fresh!")
        setResetInput("")
        setIsResetConfirming(false)
        window.location.reload()
      }
    } catch (e) {
      console.error("Failed to reset shift:", e)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="w-full h-full flex flex-col relative select-none">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
            ⚙️ Room System Control Panel
          </h1>
          <p className="text-white/40 mt-1">Configure pricing lists, screen labels, and shift ledgers.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/40 text-lg">Loading settings panel...</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-8 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 pb-8">
          {/* Main Grid: Screen labels & Pricing */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* LEFT SIDE: CONTROLS & SHORTCUTS */}
            <div className="flex flex-col gap-8">
              
              {/* CARD 1: SCREEN LABELS */}
              <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white leading-none">Console & Screen Custom Labels</h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Rename screens / PS5 designations</p>
                  </div>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {devices.map((dev) => {
                    const isSaving = savingDeviceId === dev.id
                    const isSuccess = successIndicatorId === dev.id
                    const currentVal = renamedValues[dev.id] || ""

                    return (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between gap-4 bg-white/[0.01] border border-white/5 rounded-[16px] p-3 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white/55">
                            {dev.id.toString().padStart(2, '0')}
                          </span>
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => setRenamedValues(prev => ({ ...prev, [dev.id]: e.target.value }))}
                            className="bg-transparent border-b border-transparent focus:border-cyan-400/50 outline-none text-sm text-white font-bold max-w-[150px] transition-colors py-0.5"
                          />
                        </div>

                        <button
                          onClick={() => handleRenameDevice(dev.id)}
                          disabled={isSaving || currentVal.trim() === dev.name}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isSuccess
                              ? "bg-emerald-500/25 border border-emerald-500/30 text-emerald-400"
                              : "bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40"
                          }`}
                        >
                          {isSaving ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : isSuccess ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Saved
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" /> Save
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* CARD 1B: KEYBOARD SHORTCUTS MATRIX */}
              <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 flex flex-col gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <span className="font-bold text-sm">⌨️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white leading-none">Dashboard Keyboard Shortcuts</h3>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Global hotkeys for quick terminal control</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { keys: ["F1"], action: "Matches Tab", detail: "FIFA / eFootball play" },
                    { keys: ["F2"], action: "Timer Tab", detail: "GTA / MK clocks" },
                    { keys: ["F3"], action: "Money Tab", detail: "Safe & totals registry" },
                    { keys: ["F4"], action: "Debts Tab", detail: "Outstanding accounts" },
                    { keys: ["F5"], action: "History Tab", detail: "Archival shift logs" },
                    { keys: ["ESC"], action: "Settings Tab", detail: "Dashboard settings" },
                    { keys: ["Ctrl", "S"], action: "Export Daily CSV", detail: "Backup transaction records" },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 bg-white/[0.01] border border-white/5 rounded-[16px] p-3 transition-colors hover:bg-white/[0.02]"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white/90">{item.action}</span>
                        <span className="text-[9px] text-white/35 font-semibold leading-none">{item.detail}</span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.keys.map((k, kIdx) => (
                          <span key={kIdx} className="flex items-center gap-1">
                            {kIdx > 0 && <span className="text-white/20 text-xs font-bold">+</span>}
                            <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 font-mono text-[10px] font-black text-red-400 shadow-[0_1.5px_3px_rgba(0,0,0,0.4)] tracking-wide uppercase">
                              {k}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT SIDE: PRICING CONFIGURATORS */}
            <div className="flex flex-col gap-8">
              
              {/* CARD 2: FOOTBALL MATCH PRICING */}
              <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white leading-none">Sports Matches Pricing Matrix</h3>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">FIFA / eFootball Play sessions</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveMatchPricing}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      saveMatchSuccess
                        ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10"
                    }`}
                  >
                    {saveMatchSuccess ? <><Check className="w-3.5 h-3.5" /> Config Saved</> : <><Save className="w-3.5 h-3.5" /> Save Config</>}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* P1 */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">1 Player Rate</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={fifa1Player}
                        onChange={(e) => setFifa1Player(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-emerald-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / MATCH</span>
                    </div>
                  </div>

                  {/* P2 */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">2 Players Rate</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={fifa2Players}
                        onChange={(e) => setFifa2Players(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-emerald-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / MATCH</span>
                    </div>
                  </div>

                  {/* P3 */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">3 Players Rate</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={fifa3Players}
                        onChange={(e) => setFifa3Players(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-emerald-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / MATCH</span>
                    </div>
                  </div>

                  {/* P4 */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">4 Players Rate</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={fifa4Players}
                        onChange={(e) => setFifa4Players(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-emerald-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / MATCH</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: TIMED PLAY PRICES (HOURLY BASE) */}
              <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 flex flex-col gap-5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                      <Timer className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white leading-none">Console Play Hourly Rates</h3>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Time-based Play sessions (GTA / MK / VIP)</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveTimePricing}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      saveTimeSuccess
                        ? "bg-orange-500/20 border border-orange-500/30 text-orange-400"
                        : "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/10"
                    }`}
                  >
                    {saveTimeSuccess ? <><Check className="w-3.5 h-3.5" /> Config Saved</> : <><Save className="w-3.5 h-3.5" /> Save Config</>}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* GTA V */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">GTA V (Regular)</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={gtaRate}
                        onChange={(e) => setGtaRate(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-orange-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / HOUR</span>
                    </div>
                  </div>

                  {/* Mortal Kombat */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Mortal Kombat</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={mkRate}
                        onChange={(e) => setMkRate(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-orange-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / HOUR</span>
                    </div>
                  </div>

                  {/* Tekken */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Tekken 2P</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={tekkenRate}
                        onChange={(e) => setTekkenRate(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-orange-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / HOUR</span>
                    </div>
                  </div>

                  {/* VIP Room */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">VIP Lounge Room</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        value={vipRate}
                        onChange={(e) => setVipRate(e.target.value)}
                        className="bg-transparent text-lg font-extrabold text-white outline-none w-20 border-b border-transparent focus:border-orange-500/50"
                      />
                      <span className="text-xs text-white/30 font-bold">DA / HOUR</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* EXPORT DAILY HISTORY */}
          <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-none">Export Daily History Registry</h3>
                <p className="text-xs text-white/40 mt-1.5">
                  Export all play sessions, transactions, and safe drawer movements as an organized spreadsheet.
                  <span className="text-red-400 font-semibold border border-red-500/20 bg-red-500/5 px-1.5 py-0.5 rounded text-[10px] ml-2 tracking-wider">
                    CTRL + S SHORTCUT
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-[16px] transition-all duration-300 shadow-lg shadow-emerald-600/15"
            >
              {exporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download CSV Report
                </>
              )}
            </button>
          </div>

          {/* DANGEROUS SYSTEM SHIFT RESET */}
          <div className="bg-gradient-to-br from-red-950/20 to-red-900/10 border border-red-500/15 rounded-[28px] p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-500 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-400">Shift Clean Startup & System Reset</h3>
                <p className="text-xs text-white/40">Purges all transactions, matches, timer records, and ledger history to start a new shift completely fresh.</p>
              </div>
            </div>

            {!isResetConfirming ? (
              <button
                onClick={() => setIsResetConfirming(true)}
                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-[16px] max-w-max transition-all self-start"
              >
                Reset Shift Ledger & Clear Room
              </button>
            ) : (
              <div className="flex flex-col gap-3 max-w-md bg-black/30 border border-red-500/20 rounded-[20px] p-4 mt-2">
                <span className="text-xs text-white/70 font-semibold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-red-400" />
                  Type <span className="font-mono text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded">RESET</span> below to confirm permanent delete:
                </span>
                
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={resetInput}
                    onChange={(e) => setResetInput(e.target.value)}
                    placeholder="Type RESET"
                    className="flex-1 bg-white/5 border border-white/10 rounded-[12px] px-3.5 py-2 outline-none text-white text-sm font-bold uppercase"
                  />
                  <button
                    onClick={handleShiftReset}
                    disabled={resetInput !== "RESET" || isResetting}
                    className="bg-red-600 disabled:opacity-40 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-[12px] transition-colors"
                  >
                    {isResetting ? "Wiping..." : "Confirm Purge"}
                  </button>
                  <button
                    onClick={() => { setIsResetConfirming(false); setResetInput("") }}
                    className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-4 py-2.5 rounded-[12px] text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* APP EXIT & LIFECYCLE CONTROLS */}
          <div className="bg-gradient-to-br from-neutral-950/40 to-neutral-900/10 border border-white/5 rounded-[28px] p-6 flex flex-col gap-6">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Auto-Start with Windows</h3>
                  <p className="text-xs text-white/40 mt-1.5 font-medium">Launch the dashboard automatically when the computer turns on.</p>
                </div>
              </div>
              <button
                onClick={handleAutoStartToggle}
                className={`flex items-center gap-2 px-5 py-3 rounded-[16px] font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-lg ${
                  autoStart 
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/15" 
                    : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
                }`}
              >
                {autoStart ? <><Check className="w-4 h-4" /> ON - Enabled</> : "OFF - Disabled"}
              </button>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <Power className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-none">Power Off & Exit Session</h3>
                  <p className="text-xs text-white/40 mt-1.5 font-medium">Safely terminate the current management dashboard panel and close the window.</p>
                </div>
              </div>

              <button
                onClick={() => setIsExitModalOpen(true)}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-[16px] transition-all duration-300 shadow-lg shadow-red-600/15"
              >
                <Power className="w-4 h-4" /> Shutdown & Exit
              </button>
            </div>
          </div>

          {/* DEVELOPER CREDIT FOOTER */}
          <div className="mt-4 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left flex-shrink-0">
            <div>
              <h4 className="text-xs font-black text-white tracking-wider flex items-center gap-2 justify-center md:justify-start uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                DASHBOARD CREATED BY KHALED
              </h4>
              <p className="text-[9px] text-white/30 uppercase tracking-widest mt-1 font-bold">
                Automated Game Room Management Solutions
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/5aled_jpeg/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-pink-400 hover:bg-pink-500/10 hover:border-pink-500/20 transition-all duration-300 shadow-md"
                title="Follow on Instagram"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>

              {/* GitHub */}
              <a
                href="https://github.com/5aled-jpeg"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-md"
                title="View GitHub"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>

              {/* Telegram */}
              <a
                href="https://t.me/Mr_FantastiK1"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/40 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/20 transition-all duration-300 shadow-md"
                title="Contact on Telegram"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </a>
            </div>
          </div>

        </div>
      )}

      {/* EXIT LIFECYCLE MODAL */}
      <AnimatePresence>
        {isExitModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              onClick={() => setIsExitModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="w-full max-w-md bg-white/[0.02] border border-white/10 rounded-[32px] p-8 relative overflow-hidden shadow-2xl z-10 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-500 mx-auto mb-6">
                <Power className="w-8 h-8 animate-pulse" />
              </div>

              <h2 className="text-xl font-extrabold text-white tracking-tight leading-none mb-2">
                SHUTDOWN SYSTEM SESSION?
              </h2>
              <p className="text-xs text-white/40 mb-8 uppercase tracking-wider font-semibold">Choose a safe exit routine below:</p>

              <div className="flex flex-col gap-3">
                {/* Step 1: Save */}
                <button
                  onClick={handleSaveData}
                  className="w-full py-4 rounded-[20px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01] shadow-lg shadow-emerald-600/10"
                >
                  <Save className="w-4 h-4" /> 1. Export Data to CSV
                </button>

                {/* Step 2: Exit */}
                <button
                  onClick={handleExitDirect}
                  className="w-full py-4 rounded-[20px] bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.01] shadow-lg shadow-red-600/10"
                >
                  <Power className="w-4 h-4" /> 2. Confirm Shutdown
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setIsExitModalOpen(false)}
                  className="w-full py-3.5 rounded-[20px] text-white/40 hover:bg-white/5 hover:text-white transition-all duration-300 font-semibold text-xs uppercase tracking-wider mt-2"
                >
                  Cancel (Keep Dashboard Open)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
