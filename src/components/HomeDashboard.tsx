import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Clock,
  History,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAppSettings } from '../services/settingsService';
import { fetchUserDeposits, fetchUserWithdrawals } from '../services/walletService';
import { AppSettings, DepositRequest, WithdrawalRequest } from '../types';

interface HomeDashboardProps {
  onNavigateTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigateTab,
  onOpenAuth,
  onOpenAdmin,
}) => {
  const { currentUser, userProfile, isAdmin } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recentDeposits, setRecentDeposits] = useState<DepositRequest[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<WithdrawalRequest[]>([]);

  useEffect(() => {
    fetchAppSettings().then(setSettings).catch(() => {});

    if (currentUser?.uid) {
      fetchUserDeposits(currentUser.uid).then((d) => setRecentDeposits(d.slice(0, 3))).catch(() => {});
      fetchUserWithdrawals(currentUser.uid).then((w) => setRecentWithdrawals(w.slice(0, 3))).catch(() => {});
    }
  }, [currentUser?.uid]);

  const balance = userProfile?.balance ?? 0;
  const pendingDeposits = userProfile?.pendingDeposits ?? 0;
  const pendingWithdrawals = userProfile?.pendingWithdrawals ?? 0;
  const totalDeposited = userProfile?.totalDeposited ?? 0;
  const totalWithdrawn = userProfile?.totalWithdrawn ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-6">
      {/* Maintenance Mode Warning */}
      {settings?.maintenanceMode && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Scheduled Maintenance:</strong> Some banking payout routes may experience slight delays.
          </span>
        </div>
      )}

      {/* Admin Notice Pill */}
      {isAdmin && (
        <div
          onClick={onOpenAdmin}
          className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-all text-xs"
        >
          <div className="flex items-center gap-2 text-amber-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Admin Control Active: Review pending deposits & payouts</span>
          </div>
          <span className="text-amber-400 font-bold flex items-center gap-1">
            Open <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      )}

      {/* Welcome & User Code */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Namaste 🙏, Welcome to</span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>{currentUser ? userProfile?.name || 'Nepali Earner' : 'Earn Npl'}</span>
          </h2>
        </div>
        {userProfile && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-mono uppercase">User Code</span>
            <div className="text-xs font-mono font-bold text-emerald-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              {userProfile.userCode}
            </div>
          </div>
        )}
      </div>

      {/* Main Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 p-6 sm:p-7 shadow-2xl">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-300">Available Wallet Balance</span>
          </div>
          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            NPR (Rs.)
          </span>
        </div>

        {/* Currency Amount Display */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-slate-400 text-xl font-bold font-mono">Rs.</span>
          <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
            {balance.toFixed(2)}
          </span>
        </div>

        {/* Pending Holds Indicators */}
        <div className="flex flex-wrap gap-2 mb-4">
          {pendingDeposits > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>
                Rs. {pendingDeposits.toFixed(2)} Pending Deposit Review
              </span>
            </div>
          )}
          {pendingWithdrawals > 0 && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-300 text-xs font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Rs. {pendingWithdrawals.toFixed(2)} Reserved in Payout Review
              </span>
            </div>
          )}
        </div>

        {/* Primary Action Buttons: Deposit & Withdraw */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => (currentUser ? onNavigateTab('deposit') : onOpenAuth())}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
          >
            <ArrowDownCircle className="w-5 h-5" />
            <span>Deposit (Min: Rs. {settings?.minDeposit || 100})</span>
          </button>

          <button
            onClick={() => (currentUser ? onNavigateTab('withdraw') : onOpenAuth())}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs sm:text-sm border border-slate-700 transition-all hover:scale-[1.02]"
          >
            <ArrowUpRight className="w-5 h-5 text-teal-400" />
            <span>Withdraw (Min: Rs. {settings?.minWithdrawal || 1000})</span>
          </button>
        </div>
      </div>

      {/* FEATURED: Crash Multiplier Game Card */}
      <div
        onClick={() => onNavigateTab('crash')}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0d1322] via-slate-900 to-[#1e132b] border border-amber-500/40 p-5 sm:p-6 shadow-2xl cursor-pointer group hover:border-amber-400 transition-all"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-extrabold tracking-wide uppercase">
                HOT • PROVABLY FAIR
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                97% RTP
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 group-hover:text-amber-300 transition-colors">
              <span>🚀 Crash Multiplier Game</span>
            </h3>
            <p className="text-xs text-slate-300 max-w-md">
              Watch the rocket soar and multiplier climb! Cash out before the crash to win up to 250x your stake. Dual concurrent panels • Min bet Rs. 20.
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateTab('crash');
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 shrink-0 group-hover:scale-105 transition-transform"
          >
            <span>Play Crash Now</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Admin Announcements Banner */}
      {settings?.announcementBanner && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-start gap-3 text-xs text-slate-300 leading-relaxed shadow-sm">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>{settings.announcementBanner}</p>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Deposited</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            Rs. {totalDeposited.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">Verified eSewa / Khalti / Bank</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Total Withdrawn</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            Rs. {totalWithdrawn.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500">Successfully disbursed</span>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span>Recent Activity</span>
          </h3>
          <button
            onClick={() => onNavigateTab('history')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
          >
            Full Records <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentDeposits.length === 0 && recentWithdrawals.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
            No transactions yet. Click <strong>Deposit</strong> to add funds.
          </div>
        ) : (
          <div className="space-y-2">
            {recentDeposits.map((dep) => (
              <div
                key={dep.id}
                onClick={() => onNavigateTab('history')}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-700"
              >
                <div>
                  <span className="font-bold text-emerald-400 font-mono">
                    + Rs. {dep.amount.toFixed(2)}
                  </span>{' '}
                  <span className="text-slate-400 uppercase text-[10px]">({dep.paymentMethod})</span>
                  <div className="text-[10px] text-slate-500 font-mono">Txn: {dep.transactionId}</div>
                </div>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      dep.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : dep.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    Deposit {dep.status}
                  </span>
                </div>
              </div>
            ))}

            {recentWithdrawals.map((wth) => (
              <div
                key={wth.id}
                onClick={() => onNavigateTab('history')}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs cursor-pointer hover:border-slate-700"
              >
                <div>
                  <span className="font-bold text-teal-300 font-mono">
                    - Rs. {wth.amount.toFixed(2)}
                  </span>{' '}
                  <span className="text-slate-400 uppercase text-[10px]">({wth.paymentMethod})</span>
                  <div className="text-[10px] text-slate-500 font-mono">To: {wth.accountNumber}</div>
                </div>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      wth.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : wth.status === 'paid'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    Withdrawal {wth.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
