import React from 'react';
import { Users, TrendingUp, Award, Clock } from 'lucide-react';
import { CrashBet } from '../../types';

interface CrashLiveBetsTableProps {
  bets: CrashBet[];
}

/**
 * Mask username for privacy: e.g. "atishchhy9" -> "at***9"
 */
function maskUsername(nameOrCode: string): string {
  if (!nameOrCode) return 'User***';
  const clean = nameOrCode.trim();
  if (clean.length <= 3) return `${clean}***`;
  const first2 = clean.substring(0, 2);
  const last1 = clean.substring(clean.length - 1);
  return `${first2}***${last1}`;
}

export const CrashLiveBetsTable: React.FC<CrashLiveBetsTableProps> = ({ bets }) => {
  // Real calculated figures from real database records (no bots, no fabrication)
  const numberOfBets = bets.length;
  const totalBetsNpr = bets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0);
  const totalWinningsNpr = bets.reduce((sum, b) => {
    if (b.status === 'cashed_out' && b.payout) {
      return sum + Number(b.payout);
    }
    return sum;
  }, 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-4">
      {/* Aggregate Real Statistics Bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold mb-1">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Number of Bets</span>
          </div>
          <span className="text-base sm:text-lg font-black font-mono text-white">
            {numberOfBets}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Bets (NPR)</span>
          </div>
          <span className="text-base sm:text-lg font-black font-mono text-amber-400">
            Rs. {totalBetsNpr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold mb-1">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Total Winnings</span>
          </div>
          <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
            Rs. {totalWinningsNpr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Live Bets Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-950/90 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
              <th className="py-2.5 px-3">Username</th>
              <th className="py-2.5 px-3 text-center">Odds</th>
              <th className="py-2.5 px-3 text-right">Bet (NPR)</th>
              <th className="py-2.5 px-3 text-right">Win (NPR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {bets.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500 font-sans text-xs">
                  No bets placed for this round yet. Place your bet above!
                </td>
              </tr>
            ) : (
              bets.map((bet) => {
                const isWin = bet.status === 'cashed_out';
                const isCrashed = bet.status === 'crashed';

                return (
                  <tr
                    key={bet.id}
                    className={`transition-colors hover:bg-slate-800/40 ${
                      isWin ? 'bg-emerald-500/5' : ''
                    }`}
                  >
                    {/* Masked Username */}
                    <td className="py-2.5 px-3 font-semibold text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>{maskUsername(bet.userName || bet.userCode)}</span>
                        {bet.panelIndex === 1 && (
                          <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-slate-400">
                            P2
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Odds / Multiplier */}
                    <td className="py-2.5 px-3 text-center font-bold">
                      {isWin ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px]">
                          {bet.cashedOutMultiplier?.toFixed(2)}x
                        </span>
                      ) : isCrashed ? (
                        <span className="text-slate-500 text-[11px]">-</span>
                      ) : (
                        <span className="text-amber-400 animate-pulse text-[11px]">In Play</span>
                      )}
                    </td>

                    {/* Bet Amount */}
                    <td className="py-2.5 px-3 text-right font-medium text-slate-300">
                      Rs. {bet.stake.toFixed(2)}
                    </td>

                    {/* Win Amount */}
                    <td className="py-2.5 px-3 text-right font-bold">
                      {isWin ? (
                        <span className="text-emerald-400">
                          Rs. {bet.payout?.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-500">Rs. 0.00</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
