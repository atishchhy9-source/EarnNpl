import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Building,
  Info,
  Clock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PaymentMethod, AppSettings } from '../types';
import { fetchAppSettings } from '../services/settingsService';
import { submitWithdrawalRequest } from '../services/walletService';

interface WithdrawalScreenProps {
  onSuccessNavigateHistory: () => void;
  onOpenAuth: () => void;
}

export const WithdrawalScreen: React.FC<WithdrawalScreenProps> = ({
  onSuccessNavigateHistory,
  onOpenAuth,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Form states
  const [amount, setAmount] = useState<number | ''>(1000);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('esewa');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => {
    fetchAppSettings().then(setSettings).catch(() => {});
  }, []);

  const availableBalance = userProfile?.balance ?? 0;
  const minWithdrawal = settings?.minWithdrawal ?? 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser || !userProfile) {
      onOpenAuth();
      return;
    }

    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount < minWithdrawal) {
      setError(`Minimum withdrawal amount is Rs. ${minWithdrawal.toFixed(2)}.`);
      return;
    }

    if (numAmount > availableBalance) {
      setError(`Requested amount (Rs. ${numAmount.toFixed(2)}) exceeds your available balance (Rs. ${availableBalance.toFixed(2)}).`);
      return;
    }

    if (!accountNumber.trim()) {
      setError('Please provide the recipient account number / mobile ID.');
      return;
    }

    if (!accountName.trim()) {
      setError('Please provide the registered account holder name.');
      return;
    }

    if (selectedMethod === 'bank' && !bankName.trim()) {
      setError('Please enter the bank name.');
      return;
    }

    setLoading(true);

    try {
      const wthId = await submitWithdrawalRequest({
        userId: currentUser.uid,
        userName: userProfile.name,
        userEmail: currentUser.email || '',
        userCode: userProfile.userCode,
        amount: numAmount,
        paymentMethod: selectedMethod,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        bankName: selectedMethod === 'bank' ? bankName.trim() : undefined,
        minWithdrawal,
      });

      setSuccessId(wthId);
      setAccountNumber('');
      setAccountName('');
      setBankName('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit withdrawal request.');
    } finally {
      setLoading(false);
    }
  };

  const quickWithdrawAmounts = [1000, 2000, 5000, 10000];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      {/* Top Banner */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Withdraw Funds (Rs.)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-400">
          Transfer your verified wallet balance directly to your eSewa, Khalti, or Nepali Bank Account.
        </p>
      </div>

      {/* Available Balance Overview */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950/40 border border-slate-800 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
            <Wallet className="w-4 h-4 text-emerald-400" /> Current Available Balance
          </span>
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Verified Funds
          </span>
        </div>
        <div className="text-3xl sm:text-4xl font-black font-mono text-white">
          Rs. {availableBalance.toFixed(2)}
        </div>
        {userProfile && (userProfile.pendingWithdrawals || 0) > 0 && (
          <div className="text-xs text-amber-400 mt-2 flex items-center gap-1.5 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Rs. {(userProfile.pendingWithdrawals || 0).toFixed(2)} currently in pending payout review
            </span>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {successId && (
        <div className="mb-6 p-6 rounded-3xl bg-teal-950/50 border border-teal-500/30 text-center shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Withdrawal Request Registered!</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto mb-4 leading-relaxed">
            Your withdrawal of <strong className="text-teal-400">Rs. {Number(amount).toFixed(2)}</strong> has been submitted under ID <code className="bg-slate-900 px-1.5 py-0.5 rounded text-white">{successId}</code>.
            <br />
            The amount has been reserved from your wallet and will be sent to your account upon admin processing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSuccessNavigateHistory}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs sm:text-sm transition-all"
            >
              View in Withdrawal History
            </button>
            <button
              onClick={() => setSuccessId(null)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition-all"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: Select Method */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Step 1</span>
            <span className="text-xs text-slate-400">Select payout destination</span>
          </div>
          <h3 className="text-sm font-bold text-white mb-3">Payout Method</h3>

          <div className="grid grid-cols-3 gap-3">
            {/* eSewa */}
            <div
              onClick={() => setSelectedMethod('esewa')}
              className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                selectedMethod === 'esewa'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-sm">
                e
              </div>
              <div className="text-xs font-bold text-white">eSewa</div>
              <div className="text-[10px] text-slate-400">Wallet transfer</div>
            </div>

            {/* Khalti */}
            <div
              onClick={() => setSelectedMethod('khalti')}
              className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                selectedMethod === 'khalti'
                  ? 'border-purple-500 bg-purple-500/10 shadow-md shadow-purple-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                K
              </div>
              <div className="text-xs font-bold text-white">Khalti</div>
              <div className="text-[10px] text-slate-400">Instant payout</div>
            </div>

            {/* Bank Transfer */}
            <div
              onClick={() => setSelectedMethod('bank')}
              className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                selectedMethod === 'bank'
                  ? 'border-blue-500 bg-blue-500/10 shadow-md shadow-blue-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 mx-auto mb-1 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                <Building className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white">Bank Transfer</div>
              <div className="text-[10px] text-slate-400">ConnectIPS / NCHL</div>
            </div>
          </div>
        </div>

        {/* Step 2: Withdrawal Amount */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Step 2</span>
            <span className="text-xs text-slate-400">
              Min: Rs. {minWithdrawal.toLocaleString()}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mb-2">Withdrawal Amount (Rs.)</h3>

          <div className="relative mb-3">
            <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">Rs.</span>
            <input
              type="number"
              min={minWithdrawal}
              max={availableBalance || minWithdrawal}
              step="10"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="1000"
              className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base sm:text-lg font-mono font-bold focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Quick Amount Chips */}
          <div className="grid grid-cols-4 gap-2">
            {quickWithdrawAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={`py-1.5 px-1 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  amount === q
                    ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                }`}
              >
                Rs. {q.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Recipient Account Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400">Step 3</span>
            <span className="text-xs text-slate-400">Destination credentials</span>
          </div>
          <h3 className="text-sm font-bold text-white">Recipient Account Information</h3>

          {selectedMethod === 'bank' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Bank Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Nabil Bank, NIC Asia, Global IME"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              {selectedMethod === 'esewa'
                ? 'eSewa ID / Registered Mobile Number'
                : selectedMethod === 'khalti'
                ? 'Khalti ID / Registered Mobile Number'
                : 'Bank Account Number'}{' '}
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={selectedMethod === 'bank' ? '01200175029348' : '98XXXXXXXX'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Account Holder Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Full name as shown on account"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        {/* Security & Reserve Guarantee Notice */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
          <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Balance Hold Policy:</strong> Upon submitting, the requested amount is securely reserved from your available balance. If the withdrawal is rejected by admin for any reason, the exact reserved amount is <strong className="text-teal-400">immediately restored</strong> to your wallet.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !currentUser || availableBalance < minWithdrawal}
          className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-teal-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ArrowUpRight className="w-5 h-5" />
              <span>Submit Withdrawal Request (Rs. {Number(amount || 0).toFixed(2)})</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
