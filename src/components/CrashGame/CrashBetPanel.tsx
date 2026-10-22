import React, { useState, useEffect } from 'react';
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sliders,
  DollarSign,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { CrashBet, CrashRound, CrashAutoplayConfig } from '../../types';

interface CrashBetPanelProps {
  panelIndex: number;
  label: string;
  round: CrashRound | null;
  currentMultiplier: number;
  countdownRemaining?: number;
  userBalance: number;
  minBet: number;
  maxBet: number;
  activeBet: CrashBet | null;
  onPlaceBet: (panelIndex: number, stake: number) => Promise<void>;
  onCashOut: (betId: string, currentMultiplier: number) => Promise<void>;
  onOpenAuth: () => void;
  isAutoplayEnabledSetting: boolean;
}

export const CrashBetPanel: React.FC<CrashBetPanelProps> = ({
  panelIndex,
  label,
  round,
  currentMultiplier,
  countdownRemaining = 5,
  userBalance,
  minBet,
  maxBet,
  activeBet,
  onPlaceBet,
  onCashOut,
  onOpenAuth,
  isAutoplayEnabledSetting,
}) => {
  const [stakeInput, setStakeInput] = useState<string>('30');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isQueuedForNextRound, setIsQueuedForNextRound] = useState(false);

  // Autoplay State
  const [autoplayModalOpen, setAutoplayModalOpen] = useState(false);
  const [autoplayConfig, setAutoplayConfig] = useState<CrashAutoplayConfig>({
    enabled: false,
    roundsRemaining: 0,
    totalRounds: 10,
    baseStake: 30,
    stopOnProfit: 500,
    stopOnLoss: 300,
    autoCashOutMultiplier: 2.0,
    currentProfit: 0,
    currentLoss: 0,
  });

  const parsedStake = Number(stakeInput) || 0;
  const isBettingPhase = round?.status === 'betting';
  const isFlyingPhase = round?.status === 'flying';
  const isCrashedPhase = round?.status === 'crashed';

  // Quick Amount preset values as explicitly specified in prompt:
  // Rs. 30, Rs. 200, Rs. 400, Rs. 1,000, Rs. 4,000, and Rs. 20,000
  const quickAmounts = [30, 200, 400, 1000, 4000, 20000];

  // Clear amount button handler
  const handleClear = () => {
    setStakeInput(String(minBet));
    setErrorMessage(null);
  };

  // Quick amount click handler
  const handleSelectQuickAmount = (amt: number) => {
    // Validate against wallet balance
    if (amt > userBalance) {
      setErrorMessage(`Insufficient balance for Rs. ${amt.toLocaleString()}. Available: Rs. ${userBalance.toFixed(2)}.`);
      setStakeInput(String(Math.min(amt, Math.max(minBet, Math.floor(userBalance)))));
      return;
    }
    setErrorMessage(null);
    setStakeInput(String(amt));
  };

  // Auto-place queued bet when betting phase begins
  useEffect(() => {
    if (!isQueuedForNextRound) return;
    if (isBettingPhase && !activeBet && !isSubmitting && countdownRemaining > 0.8) {
      if (userBalance >= parsedStake) {
        setIsSubmitting(true);
        onPlaceBet(panelIndex, parsedStake)
          .then(() => {
            setIsQueuedForNextRound(false);
            setErrorMessage(null);
          })
          .catch((err: any) => {
            if (err?.message?.includes('closed') || err?.message?.includes('active')) {
              setErrorMessage('Round transition in progress. Queued for next round.');
            } else {
              setIsQueuedForNextRound(false);
              setErrorMessage(err?.message || 'Failed to place bet.');
            }
          })
          .finally(() => {
            setIsSubmitting(false);
          });
      } else {
        setIsQueuedForNextRound(false);
        setErrorMessage(`Insufficient balance for queued bet of Rs. ${parsedStake}.`);
      }
    }
  }, [isQueuedForNextRound, isBettingPhase, activeBet, isSubmitting, countdownRemaining, userBalance, parsedStake, panelIndex, onPlaceBet]);

  // Place Bet submission
  const handleBetClick = async () => {
    setErrorMessage(null);
    if (userBalance <= 0) {
      setErrorMessage('Please deposit funds to place bets.');
      return;
    }
    if (parsedStake < minBet) {
      setErrorMessage(`Minimum bet is Rs. ${minBet}.`);
      return;
    }
    if (parsedStake > maxBet) {
      setErrorMessage(`Maximum bet limit is Rs. ${maxBet.toLocaleString()}.`);
      return;
    }
    if (parsedStake > userBalance) {
      setErrorMessage(`Insufficient balance. Available: Rs. ${userBalance.toFixed(2)}.`);
      return;
    }

    // If outside betting phase or in last 0.6s, toggle queue for next round
    if (!isBettingPhase || countdownRemaining <= 0.6) {
      setIsQueuedForNextRound((prev) => !prev);
      return;
    }

    try {
      setIsSubmitting(true);
      await onPlaceBet(panelIndex, parsedStake);
      setIsQueuedForNextRound(false);
    } catch (err: any) {
      if (err?.message?.includes('closed') || err?.message?.includes('active')) {
        setIsQueuedForNextRound(true);
        setErrorMessage('Round started! Bet has been queued for the next round.');
      } else {
        setErrorMessage(err?.message || 'Failed to place bet. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cash Out handler
  const handleCashOutClick = async () => {
    if (!activeBet || activeBet.status !== 'placed') return;
    try {
      setIsSubmitting(true);
      await onCashOut(activeBet.id, currentMultiplier);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Cash out failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Autoplay automated cashout and bet placement hook
  useEffect(() => {
    if (!autoplayConfig.enabled) return;

    // Check stop conditions
    if (autoplayConfig.stopOnProfit > 0 && autoplayConfig.currentProfit >= autoplayConfig.stopOnProfit) {
      setAutoplayConfig((prev) => ({ ...prev, enabled: false }));
      return;
    }
    if (autoplayConfig.stopOnLoss > 0 && autoplayConfig.currentLoss >= autoplayConfig.stopOnLoss) {
      setAutoplayConfig((prev) => ({ ...prev, enabled: false }));
      return;
    }
    if (autoplayConfig.roundsRemaining <= 0) {
      setAutoplayConfig((prev) => ({ ...prev, enabled: false }));
      return;
    }

    // Auto cash out when flight reaches configured target
    if (
      isFlyingPhase &&
      activeBet &&
      activeBet.status === 'placed' &&
      autoplayConfig.autoCashOutMultiplier > 1 &&
      currentMultiplier >= autoplayConfig.autoCashOutMultiplier &&
      !isSubmitting
    ) {
      handleCashOutClick();
    }

    // Auto place bet during betting phase if not placed yet
    if (isBettingPhase && !activeBet && !isSubmitting) {
      if (userBalance >= autoplayConfig.baseStake) {
        onPlaceBet(panelIndex, autoplayConfig.baseStake).then(() => {
          setAutoplayConfig((prev) => ({
            ...prev,
            roundsRemaining: prev.roundsRemaining - 1,
          }));
        }).catch(() => {
          // If auto bet fails, stop autoplay
          setAutoplayConfig((prev) => ({ ...prev, enabled: false }));
        });
      } else {
        setAutoplayConfig((prev) => ({ ...prev, enabled: false }));
      }
    }
  }, [
    autoplayConfig.enabled,
    isFlyingPhase,
    isBettingPhase,
    currentMultiplier,
    activeBet?.status,
    round?.id,
  ]);

  // Track autoplay profit/loss when bet completes
  useEffect(() => {
    if (!autoplayConfig.enabled || !activeBet) return;
    if (activeBet.status === 'cashed_out' && activeBet.profit) {
      setAutoplayConfig((prev) => ({
        ...prev,
        currentProfit: prev.currentProfit + (activeBet.profit || 0),
      }));
    } else if (activeBet.status === 'crashed') {
      setAutoplayConfig((prev) => ({
        ...prev,
        currentLoss: prev.currentLoss + activeBet.stake,
      }));
    }
  }, [activeBet?.status]);

  // Live Payout calculation
  const potentialPayout = activeBet && activeBet.status === 'placed'
    ? Math.floor(activeBet.stake * currentMultiplier * 100) / 100
    : Math.floor(parsedStake * currentMultiplier * 100) / 100;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl backdrop-blur-md relative overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            {label}
          </span>
        </div>

        {/* Autoplay Badge / Toggle Button */}
        {isAutoplayEnabledSetting && (
          <div>
            {autoplayConfig.enabled ? (
              <button
                onClick={() => setAutoplayConfig((prev) => ({ ...prev, enabled: false }))}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-[10px] font-bold text-red-400 hover:bg-red-500/30 flex items-center gap-1 transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                Stop Auto ({autoplayConfig.roundsRemaining} left)
              </button>
            ) : (
              <button
                onClick={() => setAutoplayModalOpen(true)}
                disabled={Boolean(activeBet && activeBet.status === 'placed')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700/80 flex items-center gap-1 transition-all disabled:opacity-50"
              >
                <Sliders className="w-3 h-3 text-amber-400" />
                <span>Autoplay</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stake Input & Clear Button */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium">Bet Amount (Rs.)</span>
          <button
            onClick={handleClear}
            disabled={Boolean(activeBet && activeBet.status === 'placed')}
            className="text-[11px] text-amber-400 hover:text-amber-300 font-bold transition-all disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs font-bold">
            Rs.
          </div>
          <input
            type="number"
            min={minBet}
            max={maxBet}
            step="10"
            value={stakeInput}
            onChange={(e) => {
              setStakeInput(e.target.value);
              setErrorMessage(null);
            }}
            disabled={Boolean(activeBet && activeBet.status === 'placed')}
            placeholder="Bet amount"
            className="w-full pl-9 pr-14 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-amber-400 transition-all disabled:opacity-50"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
              NPR
            </span>
          </div>
        </div>
      </div>

      {/* Quick Amount Chips (Mandatory: Rs. 30, 200, 400, 1000, 4000, 20000) */}
      <div className="grid grid-cols-3 gap-1.5 mb-4">
        {quickAmounts.map((amt) => {
          const isSelected = parsedStake === amt;
          const isAffordable = userBalance >= amt;
          return (
            <button
              key={amt}
              onClick={() => handleSelectQuickAmount(amt)}
              disabled={Boolean(activeBet && activeBet.status === 'placed')}
              className={`py-1.5 px-1 rounded-lg text-[11px] font-bold font-mono transition-all border ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              } ${!isAffordable ? 'opacity-40' : ''}`}
            >
              Rs. {amt >= 1000 ? `${amt / 1000}k` : amt}
            </button>
          );
        })}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-3 p-2 rounded-lg bg-red-950/50 border border-red-500/40 text-[11px] text-red-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Button: Place Bet / Cash Out / Status */}
      <div className="mt-auto">
        {/* State 1: Active Bet is Placed and Round is Flying -> CASH OUT BUTTON */}
        {activeBet && activeBet.status === 'placed' && isFlyingPhase && (
          <button
            onClick={handleCashOutClick}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wide shadow-lg transition-all transform active:scale-95 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 hover:brightness-110 animate-pulse flex flex-col items-center justify-center cursor-pointer border border-amber-400/50"
          >
            <div className="flex items-center gap-1.5 text-base">
              <Zap className="w-4 h-4 fill-current" />
              <span>CASH OUT</span>
            </div>
            <div className="text-xs font-mono font-bold mt-0.5 opacity-90">
              Rs. {potentialPayout.toFixed(2)} (+Rs. {(potentialPayout - activeBet.stake).toFixed(2)})
            </div>
          </button>
        )}

        {/* State 2: Active Bet is Placed and Round is Betting -> WAITING */}
        {activeBet && activeBet.status === 'placed' && isBettingPhase && (
          <div className="w-full py-3.5 px-4 rounded-xl font-bold text-xs text-center bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Bet Placed: Rs. {activeBet.stake.toFixed(2)} (Waiting for launch)</span>
          </div>
        )}

        {/* State 3: Active Bet Cashed Out -> WON RESULT */}
        {activeBet && activeBet.status === 'cashed_out' && (
          <div className="w-full py-3 px-4 rounded-xl font-bold text-xs text-center bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Won Rs. {activeBet.payout?.toFixed(2)} @ {activeBet.cashedOutMultiplier?.toFixed(2)}x
            </span>
          </div>
        )}

        {/* State 4: Active Bet Crashed -> LOST RESULT */}
        {activeBet && activeBet.status === 'crashed' && (
          <div className="w-full py-3 px-4 rounded-xl font-bold text-xs text-center bg-red-950/50 border border-red-500/30 text-red-300 flex items-center justify-center gap-2">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>Crashed (Lost Rs. {activeBet.stake.toFixed(2)})</span>
          </div>
        )}

        {/* State 5: No active bet -> PLACE BET / QUEUE BUTTON */}
        {(!activeBet || activeBet.status === 'cashed_out' || activeBet.status === 'crashed') && (
          <div>
            {isQueuedForNextRound ? (
              <button
                onClick={() => setIsQueuedForNextRound(false)}
                className="w-full py-3.5 px-4 rounded-xl font-black text-xs tracking-wider shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:brightness-110 cursor-pointer border border-amber-400/40"
              >
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>QUEUED FOR NEXT ROUND (Rs. {parsedStake}) - TAP TO CANCEL</span>
              </button>
            ) : isBettingPhase && countdownRemaining > 0.6 ? (
              <button
                onClick={handleBetClick}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wider shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-emerald-500/25"
              >
                <Coins className="w-4 h-4" />
                <span>{isSubmitting ? 'PROCESSING...' : `PLACE BET (Rs. ${parsedStake})`}</span>
              </button>
            ) : isBettingPhase && countdownRemaining <= 0.6 ? (
              <button
                disabled
                className="w-full py-3.5 px-4 rounded-xl font-black text-xs tracking-wider shadow-lg bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>LOCKING BETS...</span>
              </button>
            ) : (
              <button
                onClick={handleBetClick}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl font-black text-xs tracking-wider shadow-lg transition-all transform active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 cursor-pointer border border-blue-400/30"
              >
                <Coins className="w-4 h-4" />
                <span>BET NEXT ROUND (Rs. {parsedStake})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Autoplay Modal Dialog */}
      {autoplayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                Configure Autoplay (Panel {panelIndex + 1})
              </h3>
              <button
                onClick={() => setAutoplayModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Number of Rounds</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 25, 50].map((rounds) => (
                    <button
                      key={rounds}
                      onClick={() => setAutoplayConfig((p) => ({ ...p, totalRounds: rounds }))}
                      className={`py-1.5 rounded-lg font-bold font-mono text-center border ${
                        autoplayConfig.totalRounds === rounds
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {rounds}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Bet Stake per Round (Rs.)</label>
                <input
                  type="number"
                  min={minBet}
                  max={maxBet}
                  value={autoplayConfig.baseStake}
                  onChange={(e) =>
                    setAutoplayConfig((p) => ({ ...p, baseStake: Number(e.target.value) || minBet }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Auto Cash Out at Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  max="50"
                  value={autoplayConfig.autoCashOutMultiplier}
                  onChange={(e) =>
                    setAutoplayConfig((p) => ({
                      ...p,
                      autoCashOutMultiplier: Math.max(1.1, Number(e.target.value) || 2.0),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  placeholder="e.g. 2.0x"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Stop on Profit (Rs.)</label>
                  <input
                    type="number"
                    value={autoplayConfig.stopOnProfit}
                    onChange={(e) =>
                      setAutoplayConfig((p) => ({ ...p, stopOnProfit: Number(e.target.value) || 0 }))
                    }
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Stop on Loss (Rs.)</label>
                  <input
                    type="number"
                    value={autoplayConfig.stopOnLoss}
                    onChange={(e) =>
                      setAutoplayConfig((p) => ({ ...p, stopOnLoss: Number(e.target.value) || 0 }))
                    }
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setAutoplayModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-700 font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setAutoplayConfig((p) => ({
                      ...p,
                      enabled: true,
                      roundsRemaining: p.totalRounds,
                      currentProfit: 0,
                      currentLoss: 0,
                    }));
                    setAutoplayModalOpen(false);
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-slate-950"
                >
                  Start Autoplay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
