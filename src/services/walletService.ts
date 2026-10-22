import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import {
  DepositRequest,
  WithdrawalRequest,
  WalletTransaction,
  PaymentMethod,
} from '../types';

/**
 * Submit user deposit request
 * Does NOT increase balance. Sets status to 'pending'.
 */
export async function submitDepositRequest(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userCode: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  screenshotUrl: string;
}): Promise<string> {
  const depositId = 'dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const depositRef = doc(db, 'depositRequests', depositId);
  const userRef = doc(db, 'users', params.userId);

  try {
    const newDeposit: DepositRequest = {
      id: depositId,
      userId: params.userId,
      userName: params.userName,
      userEmail: params.userEmail,
      userCode: params.userCode,
      amount: Number(params.amount),
      paymentMethod: params.paymentMethod,
      transactionId: params.transactionId.trim(),
      screenshotUrl: params.screenshotUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
      idempotencyKey: `dep_key_${params.userId}_${params.transactionId.trim()}`,
    };

    // Save deposit request
    await setDoc(depositRef, newDeposit);

    // Update user pendingDeposits metric
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const curPending = userSnap.data().pendingDeposits || 0;
        await setDoc(userRef, {
          pendingDeposits: curPending + Number(params.amount),
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch {
      // Non-blocking if restricted
    }

    // Add user notification
    const notifId = 'notif_' + Date.now();
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      userId: params.userId,
      title: 'Deposit Request Submitted',
      message: `Your deposit request of Rs. ${params.amount.toFixed(2)} (${params.paymentMethod.toUpperCase()}) has been submitted and is pending admin verification.`,
      type: 'deposit',
      read: false,
      createdAt: new Date().toISOString(),
    });

    return depositId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `depositRequests/${depositId}`);
  }
}

/**
 * Admin approves a deposit request atomically:
 * 1. Verifies deposit is still 'pending' to prevent race conditions & double-credit.
 * 2. Updates deposit status to 'approved'.
 * 3. Adds amount to user balance and totalDeposited.
 * 4. Deducts from pendingDeposits.
 * 5. Writes an immutable record to walletTransactions ledger.
 * 6. Dispatches notification to user.
 */
export async function adminApproveDeposit(
  depositId: string,
  reviewerEmail: string
): Promise<{ success: boolean; newBalance: number }> {
  const depositRef = doc(db, 'depositRequests', depositId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      const depositSnap = await transaction.get(depositRef);
      if (!depositSnap.exists()) {
        throw new Error('Deposit request not found');
      }

      const deposit = depositSnap.data() as DepositRequest;
      const userRef = doc(db, 'users', deposit.userId);
      const userSnap = await transaction.get(userRef);

      // Idempotent guard: if already approved, safely return without re-crediting
      if (deposit.status === 'approved') {
        const curBal = userSnap.exists() ? Number(userSnap.data().balance || 0) : 0;
        return { success: true, newBalance: curBal };
      }

      if (deposit.status === 'rejected') {
        throw new Error('This deposit request was rejected and cannot be approved.');
      }

      if (!userSnap.exists()) {
        throw new Error('Target user account not found');
      }

      const user = userSnap.data();
      const prevBal = Number(user.balance || 0);
      const creditAmt = Number(deposit.amount);
      const newBal = prevBal + creditAmt;
      const prevTotalDep = Number(user.totalDeposited || 0);
      const prevPending = Number(user.pendingDeposits || 0);

      const nowIso = new Date().toISOString();

      // 1. Lock deposit status
      transaction.update(depositRef, {
        status: 'approved',
        reviewedBy: reviewerEmail,
        reviewedAt: nowIso,
      });

      // 2. Atomically credit user balance
      transaction.update(userRef, {
        balance: newBal,
        totalDeposited: prevTotalDep + creditAmt,
        pendingDeposits: Math.max(0, prevPending - creditAmt),
        updatedAt: nowIso,
      });

      // 3. Create immutable ledger transaction
      const txnId = 'txn_dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const txnRef = doc(db, 'walletTransactions', txnId);
      const ledgerRecord: WalletTransaction = {
        id: txnId,
        userId: deposit.userId,
        type: 'deposit_credit',
        amount: creditAmt,
        previousBalance: prevBal,
        newBalance: newBal,
        description: `Deposit approved via ${deposit.paymentMethod.toUpperCase()} (Txn ID: ${deposit.transactionId})`,
        referenceId: depositId,
        status: 'completed',
        createdAt: nowIso,
      };
      transaction.set(txnRef, ledgerRecord);

      // 4. Send notification
      const notifId = 'notif_' + Date.now();
      transaction.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: deposit.userId,
        title: 'Deposit Approved! 🎉',
        message: `Your deposit of Rs. ${creditAmt.toFixed(2)} has been verified and added to your balance. Current balance: Rs. ${newBal.toFixed(2)}.`,
        type: 'deposit',
        read: false,
        createdAt: nowIso,
      });

      return { success: true, newBalance: newBal };
    });

    return result;
  } catch (error: any) {
    if (error?.message && !error.message.includes('Missing or insufficient permissions')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `depositRequests/${depositId}`);
  }
}

