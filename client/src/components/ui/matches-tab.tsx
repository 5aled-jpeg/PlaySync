import { useState, useEffect } from "react";
import { Plus, Check, Volume2, VolumeX, History, Calendar, User, DollarSign, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Game metadata mapping matching existing assets
const MATCH_GAME_DATA: Record<string, { icon: string; color: string }> = {
  "FIFA 26": { icon: "/icons/fifa26.png", color: "#10b981" },     // Emerald Sports Green glow
  "eFootball": { icon: "/icons/efootball.png", color: "#eab308" } // Sporty Yellow/Blue glow
};

export function MatchesTab({ onModalOpenChange }: { onModalOpenChange?: (open: boolean) => void }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [closedSessions, setClosedSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Menu States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Match Modal inputs
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(0);
  const [selectedGame, setSelectedGame] = useState("FIFA 26");
  const [players, setPlayers] = useState<number>(2);
  const [matchesCount, setMatchesCount] = useState<number>(1);
  const [isDebt, setIsDebt] = useState(false);
  const [customerName, setCustomerName] = useState("");

  // Sync modal states to parent
  useEffect(() => {
    if (onModalOpenChange) {
      onModalOpenChange(isAddModalOpen);
    }
  }, [isAddModalOpen, onModalOpenChange]);

  // Calculate rate based on players count:
  // 1 Player = 100 DA per match
  // 2 Players = 100 DA per match
  // 3 Players = 150 DA per match
  // 4 Players = 200 DA per match
  const getMatchRate = (pCount: number) => {
    try {
      const stored = localStorage.getItem("match_pricing");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (pCount === 1 && parsed.p1 !== undefined) return parsed.p1;
        if (pCount === 2 && parsed.p2 !== undefined) return parsed.p2;
        if (pCount === 3 && parsed.p3 !== undefined) return parsed.p3;
        if (pCount === 4 && parsed.p4 !== undefined) return parsed.p4;
      }
    } catch (e) {}

    if (pCount === 3) return 150;
    if (pCount === 4) return 200;
    return 100; // 1 or 2 players
  };

  const fetchClosedMatchesAndDevices = async () => {
    try {
      const devRes = await fetch("http://localhost:3000/api/devices");
      const devData = await devRes.json();
      setDevices(devData);

      const closedRes = await fetch("http://localhost:3000/api/sessions/closed");
      const closedData = await closedRes.json();
      // Filter where pricing_method is 'match' and not a manual safe adjustment
      setClosedSessions(closedData.filter((s: any) => s.pricing_method === "match" && !s.game_type.startsWith("Safe:")));
      
      setLoading(false);
    } catch (e) {
      console.error("Error fetching matches data:", e);
      setLoading(false);
    }
  };

  const handleDeleteMatch = async (sessionId: number) => {
    if (!confirm("Are you sure you want to delete this match record?")) return;
    try {
      const res = await fetch("http://localhost:3000/api/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const result = await res.json();
      if (result.success) {
        fetchClosedMatchesAndDevices();
      }
    } catch (e) {
      console.error("Failed to delete match:", e);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear all matches history? This cannot be undone.")) return;
    try {
      const res = await fetch("http://localhost:3000/api/sessions/clear-matches", {
        method: "POST"
      });
      const result = await res.json();
      if (result.success) {
        fetchClosedMatchesAndDevices();
      }
    } catch (e) {
      console.error("Failed to clear matches history:", e);
    }
  };

  useEffect(() => {
    fetchClosedMatchesAndDevices();
  }, []);

  // Keyboard Shortcuts for quick match entry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid triggering if user is typing in an input field (like Customer Name)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const validKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
      // The user specifically asked for 1,2,3,5,6,7 but we can support any single digit nicely
      if (validKeys.includes(e.key)) {
        const count = parseInt(e.key, 10);
        e.preventDefault();
        
        let targetDeviceId = selectedDeviceId;
        if (!targetDeviceId && devices.length > 0) {
           targetDeviceId = devices[0].id;
           setSelectedDeviceId(targetDeviceId);
        }

        if (!targetDeviceId) return;

        // Directly record match
        const priceRate = getMatchRate(2); // default 2 players
        const totalCost = count * priceRate;
        
        fetch("http://localhost:3000/api/sessions/record-finished", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: targetDeviceId,
            gameType: "FIFA 26", // forced default for quick shortcut
            mode: "2 Players",
            controllerCount: 2,
            pricingMethod: "match",
            priceRate: priceRate,
            duration: count,
            totalCost: totalCost,
            isDebt: false,
            customerName: ""
          })
        }).then(res => res.json()).then(result => {
           if (result.success) {
             fetchClosedMatchesAndDevices();
           }
        }).catch(console.error);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [devices, selectedDeviceId]);

  const handleRecordMatch = async () => {
    if (!selectedDeviceId) return;

    const priceRate = getMatchRate(players);
    const totalCost = matchesCount * priceRate;

    try {
      const res = await fetch("http://localhost:3000/api/sessions/record-finished", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          gameType: selectedGame,
          mode: `${players} Players`,
          controllerCount: players,
          pricingMethod: "match",
          priceRate: priceRate,
          duration: matchesCount, // duration represents total matches
          totalCost: totalCost,
          isDebt: isDebt,
          customerName: isDebt ? customerName : ""
        })
      });
      
      const result = await res.json();
      if (result.success) {
        await fetchClosedMatchesAndDevices();
        // Reset states
        setSelectedDeviceId(0);
        setIsDebt(false);
        setCustomerName("");
        setIsAddModalOpen(false);
      }
    } catch (e) {
      console.error("Failed to record match session:", e);
    }
  };

  // Helper to format SQLite timestamp to human readable hours/minutes
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return "Just now";
    }
  };

  const availableDevices = devices;

  return (
    <div className="w-full h-full flex flex-col relative select-none">
      <header className="flex justify-between items-center mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            ⚽ Recorded Matches History
            <span className="text-[10px] font-normal text-zinc-500 dark:text-white/30 tracking-widest uppercase bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/5 px-2.5 py-1 rounded-full">
              {closedSessions.length} total matches recorded
            </span>
          </h1>
          <p className="text-zinc-500 dark:text-white/40 mt-1">Audit ledger of recently finished and billed matches.</p>
        </div>

        <div className="flex gap-4">
          {closedSessions.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-2 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-5 py-3 rounded-[16px] font-semibold text-sm transition-all duration-300 hover:scale-[1.01]"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          )}

          <button 
            onClick={() => {
              if (availableDevices.length > 0) {
                setSelectedDeviceId(availableDevices[0].id);
              }
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-900 dark:text-white px-6 py-3 rounded-[16px] font-medium transition-all duration-300 shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            Record Finished Match
          </button>
        </div>
      </header>

      {/* Main Grid View Area for Matches History Ledger */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 dark:text-white/40 text-lg">Loading history...</div>
        </div>
      ) : closedSessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-white/5 rounded-[24px] bg-white/[0.01] p-12">
          <div className="w-16 h-16 rounded-full bg-white/[0.02] border border-zinc-200 dark:border-white/5 flex items-center justify-center mb-4 text-zinc-500 dark:text-white/20">
            <History className="w-8 h-8" />
          </div>
          <span className="text-zinc-500 dark:text-white/30 text-lg mb-1">No matches recorded today yet</span>
          <span className="text-zinc-500 dark:text-white/40 text-xs max-w-sm text-center">
            Log completed matches by clicking "+ Record Finished Match" at the top right to build your ledger.
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-220px)] pr-2 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {closedSessions.map((session) => {
              const gameMeta = MATCH_GAME_DATA[session.game_type] || { icon: "/icons/fifa26.png", color: "#10b981" };
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[24px] p-5 shadow-2xl flex flex-col justify-between relative overflow-hidden hover:bg-white/[0.03] hover:border-white/10 transition-all duration-300"
                >
                  {/* Subtle sports glow background accent */}
                  <div 
                    className="absolute -top-10 -right-10 w-24 h-24 rounded-full opacity-[0.03] blur-2xl pointer-events-none"
                    style={{ backgroundColor: gameMeta.color }}
                  />

                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center p-2 overflow-hidden border border-zinc-200 dark:border-white/5">
                        <img 
                          src={gameMeta.icon} 
                          alt={session.game_type} 
                          className="w-full h-full object-contain" 
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-zinc-900 dark:text-white font-semibold text-base leading-tight">
                          {session.game_type}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-white/30 tracking-widest uppercase mt-0.5">
                          {session.device_name}
                        </span>
                      </div>
                    </div>

                    {/* Paid/Debt Badge */}
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                      session.status === "unpaid" 
                        ? "bg-red-500/10 border-red-500/20 text-red-400" 
                        : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    }`}>
                      {session.status === "unpaid" ? "Debt" : "Paid"}
                    </span>
                  </div>

                  {/* Details block */}
                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-zinc-200 dark:border-white/5 mb-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-zinc-500 dark:text-white/30 uppercase tracking-widest leading-none mb-1">Play Mode</span>
                      <span className="text-zinc-700 dark:text-white/80 font-medium text-xs">
                        {session.mode}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-zinc-500 dark:text-white/30 uppercase tracking-widest leading-none mb-1">Matches played</span>
                      <span className="text-zinc-700 dark:text-white/80 font-semibold text-xs">
                        {session.duration} {session.duration === 1 ? 'Match' : 'Matches'}
                      </span>
                    </div>
                  </div>

                  {/* Pricing and Timestamp row */}
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-white/30 font-medium">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatTime(session.end_time)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Trash Delete button */}
                      <button
                        onClick={() => handleDeleteMatch(session.id)}
                        className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all duration-300"
                        title="Delete Match Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-zinc-500 dark:text-white/30 uppercase tracking-widest leading-none mb-0.5">Total Revenue</span>
                        <span className={`text-lg font-extrabold tracking-tight ${
                          session.status === "unpaid" ? "text-red-500" : "text-emerald-400"
                        }`}>{session.total_cost} DA</span>
                      </div>
                    </div>
                  </div>

                  {/* Debtor Display if Debt */}
                  {session.status === "unpaid" && (
                    <div className="mt-3 pt-2.5 border-t border-dashed border-red-500/10 flex items-center gap-2 text-[10px] text-red-400 font-semibold uppercase tracking-wider">
                      <User className="w-3.5 h-3.5" />
                      <span>Debtor: <span className="text-zinc-900 dark:text-white font-bold">{session.customer_name || 'Khaled'}</span></span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Central "Add Matches" Themed Popup */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/90"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-[#0b0f0c] border border-emerald-500/10 rounded-[28px] p-6 shadow-none z-10"
            >
              {/* Stadium Banner Accent */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500 rounded-t-[28px]" />

              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6 tracking-tight flex items-center gap-2">
                ⚽ Record Completed Match
              </h2>
              
              <div className="space-y-5">
                {/* Choose Device */}
                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Select Console
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(Number(e.target.value))}
                      className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-emerald-500 transition-colors appearance-none cursor-pointer"
                    >
                      {devices.length === 0 ? (
                        <option value={0} disabled>No devices loaded</option>
                      ) : (
                        devices.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                      )}
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500 dark:text-white/40 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Choose Football Game */}
                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Select Game
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(MATCH_GAME_DATA).map((game) => (
                      <button
                        key={game}
                        type="button"
                        onClick={() => setSelectedGame(game)}
                        className={`flex items-center justify-center p-4 rounded-[20px] border transition-all duration-300 gap-3 ${
                          selectedGame === game
                            ? "bg-emerald-500/10 border-emerald-500 text-zinc-900 dark:text-white"
                            : "bg-white/[0.02] border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <img 
                          src={MATCH_GAME_DATA[game].icon} 
                          alt={game} 
                          className="w-8 h-8 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-sm font-semibold tracking-tight text-left">
                          {game}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Players Count / Rates selector */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">
                      Controllers / Players
                    </label>
                    <span className="text-xs text-emerald-500 font-semibold uppercase">
                      {getMatchRate(players)} DA / match
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setPlayers(count)}
                        className={`flex-1 py-3 rounded-[12px] font-semibold text-sm transition-all duration-300 ${
                          players === count
                            ? "bg-emerald-600 text-zinc-900 dark:text-white shadow-lg shadow-emerald-600/20"
                            : "bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {count} P
                      </button>
                    ))}
                  </div>
                </div>

                {/* Number of Matches Selector */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">
                      Number of Matches
                    </label>
                    <span className="text-base font-bold text-[#9A031E] tracking-tight">
                      {matchesCount * getMatchRate(players)} DA Total
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    {[1, 2, 3, 5].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setMatchesCount(count)}
                        className={`flex-1 py-3 rounded-[12px] font-semibold text-sm transition-all duration-300 ${
                          matchesCount === count
                            ? "bg-emerald-600 text-zinc-900 dark:text-white shadow-lg shadow-emerald-600/20"
                            : "bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {count} {count === 1 ? "Match" : "Matches"}
                      </button>
                    ))}
                  </div>

                  {/* Custom Matches Input */}
                  <div className="mt-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={matchesCount || ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setMatchesCount(isNaN(val) ? 1 : Math.max(1, val));
                      }}
                      placeholder="Or enter custom matches count..."
                      className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3 text-center text-zinc-900 dark:text-white text-base focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-white/20"
                    />
                  </div>
                </div>

                {/* Payment Selection Details directly in modal */}
                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Payment Type
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setIsDebt(false)}
                      className={`py-3.5 rounded-[16px] border font-semibold text-sm transition-all duration-300 ${
                        !isDebt
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                          : "bg-white/[0.02] border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      Paid Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDebt(true)}
                      className={`py-3.5 rounded-[16px] border font-semibold text-sm transition-all duration-300 ${
                        isDebt
                          ? "bg-[#9A031E]/10 border-[#9A031E] text-red-400"
                          : "bg-white/[0.02] border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      Save as Debt
                    </button>
                  </div>

                  <AnimatePresence>
                    {isDebt && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-3"
                      >
                        <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                          Debtor / Customer Name
                        </label>
                        <input 
                          type="text" 
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="e.g. Khaled"
                          className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-[#9A031E] transition-colors"
                          autoFocus
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-3.5 rounded-[16px] text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white transition-all duration-300 font-semibold border border-transparent hover:border-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRecordMatch}
                  disabled={!selectedDeviceId || (isDebt && !customerName)}
                  className="flex-1 py-3.5 rounded-[16px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-zinc-900 dark:text-white font-semibold transition-all duration-300 shadow-lg shadow-emerald-600/20"
                >
                  Save Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
