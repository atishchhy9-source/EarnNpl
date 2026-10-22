import React, { useState, useEffect } from 'react';
import { History, X, CheckCircle2, XCircle, ArrowUpRight, ShieldCheck, Filter } from 'lucide-react';
import { CrashBet } from '../../types';
import { fetchUserCrashBets } from '../../services/crashService';

interface CrashHistoryModalProps {
  userId: string;
  onClose: () => void;
}

export const CrashHistoryModal: React.FC<CrashHistoryModalProps> = ({ userId, onClose }) => {
  const [historyBets, setHistoryBets] = useState<CrashBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');

  useEffect(() => {
    fetchUserCrashBets(userId)
      .then((data) => {
        setHistoryBets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const filteredBets = historyBets.filter((b) => {
    if (filter === 'wins') return b.status === 'cashed_out';
    if (filter === 'losses') return b.status === 'crashed';
    return true;
  });

  const totalBetsCount = historyBets.length;
  const totalWon = historyBets.reduce((acc, b) => acc + (b.payout || 0), 0);
  const totalStaked = historyBets.reduce((acc, b) => acc + b.stake, 0);
  const netPnL = totalWon - totalStaked;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Crash Betting History</h2>
              <p className="text-xs text-slate-400">Your auditable personal round transactions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-slate-950/60 border-b border-slate-800 text-center">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Rounds</span>
            <div className="text-sm font-bold font-mono text-white mt-0.5">{totalBetsCount}</div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Staked</span>
            <div className="text-sm font-bold font-mono text-slate-300 mt-0.5">
              Rs. {totalStaked.toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Net Profit / Loss</span>
            <div
              className={`text-sm font-bold font-mono mt-0.5 ${
                netPnL >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {netPnL >= 0 ? `+Rs. ${netPnL.toFixed(2)}` : `-Rs. ${Math.abs(netPnL).toFixed(2)}`}
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-4 py-2 border-b border-slate-800/80 flex items-center gap-2">
          {(['all', 'wins', 'losses'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === mode
                  ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading game history...</div>
          ) : filteredBets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No records found.</div>
          ) : (
            filteredBets.map((bet) => {
              const isWin = bet.status === 'cashed_out';
              const profit = isWin ? (bet.profit || 0) : -bet.stake;

              return (
                <div
                  key={bet.id}
                  className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl ${
                        isWin ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {isWin ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white font-mono">
                        <span>Round #{bet.roundId.split('_')[1] || '---'}</span>
                        <span className="text-[10px] text-slate-500 font-sans">
                          (Panel {bet.panelIndex + 1})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>Stake: Rs. {bet.stake.toFixed(2)}</span>
                        <span>•</span>
                        <span>
                          {isWin ? (
                            <span className="text-emerald-400 font-bold font-mono">
                              Cashed @ {bet.cashedOutMultiplier?.toFixed(2)}x
                            </span>
                          ) : (
                            <span className="text-red-400 font-medium">Crashed</span>
                          )}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(bet.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Payout & Net PnL */}
                  <div className="text-right font-mono">
                    <div className="font-bold text-white">
                      {isWin ? `Rs. ${(bet.payout || 0).toFixed(2)}` : 'Rs. 0.00'}
                    </div>
                    <div
                      className={`text-[11px] font-bold ${
                        profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {profit >= 0 ? `+Rs. ${profit.toFixed(2)}` : `-Rs. ${Math.abs(profit).toFixed(2)}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
