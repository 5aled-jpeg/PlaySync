import { useState, useEffect } from "react";
import { DollarSign, Landmark, TrendingUp, Calendar, ArrowUpRight, Plus, RefreshCw, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Transaction {
  id: number;
  amount: number;
  created_at: string;
  game_type: string;
  pricing_method: string;
  device_name: string;
}

interface GameBreakdown {
  game_type: string;
  revenue: number;
  count: number;
}

interface MoneyStats {
  totalPaid: number;
  todayPaid: number;
  todayDebts: number;
  transactions: Transaction[];
  gameBreakdown: GameBreakdown[];
}

export function MoneyTab() {
  const [stats, setStats] = useState<MoneyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual Cash adjustment state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const fetchMoneyStats = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const res = await fetch("http://localhost:3000/api/money/stats");
      const data = await res.json();
      setStats(data);
      setLoading(false);
      setIsRefreshing(false);
    } catch (e) {
      console.error("Error fetching money statistics:", e);
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleDeleteTransaction = async (sessionId: number | null) => {
    if (!sessionId) {
      alert("This manual entry does not support direct deletion. Clear the ledger instead.");
      return;
    }
    if (!confirm("Are you sure you want to delete this transaction record? This will adjust the safe balance.")) return;
    try {
      const res = await fetch("http://localhost:3000/api/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const result = await res.json();
      if (result.success) {
        fetchMoneyStats();
      }
    } catch (e) {
      console.error("Failed to delete transaction:", e);
    }
  };

  const handleClearLedger = async () => {
    if (!confirm("Are you sure you want to clear all ledger logs? This will reset all daily transaction history.")) return;
    try {
      const res = await fetch("http://localhost:3000/api/money/clear-ledger", {
        method: "POST"
      });
      const result = await res.json();
      if (result.success) {
        fetchMoneyStats();
      }
    } catch (e) {
      console.error("Failed to clear ledger history:", e);
    }
  };

  useEffect(() => {
    fetchMoneyStats();
  }, []);

  const handleManualAdjustment = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt)) return;

    try {
      // We can record a manual adjustment directly by sending a dummy completed match session with a specific game type like "Cash Adjust"!
      const res = await fetch("http://localhost:3000/api/sessions/record-finished", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: 1, // Default to PS5 1
          gameType: `Safe: ${adjustNote || "Cash Adjustment"}`,
          mode: "Manual Entry",
          controllerCount: 0,
          pricingMethod: "match",
          priceRate: amt,
          duration: 1,
          totalCost: amt,
          isDebt: false,
          customerName: ""
        })
      });

      const result = await res.json();
      if (result.success) {
        setAdjustAmount("");
        setAdjustNote("");
        setIsAdjustModalOpen(false);
        fetchMoneyStats(true);
      }
    } catch (e) {
      console.error("Failed to log manual cash entry:", e);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat().format(val) + " DA";
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "Just now";
    }
  };

  const getGameIconColor = (gameName: string) => {
    if (gameName.includes("FIFA")) return "#10b981"; // Emerald
    if (gameName.includes("eFootball")) return "#eab308"; // Gold
    if (gameName.includes("GTA")) return "#06b6d4"; // Cyan
    if (gameName.includes("Mortal Kombat")) return "#f97316"; // Orange
    if (gameName.includes("Tekken")) return "#a855f7"; // Purple
    if (gameName.includes("VIP")) return "#f1d900"; // Gold VIP
    return "#3b82f6"; // Default Blue
  };

  return (
    <div className="w-full h-full flex flex-col relative select-none">
      <header className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            🪙 Finance & Cash Register
            {isRefreshing && (
              <span className="text-[10px] text-emerald-400 border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 rounded-full font-semibold animate-pulse uppercase tracking-wider">
                Syncing Ledger...
              </span>
            )}
          </h1>
          <p className="text-zinc-500 dark:text-white/40 mt-1">Audit transactions, track cash-drawer revenue, and manage debts.</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => fetchMoneyStats(true)}
            className="w-12 h-12 rounded-[16px] flex items-center justify-center border border-zinc-200 dark:border-white/5 bg-black/5 dark:bg-white/5 text-zinc-700 dark:text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300"
            title="Refresh Ledger Stats"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          <button 
            onClick={() => setIsAdjustModalOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-900 dark:text-white px-6 py-3 rounded-[16px] font-medium transition-all duration-300 shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            Cash Drawer Entry
          </button>
        </div>
      </header>

      {loading || !stats ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 dark:text-white/40 text-lg">Loading financial ledgers...</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 pb-6">
          {/* Top Key Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0">
            {/* Card 1: Today's Income */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-[24px] border border-zinc-200 dark:border-white/5 bg-gradient-to-br from-emerald-950/20 to-emerald-900/10 p-6 shadow-2xl"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-500/5 blur-3xl" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">Shift's Cash Income</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none mb-1">
                {formatCurrency(stats.todayPaid)}
              </h2>
              <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider flex items-center gap-1 mt-2">
                <TrendingUp className="w-3.5 h-3.5" /> Cash Drawer Current Total
              </span>
            </motion.div>

            {/* Card 2: Today's Debts */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative overflow-hidden rounded-[24px] border border-zinc-200 dark:border-white/5 bg-gradient-to-br from-red-950/20 to-red-900/10 p-6 shadow-2xl"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-red-500/5 blur-3xl" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">Shift's Unpaid Debts</span>
                <div className="w-10 h-10 rounded-xl bg-[#9A031E]/15 border border-[#9A031E]/30 flex items-center justify-center text-red-400">
                  <Landmark className="w-5 h-5" />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none mb-1">
                {formatCurrency(stats.todayDebts)}
              </h2>
              <span className="text-[10px] text-red-400/80 font-medium uppercase tracking-wider flex items-center gap-1 mt-2">
                ⚠️ Pending debtor ledgers created this shift
              </span>
            </motion.div>

            {/* Card 3: Total Revenue Accumulation */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative overflow-hidden rounded-[24px] border border-zinc-200 dark:border-white/5 bg-white/[0.02] p-6 shadow-2xl"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-black/5 dark:bg-white/5 blur-3xl" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">Total Accumulated Income</span>
                <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-center text-zinc-700 dark:text-white/60">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
              </div>
              <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight leading-none mb-1">
                {formatCurrency(stats.totalPaid)}
              </h2>
              <span className="text-[10px] text-zinc-500 dark:text-white/30 font-medium uppercase tracking-wider flex items-center gap-1 mt-2">
                📈 Total revenue logged since deployment
              </span>
            </motion.div>
          </div>

          {/* Core Analytics Grid: Charts & Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left Col (Analytics Chart Breakdown) */}
            <div className="lg:col-span-1 bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-[28px] p-6 flex flex-col gap-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">Revenue Breakdown</h3>
                <p className="text-xs text-zinc-500 dark:text-white/40">Financial yield per game console rule.</p>
              </div>

              {stats.gameBreakdown.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 dark:text-white/20 text-xs">No analytics data recorded yet.</div>
              ) : (
                <div className="space-y-4">
                  {stats.gameBreakdown.map((item, idx) => {
                    const maxVal = Math.max(...stats.gameBreakdown.map(g => g.revenue));
                    const percentage = maxVal > 0 ? (item.revenue / maxVal) * 100 : 0;
                    const gameColor = getGameIconColor(item.game_type);

                    return (
                      <div key={item.game_type} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-700 dark:text-white/80 font-medium flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full" 
                              style={{ backgroundColor: gameColor }}
                            />
                            {item.game_type}
                          </span>
                          <span className="text-zinc-500 dark:text-white/40 font-semibold">
                            {formatCurrency(item.revenue)} ({item.count} {item.count === 1 ? 'game' : 'games'})
                          </span>
                        </div>
                        {/* Beautiful custom CSS bar */}
                        <div className="w-full h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden border border-zinc-200 dark:border-white/5">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: gameColor }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Col (Transactions History Table/Ledger) */}
            <div className="lg:col-span-2 bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-[28px] p-6 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">Shift Transaction Logs</h3>
                  <p className="text-xs text-zinc-500 dark:text-white/40">Audit list of all payments completed this shift.</p>
                </div>

                {stats.transactions.length > 0 && (
                  <button
                    onClick={handleClearLedger}
                    className="flex items-center gap-1.5 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-[12px] font-semibold text-[10px] uppercase tracking-wider transition-all duration-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear History
                  </button>
                )}
              </div>

              {stats.transactions.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-white/5 rounded-[20px] text-zinc-500 dark:text-white/20 text-xs">
                  No transaction records logged this shift yet.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[350px] pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-white/5 text-[10px] text-zinc-500 dark:text-white/30 uppercase tracking-widest">
                        <th className="py-3 font-semibold">Game / Source</th>
                        <th className="py-3 font-semibold">Console</th>
                        <th className="py-3 font-semibold">Time</th>
                        <th className="py-3 font-semibold text-right">Revenue</th>
                        <th className="py-3 font-semibold text-right w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {stats.transactions.map((t) => {
                        const gameColor = getGameIconColor(t.game_type);
                        return (
                          <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                            <td className="py-4 font-semibold text-zinc-700 dark:text-white/90 flex items-center gap-2">
                              <span 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: gameColor }}
                              />
                              {t.game_type}
                            </td>
                            <td className="py-4 text-zinc-500 dark:text-white/40">{t.device_name || "Manual entry"}</td>
                            <td className="py-4 text-zinc-500 dark:text-white/40 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-500 dark:text-white/20" />
                              {formatTime(t.created_at)}
                            </td>
                            <td className={`py-4 text-right font-bold ${
                              t.amount < 0 ? "text-red-500" : "text-emerald-400"
                            }`}>
                              {t.amount >= 0 ? "+" : ""}{formatCurrency(t.amount)}
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => handleDeleteTransaction(t.session_id)}
                                className="w-7 h-7 rounded-md bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all duration-300 ml-auto"
                                title="Delete Transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Manual Cash Adjustment Modal Dialog */}
      <AnimatePresence>
        {isAdjustModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdjustModalOpen(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-[#0a0c0a] border border-emerald-500/10 rounded-[28px] p-6 shadow-[0_0_50px_rgba(16,185,129,0.15)] z-10"
            >
              {/* Top decoration */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500 rounded-t-[28px]" />

              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6 tracking-tight flex items-center gap-2">
                🪙 Safe / Drawer Adjustment
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Adjustment Amount (DA)
                  </label>
                  <input 
                    type="number" 
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g. 1000 or -500"
                    className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-emerald-500 transition-colors"
                    autoFocus
                  />
                  <span className="text-[10px] text-zinc-500 dark:text-white/20 mt-1 block">
                    Use positive numbers for drawer additions and negative numbers for payouts/purchases.
                  </span>
                </div>

                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Note / Explanation
                  </label>
                  <input 
                    type="text" 
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="e.g. Shift startup balance, snacks purchase..."
                    className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-3.5 rounded-[16px] text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white transition-all duration-300 font-semibold border border-transparent hover:border-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleManualAdjustment}
                  disabled={!adjustAmount}
                  className="flex-1 py-3.5 rounded-[16px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-zinc-900 dark:text-white font-semibold transition-all duration-300 shadow-lg shadow-emerald-600/20"
                >
                  Log Adjustment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
