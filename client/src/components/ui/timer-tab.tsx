import { useState, useEffect, useRef } from "react";
import { Plus, Square, Volume2, VolumeX, ChevronDown, Check, X, Play, Pause, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Beautiful custom Circular Progress Component
const CircularProgress = ({
  progress,
  timeStr,
  color,
  isAlarming
}: {
  progress: number;
  timeStr: string;
  color: string;
  isAlarming: boolean;
}) => {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const safeProgress = Math.max(0, Math.min(100, progress));
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center w-40 h-40 mx-auto my-6 rounded-full transition-all duration-500 ${isAlarming ? "animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.3)] bg-red-500/5" : ""}`}>
      <svg className="absolute w-full h-full transform -rotate-90">
        <circle cx="80" cy="80" r={radius} stroke="rgba(255,255,255,0.04)" strokeWidth="8" fill="transparent" />
        <circle
          cx="80" cy="80" r={radius}
          stroke={isAlarming ? "#ef4444" : color} strokeWidth="10" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
        />
        <circle
          cx="80" cy="80" r={radius}
          stroke={isAlarming ? "#ef4444" : color} strokeWidth="10" fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear blur-md opacity-40"
        />
      </svg>
      <div className="flex flex-col items-center z-10 mt-1">
        <span className="text-[10px] text-zinc-500 dark:text-white/40 uppercase tracking-widest mb-1">
          {isAlarming ? "Time Up" : "Time Left"}
        </span>
        <span className={`text-4xl font-light tracking-tight transition-colors duration-300 ${isAlarming ? "text-red-500 font-normal" : "text-zinc-900 dark:text-white"}`}>
          {timeStr}
        </span>
      </div>
    </div>
  );
};

// Game metadata mapping matching existing assets in C:\Users\khaled\Desktop\client managment game room\icons
const GAME_DATA: Record<string, { icon: string; color: string; defaultRate: number }> = {
  "GTA V": { icon: "/icons/gta v.png", color: "#15b64550", defaultRate: 5 }, // 100 DA / 20 min = 5 DA/min
  "Mortal Kombat": { icon: "/icons/mortal kombat icon.ico", color: "#f97316", defaultRate: 5 },
  "Tekken": { icon: "/icons/tekken.png", color: "#a855f7", defaultRate: 5 },
  "VIP Room": { icon: "/icons/vip.png", color: "#f1d900ff", defaultRate: 5 } // 300 DA / 60 min = 5 DA/min
};

interface ActiveSession {
  id: number; // session ID
  deviceId: number;
  console: string;
  game: string;
  totalSeconds: number;
  secondsLeft: number;
  progress: number;
  color: string;
  icon: string;
  isPaused: boolean;
  isAlarming: boolean;
  priceRate: number;
  cost: number;
  controllerCount: number;
  startTime: string;
}

export function TimerTab({ onModalOpenChange }: { onModalOpenChange?: (open: boolean) => void }) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [closedSessions, setClosedSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Menu States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);

  // Sync modal open states to parent layout for dynamic blur/fade transitions
  useEffect(() => {
    if (onModalOpenChange) {
      onModalOpenChange(isAddModalOpen || isStopModalOpen);
    }
  }, [isAddModalOpen, isStopModalOpen, onModalOpenChange]);
  const [stoppingSession, setStoppingSession] = useState<ActiveSession | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  // Stop Modal input
  const [isDebt, setIsDebt] = useState(false);
  const [customerName, setCustomerName] = useState("");

  // Add Timer Modal input
  const [selectedDeviceId, setSelectedDeviceId] = useState<number>(0);
  const [inputTime, setInputTime] = useState("");
  const [selectedGame, setSelectedGame] = useState("GTA V");
  const [players, setPlayers] = useState<number>(2);

  // Audio elements or synthesizing state
  const [isMuted, setIsMuted] = useState(false);
  const audioIntervalRef = useRef<any>(null);

  // Fetch all devices and load sessions
  const fetchDevicesAndSessions = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/devices");
      const data = await res.json();
      setDevices(data);

      // Parse sessions that are active timed sessions
      const activeTimers: ActiveSession[] = [];
      data.forEach((dev: any) => {
        if (dev.status === "active" && dev.pricing_method === "time" && dev.duration > 0) {
          const startTimeMs = new Date(dev.start_time).getTime();
          const totalSeconds = dev.duration * 60;
          const elapsedSeconds = Math.floor((Date.now() - startTimeMs) / 1000);
          const secondsLeft = Math.max(0, totalSeconds - elapsedSeconds);
          const progress = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;

          const gameMeta = GAME_DATA[dev.game_type] || { icon: "/icons/fifa26.png", color: "#3b82f6", defaultRate: 5 };

          activeTimers.push({
            id: dev.current_session_id,
            deviceId: dev.id,
            console: dev.name,
            game: dev.game_type,
            totalSeconds,
            secondsLeft,
            progress,
            color: gameMeta.color,
            icon: gameMeta.icon,
            isPaused: false,
            isAlarming: secondsLeft <= 0,
            priceRate: dev.price_rate,
            cost: dev.total_cost || (dev.duration * dev.price_rate),
            controllerCount: dev.controller_count,
            startTime: dev.start_time
          });
        }
      });

      setSessions(activeTimers);

      // Fetch closed sessions
      try {
        const closedRes = await fetch("http://localhost:3000/api/sessions/closed");
        const closedData = await closedRes.json();
        // Filter to only include timed sessions and exclude Safe adjustments
        setClosedSessions(closedData.filter((s: any) => s.pricing_method === "time" && !s.game_type.startsWith("Safe:")));
      } catch (e) {
        console.error("Error fetching closed sessions:", e);
      }

      setLoading(false);
    } catch (e) {
      console.error("Error fetching data:", e);
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm("Are you sure you want to delete this closed session record?")) return;
    try {
      const res = await fetch("http://localhost:3000/api/sessions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const result = await res.json();
      if (result.success) {
        fetchDevicesAndSessions();
      }
    } catch (e) {
      console.error("Failed to delete closed session:", e);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear all closed timer history? This cannot be undone.")) return;
    try {
      const res = await fetch("http://localhost:3000/api/sessions/clear-timers", {
        method: "POST"
      });
      const result = await res.json();
      if (result.success) {
        fetchDevicesAndSessions();
      }
    } catch (e) {
      console.error("Failed to clear closed sessions history:", e);
    }
  };

  useEffect(() => {
    fetchDevicesAndSessions();
  }, []);

  // Set up real-time ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.isPaused || s.secondsLeft <= 0) {
            if (s.secondsLeft <= 0 && !s.isAlarming) {
              return { ...s, secondsLeft: 0, progress: 0, isAlarming: true };
            }
            return s;
          }

          const nextSecondsLeft = s.secondsLeft - 1;
          const progress = s.totalSeconds > 0 ? (nextSecondsLeft / s.totalSeconds) * 100 : 0;
          return {
            ...s,
            secondsLeft: nextSecondsLeft,
            progress
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Alarm sound synthesized looping handled globally in App.tsx

  // Click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownId(null);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    const pad = (n: number) => String(n).padStart(2, "0");

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleStartTimer = async () => {
    if (!selectedDeviceId || !inputTime) return;
    const durationMin = parseInt(inputTime);
    if (isNaN(durationMin) || durationMin <= 0) return;

    let priceRate = 5;
    try {
      const stored = localStorage.getItem("timer_pricing");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (selectedGame === "GTA V" && parsed.gta !== undefined) {
          priceRate = parsed.gta / 60;
        } else if (selectedGame === "Mortal Kombat" && parsed.mk !== undefined) {
          priceRate = parsed.mk / 60;
        } else if (selectedGame === "Tekken" && parsed.tekken !== undefined) {
          priceRate = parsed.tekken / 60;
        } else if (selectedGame === "VIP Room" && parsed.vip !== undefined) {
          priceRate = parsed.vip / 60;
        }
      } else {
        const gameMeta = GAME_DATA[selectedGame];
        priceRate = gameMeta?.defaultRate ?? 5;
      }
    } catch (e) {
      const gameMeta = GAME_DATA[selectedGame];
      priceRate = gameMeta?.defaultRate ?? 5;
    }

    const totalCost = durationMin * priceRate;

    try {
      const res = await fetch("http://localhost:3000/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          gameType: selectedGame,
          mode: `${players} Players`,
          controllerCount: players,
          pricingMethod: "time",
          priceRate: priceRate,
          duration: durationMin
        })
      });

      const result = await res.json();
      if (result.success) {
        // Instantly save to SQLite & reload from db for perfect reliability
        await fetchDevicesAndSessions();

        // Reset states
        setInputTime("");
        setSelectedDeviceId(0);
        setIsAddModalOpen(false);
      }
    } catch (e) {
      console.error("Failed to start session:", e);
    }
  };

  const handleExtend = async (session: ActiveSession, additionalMinutes: number) => {
    const currentDuration = Math.round(session.totalSeconds / 60);
    const newDuration = currentDuration + additionalMinutes;
    const newCost = newDuration * session.priceRate;

    try {
      const res = await fetch("http://localhost:3000/api/sessions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          duration: newDuration,
          totalCost: newCost,
          matchesPlayed: 0,
          controllerCount: session.controllerCount,
          priceRate: session.priceRate
        })
      });

      const result = await res.json();
      if (result.success) {
        // Dynamic update of local React state for instantaneous smoothness
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id === session.id) {
              const extendedSeconds = s.secondsLeft + (additionalMinutes * 60);
              const newTotal = s.totalSeconds + (additionalMinutes * 60);
              return {
                ...s,
                totalSeconds: newTotal,
                secondsLeft: extendedSeconds,
                progress: newTotal > 0 ? (extendedSeconds / newTotal) * 100 : 0,
                cost: newCost,
                isAlarming: false // Reset alarm if extended
              };
            }
            return s;
          })
        );
      }
    } catch (e) {
      console.error("Failed to extend session:", e);
    }
  };

  const handleStopClick = (session: ActiveSession) => {
    setStoppingSession(session);
    setIsDebt(false);
    setCustomerName("");
    setIsStopModalOpen(true);
  };

  const handleConfirmStop = async () => {
    if (!stoppingSession) return;

    try {
      const res = await fetch("http://localhost:3000/api/sessions/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: stoppingSession.id,
          deviceId: stoppingSession.deviceId,
          totalCost: stoppingSession.cost,
          isDebt: isDebt,
          customerName: isDebt ? customerName : ""
        })
      });

      const result = await res.json();
      if (result.success) {
        setIsStopModalOpen(false);
        setStoppingSession(null);
        fetchDevicesAndSessions(); // Reload grid
      }
    } catch (e) {
      console.error("Failed to stop session:", e);
    }
  };

  // Find available devices for the dropdown
  const availableDevices = devices.filter((d) => d.status === "available");

  return (
    <div className="w-full h-full flex flex-col relative select-none">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            Active Countdown Timers
            {sessions.some(s => s.isAlarming) && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </h1>
          <p className="text-zinc-500 dark:text-white/40 mt-1">Real-time device monitoring & auto-saving limits.</p>
        </div>

        <div className="flex gap-4">
          {/* Global Sound Control */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-[16px] flex items-center justify-center border transition-all duration-300 ${isMuted
              ? "border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
              : "border-zinc-200 dark:border-white/5 bg-black/5 dark:bg-white/5 text-zinc-700 dark:text-white/60 hover:text-white hover:bg-white/10"
              }`}
            title={isMuted ? "Unmute Alarm Sound" : "Mute Alarm Sound"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <button
            onClick={() => {
              if (availableDevices.length > 0) {
                setSelectedDeviceId(availableDevices[0].id);
              }
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#9A031E] hover:bg-[#9A031E]/80 text-zinc-900 dark:text-white px-6 py-3 rounded-[16px] font-medium transition-all duration-300 shadow-[0_4px_20px_rgba(154,3,30,0.3)] hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5" />
            Add Timer
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 dark:text-white/40 text-lg">Loading devices...</div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-white/5 rounded-[24px] bg-white/[0.01] p-12">
          <span className="text-zinc-500 dark:text-white/20 text-lg mb-2">No active timers right now</span>
          <span className="text-zinc-500 dark:text-white/40 text-sm max-w-sm text-center">
            Click "Add Timer" above to launch a limit-time session on any available PS5 console.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 overflow-y-auto max-h-[calc(100vh-220px)] pr-2">
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`border rounded-[24px] p-6 shadow-2xl relative overflow-hidden flex flex-col transition-all duration-500 ${session.isAlarming
                ? "bg-red-950/20 border-red-500/40 shadow-[0_10px_40px_rgba(239,68,68,0.15)] animate-pulse"
                : "bg-white/[0.02] border-zinc-200 dark:border-white/5 hover:border-white/10 hover:bg-white/[0.03]"
                }`}
            >
              {/* Top Row: PS5 Name & Quick Actions */}
              <div className="flex justify-between items-center mb-1">
                <span className="text-zinc-500 dark:text-white/40 font-medium text-xs tracking-widest uppercase">
                  {session.console}
                </span>

                {/* Right Extension Trigger */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdownId(activeDropdownId === session.id ? null : session.id);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors text-zinc-700 dark:text-white/50 hover:text-white ${activeDropdownId === session.id ? "bg-black/10 dark:bg-white/10" : "bg-black/5 dark:bg-white/5 hover:bg-white/80"
                      }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Glassmorphic Extension Dropdown */}
                  <AnimatePresence>
                    {activeDropdownId === session.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 5 }}
                        className="absolute right-0 mt-2 w-36 bg-[#18181b] border border-zinc-200 dark:border-white/10 rounded-[16px] shadow-2xl p-2 z-20 backdrop-blur-[12px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="block text-[10px] text-zinc-500 dark:text-white/40 font-semibold px-3 py-1.5 uppercase tracking-wider">
                          Extend Time
                        </span>
                        {[1, 5, 10, 20, 60].map((mins) => (
                          <button
                            key={mins}
                            onClick={() => {
                              handleExtend(session, mins);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-white/70 hover:text-white hover:bg-[#9A031E] rounded-[10px] transition-colors"
                          >
                            +{mins === 60 ? "1 Hour" : `${mins} Min`}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Progress Ring and Countdown */}
              <CircularProgress
                progress={session.progress}
                timeStr={formatTime(session.secondsLeft)}
                color={session.color}
                isAlarming={session.isAlarming}
              />

              {/* Session Meta Information */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-200 dark:border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center p-1.5 overflow-hidden border border-zinc-200 dark:border-white/5">
                    <img
                      src={session.icon}
                      alt={session.game}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback in case icon path isn't resolvable
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-zinc-700 dark:text-white/90 font-medium text-sm leading-tight">
                      {session.game}
                    </span>
                    <span className="text-[10px] text-[#9A031E] font-medium tracking-wide mt-0.5">
                      {session.cost} DA
                    </span>
                  </div>
                </div>

                {/* Stop Timer Button */}
                <button
                  onClick={() => handleStopClick(session)}
                  className="w-10 h-10 rounded-[14px] bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-[#9A031E] hover:text-white transition-all duration-300"
                  title="Stop and Bill Session"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="w-full h-[1px] bg-black/5 dark:bg-white/5 my-6 flex-shrink-0" />

      {/* Closed Sessions Horizontal Scroll Row */}
      <div className="mt-auto flex-shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            Closed Sessions
            <span className="text-[10px] font-normal text-zinc-500 dark:text-white/30 tracking-widest uppercase">
              ({closedSessions.length} recently ended)
            </span>
          </h2>

          {closedSessions.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-[12px] font-semibold text-[10px] uppercase tracking-wider transition-all duration-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          )}
        </div>

        {closedSessions.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-zinc-200 dark:border-white/5 rounded-[20px] bg-white/[0.01]">
            <span className="text-zinc-500 dark:text-white/20 text-xs">No closed sessions today yet.</span>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {closedSessions.map((session) => {
              const gameMeta = GAME_DATA[session.game_type] || { icon: "/icons/fifa26.png", color: "#3b82f6" };
              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-shrink-0 w-52 bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[20px] p-4 shadow-xl flex flex-col gap-3 hover:bg-white/[0.03] transition-colors"
                >
                  {/* Game Name & Icon */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center p-1.5 overflow-hidden border border-zinc-200 dark:border-white/5">
                        <img
                          src={gameMeta.icon}
                          alt={session.game_type}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <span className="text-zinc-700 dark:text-white/80 font-medium text-sm leading-none truncate">
                        {session.game_type}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="w-7 h-7 rounded-md bg-black/5 dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all duration-300 flex-shrink-0"
                      title="Delete Session Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Time & Price */}
                  <div className="flex justify-between items-end mt-1">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-zinc-500 dark:text-white/30 uppercase tracking-widest leading-none mb-1">Time</span>
                      <span className="text-zinc-700 dark:text-white/70 font-semibold text-xs">{session.duration} Mins</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] text-zinc-500 dark:text-white/30 uppercase tracking-widest leading-none mb-1">Price</span>
                      <span className={`text-sm font-bold tracking-tight ${
                        session.status === "unpaid" ? "text-red-500" : "text-emerald-400"
                      }`}>{session.total_cost} DA</span>
                    </div>
                  </div>

                  {/* Footer (Console Name & Status) */}
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 dark:text-white/20 border-t border-zinc-200 dark:border-white/5 pt-2 mt-1">
                    <span>{session.device_name}</span>
                    <span className={session.status === "unpaid" ? "text-red-500/80 font-semibold" : "text-emerald-500/80 font-semibold"}>
                      {session.status === "unpaid" ? "Debt" : "Paid"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Central "Add Timer" Modal Popup */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0f0f11] border border-zinc-200 dark:border-white/5 rounded-[28px] p-6 shadow-2xl z-10"
            >
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6 tracking-tight">Launch Timer</h2>

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
                      className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-zinc-900 dark:text-white text-base focus:outline-none focus:border-[#9A031E] transition-colors appearance-none cursor-pointer"
                    >
                      {availableDevices.length === 0 ? (
                        <option value={0} disabled>No devices available</option>
                      ) : (
                        availableDevices.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))
                      )}
                    </select>
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none text-zinc-500 dark:text-white/40 text-xs">
                      ▼
                    </div>
                  </div>
                </div>

                {/* Duration Choice & Presets */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider">
                      Duration (Minutes)
                    </label>
                    <span className="text-[11px] text-[#9A031E]">
                      {inputTime ? `${parseInt(inputTime) * (GAME_DATA[selectedGame]?.defaultRate || 5)} DA` : "0 DA"}
                    </span>
                  </div>

                  <input
                    type="number"
                    value={inputTime}
                    onChange={(e) => setInputTime(e.target.value)}
                    placeholder="e.g. 60"
                    className="w-full bg-white dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-[16px] px-4 py-3.5 text-zinc-900 dark:text-white text-lg focus:outline-none focus:border-[#9A031E] transition-colors mb-3"
                    autoFocus
                  />

                  {/* Fast Quick-Presets */}
                  <div className="flex gap-2">
                    {[20, 40, 60, 120].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => setInputTime(String(mins))}
                        className={`flex-1 py-2 text-xs font-semibold rounded-[12px] border transition-all duration-300 ${inputTime === String(mins)
                          ? "bg-[#9A031E] text-zinc-900 dark:text-white border-transparent"
                          : "bg-black/5 dark:bg-white/5 border-zinc-200 dark:border-white/5 text-zinc-700 dark:text-white/50 hover:bg-white/10 hover:text-white"
                          }`}
                      >
                        {mins === 120 ? "2 hrs" : `${mins} min`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select Game */}
                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Select Game
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.keys(GAME_DATA).map((game) => (
                      <button
                        key={game}
                        type="button"
                        onClick={() => setSelectedGame(game)}
                        className={`flex flex-col items-center justify-center p-3 rounded-[16px] border transition-all duration-300 gap-1.5 ${selectedGame === game
                          ? "bg-[#9A031E]/20 border-[#9A031E] text-zinc-900 dark:text-white"
                          : "bg-white/[0.02] border-zinc-200 dark:border-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white"
                          }`}
                      >
                        <img
                          src={GAME_DATA[game].icon}
                          alt={game}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-[10px] font-semibold tracking-tight text-center leading-none">
                          {game}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Controller Count / Players Selection */}
                <div>
                  <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                    Controllers / Players
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setPlayers(count)}
                        className={`flex-1 py-2.5 rounded-[12px] font-semibold text-sm transition-all duration-300 ${players === count
                          ? "bg-[#9A031E] text-zinc-900 dark:text-white"
                          : "bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-white/40 hover:bg-white/10 hover:text-white"
                          }`}
                      >
                        {count} P
                      </button>
                    ))}
                  </div>
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
                  onClick={handleStartTimer}
                  disabled={!selectedDeviceId || !inputTime}
                  className="flex-1 py-3.5 rounded-[16px] bg-[#9A031E] hover:bg-[#9A031E]/90 disabled:opacity-40 disabled:hover:bg-[#9A031E] text-zinc-900 dark:text-white font-semibold transition-all duration-300 shadow-lg shadow-[#9A031E]/20"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Elegant Custom Stop / Billing Modal */}
      <AnimatePresence>
        {isStopModalOpen && stoppingSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsStopModalOpen(false);
                setStoppingSession(null);
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0f0f11] border border-zinc-200 dark:border-white/5 rounded-[28px] p-6 shadow-2xl z-10"
            >
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-2 tracking-tight">Stop Timer & Bill</h2>
              <p className="text-zinc-500 dark:text-white/40 text-sm mb-6">Stop session for {stoppingSession.console}.</p>

              <div className="bg-white/[0.02] border border-zinc-200 dark:border-white/5 rounded-[20px] p-5 mb-6 flex flex-col gap-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-white/40 font-medium">Active Game:</span>
                  <span className="text-zinc-900 dark:text-white font-semibold">{stoppingSession.game}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500 dark:text-white/40 font-medium">Session Status:</span>
                  <span className={stoppingSession.isAlarming ? "text-red-500 font-semibold" : "text-emerald-500 font-semibold"}>
                    {stoppingSession.isAlarming ? "Completed" : "Active"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-white/5">
                  <span className="text-zinc-500 dark:text-white/40 font-semibold uppercase tracking-wider text-xs">Total Bill:</span>
                  <span className="text-2xl font-bold text-[#9A031E]">{stoppingSession.cost} DA</span>
                </div>
              </div>

              {/* Debt Toggle */}
              <div className="space-y-4 mb-8">
                <div
                  onClick={() => setIsDebt(!isDebt)}
                  className="flex items-center justify-between cursor-pointer bg-white/[0.01] border border-zinc-200 dark:border-white/5 rounded-[16px] p-4 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">Save as Debt (Unpaid)</span>
                    <span className="text-xs text-zinc-500 dark:text-white/40 mt-0.5">Check if player will pay later</span>
                  </div>
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors ${isDebt ? "bg-[#9A031E] border-transparent" : "border-zinc-200 dark:border-white/20"
                    }`}>
                    {isDebt && <Check className="w-4 h-4 text-zinc-900 dark:text-white" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isDebt && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="block text-zinc-500 dark:text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
                        Customer / Debtor Name
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

              {/* Confirm Decisions */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsStopModalOpen(false);
                    setStoppingSession(null);
                  }}
                  className="flex-1 py-3.5 rounded-[16px] text-zinc-500 dark:text-white/40 hover:bg-white/5 hover:text-white transition-all duration-300 font-semibold border border-transparent hover:border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStop}
                  disabled={isDebt && !customerName}
                  className="flex-1 py-3.5 rounded-[16px] bg-[#9A031E] hover:bg-[#9A031E]/90 disabled:opacity-40 disabled:hover:bg-[#9A031E] text-zinc-900 dark:text-white font-semibold transition-all duration-300 shadow-lg shadow-[#9A031E]/20"
                >
                  Confirm Stop
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
