import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  LogOut,
  Mail,
  Key,
  Copy,
  Check,
  FileText,
  HelpCircle,
  Phone,
  MessageSquare,
  Lock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building,
  ArrowUpRight,
  ArrowDownCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAppSettings } from '../services/settingsService';
import { AppSettings } from '../types';

interface ProfileScreenProps {
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onNavigateTab: (tab: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onOpenAuth,
  onOpenAdmin,
  onNavigateTab,
}) => {
  const { currentUser, userProfile, isAdmin, logout, sendPasswordReset } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [activeModal, setActiveModal] = useState<'terms' | 'privacy' | 'policy' | 'support' | null>(null);

  useEffect(() => {
    fetchAppSettings().then(setSettings).catch(() => {});
  }, []);

  const handleCopy = (text: string, type: 'id' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePasswordReset = async () => {
    if (currentUser?.email) {
      try {
        await sendPasswordReset(currentUser.email);
        setResetSent(true);
        setTimeout(() => setResetSent(false), 4000);
      } catch (err) {
        alert('Could not send reset email.');
      }
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-4">
          <User className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Sign in to your Account</h3>
        <p className="text-xs text-slate-400 mb-6">
          Log in to manage your deposits, request payouts, and check your transaction ledger.
        </p>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20"
        >
          Sign In Now
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-5">
      {/* User Info Card */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 relative overflow-hidden shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-emerald-400 text-xl">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">{userProfile?.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Portal</span>
            </button>
          )}
        </div>

        {/* User Identifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5 pt-4 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">User Referral Code</span>
              <span className="font-mono font-bold text-emerald-400">{userProfile?.userCode}</span>
            </div>
            <button
              onClick={() => handleCopy(userProfile?.userCode || '', 'code')}
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">System User ID</span>
              <span className="font-mono text-slate-300 text-[11px] truncate block">{currentUser.uid}</span>
            </div>
            <button
              onClick={() => handleCopy(currentUser.uid, 'id')}
              className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white shrink-0"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Account Balances Summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500">Available</span>
          <div className="text-sm sm:text-base font-extrabold font-mono text-emerald-400 mt-0.5">
            Rs. {(userProfile?.balance || 0).toFixed(2)}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Deposited</span>
          <div className="text-sm sm:text-base font-extrabold font-mono text-white mt-0.5">
            Rs. {(userProfile?.totalDeposited || 0).toFixed(2)}
          </div>
        </div>
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Withdrawn</span>
          <div className="text-sm sm:text-base font-extrabold font-mono text-teal-400 mt-0.5">
            Rs. {(userProfile?.totalWithdrawn || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Quick Deposit & Withdrawal Shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigateTab('deposit')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-left transition-colors group"
        >
          <ArrowDownCircle className="w-5 h-5 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold text-white">Deposit Funds</h4>
          <p className="text-[11px] text-slate-400">Min: Rs. {settings?.minDeposit || 100}</p>
        </button>

        <button
          onClick={() => onNavigateTab('withdraw')}
          className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-teal-500/40 text-left transition-colors group"
        >
          <ArrowUpRight className="w-5 h-5 text-teal-400 mb-1 group-hover:scale-110 transition-transform" />
          <h4 className="text-xs font-bold text-white">Request Payout</h4>
          <p className="text-[11px] text-slate-400">Min: Rs. {settings?.minWithdrawal || 1000}</p>
        </button>
      </div>

      {/* Support & Legal Menu */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden divide-y divide-slate-800/80">
        <div
          onClick={() => setActiveModal('support')}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Official Support & Help</h4>
              <p className="text-[11px] text-slate-400">Contact admin, Telegram, and FAQs</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>

        <div
          onClick={() => setActiveModal('policy')}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Deposit & Withdrawal Policy</h4>
              <p className="text-[11px] text-slate-400">Limits, verification timelines, and refund rules</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>

        <div
          onClick={() => setActiveModal('terms')}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Terms of Service</h4>
              <p className="text-[11px] text-slate-400">Nepali digital transactions and anti-fraud conditions</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>

        <div
          onClick={() => setActiveModal('privacy')}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Privacy Policy</h4>
              <p className="text-[11px] text-slate-400">Data protection and financial record storage</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>
      </div>

      {/* Security Actions */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Security</h4>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-white">Reset Password</div>
            <div className="text-[11px] text-slate-400">Send password change instructions to email</div>
          </div>
          <button
            onClick={handlePasswordReset}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            {resetSent ? 'Email Sent!' : 'Send Reset'}
          </button>
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">Sign out of this session</div>
          <button
            onClick={logout}
            className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* MODALS */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="relative max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto text-xs text-slate-300 leading-relaxed">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-white">
                {activeModal === 'support' && 'Official Help & Support'}
                {activeModal === 'policy' && 'Financial Rules & Policies'}
                {activeModal === 'terms' && 'Terms and Conditions'}
                {activeModal === 'privacy' && 'Privacy Policy'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {activeModal === 'support' && (
              <div className="space-y-3">
                <p>Contact our support team for payment verifications and payout inquiries:</p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                  <div>Email: <strong className="text-emerald-400">{settings?.supportEmail || 'support@earnnpl.com.np'}</strong></div>
                  <div>Telegram: <strong className="text-emerald-400">{settings?.supportTelegram || '@EarnNplOfficial'}</strong></div>
                  <div>WhatsApp: <strong className="text-emerald-400">{settings?.supportWhatsapp || '+977-9841234567'}</strong></div>
                </div>
                <h5 className="font-bold text-white pt-2">Processing FAQ</h5>
                <p><strong>Q: What is the minimum deposit?</strong><br />A: Rs. {settings?.minDeposit || 100.00}.</p>
                <p><strong>Q: What is the minimum withdrawal?</strong><br />A: Rs. {settings?.minWithdrawal || 1000.00}.</p>
                <p><strong>Q: What happens if a withdrawal is rejected?</strong><br />A: The exact reserved amount is automatically refunded back to your available balance in an atomic transaction.</p>
              </div>
            )}

            {activeModal === 'policy' && (
              <div className="space-y-2.5">
                <p>1. <strong>Deposits:</strong> Minimum deposit amount is Rs. {settings?.minDeposit || 100}. Every transaction ID is verified against our official account receipts before being credited to your wallet.</p>
                <p>2. <strong>Withdrawals:</strong> Minimum payout amount is Rs. {settings?.minWithdrawal || 1000}. Payouts are made directly to your registered eSewa, Khalti, or Bank account.</p>
                <p>3. <strong>Balance Protection:</strong> When you submit a withdrawal, the funds are safely held so they cannot be spent twice. If the payout cannot be completed, the amount is refunded to your balance exactly once.</p>
              </div>
            )}

            {activeModal === 'terms' && (
              <div className="space-y-2.5">
                <p>By registering on Earn Npl, you agree that:</p>
                <p>• All transactions are strictly in Nepali Rupees (Rs. NPR).</p>
                <p>• Only one account per person is allowed. Multiple accounts or forged transaction IDs result in immediate suspension.</p>
              </div>
            )}

            {activeModal === 'privacy' && (
              <div className="space-y-2.5">
                <p>Earn Npl protects your financial details. Payout account numbers and payment slips are strictly accessible to authorized administrators for verification only.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
