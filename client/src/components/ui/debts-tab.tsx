import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { User, Calendar, DollarSign, Check, ChevronDown, ChevronUp, RefreshCw, AlertCircle, Gamepad2, Timer, UserCheck, Trash2 } from "lucide-react"

interface DebtSession {
  id: number // debt ID
  session_id: number
  customer_name: string
  amount: number
  created_at: string
  status: 'unpaid' | 'paid'
  game_type: string
  mode: string
  pricing_method: string
  duration: number
  device_id: number
  device_name: string
}

// Game details for beautiful icon rendering
const GAME_META: Record<string, { icon: string; color: string }> = {
  "FIFA 26": { icon: "/icons/fifa26.png", color: "#10b981" },
  "eFootball": { icon: "/icons/efootball.png", color: "#eab308" },
  "GTA V": { icon: "/icons/gta v.png", color: "#06b6d4" },
  "Mortal Kombat": { icon: "/icons/mortal kombat icon.ico", color: "#f97316" },
  "Tekken": { icon: "/icons/tekken.png", color: "#a855f7" },
  "VIP Room": { icon: "/icons/vip.png", color: "#f1d900" }
}

export function DebtsTab() {
  const [debts, setDebts] = useState<DebtSession[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [clearingId, setClearingId] = useState<number | null>(null)
  
  // Track expanded state for debtor cards
  const [expandedDebtors, setExpandedDebtors] = useState<Record<string, boolean>>({})

  const fetchDebts = async (showSyncIndicator = false) => {
    if (showSyncIndicator) setIsRefreshing(true)
    try {
      const res = await fetch("http://localhost:3000/api/debts")
      const data = await res.json()
      setDebts(data)
      setLoading(false)
      setIsRefreshing(false)
    } catch (e) {
      console.error("Failed to fetch debts:", e)
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDebts()
  }, [])

  // Clear single debt session
  const handleClearDebt = async (debt: DebtSession) => {
    setClearingId(debt.id)
    try {
      const res = await fetch("http://localhost:3000/api/debts/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debtId: debt.id,
          sessionId: debt.session_id,
          amount: debt.amount,
          deviceId: debt.device_id,
          customerName: debt.customer_name
        })
      })

      const result = await res.json()
      if (result.success) {
        // Refresh local lists
        await fetchDebts()
      }
    } catch (e) {
      console.error("Failed to clear debt:", e)
    } finally {
      setClearingId(null)
    }
  }

  // Clear all unpaid sessions for a single customer
  const handleClearAllDebtorDebts = async (customerName: string, customerUnpaidDebts: DebtSession[]) => {
    setClearingId(-1) // global spinner on all
    try {
      for (const debt of customerUnpaidDebts) {
        await fetch("http://localhost:3000/api/debts/clear", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            debtId: debt.id,
            sessionId: debt.session_id,
            amount: debt.amount,
            deviceId: debt.device_id,
            customerName: debt.customer_name
          })
        })
      }
      await fetchDebts()
    } catch (e) {
      console.error("Failed to clear debtor debts:", e)
    } finally {
      setClearingId(null)
    }
  }

  const handleClearPaidHistory = async () => {
    if (!confirm("Are you sure you want to clear all paid debts logs? This cannot be undone.")) return;
    try {
      const res = await fetch("http://localhost:3000/api/debts/clear-paid-history", {
        method: "POST"
      });
      const result = await res.json();
      if (result.success) {
        fetchDebts();
      }
    } catch (e) {
      console.error("Failed to clear paid debts history:", e);
    }
  }

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

  const toggleExpand = (name: string) => {
    setExpandedDebtors(prev => ({
      ...prev,
      [name]: !prev[name]
    }))
  }

  // Separate unpaid and paid debts
  const unpaidDebts = debts.filter(d => d.status === "unpaid")
  const paidDebts = debts.filter(d => d.status === "paid")

  // Group unpaid debts by customer name
  const debtorGroups: Record<string, DebtSession[]> = {}
  unpaidDebts.forEach(d => {
    const name = d.customer_name || "Unknown Customer"
    if (!debtorGroups[name]) {
      debtorGroups[name] = []
    }
    debtorGroups[name].push(d)
  })

  // Calculate stats
  const totalUnpaidAmount = unpaidDebts.reduce((sum, d) => sum + d.amount, 0)
  const uniqueDebtorsCount = Object.keys(debtorGroups).length

  return (
    <div className="w-full h-full flex flex-col relative select-none">
      {/* Header Section */}
      <header className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            📓 Debts Ledger Registry
            {isRefreshing && (
              <span className="text-[10px] text-red-400 border border-red-400/20 bg-red-400/10 px-2.5 py-1 rounded-full font-semibold animate-pulse uppercase tracking-wider">
                Syncing Debts...
              </span>
            )}
          </h1>
          <p className="text-zinc-500 dark:text-white/40 mt-1">Track outstanding customer debts and process invoice payments.</p>
        </div>

        <button
          onClick={() => fetchDebts(true)}
          className="w-12 h-12 rounded-[16px] flex items-center justify-center border border-zinc-200 dark:border-white/5 bg-black/5 dark:bg-white/5 text-zinc-700 dark:text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300"
          title="Refresh Debts Ledger"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin text-red-400" : ""}`} />
        </button>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 dark:text-white/40 text-lg">Loading debts database...</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 pb-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-shrink-0">
            {/* Metric 1: Total Outstanding Unpaid Debt */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[24px] border border-red-500/15 bg-gradient-to-br from-red-950/20 to-red-900/10 p-6 shadow-2xl"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-red-500/5 blur-3xl" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">Outstanding Room Debt</span>
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <h2 className="text-4xl font-extrabold text-red-400 tracking-tight leading-none mb-1">
                {formatCurrency(totalUnpaidAmount)}
              </h2>
              <span className="text-[10px] text-zinc-500 dark:text-white/30 font-medium uppercase tracking-wider flex items-center gap-1 mt-2">
                ⚠️ Total assets to collect from customers
              </span>
            </motion.div>

            {/* Metric 2: Active Accounts */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-[24px] border border-zinc-200 dark:border-white/5 bg-white/[0.02] p-6 shadow-2xl"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-black/5 dark:bg-white/5 blur-3xl" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">Active Debtor Accounts</span>
                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-700 dark:text-white/60">
                  <User className="w-5 h-5" />
                </div>
              </div>
              <h2 className="text-4xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none mb-1">
                {uniqueDebtorsCount}
              </h2>
              <span className="text-[10px] text-zinc-500 dark:text-white/30 font-medium uppercase tracking-wider flex items-center gap-1 mt-2">
                👤 Unique players with pending logs
              </span>
            </motion.div>
          </div>

          {/* Active Debtors Grid */}
          <div className="flex-shrink-0">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight mb-4 flex items-center gap-2">
              👤 Debtor Accounts Directory
              <span className="text-[10px] font-normal text-zinc-500 dark:text-white/30 tracking-widest uppercase">
                (Click card to view details)
              </span>
            </h3>

            {uniqueDebtorsCount === 0 ? (
              <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-white/5 rounded-[24px] bg-white/[0.01]">
                <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-zinc-200 dark:border-white/5 flex items-center justify-center mx-auto mb-4 text-emerald-400/40">
                  <UserCheck className="w-8 h-8" />
                </div>
                <span className="text-zinc-500 dark:text-white/30 text-lg mb-1 block font-medium">Safe Drawer is fully cleared!</span>
                <span className="text-zinc-500 dark:text-white/40 text-xs">No active debtor sessions exist. You are completely debt-free.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(debtorGroups).map((name) => {
                  const customerDebts = debtorGroups[name]
                  const sumDebts = customerDebts.reduce((sum, d) => sum + d.amount, 0)
                  const isExpanded = !!expandedDebtors[name]
                  const firstLetter = name.trim().charAt(0).toUpperCase()

                  return (
                    <motion.div
                      key={name}
                      layout
                      className="bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[24px] p-5 shadow-2xl flex flex-col relative overflow-hidden transition-all duration-300"
                    >
                      {/* Breathtaking red blur indicator */}
                      <div className="absolute -top-12 -right-12 w-28 h-28 rounded-full bg-red-500/[0.02] blur-2xl pointer-events-none" />

                      {/* Header profile row */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {/* Beautiful gradient avatar badge */}
                          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-red-600/30 to-red-500/10 border border-red-500/20 flex items-center justify-center font-bold text-zinc-900 dark:text-white tracking-wider">
                            {firstLetter}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-zinc-900 dark:text-white font-bold text-base leading-tight">
                              {name}
                            </span>
                            <span className="text-[10px] text-zinc-500 dark:text-white/30 tracking-widest uppercase mt-0.5">
                              {customerDebts.length} {customerDebts.length === 1 ? 'Pending log' : 'Pending logs'}
                            </span>
                          </div>
                        </div>

                        {/* Cost balance badge */}
                        <div className="text-right">
                          <span className="text-[9px] text-zinc-500 dark:text-white/30 uppercase tracking-widest block mb-0.5">Balance</span>
                          <span className="text-lg font-extrabold text-red-500 tracking-tight">{formatCurrency(sumDebts)}</span>
                        </div>
                      </div>

                      {/* Expanding Accordion Trigger button */}
                      <button
                        onClick={() => toggleExpand(name)}
                        className="w-full flex items-center justify-between py-2 px-3.5 bg-black/5 dark:bg-white/5 rounded-[12px] text-zinc-700 dark:text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold mb-4 focus:outline-none"
                      >
                        <span>{isExpanded ? "Hide detailed matches" : "Show detailed matches"}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {/* Accordion Session Item List */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-3 mb-4 border-t border-dashed border-zinc-200 dark:border-white/5 pt-3"
                          >
                            {customerDebts.map((debt) => {
                              const gameColor = GAME_META[debt.game_type]?.color || "#3b82f6"
                              return (
                                <div key={debt.id} className="bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-[16px] p-3 flex flex-col gap-2 relative">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-semibold text-zinc-700 dark:text-white/80 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: gameColor }} />
                                      {debt.game_type}
                                    </span>
                                    <span className="text-xs font-bold text-red-400">{formatCurrency(debt.amount)}</span>
                                  </div>

                                  <div className="flex justify-between items-center text-[10px] text-zinc-500 dark:text-white/30">
                                    <span>{debt.device_name} ({debt.mode})</span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatTime(debt.created_at)}
                                    </span>
                                  </div>

                                  {/* Clear Debt single button */}
                                  <button
                                    onClick={() => handleClearDebt(debt)}
                                    disabled={clearingId !== null}
                                    className="w-full mt-1.5 py-1.5 rounded-[8px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                                  >
                                    {clearingId === debt.id ? "Processing..." : "Clear This Session"}
                                  </button>
                                </div>
                              )
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Clear All Button */}
                      <button
                        onClick={() => handleClearAllDebtorDebts(name, customerDebts)}
                        disabled={clearingId !== null}
                        className="w-full py-3 rounded-[16px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-zinc-900 dark:text-white font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 hover:scale-[1.01]"
                      >
                        <Check className="w-4 h-4" />
                        Clear All Balance ({formatCurrency(sumDebts)})
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cleared Debts Ledger Log Table */}
          <div className="bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-[28px] p-6 flex flex-col gap-4 flex-shrink-0 mt-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">Cleared Debt Ledger Logs</h3>
                <p className="text-xs text-zinc-500 dark:text-white/40">Audit registry of recently paid off debts.</p>
              </div>

              {paidDebts.length > 0 && (
                <button
                  onClick={handleClearPaidHistory}
                  className="flex items-center gap-1.5 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-[12px] font-semibold text-[10px] uppercase tracking-wider transition-all duration-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
              )}
            </div>

            {paidDebts.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 dark:text-white/20 text-xs">
                No debts cleared today yet.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[220px] pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-white/5 text-[10px] text-zinc-500 dark:text-white/30 uppercase tracking-widest">
                      <th className="py-3 font-semibold">Customer</th>
                      <th className="py-3 font-semibold">Session details</th>
                      <th className="py-3 font-semibold">Cleared Time</th>
                      <th className="py-3 font-semibold text-right">Paid Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {paidDebts.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-4 font-bold text-zinc-700 dark:text-white/90">{t.customer_name}</td>
                        <td className="py-4 text-zinc-500 dark:text-white/40">{t.game_type} ({t.device_name})</td>
                        <td className="py-4 text-zinc-500 dark:text-white/40 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-white/20" />
                          {formatTime(t.created_at)}
                        </td>
                        <td className="py-4 text-right font-bold text-emerald-400 flex items-center gap-1 justify-end">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 mr-1.5">CLEARED</span>
                          +{formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
