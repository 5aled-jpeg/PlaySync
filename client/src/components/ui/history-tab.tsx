import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Trash2, TrendingUp, Gamepad2, Landmark, RefreshCw, AlertCircle } from "lucide-react"

interface Transaction {
  id: number
  session_id: number | null
  amount: number
  created_at: string
  game_type: string | null
  pricing_method: string | null
  device_name: string | null
  duration: number | null
}

const GAME_COLORS: Record<string, string> = {
  "FIFA 26": "#10b981",
  "eFootball": "#eab308",
  "GTA V": "#06b6d4",
  "Mortal Kombat": "#f97316",
  "Tekken": "#a855f7",
  "VIP Room": "#f1d900"
}

export function HistoryTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedDateStr, setSelectedDateStr] = useState<string>("") // e.g. "2026-05-19"

  const fetchAllHistory = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsRefreshing(true)
    try {
      const res = await fetch("http://localhost:3000/api/history/all")
      const data = await res.json()
      setTransactions(data)
      
      // Auto-select the latest date in the history that has logs
      if (data.length > 0 && !selectedDateStr) {
        const latestDate = data[0].created_at.split("T")[0]
        setSelectedDateStr(latestDate)
      }
      setLoading(false)
      setIsRefreshing(false)
    } catch (e) {
      console.error("Failed to fetch all transaction history:", e)
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchAllHistory()
  }, [])

  // Delete transaction handler
  const handleDeleteTransaction = async (sessionId: number | null, transactionId: number) => {
    if (!sessionId) {
      alert("This manual entry does not support direct deletion. Reset ledger in settings instead.");
      return;
    }
    if (!confirm("Are you sure you want to delete this historical transaction record? All synchronized links will be wiped.")) return;
    try {
      const res = await fetch("http://localhost:3000/api/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const result = await res.json();
      if (result.success) {
        fetchAllHistory();
      }
    } catch (e) {
      console.error("Failed to delete historical transaction:", e);
    }
  }

  // Helper: Format full dates to readable day strings (e.g. "Sun 17")
  const getReadableDateParts = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      const weekday = weekdays[date.getDay()]
      const dayNum = date.getDate()
      return { weekday, dayNum }
    } catch (e) {
      return { weekday: "Day", dayNum: 0 }
    }
  }

  // Group transactions by date string (YYYY-MM-DD)
  const groupedDates: Record<string, Transaction[]> = {}
  transactions.forEach(t => {
    if (!t.created_at) return
    const datePart = t.created_at.split("T")[0]
    if (!groupedDates[datePart]) {
      groupedDates[datePart] = []
    }
    groupedDates[datePart].push(t)
  })

  // Sort dates descending
  const sortedDates = Object.keys(groupedDates).sort((a, b) => b.localeCompare(a))

  // Transactions for the currently selected date
  const filteredTransactions = selectedDateStr ? groupedDates[selectedDateStr] || [] : []

  // Compute selected day KPIs
  const dayRevenue = filteredTransactions.reduce((sum, t) => sum + t.amount, 0)
  const matchesCompleted = filteredTransactions.filter(t => t.pricing_method === "match").length
  const timedPlaysCompleted = filteredTransactions.filter(t => t.pricing_method === "time").length

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat().format(val) + " DA"
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return "Just now"
    }
  }

  const getGameIconColor = (gType: string | null) => {
    if (!gType) return "#a1a1aa"
    for (const key in GAME_COLORS) {
      if (gType.includes(key)) return GAME_COLORS[key]
    }
    return "#a1a1aa"
  }

  return (
    <div className="w-full h-full flex flex-col relative select-none">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
            📅 Daily Archives & Logs
            {isRefreshing && (
              <span className="text-[10px] text-red-400 border border-red-400/20 bg-red-400/10 px-2.5 py-1 rounded-full font-semibold animate-pulse uppercase tracking-wider">
                Updating Archives...
              </span>
            )}
          </h1>
          <p className="text-white/40 mt-1">Select a calendar date to audit past shifts and player sessions.</p>
        </div>

        <button
          onClick={() => fetchAllHistory(true)}
          className="w-12 h-12 rounded-[16px] flex items-center justify-center border border-white/5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300"
          title="Sync History Archives"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin text-red-400" : ""}`} />
        </button>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/40 text-lg">Loading archival registry...</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 pb-6">
          
          {/* HORIZONTAL CALENDAR SLIDER */}
          <div className="flex-shrink-0">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Calendar Timeline</h3>
            
            {sortedDates.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-white/5 rounded-[20px] bg-white/[0.01] text-white/20 text-xs">
                No past transactions recorded yet.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {sortedDates.map((dateStr) => {
                  const isSelected = selectedDateStr === dateStr
                  const { weekday, dayNum } = getReadableDateParts(dateStr)
                  const count = groupedDates[dateStr].length

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDateStr(dateStr)}
                      className={`flex-shrink-0 w-20 h-24 rounded-[20px] flex flex-col items-center justify-center gap-1.5 transition-all duration-300 border ${
                        isSelected
                          ? "bg-[#9A031E] border-red-500/20 text-white shadow-[0_0_20px_rgba(154,3,30,0.3)] scale-[1.03]"
                          : "bg-white/5 border-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                        {weekday}
                      </span>
                      <span className="text-2xl font-extrabold tracking-tight">
                        {dayNum}
                      </span>
                      <span className="text-[9px] font-semibold opacity-40 leading-none">
                        {count} {count === 1 ? 'log' : 'logs'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {selectedDateStr && (
              <motion.div
                key={selectedDateStr}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* DAY SUMMARY KPI METRICS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
                  {/* KPI 1: Day Revenue */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-[24px] p-5 flex flex-col justify-between">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">Total Day Revenue</span>
                    <h4 className={`text-3xl font-extrabold tracking-tight mt-2 ${
                      dayRevenue >= 0 ? "text-emerald-400" : "text-red-500"
                    }`}>
                      {dayRevenue >= 0 ? "+" : ""}{formatCurrency(dayRevenue)}
                    </h4>
                  </div>

                  {/* KPI 2: Football Matches */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-[24px] p-5 flex flex-col justify-between">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">Matches Completed</span>
                    <h4 className="text-3xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
                      <Gamepad2 className="w-6 h-6 text-emerald-400/60" />
                      {matchesCompleted} {matchesCompleted === 1 ? "Match" : "Matches"}
                    </h4>
                  </div>

                  {/* KPI 3: Timed Sessions */}
                  <div className="bg-white/[0.01] border border-white/5 rounded-[24px] p-5 flex flex-col justify-between">
                    <span className="text-[9px] text-white/30 uppercase tracking-widest font-semibold">Console Timed Slots</span>
                    <h4 className="text-3xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
                      <Landmark className="w-6 h-6 text-cyan-400/60" />
                      {timedPlaysCompleted} {timedPlaysCompleted === 1 ? "Session" : "Sessions"}
                    </h4>
                  </div>
                </div>

                {/* LOGS TABLE CARD */}
                <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 flex flex-col gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white tracking-tight">Audit Transactions Ledger</h3>
                    <p className="text-xs text-white/40">Complete transaction details for {selectedDateStr}.</p>
                  </div>

                  {filteredTransactions.length === 0 ? (
                    <div className="py-16 text-center border border-dashed border-white/5 rounded-[20px] text-white/20 text-xs">
                      No records logged on this date.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[350px] pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[10px] text-white/30 uppercase tracking-widest">
                            <th className="py-3 font-semibold">Source / Activity</th>
                            <th className="py-3 font-semibold">Screen designation</th>
                            <th className="py-3 font-semibold">Billed Time</th>
                            <th className="py-3 font-semibold text-right">Revenue Billed</th>
                            <th className="py-3 font-semibold text-right w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {filteredTransactions.map((t) => {
                            const sourceLabel = t.game_type || "Cash Deposit"
                            const dotColor = getGameIconColor(t.game_type)
                            const isMatch = t.pricing_method === "match"

                            return (
                              <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                                <td className="py-4 font-semibold text-white/90 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                                  {sourceLabel}
                                </td>
                                <td className="py-4 text-white/40">{t.device_name || "Manual safe entry"}</td>
                                <td className="py-4 text-white/40">
                                  <span className="font-semibold">{formatTime(t.created_at)}</span>
                                  {t.duration && (
                                    <span className="text-[10px] text-white/20 ml-2">
                                      ({t.duration} {isMatch ? 'Matches' : 'Mins'})
                                    </span>
                                  )}
                                </td>
                                <td className={`py-4 text-right font-bold ${
                                  t.amount < 0 ? "text-red-500" : "text-emerald-400"
                                }`}>
                                  {t.amount >= 0 ? "+" : ""}{formatCurrency(t.amount)}
                                </td>
                                <td className="py-4 text-right">
                                  <button
                                    onClick={() => handleDeleteTransaction(t.session_id, t.id)}
                                    className="w-7 h-7 rounded-md bg-white/5 border border-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all duration-300 ml-auto"
                                    title="Delete Log Entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
