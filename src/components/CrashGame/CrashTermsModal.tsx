import React from 'react';
import { Shield, X, AlertTriangle, CheckCircle2, Lock, Scale } from 'lucide-react';

interface CrashTermsModalProps {
  onClose: () => void;
  minBet: number;
  maxBet: number;
}

export const CrashTermsModal: React.FC<CrashTermsModalProps> = ({ onClose, minBet, maxBet }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Terms & Game Rules</h2>
              <p className="text-xs text-slate-400">Provably Fair Crash Multiplier Regulations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              1. How to Play
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Place a bet before the round countdown reaches zero. Minimum bet is Rs. {minBet}, Maximum bet is Rs. {maxBet.toLocaleString()}.</li>
              <li>You can place up to two concurrent bets in a single round using Panel 1 and Panel 2.</li>
              <li>Once the rocket takes off, the live multiplier increases from 1.00x upward.</li>
              <li>Press <strong>Cash Out</strong> before the rocket crashes to claim your payout: <code className="text-amber-400 font-mono">Payout = Stake × Multiplier</code>.</li>
              <li>If the rocket flies away/crashes before you cash out, your round stake is lost.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-amber-400" />
              2. Provably Fair System & SHA-256
            </h3>
            <p className="text-slate-400">
              Every round outcome is mathematically predetermined before betting begins using standard SHA-256 cryptographic hashing.
              The hash of the round seed is published prior to takeoff, preventing any client or server tampering during flight.
              The system operates on an auditable 97% Return-To-Player (RTP) statistical model.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-blue-400" />
              3. Real Wallet & Atomic Accounting
            </h3>
            <p className="text-slate-400">
              All bets and payouts directly interface with your authenticated Earn Npl wallet balance.
              Stakes are deducted atomically upon bet confirmation. Winnings are immediately credited to your balance and recorded in the immutable transaction ledger.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1.5">
            <h4 className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              4. Responsible Gaming & Legal Disclaimer
            </h4>
            <p className="text-[11px] leading-normal opacity-90">
              Please play responsibly. Only wager funds you can afford to lose.
              Before participating in real-money skill gaming or interactive activities, users must ensure compliance with all applicable local laws, age regulations (18+), and guidelines of the Federal Democratic Republic of Nepal.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 transition-all text-xs"
          >
            I Understand & Agree
          </button>
        </div>
      </div>
    </div>
  );
};