/**
 * Admin rejects a deposit request:
 * 1. Checks status is 'pending'
 * 2. Marks deposit as 'rejected' with reason
 * 3. Does NOT alter balance
 * 4. Deducts from pendingDeposits
 * 5. Sends rejection notification
 */
export async function adminRejectDeposit(
  depositId: string,
  rejectionReason: string,
  reviewerEmail: string
): Promise<boolean> {
  const depositRef = doc(db, 'depositRequests', depositId);

  try {
    await runTransaction(db, async (transaction) => {
      const depositSnap = await transaction.get(depositRef);
      if (!depositSnap.exists()) {
        throw new Error('Deposit request not found');
      }

      const deposit = depositSnap.data() as DepositRequest;
      if (deposit.status === 'rejected') {
        return true;
      }
      if (deposit.status === 'approved') {
        throw new Error('This deposit was already approved and cannot be rejected.');
      }

      const userRef = doc(db, 'users', deposit.userId);
      const userSnap = await transaction.get(userRef);

      const nowIso = new Date().toISOString();

      transaction.update(depositRef, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim() || 'Payment details could not be verified.',
        reviewedBy: reviewerEmail,
        reviewedAt: nowIso,
      });

      if (userSnap.exists()) {
        const prevPending = Number(userSnap.data().pendingDeposits || 0);
        transaction.update(userRef, {
          pendingDeposits: Math.max(0, prevPending - Number(deposit.amount)),
          updatedAt: nowIso,
        });
      }

      const notifId = 'notif_' + Date.now();
      transaction.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: deposit.userId,
        title: 'Deposit Rejected',
        message: `Your deposit of Rs. ${deposit.amount.toFixed(2)} was rejected. Reason: ${rejectionReason.trim() || 'Verification failed'}.`,
        type: 'deposit',
        read: false,
        createdAt: nowIso,
      });
    });

    return true;
  } catch (error: any) {
    if (error?.message && !error.message.includes('Missing or insufficient permissions')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `depositRequests/${depositId}`);
  }
}

/**
 * Submit Withdrawal Request:
 * CRITICAL INVARIANT: Atomically reserves/deducts requested amount from user available balance
 * so the same balance cannot be spent twice.
 */
export async function submitWithdrawalRequest(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userCode: string;
  amount: number;
  paymentMethod: PaymentMethod;
  accountNumber: string;
  accountName: string;
  bankName?: string;
  minWithdrawal: number;
}): Promise<string> {
  const withdrawalId = 'wth_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);
  const userRef = doc(db, 'users', params.userId);

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User profile not found');
      }

      const user = userSnap.data();
      const currentBalance = Number(user.balance || 0);
      const reqAmount = Number(params.amount);

      if (reqAmount < params.minWithdrawal) {
        throw new Error(`Minimum withdrawal limit is Rs. ${params.minWithdrawal.toFixed(2)}.`);
      }

      if (currentBalance < reqAmount) {
        throw new Error(`Insufficient balance. Available: Rs. ${currentBalance.toFixed(2)}, Requested: Rs. ${reqAmount.toFixed(2)}.`);
      }

      const newBalance = currentBalance - reqAmount;
      const prevPendingWth = Number(user.pendingWithdrawals || 0);
      const nowIso = new Date().toISOString();

      // 1. Create withdrawal request
      const requestData: WithdrawalRequest = {
        id: withdrawalId,
        userId: params.userId,
        userName: params.userName,
        userEmail: params.userEmail,
        userCode: params.userCode,
        amount: reqAmount,
        paymentMethod: params.paymentMethod,
        accountNumber: params.accountNumber.trim(),
        accountName: params.accountName.trim(),
        bankName: params.bankName?.trim() || '',
        status: 'pending',
        createdAt: nowIso,
      };
      transaction.set(withdrawalRef, requestData);

      // 2. Safely reserve/deduct the funds from available balance
      transaction.update(userRef, {
        balance: newBalance,
        pendingWithdrawals: prevPendingWth + reqAmount,
        updatedAt: nowIso,
      });

      // 3. Write transaction ledger record
      const txnId = 'txn_wth_res_' + Date.now();
      const ledgerRecord: WalletTransaction = {
        id: txnId,
        userId: params.userId,
        type: 'withdrawal_reserve',
        amount: reqAmount,
        previousBalance: currentBalance,
        newBalance: newBalance,
        description: `Withdrawal request submitted via ${params.paymentMethod.toUpperCase()} (Reserved for payout)`,
        referenceId: withdrawalId,
        status: 'pending',
        createdAt: nowIso,
      };
      transaction.set(doc(db, 'walletTransactions', txnId), ledgerRecord);

      // 4. Send notification
      const notifId = 'notif_wth_' + Date.now();
      transaction.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: params.userId,
        title: 'Withdrawal Request Submitted',
        message: `Your withdrawal request of Rs. ${reqAmount.toFixed(2)} has been submitted. The amount is reserved and will be processed shortly.`,
        type: 'withdrawal',
        read: false,
        createdAt: nowIso,
      });
    });

    return withdrawalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `withdrawalRequests/${withdrawalId}`);
  }
}

