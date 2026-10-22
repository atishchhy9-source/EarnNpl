import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Copy,
  Check,
  Eye,
  X,
  Building,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchUserDeposits,
  fetchUserWithdrawals,
  fetchUserTransactions,
} from '../services/walletService';
import { DepositRequest, WithdrawalRequest, WalletTransaction } from '../types';

interface HistoryScreenProps {
  onNavigateDeposit: () => void;
  onNavigateWithdraw: () => void;
  onOpenAuth: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  onNavigateDeposit,
  onNavigateWithdraw,
  onOpenAuth,
}) => {
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'ledger'>('deposits');
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [depList, wthList, txnList] = await Promise.all([
        fetchUserDeposits(currentUser.uid),
        fetchUserWithdrawals(currentUser.uid),
        fetchUserTransactions(currentUser.uid),
      ]);
      setDeposits(depList);
      setWithdrawals(wthList);
      setTransactions(txnList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.uid]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Sign in to View Records</h3>
        <p className="text-xs text-slate-400 mb-6">
          Access your real-time deposit confirmations, payout requests, and complete wallet ledger.
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

  const filteredDeposits = deposits.filter((d) => {
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      d.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      w.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (w.paymentReference && w.paymentReference.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Transaction History & Records
          </h2>
          <p className="text-xs text-slate-400">
            Audit your deposits, payout statuses, and permanent wallet balance ledger.
          </p>
        </div>

        {/* View Toggle */}
        <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-xl self-start overflow-x-auto max-w-full">
          <button
            onClick={() => { setActiveTab('deposits'); setStatusFilter('all'); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'deposits'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Deposits ({deposits.length})
          </button>
          <button
            onClick={() => { setActiveTab('withdrawals'); setStatusFilter('all'); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'withdrawals'
                ? 'bg-teal-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Withdrawals ({withdrawals.length})
          </button>
          <button
            onClick={() => { setActiveTab('ledger'); setStatusFilter('all'); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
              activeTab === 'ledger'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ledger ({transactions.length})
          </button>
        </div>
      </div>

      {/* Filter / Search Bar (for deposits and withdrawals) */}
      {activeTab !== 'ledger' && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(activeTab === 'deposits'
              ? ['all', 'pending', 'approved', 'rejected']
              : ['all', 'pending', 'approved', 'rejected', 'paid']
            ).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all border ${
                  statusFilter === st
                    ? 'bg-slate-800 text-emerald-400 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder={activeTab === 'deposits' ? 'Search transaction ID...' : 'Search account number / ref...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center">
          <span className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
          <p className="text-xs text-slate-400 mt-2">Loading financial records...</p>
        </div>
      ) : activeTab === 'deposits' ? (
        /* DEPOSIT REQUESTS VIEW */
        filteredDeposits.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">No Deposit Requests Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
              {statusFilter === 'all'
                ? "You haven't made any deposits yet. Start by transferring via eSewa, Khalti, or Bank."
                : `No deposits matching status "${statusFilter}".`}
            </p>
            <button
              onClick={onNavigateDeposit}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
            >
              Make a Deposit
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeposits.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                        item.paymentMethod === 'esewa'
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : item.paymentMethod === 'khalti'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {item.paymentMethod.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-base font-mono">
                          + Rs. {item.amount.toFixed(2)}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span>Txn: <code className="text-slate-300 font-mono">{item.transactionId}</code></span>
                        <button
                          onClick={() => handleCopy(item.transactionId, item.id)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    {item.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                        <Clock className="w-3 h-3 animate-spin" /> Pending Review
                      </span>
                    )}
                    {item.status === 'approved' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Approved & Credited
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>
                </div>

                {item.status === 'rejected' && item.rejectionReason && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <strong className="font-semibold text-rose-200">Rejection Reason:</strong>{' '}
                      {item.rejectionReason}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-800/60">
                  <span>
                    Submitted: {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  {item.screenshotUrl && (
                    <button
                      onClick={() => setPreviewImage(item.screenshotUrl)}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Proof
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : activeTab === 'withdrawals' ? (
        /* WITHDRAWALS VIEW */
        filteredWithdrawals.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-900 border border-slate-800 text-center">
            <ArrowUpRight className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">No Withdrawal Requests Found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
              {statusFilter === 'all'
                ? 'You have not submitted any withdrawal requests yet.'
                : `No withdrawals matching status "${statusFilter}".`}
            </p>
            <button
              onClick={onNavigateWithdraw}
              className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
            >
              Request Withdrawal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWithdrawals.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition-all shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-white text-base font-mono">
                        - Rs. {item.amount.toFixed(2)}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.paymentMethod}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      Account: <span className="font-mono font-semibold">{item.accountNumber}</span> ({item.accountName})
                    </div>
                    {item.bankName && (
                      <div className="text-[11px] text-slate-400">Bank: {item.bankName}</div>
                    )}
                  </div>

                  <div>
                    {item.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
                        <Clock className="w-3 h-3 animate-spin" /> Pending Review
                      </span>
                    )}
                    {item.status === 'approved' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
                        Processing Payout
                      </span>
                    )}
                    {item.status === 'paid' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    )}
                    {item.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                        <XCircle className="w-3 h-3" /> Rejected (Refunded)
                      </span>
                    )}
                  </div>
                </div>

                {item.paymentReference && (
                  <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                    <strong className="font-semibold text-emerald-200">Payout Reference:</strong>{' '}
                    <code className="font-mono">{item.paymentReference}</code>
                  </div>
                )}

                {item.status === 'rejected' && item.rejectionReason && (
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                    <div>
                      <strong className="font-semibold text-rose-200">Rejection Reason:</strong>{' '}
                      {item.rejectionReason} (Amount restored to wallet)
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 pt-2.5 border-t border-slate-800/60">
                  <span>
                    Requested: {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  <span className="font-mono text-slate-400">ID: {item.id}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* WALLET LEDGER VIEW */
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <strong className="text-white">Ledger Guarantee:</strong> Every balance movement (deposit credit, withdrawal reserve hold, payout, or refund) is permanently audited.
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-xs">
              No ledger transactions recorded yet.
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-white">{tx.description}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} • ID: <code className="font-mono text-slate-400">{tx.id}</code>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Prev: <span className="font-mono">Rs. {tx.previousBalance.toFixed(2)}</span> → New: <span className="font-mono font-bold text-emerald-400">Rs. {tx.newBalance.toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-extrabold font-mono ${
                      tx.type === 'deposit_credit' || tx.type === 'withdrawal_refund'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {tx.type === 'deposit_credit' || tx.type === 'withdrawal_refund' ? '+' : '-'}
                    Rs. {Math.abs(tx.amount).toFixed(2)}
                  </div>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 mt-1 capitalize">
                    {tx.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Screenshot Modal */}
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
                alt="Payment proof full"
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
