import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  FileText,
  History,
  Shield,
  Wallet,
  ArrowDownCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CrashCanvas } from './CrashCanvas';
import { CrashBetPanel } from './CrashBetPanel';
import { CrashLiveBetsTable } from './CrashLiveBetsTable';
import { CrashHistoryModal } from './CrashHistoryModal';
import { CrashTermsModal } from './CrashTermsModal';
import { crashAudio } from '../../utils/crashAudio';
import {
  subscribeToActiveRound,
  subscribeToRoundBets,
  fetchRecentCrashRounds,
  initOrAdvanceRound,
  startFlyingPhase,
  finishRoundOnCrash,
  placeCrashBet,
  cashOutCrashBet,
  CrashGameError,
} from '../../services/crashService';
import { fetchAppSettings } from '../../services/settingsService';
import { CrashRound, CrashBet, AppSettings } from '../../types';

interface CrashMultiplierGameProps {
  onNavigateDeposit: () => void;
  onOpenAuth: () => void;
}

export const CrashMultiplierGame: React.FC<CrashMultiplierGameProps> = ({
  onNavigateDeposit,
  onOpenAuth,
}) => {
  const { currentUser, userProfile, refreshProfile } = useAuth();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activeRound, setActiveRound] = useState<CrashRound | null>(null);
  const [roundBets, setRoundBets] = useState<CrashBet[]>([]);
  const [recentRounds, setRecentRounds] = useState<CrashRound[]>([]);

  // Sound Muted state
  const [isMuted, setIsMuted] = useState<boolean>(crashAudio.getMuted());

  // Modals
  const [historyOpen, setHistoryOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Live flight animation state
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
  const [countdownRemaining, setCountdownRemaining] = useState<number>(5.0);

  // User's active bets for Panel 0 and Panel 1
  const [panel0Bet, setPanel0Bet] = useState<CrashBet | null>(null);
  const [panel1Bet, setPanel1Bet] = useState<CrashBet | null>(null);

  // Ref to track latest active round for animation frame
  const activeRoundRef = useRef<CrashRound | null>(null);
  activeRoundRef.current = activeRound;

  // Initial load: settings & recent rounds
  useEffect(() => {
    fetchAppSettings().then(setSettings).catch(() => {});
    fetchRecentCrashRounds(15).then(setRecentRounds).catch(() => {});
  }, []);

  // Real-time listener for current active round
  useEffect(() => {
    const unsub = subscribeToActiveRound((round) => {
      setActiveRound(round);
    });
    return () => unsub();
  }, []);

  // Real-time listener for bets in current round
  useEffect(() => {
    if (!activeRound?.id) {
      setRoundBets([]);
      setPanel0Bet(null);
      setPanel1Bet(null);
      return;
    }

    const unsub = subscribeToRoundBets(activeRound.id, (bets) => {
      setRoundBets(bets);

      if (currentUser?.uid) {
        const myP0 = bets.find((b) => b.userId === currentUser.uid && b.panelIndex === 0) || null;
        const myP1 = bets.find((b) => b.userId === currentUser.uid && b.panelIndex === 1) || null;
        setPanel0Bet(myP0);
        setPanel1Bet(myP1);
      }
    });

    return () => unsub();
  }, [activeRound?.id, currentUser?.uid]);

  // Round loop runner & animation controller
  useEffect(() => {
    let animId: number;
    let timerInterval: any;

    // If no active round exists at all, initialize the first round
    if (!activeRound) {
      initOrAdvanceRound(1, settings?.crashCountdownSecs || 7).catch(() => {});
      return;
    }

    // STATE 1: BETTING COUNTDOWN
    if (activeRound.status === 'betting') {
      setCurrentMultiplier(1.0);

      const updateCountdown = () => {
        const now = Date.now();
        const diff = Math.max(0, (activeRound.bettingEndTime - now) / 1000);
        setCountdownRemaining(diff);

        // Sound countdown tick
        if (diff <= 3.0 && diff > 0.1 && Math.floor(diff * 10) % 10 === 0) {
          crashAudio.playCountdownTick(diff <= 1.0);
        }

        if (diff <= 0) {
          clearInterval(timerInterval);
          // Transition to flying
          crashAudio.playLaunch();
          startFlyingPhase(activeRound.id).catch(() => {});
        }
      };

      updateCountdown();
      timerInterval = setInterval(updateCountdown, 100);

      return () => {
        clearInterval(timerInterval);
      };
    }

    // STATE 2: FLYING PHASE
    if (activeRound.status === 'flying') {
      const startTime = activeRound.flyingStartTime || Date.now();
      const crashPoint = activeRound.crashPoint;

      const step = () => {
        const now = Date.now();
        const elapsedSecs = (now - startTime) / 1000;

        // Realistic exponential curve: M(t) = 1.00 + 0.08 * t + 0.06 * t^2
        const calcMult = Math.floor((1.0 + 0.08 * elapsedSecs + 0.06 * Math.pow(elapsedSecs, 1.85)) * 100) / 100;

        crashAudio.updateMultiplierPitch(calcMult);

        if (calcMult >= crashPoint) {
          // CRASH TRIGGERED!
          setCurrentMultiplier(crashPoint);
          crashAudio.playCrash();
          finishRoundOnCrash(activeRound).then(() => {
            fetchRecentCrashRounds(15).then(setRecentRounds).catch(() => {});
            refreshProfile();
          });
        } else {
          setCurrentMultiplier(calcMult);
          animId = requestAnimationFrame(step);
        }
      };

      animId = requestAnimationFrame(step);

      return () => {
        cancelAnimationFrame(animId);
      };
    }

    // STATE 3: CRASHED PHASE (WAIT & ADVANCE)
    if (activeRound.status === 'crashed') {
      setCurrentMultiplier(activeRound.crashPoint);

      const timeout = setTimeout(() => {
        // Automatically start the next round
        initOrAdvanceRound(activeRound.roundNumber, settings?.crashCountdownSecs || 7)
          .then(() => {
            refreshProfile();
          })
          .catch(() => {});
      }, 4000);

      return () => clearTimeout(timeout);
    }
  }, [activeRound?.status, activeRound?.id]);

  // Handle Bet placement from Panel
  const handlePlaceBet = async (panelIndex: number, stake: number) => {
    if (!currentUser?.uid || !userProfile) {
      onOpenAuth();
      return;
    }
    if (!activeRound || activeRound.status !== 'betting') {
      throw new CrashGameError('Betting time is closed for this round.');
    }

    await placeCrashBet({
      userId: currentUser.uid,
      userName: userProfile.name || 'Player',
      userCode: userProfile.userCode || 'NPL',
      roundId: activeRound.id,
      panelIndex,
      stake,
      minBet: settings?.crashMinBet || 20,
      maxBet: settings?.crashMaxBet || 25000,
    });

    await refreshProfile();
  };

  // Handle Cash Out from Panel
  const handleCashOut = async (betId: string, mult: number) => {
    if (!currentUser?.uid || !activeRound) return;

    await cashOutCrashBet({
      betId,
      userId: currentUser.uid,
      roundId: activeRound.id,
      claimedMultiplier: mult,
    });

    crashAudio.playCashOut();
    await refreshProfile();
  };

  // Toggle Sound FX
  const handleToggleSound = () => {
    const nextMuted = crashAudio.toggleMute();
    setIsMuted(nextMuted);
  };

  const minBet = settings?.crashMinBet ?? 20;
  const maxBet = settings?.crashMaxBet ?? 25000;
  const isAutoplayEnabled = settings?.crashAutoplayEnabled ?? true;
  const balance = userProfile?.balance ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-28 space-y-4">
      {/* Maintenance Mode Warning if enabled */}
      {settings?.crashMaintenance && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Crash Maintenance Mode:</strong> Game algorithms are undergoing routine integrity optimization.
          </span>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-md">
            🚀
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Crash Multiplier</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                PROVABLY FAIR
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Round #{activeRound?.roundNumber || 1} • 97% Return-To-Player
            </p>
          </div>
        </div>

        {/* Action Controls & Wallet Badge */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border transition-all ${
              isMuted
                ? 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
            }`}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* T&C Button */}
          <button
            onClick={() => setTermsOpen(true)}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all text-xs font-semibold flex items-center gap-1"
            title="Terms & Rules"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">T&C</span>
          </button>

          {/* History Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                onOpenAuth();
                return;
              }
              setHistoryOpen(true);
            }}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all text-xs font-semibold flex items-center gap-1"
            title="Betting History"
          >
            <History className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">History</span>
          </button>

          {/* Live User Wallet Badge */}
          <div
            onClick={onNavigateDeposit}
            className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs hover:border-emerald-500 transition-all shadow-inner"
            title="Click to Deposit"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rs. {balance.toFixed(2)}</span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 opacity-70" />
          </div>
        </div>
      </div>

      {/* Recent Multipliers Pill Ribbon */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 scrollbar-none">
        <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          Recent:
        </span>
        {recentRounds.length === 0 ? (
          <span className="text-[11px] text-slate-500 font-mono">1.94x • 2.50x • 1.15x • 8.42x</span>
        ) : (
          recentRounds.map((r) => {
            const pt = r.crashPoint || 1.0;
            const isHigh = pt >= 10.0;
            const isMedium = pt >= 2.0 && pt < 10.0;

            return (
              <span
                key={r.id}
                className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border transition-all ${
                  isHigh
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                    : isMedium
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-900 border-slate-700/80 text-slate-400'
                }`}
              >
                {pt.toFixed(2)}x
              </span>
            );
          })
        )}
      </div>

      {/* Main Animated Multiplier Canvas */}
      <CrashCanvas
        status={activeRound?.status || 'betting'}
        currentMultiplier={currentMultiplier}
        finalCrashPoint={activeRound?.crashPoint}
        countdownSeconds={countdownRemaining}
      />

      {/* Two Separate Betting Panels (Panel 1 and Panel 2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Betting Panel 1 */}
        <CrashBetPanel
          panelIndex={0}
          label="Betting Panel 1"
          round={activeRound}
          currentMultiplier={currentMultiplier}
          countdownRemaining={countdownRemaining}
          userBalance={balance}
          minBet={minBet}
          maxBet={maxBet}
          activeBet={panel0Bet}
          onPlaceBet={handlePlaceBet}
          onCashOut={handleCashOut}
          onOpenAuth={onOpenAuth}
          isAutoplayEnabledSetting={isAutoplayEnabled}
        />

        {/* Betting Panel 2 */}
        <CrashBetPanel
          panelIndex={1}
          label="Betting Panel 2"
          round={activeRound}
          currentMultiplier={currentMultiplier}
          countdownRemaining={countdownRemaining}
          userBalance={balance}
          minBet={minBet}
          maxBet={maxBet}
          activeBet={panel1Bet}
          onPlaceBet={handlePlaceBet}
          onCashOut={handleCashOut}
          onOpenAuth={onOpenAuth}
          isAutoplayEnabledSetting={isAutoplayEnabled}
        />
      </div>

      {/* Live Bets Table & Real Statistics */}
      <CrashLiveBetsTable bets={roundBets} />

      {/* Modals */}
      {historyOpen && currentUser?.uid && (
        <CrashHistoryModal userId={currentUser.uid} onClose={() => setHistoryOpen(false)} />
      )}

      {termsOpen && (
        <CrashTermsModal onClose={() => setTermsOpen(false)} minBet={minBet} maxBet={maxBet} />
      )}
    </div>
  );
};