/**
 * Admin rejects withdrawal:
 * Releases the reserved amount back to user's available balance exactly once!
 */
export async function adminRejectWithdrawal(
  withdrawalId: string,
  rejectionReason: string,
  reviewerEmail: string
): Promise<void> {
  const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(withdrawalRef);
      if (!snap.exists()) throw new Error('Withdrawal request not found');

      const wth = snap.data() as WithdrawalRequest;
      if (wth.status === 'rejected') {
        return;
      }
      if (wth.status === 'paid') {
        throw new Error('This withdrawal has already been paid and cannot be rejected.');
      }

      const userRef = doc(db, 'users', wth.userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error('User profile not found');

      const user = userSnap.data();
      const prevBal = Number(user.balance || 0);
      const refundAmt = Number(wth.amount);
      const restoredBal = prevBal + refundAmt;
      const prevPendingWth = Number(user.pendingWithdrawals || 0);
      const nowIso = new Date().toISOString();

      // 1. Update withdrawal status
      transaction.update(withdrawalRef, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim() || 'Withdrawal could not be processed.',
        reviewedBy: reviewerEmail,
        reviewedAt: nowIso,
      });

      // 2. Atomically refund the reserved amount back to user
      transaction.update(userRef, {
        balance: restoredBal,
        pendingWithdrawals: Math.max(0, prevPendingWth - refundAmt),
        updatedAt: nowIso,
      });

      // 3. Write transaction ledger
      const txnId = 'txn_wth_ref_' + Date.now();
      const ledgerRecord: WalletTransaction = {
        id: txnId,
        userId: wth.userId,
        type: 'withdrawal_refund',
        amount: refundAmt,
        previousBalance: prevBal,
        newBalance: restoredBal,
        description: `Refund for rejected withdrawal: ${rejectionReason.trim() || 'Declined'}`,
        referenceId: withdrawalId,
        status: 'completed',
        createdAt: nowIso,
      };
      transaction.set(doc(db, 'walletTransactions', txnId), ledgerRecord);

      // 4. Notification
      const notifId = 'notif_' + Date.now();
      transaction.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: wth.userId,
        title: 'Withdrawal Rejected (Refunded)',
        message: `Your withdrawal of Rs. ${refundAmt.toFixed(2)} was rejected. Reason: ${rejectionReason.trim() || 'Verification failed'}. Funds returned to your available balance.`,
        type: 'withdrawal',
        read: false,
        createdAt: nowIso,
      });
    });
  } catch (error: any) {
    if (error?.message && !error.message.includes('Missing or insufficient permissions')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `withdrawalRequests/${withdrawalId}`);
  }
}

/**
 * Admin marks withdrawal as Paid:
 * Records payment reference, marks as Paid, finalizes totalWithdrawn.
 */
