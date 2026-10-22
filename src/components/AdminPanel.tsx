import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Eye,
  X,
  Settings,
  Users,
  Check,
  Building,
  RefreshCw,
  Lock,
  ArrowUpRight,
  ArrowDownCircle,
  QrCode,
  Upload,
  AlertTriangle,
  FileText,
  DollarSign,
  Flame,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAllDepositsAdmin,
  fetchAllWithdrawalsAdmin,
  adminApproveDeposit,
  adminRejectDeposit,
  adminRejectWithdrawal,
  adminMarkWithdrawalPaid,
} from '../services/walletService';
import { fetchAppSettings, updateAppSettings } from '../services/settingsService';
import { fetchAdminCrashRounds, fetchAdminCrashBets } from '../services/crashService';
import { DepositRequest, WithdrawalRequest, AppSettings, CrashRound, CrashBet } from '../types';
import { collection, getDocs, query, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

interface AdminPanelProps {
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'qrcodes' | 'users' | 'settings' | 'crash'>('deposits');
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [crashRoundsList, setCrashRoundsList] = useState<CrashRound[]>([]);
  const [crashBetsList, setCrashBetsList] = useState<CrashBet[]>([]);

  // Filters & search
  const [depositFilter, setDepositFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [withdrawalFilter, setWithdrawalFilter] = useState<'pending' | 'approved' | 'rejected' | 'paid' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modals
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [rejectingDeposit, setRejectingDeposit] = useState<DepositRequest | null>(null);
  const [depositRejectionReason, setDepositRejectionReason] = useState('');
  const [approvingDeposit, setApprovingDeposit] = useState<DepositRequest | null>(null);

  // Withdrawal action modals
  const [rejectingWithdrawal, setRejectingWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [withdrawalRejectionReason, setWithdrawalRejectionReason] = useState('');
  const [payingWithdrawal, setPayingWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [paymentReference, setPaymentReference] = useState('');

  // Settings form states
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // QR upload refs
  const esewaQrInputRef = useRef<HTMLInputElement>(null);
  const khaltiQrInputRef = useRef<HTMLInputElement>(null);
  const bankQrInputRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [depList, wthList, appSet, cRounds, cBets] = await Promise.all([
        fetchAllDepositsAdmin(),
        fetchAllWithdrawalsAdmin(),
        fetchAppSettings(),
        fetchAdminCrashRounds(30),
        fetchAdminCrashBets(50),
      ]);
      setDeposits(depList);
      setWithdrawals(wthList);
      setSettings(appSet);
      setCrashRoundsList(cRounds);
      setCrashBetsList(cBets);

      try {
        const uSnap = await getDocs(query(collection(db, 'users'), limit(100)));
        setUsersList(uSnap.docs.map(d => d.data()));
      } catch (e) {
        console.warn('Users query:', e);
      }
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Access Denied</h3>
          <p className="text-xs text-slate-400 mb-6">
            Only authorized Earn Npl administrators can access this panel.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  // Handle Deposit Approval
  const handleConfirmApproveDeposit = async () => {
    if (!approvingDeposit || !currentUser?.email) return;
    const targetId = approvingDeposit.id;
    setActionLoadingId(targetId);
    setApprovingDeposit(null);
    try {
      await adminApproveDeposit(targetId, currentUser.email);
      setDeposits(prev => prev.map(d => d.id === targetId ? { ...d, status: 'approved' } : d));
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Error approving deposit');
      await loadAll();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Deposit Rejection
  const handleConfirmRejectDeposit = async () => {
    if (!rejectingDeposit || !currentUser?.email) return;
    const targetId = rejectingDeposit.id;
    const reason = depositRejectionReason;
    setActionLoadingId(targetId);
    setRejectingDeposit(null);
    setDepositRejectionReason('');
    try {
      await adminRejectDeposit(targetId, reason, currentUser.email);
      setDeposits(prev => prev.map(d => d.id === targetId ? { ...d, status: 'rejected', rejectionReason: reason } : d));
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Error rejecting deposit');
      await loadAll();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Withdrawal Rejection (Releases Reserved Hold)
  const handleConfirmRejectWithdrawal = async () => {
    if (!rejectingWithdrawal || !currentUser?.email) return;
    const targetId = rejectingWithdrawal.id;
    const reason = withdrawalRejectionReason;
    setActionLoadingId(targetId);
    setRejectingWithdrawal(null);
    setWithdrawalRejectionReason('');
    try {
      await adminRejectWithdrawal(targetId, reason, currentUser.email);
      setWithdrawals(prev => prev.map(w => w.id === targetId ? { ...w, status: 'rejected', rejectionReason: reason } : w));
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Error rejecting withdrawal');
      await loadAll();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Withdrawal Mark Paid
  const handleConfirmPayWithdrawal = async () => {
    if (!payingWithdrawal || !currentUser?.email) return;
    if (!paymentReference.trim()) {
      alert('Please enter a payment reference number / voucher code.');
      return;
    }
    const targetId = payingWithdrawal.id;
    const refCode = paymentReference.trim();
    setActionLoadingId(targetId);
    setPayingWithdrawal(null);
    setPaymentReference('');
    try {
      await adminMarkWithdrawalPaid(targetId, refCode, currentUser.email);
      setWithdrawals(prev => prev.map(w => w.id === targetId ? { ...w, status: 'paid', paymentReference: refCode } : w));
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Error marking withdrawal as paid');
      await loadAll();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle QR upload helper
  const handleQrUpload = (method: 'esewa' | 'khalti' | 'bank', file: File) => {
    if (!settings) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (method === 'esewa') setSettings({ ...settings, esewaQrCode: dataUrl });
      else if (method === 'khalti') setSettings({ ...settings, khaltiQrCode: dataUrl });
      else if (method === 'bank') setSettings({ ...settings, bankQrCode: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await updateAppSettings(settings);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 2500);
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Suspend / Activate user
  const handleToggleUserStatus = async (user: any) => {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    if (!confirm(`Are you sure you want to mark ${user.name} as ${newStatus}?`)) return;
    try {
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      setUsersList(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } catch (err: any) {
      alert('Error updating user status: ' + err.message);
    }
  };

  const pendingDepositsCount = deposits.filter(d => d.status === 'pending').length;
  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length;
  const totalApprovedDeposits = deposits
    .filter(d => d.status === 'approved')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalPaidWithdrawals = withdrawals
    .filter(w => w.status === 'paid')
    .reduce((sum, w) => sum + w.amount, 0);

  const filteredDeposits = deposits.filter((d) => {
    const matchesFilter = depositFilter === 'all' || d.status === depositFilter;
    const matchesQuery =
      !searchQuery ||
      d.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.userCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.userName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesFilter = withdrawalFilter === 'all' || w.status === withdrawalFilter;
    const matchesQuery =
      !searchQuery ||
      w.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.paymentReference && w.paymentReference.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-md animate-fadeIn">
      <div className="min-h-screen max-w-6xl mx-auto px-4 py-6 sm:py-8 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Earn Npl Master Control Panel
                </h1>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Firebase Persistent
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Verified Finance Console • Admin: <strong className="text-slate-200">{currentUser?.email}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadAll}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
              title="Refresh records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Exit Admin Panel
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <ArrowDownCircle className="w-3.5 h-3.5 text-amber-400" /> Pending Deposits
            </span>
            <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
              {pendingDepositsCount}
            </div>
            <span className="text-[10px] text-slate-500">Requires verification</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-teal-400" /> Pending Payouts
            </span>
            <div className="text-2xl font-extrabold text-teal-400 font-mono mt-1">
              {pendingWithdrawalsCount}
            </div>
            <span className="text-[10px] text-slate-500">Awaiting bank/wallet transfer</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Total Approved Deposits</span>
            <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
              Rs. {totalApprovedDeposits.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500">Credited to users</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Total Paid Withdrawals</span>
            <div className="text-xl font-extrabold text-white font-mono mt-1">
              Rs. {totalPaidWithdrawals.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500">Disbursed to users</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => { setActiveTab('deposits'); setSearchQuery(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'deposits'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Deposits ({pendingDepositsCount > 0 ? `${pendingDepositsCount} Pending` : deposits.length})
          </button>
          <button
            onClick={() => { setActiveTab('withdrawals'); setSearchQuery(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'withdrawals'
                ? 'bg-teal-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Withdrawals ({pendingWithdrawalsCount > 0 ? `${pendingWithdrawalsCount} Pending` : withdrawals.length})
          </button>
          <button
            onClick={() => { setActiveTab('qrcodes'); setSearchQuery(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'qrcodes'
                ? 'bg-purple-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            QR Codes & Payment Details
          </button>
          <button
            onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Users Directory ({usersList.length})
          </button>
          <button
            onClick={() => { setActiveTab('settings'); setSearchQuery(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-blue-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Financial Limits & Notices
          </button>
          <button
            onClick={() => { setActiveTab('crash'); setSearchQuery(''); }}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'crash'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md font-extrabold'
                : 'text-amber-400 hover:text-amber-300 bg-slate-900 border border-amber-500/30'
            }`}
          >
            <span>🚀 Crash Game Controls</span>
          </button>
        </div>

        {/* TAB 1: DEPOSITS APPROVAL PANEL */}
        {activeTab === 'deposits' && (
          <div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['pending', 'approved', 'rejected', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDepositFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      depositFilter === filter
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {filter}
                    {filter === 'pending' && pendingDepositsCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px]">
                        {pendingDepositsCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="relative sm:w-80">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user, code, or txn ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : filteredDeposits.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-white">No Deposit Requests Found</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {depositFilter === 'pending'
                    ? 'All pending deposits have been processed.'
                    : `No deposits matching "${depositFilter}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDeposits.map((dep) => (
                  <div
                    key={dep.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      dep.status === 'pending'
                        ? 'bg-slate-900/90 border-amber-500/30 shadow-lg'
                        : dep.status === 'approved'
                        ? 'bg-slate-900/60 border-emerald-500/20'
                        : 'bg-slate-900/40 border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            dep.paymentMethod === 'esewa'
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : dep.paymentMethod === 'khalti'
                              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {dep.paymentMethod.toUpperCase()}
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xl font-extrabold text-white font-mono">
                              Rs. {dep.amount.toFixed(2)}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {dep.userName} ({dep.userCode})
                            </span>
                            {dep.status === 'pending' && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                Pending Verification
                              </span>
                            )}
                            {dep.status === 'approved' && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                Approved & Credited
                              </span>
                            )}
                            {dep.status === 'rejected' && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                Rejected
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-slate-400">
                            <div>Txn ID: <strong className="text-emerald-400 font-mono font-bold select-all">{dep.transactionId}</strong></div>
                            <div>User ID: <span className="text-slate-300 font-mono text-[11px]">{dep.userId}</span></div>
                            <div>Email: <span className="text-slate-300">{dep.userEmail}</span></div>
                            <div>Submitted: <span className="text-slate-300">{new Date(dep.createdAt).toLocaleString()}</span></div>
                          </div>

                          {dep.rejectionReason && (
                            <div className="mt-2 text-xs text-rose-400">
                              <strong>Rejection reason:</strong> {dep.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                        {dep.screenshotUrl && (
                          <div
                            onClick={() => setPreviewImage(dep.screenshotUrl)}
                            className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 cursor-pointer"
                            title="Click to view full screenshot"
                          >
                            <img
                              src={dep.screenshotUrl}
                              alt="Proof thumb"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}

                        {dep.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setApprovingDeposit(dep)}
                              disabled={actionLoadingId === dep.id}
                              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                            >
                              Approve & Credit
                            </button>
                            <button
                              onClick={() => {
                                setRejectingDeposit(dep);
                                setDepositRejectionReason('');
                              }}
                              disabled={actionLoadingId === dep.id}
                              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-slate-500 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                            Processed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WITHDRAWALS APPROVAL PANEL */}
        {activeTab === 'withdrawals' && (
          <div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['pending', 'paid', 'rejected', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setWithdrawalFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                      withdrawalFilter === filter
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {filter}
                    {filter === 'pending' && pendingWithdrawalsCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px]">
                        {pendingWithdrawalsCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="relative sm:w-80">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user, account, or ref..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <span className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin inline-block" />
              </div>
            ) : filteredWithdrawals.length === 0 ? (
              <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-10 h-10 text-teal-500/40 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-white">No Withdrawal Requests Found</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {withdrawalFilter === 'pending'
                    ? 'All pending withdrawal payouts have been processed!'
                    : `No withdrawals matching "${withdrawalFilter}".`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredWithdrawals.map((wth) => (
                  <div
                    key={wth.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      wth.status === 'pending'
                        ? 'bg-slate-900/90 border-amber-500/30 shadow-lg'
                        : wth.status === 'paid'
                        ? 'bg-slate-900/60 border-emerald-500/20'
                        : 'bg-slate-900/40 border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xl font-extrabold text-white font-mono">
                            Rs. {wth.amount.toFixed(2)}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {wth.userName} ({wth.userCode})
                          </span>
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            {wth.paymentMethod}
                          </span>
                          {wth.status === 'pending' && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
                              Pending Payout
                            </span>
                          )}
                          {wth.status === 'paid' && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              Paid
                            </span>
                          )}
                          {wth.status === 'rejected' && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              Rejected (Refunded)
                            </span>
                          )}
                        </div>

                        {/* Recipient Details */}
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 mt-2.5 text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            Destination Account:{' '}
                            <strong className="text-white font-mono font-bold select-all">
                              {wth.accountNumber}
                            </strong>
                          </div>
                          <div>Holder Name: <strong className="text-white">{wth.accountName}</strong></div>
                          {wth.bankName && <div>Bank Name: <strong className="text-white">{wth.bankName}</strong></div>}
                          <div>Requested At: <span>{new Date(wth.createdAt).toLocaleString()}</span></div>
                        </div>

                        {wth.paymentReference && (
                          <div className="mt-2 text-xs text-emerald-400">
                            <strong>Payment Reference / Voucher:</strong> <code className="font-mono bg-slate-950 px-1 py-0.5 rounded">{wth.paymentReference}</code>
                          </div>
                        )}

                        {wth.rejectionReason && (
                          <div className="mt-2 text-xs text-rose-400">
                            <strong>Rejection Reason:</strong> {wth.rejectionReason} (Amount was refunded to user balance)
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {wth.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setPayingWithdrawal(wth);
                                setPaymentReference('');
                              }}
                              disabled={actionLoadingId === wth.id}
                              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
                            >
                              Mark as Paid
                            </button>
                            <button
                              onClick={() => {
                                setRejectingWithdrawal(wth);
                                setWithdrawalRejectionReason('');
                              }}
                              disabled={actionLoadingId === wth.id}
                              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs disabled:opacity-50"
                            >
                              Reject & Refund
                            </button>
                          </>
                        )}
                        {wth.status === 'paid' && (
                          <span className="text-xs font-mono text-emerald-400 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            Disbursed
                          </span>
                        )}
                        {wth.status === 'rejected' && (
                          <span className="text-xs font-mono text-rose-400 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                            Refunded
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: QR CODES & PAYMENT CHANNELS */}
        {activeTab === 'qrcodes' && settings && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <strong className="text-white">Admin QR Code & Channel Manager:</strong> Upload or replace the official deposit QR codes for eSewa, Khalti, and Nepali Bank Transfer. Users will see and scan these QR codes directly in their deposit screens.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* eSewa QR & Config */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" /> eSewa Channel
                  </h4>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.esewaEnabled}
                      onChange={(e) => setSettings({ ...settings, esewaEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                {/* QR Preview / Upload */}
                <div className="text-center">
                  <input
                    ref={esewaQrInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleQrUpload('esewa', f);
                    }}
                  />
                  {settings.esewaQrCode ? (
                    <div className="relative inline-block p-2 bg-white rounded-xl shadow mb-2 group">
                      <img
                        src={settings.esewaQrCode}
                        alt="eSewa QR"
                        className="w-36 h-36 object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => esewaQrInputRef.current?.click()}
                        className="absolute inset-0 bg-slate-950/70 text-white text-xs font-bold rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Replace QR
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => esewaQrInputRef.current?.click()}
                      className="w-36 h-36 mx-auto border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl flex flex-col items-center justify-center p-2 cursor-pointer bg-slate-950 text-slate-400 mb-2 transition-colors"
                    >
                      <Upload className="w-6 h-6 mb-1 text-slate-500" />
                      <span className="text-[11px] font-semibold">Upload eSewa QR</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => esewaQrInputRef.current?.click()}
                    className="text-xs text-emerald-400 hover:underline block mx-auto"
                  >
                    {settings.esewaQrCode ? 'Change QR Image' : 'Select QR Image'}
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">eSewa Mobile ID</label>
                    <input
                      type="text"
                      value={settings.esewaId}
                      onChange={(e) => setSettings({ ...settings, esewaId: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">eSewa Account Name</label>
                    <input
                      type="text"
                      value={settings.esewaName}
                      onChange={(e) => setSettings({ ...settings, esewaName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Payment Instructions</label>
                    <textarea
                      rows={3}
                      value={settings.esewaInstructions}
                      onChange={(e) => setSettings({ ...settings, esewaInstructions: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Khalti QR & Config */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Khalti Channel
                  </h4>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.khaltiEnabled}
                      onChange={(e) => setSettings({ ...settings, khaltiEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                {/* QR Preview / Upload */}
                <div className="text-center">
                  <input
                    ref={khaltiQrInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleQrUpload('khalti', f);
                    }}
                  />
                  {settings.khaltiQrCode ? (
                    <div className="relative inline-block p-2 bg-white rounded-xl shadow mb-2 group">
                      <img
                        src={settings.khaltiQrCode}
                        alt="Khalti QR"
                        className="w-36 h-36 object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => khaltiQrInputRef.current?.click()}
                        className="absolute inset-0 bg-slate-950/70 text-white text-xs font-bold rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Replace QR
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => khaltiQrInputRef.current?.click()}
                      className="w-36 h-36 mx-auto border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl flex flex-col items-center justify-center p-2 cursor-pointer bg-slate-950 text-slate-400 mb-2 transition-colors"
                    >
                      <Upload className="w-6 h-6 mb-1 text-slate-500" />
                      <span className="text-[11px] font-semibold">Upload Khalti QR</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => khaltiQrInputRef.current?.click()}
                    className="text-xs text-purple-400 hover:underline block mx-auto"
                  >
                    {settings.khaltiQrCode ? 'Change QR Image' : 'Select QR Image'}
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Khalti Mobile ID</label>
                    <input
                      type="text"
                      value={settings.khaltiId}
                      onChange={(e) => setSettings({ ...settings, khaltiId: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Khalti Account Name</label>
                    <input
                      type="text"
                      value={settings.khaltiName}
                      onChange={(e) => setSettings({ ...settings, khaltiName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Payment Instructions</label>
                    <textarea
                      rows={3}
                      value={settings.khaltiInstructions}
                      onChange={(e) => setSettings({ ...settings, khaltiInstructions: e.target.value })}
                      className="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bank Transfer QR & Config */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Bank Transfer
                  </h4>
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.bankEnabled}
                      onChange={(e) => setSettings({ ...settings, bankEnabled: e.target.checked })}
                      className="rounded"
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div className="text-center">
                  <input
                    ref={bankQrInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleQrUpload('bank', f);
                    }}
                  />
                  {settings.bankQrCode ? (
                    <div className="relative inline-block p-2 bg-white rounded-xl shadow mb-2 group">
                      <img
                        src={settings.bankQrCode}
                        alt="Bank QR"
                        className="w-36 h-36 object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => bankQrInputRef.current?.click()}
                        className="absolute inset-0 bg-slate-950/70 text-white text-xs font-bold rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Replace QR
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => bankQrInputRef.current?.click()}
                      className="w-36 h-36 mx-auto border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center p-2 cursor-pointer bg-slate-950 text-slate-400 mb-2 transition-colors"
                    >
                      <Upload className="w-6 h-6 mb-1 text-slate-500" />
                      <span className="text-[11px] font-semibold">Upload Bank QR</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => bankQrInputRef.current?.click()}
                    className="text-xs text-blue-400 hover:underline block mx-auto"
                  >
                    {settings.bankQrCode ? 'Change QR Image' : 'Select QR Image'}
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={settings.bankName}
                      onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Account Number</label>
                    <input
                      type="text"
                      value={settings.bankAccountNumber}
                      onChange={(e) => setSettings({ ...settings, bankAccountNumber: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Account Name</label>
                    <input
                      type="text"
                      value={settings.bankAccountName}
                      onChange={(e) => setSettings({ ...settings, bankAccountName: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs shadow-lg shadow-purple-500/20"
            >
              {savingSettings ? 'Saving...' : 'Save QR Codes & Details to Firebase'}
            </button>
          </div>
        )}

        {/* TAB 4: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Registered Users & Balances</h3>
                <span className="text-xs text-slate-400">{usersList.length} accounts</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">User Code</th>
                      <th className="py-3 px-4">Available Balance</th>
                      <th className="py-3 px-4">Total Deposited</th>
                      <th className="py-3 px-4">Total Withdrawn</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {u.userCode}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          Rs. {(u.balance || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          Rs. {(u.totalDeposited || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          Rs. {(u.totalWithdrawn || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.status === 'suspended' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className="text-[11px] text-slate-400 hover:text-white underline"
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: FINANCIAL LIMITS & SETTINGS */}
        {activeTab === 'settings' && settings && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Financial Limits Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Minimum Deposit (Rs.)</label>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    value={settings.minDeposit}
                    onChange={(e) => setSettings({ ...settings, minDeposit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Users cannot deposit below this amount.</p>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Minimum Withdrawal (Rs.)</label>
                  <input
                    type="number"
                    min="50"
                    step="1"
                    value={settings.minWithdrawal}
                    onChange={(e) => setSettings({ ...settings, minWithdrawal: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Users cannot withdraw below this amount.</p>
                </div>
              </div>
            </div>

            {/* Announcement Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
                Announcements & Notice
              </h3>
              <textarea
                rows={3}
                value={settings.announcementBanner}
                onChange={(e) => setSettings({ ...settings, announcementBanner: e.target.value })}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                placeholder="Notice displayed to all users..."
              />
            </div>

            {/* Support info */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
                Support Desk Configuration
              </h3>
              <div>
                <label className="block text-slate-400 mb-1">Support Email</label>
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Telegram Support Channel</label>
                <input
                  type="text"
                  value={settings.supportTelegram}
                  onChange={(e) => setSettings({ ...settings, supportTelegram: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs shadow-lg shadow-blue-500/20"
              >
                {savingSettings ? 'Saving...' : 'Save Settings to Firebase'}
              </button>
              {settingsSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                  <Check className="w-4 h-4" /> Persisted to Cloud Firestore!
                </span>
              )}
            </div>
          </form>
        )}

        {/* TAB 6: CRASH GAME CONTROLS & AUDIT */}
        {activeTab === 'crash' && settings && (
          <div className="space-y-6">
            {/* Quick KPI stats from real database crash records */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Recorded Rounds</span>
                <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                  {crashRoundsList.length}
                </div>
                <span className="text-[10px] text-slate-500">Provably fair audited</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Bets Processed</span>
                <div className="text-2xl font-extrabold text-blue-400 font-mono mt-1">
                  {crashBetsList.length}
                </div>
                <span className="text-[10px] text-slate-500">Dual panels ledger</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Game Turnover</span>
                <div className="text-xl font-extrabold text-white font-mono mt-1">
                  Rs. {crashBetsList.reduce((s, b) => s + b.stake, 0).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">Deducted from wallets</span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400 font-medium">Total Payouts Credited</span>
                <div className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
                  Rs. {crashBetsList.reduce((s, b) => s + (b.payout || 0), 0).toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-500">Credited to wallets</span>
              </div>
            </div>

            {/* Crash Configuration Form */}
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Crash Multiplier Engine Configuration</h3>
                      <p className="text-xs text-slate-400">Enforced directly in backend Firestore logic</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Enable / Disable Game */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-white block">Game Status</label>
                      <span className="text-[11px] text-slate-400">
                        {settings.crashGameEnabled ? 'Game is LIVE' : 'Game is Disabled'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, crashGameEnabled: !settings.crashGameEnabled })}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.crashGameEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          settings.crashGameEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Enable / Disable Autoplay */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-white block">Autoplay Engine</label>
                      <span className="text-[11px] text-slate-400">
                        {settings.crashAutoplayEnabled ? 'Autoplay Enabled' : 'Autoplay Disabled'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, crashAutoplayEnabled: !settings.crashAutoplayEnabled })
                      }
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.crashAutoplayEnabled ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          settings.crashAutoplayEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Maintenance Mode */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-white block">Maintenance Flag</label>
                      <span className="text-[11px] text-slate-400">
                        {settings.crashMaintenance ? 'Active Notice' : 'Normal Operations'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, crashMaintenance: !settings.crashMaintenance })
                      }
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.crashMaintenance ? 'bg-rose-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          settings.crashMaintenance ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Min Bet */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Minimum Bet Stake (Rs.) <span className="text-amber-400 font-mono">(Min 20)</span>
                    </label>
                    <input
                      type="number"
                      min={20}
                      value={settings.crashMinBet}
                      onChange={(e) =>
                        setSettings({ ...settings, crashMinBet: Math.max(20, Number(e.target.value) || 20) })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Default minimum bet is Rs. 20</p>
                  </div>

                  {/* Max Bet */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Maximum Bet Stake (Rs.)
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={100000}
                      value={settings.crashMaxBet}
                      onChange={(e) =>
                        setSettings({ ...settings, crashMaxBet: Number(e.target.value) || 25000 })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Configurable cap per panel</p>
                  </div>

                  {/* Countdown seconds */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Betting Countdown (Seconds)
                    </label>
                    <input
                      type="number"
                      min={3}
                      max={15}
                      value={settings.crashCountdownSecs}
                      onChange={(e) =>
                        setSettings({ ...settings, crashCountdownSecs: Math.max(3, Number(e.target.value) || 5) })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Time allowed for placing bets</p>
                  </div>
                </div>

                {/* Crash Announcement text */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Crash Announcement & T&C Banner
                  </label>
                  <input
                    type="text"
                    value={settings.crashAnnouncement}
                    onChange={(e) => setSettings({ ...settings, crashAnnouncement: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    placeholder="Notice displayed in game header..."
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                  >
                    {savingSettings ? 'Saving...' : 'Save Crash Settings to Firebase'}
                  </button>
                  {settingsSuccess && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                      <Check className="w-4 h-4" /> Persisted to Cloud Firestore!
                    </span>
                  )}
                </div>
              </div>
            </form>

            {/* Audit Table 1: Recent Crash Rounds */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Provably Fair Crash Rounds Ledger</h3>
                  <p className="text-xs text-slate-400">Cryptographically audited crash outcomes</p>
                </div>
                <button
                  type="button"
                  onClick={loadAll}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <th className="py-2.5 px-3">Round #</th>
                      <th className="py-2.5 px-3">Crash Point</th>
                      <th className="py-2.5 px-3">SHA-256 Hash</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {crashRoundsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 font-sans text-xs">
                          No completed rounds recorded yet.
                        </td>
                      </tr>
                    ) : (
                      crashRoundsList.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-white">#{r.roundNumber}</td>
                          <td className="py-2.5 px-3 font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                r.crashPoint >= 10
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : r.crashPoint >= 2
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'text-slate-300'
                              }`}
                            >
                              {r.crashPoint.toFixed(2)}x
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {r.serverSeedHash.substring(0, 16)}...
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {new Date(r.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Audit Table 2: Recent User Crash Bets */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white">Recent Accepted Bets Ledger</h3>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Round ID</th>
                      <th className="py-2.5 px-3">Stake</th>
                      <th className="py-2.5 px-3">Odds</th>
                      <th className="py-2.5 px-3">Payout</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {crashBetsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500 font-sans text-xs">
                          No crash bets in ledger yet.
                        </td>
                      </tr>
                    ) : (
                      crashBetsList.map((bet) => (
                        <tr key={bet.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {bet.userName} ({bet.userCode})
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">{bet.roundId}</td>
                          <td className="py-2.5 px-3 font-bold text-white">Rs. {bet.stake.toFixed(2)}</td>
                          <td className="py-2.5 px-3 font-bold">
                            {bet.cashedOutMultiplier ? `${bet.cashedOutMultiplier.toFixed(2)}x` : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-bold">
                            {bet.payout ? (
                              <span className="text-emerald-400">Rs. {bet.payout.toFixed(2)}</span>
                            ) : (
                              <span className="text-slate-500">Rs. 0.00</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                bet.status === 'cashed_out'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : bet.status === 'crashed'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {bet.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                            {new Date(bet.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* MODAL: CONFIRM DEPOSIT APPROVE */}
        {approvingDeposit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Confirm Deposit Approval</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                You are approving deposit <code className="bg-slate-950 px-1 py-0.5 rounded text-white">{approvingDeposit.id}</code>.
                <br /><br />
                This will execute an <strong className="text-emerald-400">atomic Firestore transaction</strong> to:
                <br />
                • Lock the deposit state permanently as Approved
                <br />
                • Credit exactly <strong className="text-white">Rs. {approvingDeposit.amount.toFixed(2)}</strong> to {approvingDeposit.userName}
                <br />
                • Write an auditable entry to <code className="text-slate-300">walletTransactions</code>
              </p>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setApprovingDeposit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApproveDeposit}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
                >
                  Confirm & Credit Rs. {approvingDeposit.amount.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REJECT DEPOSIT */}
        {rejectingDeposit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Reject Deposit Request</h3>
              <p className="text-xs text-slate-300 mb-4">
                The user's balance will NOT change. Provide an optional rejection reason.
              </p>
              <textarea
                rows={3}
                value={depositRejectionReason}
                onChange={(e) => setDepositRejectionReason(e.target.value)}
                placeholder="e.g. Transaction ID not found on bank/eSewa statement."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white mb-4 focus:outline-none focus:border-rose-500"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRejectingDeposit(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectDeposit}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MARK WITHDRAWAL PAID */}
        {payingWithdrawal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Mark Withdrawal as Paid</h3>
              <p className="text-xs text-slate-300 mb-3">
                Ensure you have transferred <strong className="text-teal-400">Rs. {payingWithdrawal.amount.toFixed(2)}</strong> to {payingWithdrawal.accountName} ({payingWithdrawal.accountNumber}).
              </p>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Payment Transaction Reference / Voucher Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. 984029402 or BANK-IPS-98124"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPayingWithdrawal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayWithdrawal}
                  className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
                >
                  Confirm Paid
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: REJECT WITHDRAWAL (REFUND TO USER) */}
        {rejectingWithdrawal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
                <XCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Reject Withdrawal Request</h3>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                This will automatically <strong className="text-teal-400">refund Rs. {rejectingWithdrawal.amount.toFixed(2)}</strong> back to the user's available balance in an atomic transaction.
              </p>
              <textarea
                rows={3}
                value={withdrawalRejectionReason}
                onChange={(e) => setWithdrawalRejectionReason(e.target.value)}
                placeholder="e.g. Invalid account number or recipient name mismatch."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white mb-4 focus:outline-none focus:border-rose-500"
              />
              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRejectingWithdrawal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRejectWithdrawal}
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs"
                >
                  Confirm & Refund to User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: PREVIEW SCREENSHOT */}
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
            <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <h4 className="text-sm font-bold text-white">Payment Receipt Proof</h4>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-xl bg-slate-950 flex items-center justify-center p-2">
                <img
                  src={previewImage}
                  alt="Proof full"
                  className="max-h-[65vh] w-auto object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