export async function adminMarkWithdrawalPaid(
  withdrawalId: string,
  paymentReference: string,
  reviewerEmail: string
): Promise<void> {
  const withdrawalRef = doc(db, 'withdrawalRequests', withdrawalId);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(withdrawalRef);
      if (!snap.exists()) throw new Error('Withdrawal request not found');

      const wth = snap.data() as WithdrawalRequest;
      if (wth.status === 'paid') {
        return;
      }
      if (wth.status === 'rejected') {
        throw new Error('Cannot pay an already rejected withdrawal.');
      }

      const userRef = doc(db, 'users', wth.userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error('User profile not found');

      const user = userSnap.data();
      const prevTotalWithdrawn = Number(user.totalWithdrawn || 0);
      const prevPendingWth = Number(user.pendingWithdrawals || 0);
      const nowIso = new Date().toISOString();

      // 1. Mark as paid with payment reference
      transaction.update(withdrawalRef, {
        status: 'paid',
        paymentReference: paymentReference.trim() || 'Paid by Finance Admin',
        reviewedBy: reviewerEmail,
        reviewedAt: nowIso,
        paidAt: nowIso,
      });

      // 2. Finalize user metrics
      transaction.update(userRef, {
        pendingWithdrawals: Math.max(0, prevPendingWth - Number(wth.amount)),
        totalWithdrawn: prevTotalWithdrawn + Number(wth.amount),
        updatedAt: nowIso,
      });

      // 3. Write transaction ledger
      const txnId = 'txn_wth_paid_' + Date.now();
      const ledgerRecord: WalletTransaction = {
        id: txnId,
        userId: wth.userId,
        type: 'withdrawal_paid',
        amount: wth.amount,
        previousBalance: Number(user.balance || 0),
        newBalance: Number(user.balance || 0),
        description: `Payout completed via ${wth.paymentMethod.toUpperCase()} (Ref: ${paymentReference.trim()})`,
        referenceId: withdrawalId,
        status: 'completed',
        createdAt: nowIso,
      };
      transaction.set(doc(db, 'walletTransactions', txnId), ledgerRecord);

      // 4. Notification
      const notifId = 'notif_' + Date.now();
      transaction.set(doc(db, 'notifications', notifId), {
        id: notifId,
        userId: wth.userId,
        title: 'Withdrawal Paid! 💸',
        message: `Rs. ${wth.amount.toFixed(2)} sent to your ${wth.paymentMethod.toUpperCase()} account (${wth.accountNumber}). Ref: ${paymentReference.trim()}`,
        type: 'withdrawal',
        read: false,
        createdAt: nowIso,
      });
    });
  } catch (error: any) {
    if (error?.message && !error.message.includes('Missing or insufficient permissions')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `withdrawalRequests/${withdrawalId}`);
  }
}

/**
 * Fetch user deposit requests
 */
export async function fetchUserDeposits(userId: string): Promise<DepositRequest[]> {
  try {
    const q = query(
      collection(db, 'depositRequests'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as DepositRequest);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'depositRequests');
  }
}

/**
 * Fetch user withdrawal requests
 */
export async function fetchUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
  try {
    const q = query(
      collection(db, 'withdrawalRequests'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as WithdrawalRequest);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'withdrawalRequests');
  }
}

/**
 * Fetch wallet transactions for user
 */
export async function fetchUserTransactions(userId: string): Promise<WalletTransaction[]> {
  try {
    const q = query(
      collection(db, 'walletTransactions'),
      where('userId', '==', userId),
      limit(50)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as WalletTransaction);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'walletTransactions');
  }
}

/**
 * Admin fetch deposits
 */
export async function fetchAllDepositsAdmin(
  statusFilter?: 'all' | 'pending' | 'approved' | 'rejected'
): Promise<DepositRequest[]> {
  try {
    let q;
    if (statusFilter && statusFilter !== 'all') {
      q = query(collection(db, 'depositRequests'), where('status', '==', statusFilter), limit(100));
    } else {
      q = query(collection(db, 'depositRequests'), limit(100));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as DepositRequest);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'depositRequests');
  }
}

/**
 * Admin fetch withdrawals
 */
export async function fetchAllWithdrawalsAdmin(
  statusFilter?: 'all' | 'pending' | 'approved' | 'rejected' | 'paid'
): Promise<WithdrawalRequest[]> {
  try {
    let q;
    if (statusFilter && statusFilter !== 'all') {
      q = query(collection(db, 'withdrawalRequests'), where('status', '==', statusFilter), limit(100));
    } else {
      q = query(collection(db, 'withdrawalRequests'), limit(100));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map(d => d.data() as WithdrawalRequest);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'withdrawalRequests');
  }
}
