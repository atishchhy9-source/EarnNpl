import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  limit,
  orderBy,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { CrashRound, CrashBet, WalletTransaction } from '../types';

/**
 * SHA-256 helper using standard Web Crypto API
 */
export async function sha256Hex(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Provably Fair Crash Point Generator
 * Uses 97% Return-To-Player (3% house edge).
 * Generates an auditable crash point derived from the serverSeed + roundNumber.
 */
export async function calculateCrashPoint(serverSeed: string, roundNumber: number): Promise<{ crashPoint: number; hash: string }> {
  const hash = await sha256Hex(`${serverSeed}:${roundNumber}`);
  // Take first 13 hex characters (52 bits)
  const hexPart = hash.substring(0, 13);
  const intVal = parseInt(hexPart, 16);
  const max52Bits = Math.pow(2, 52);
  const r = intVal / max52Bits;

  // 3% probability of instant crash at 1.00x
  if (r < 0.03) {
    return { crashPoint: 1.0, hash };
  }

  // 97% RTP curve: multiplier = floor(0.97 / (1 - r) * 100) / 100
  const mult = Math.floor((0.97 / (1 - r)) * 100) / 100;
  // Bound between 1.01x and 250.00x for sensible gameplay
  const clamped = Math.max(1.01, Math.min(250.0, mult));
  return { crashPoint: clamped, hash };
}

/**
 * Generate a cryptographically random server seed string
 */
export function generateRandomSeed(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Real-time listener for current active round document (`crashRounds/active`)
 */
export function subscribeToActiveRound(onUpdate: (round: CrashRound | null) => void): () => void {
  const activeDocRef = doc(db, 'crashRounds', 'active');
  return onSnapshot(
    activeDocRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as CrashRound);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('subscribeToActiveRound snapshot error:', err);
    }
  );
}

/**
 * Real-time listener for bets in a specific round
 */
export function subscribeToRoundBets(roundId: string, onUpdate: (bets: CrashBet[]) => void): () => void {
  const betsRef = collection(db, 'crashBets');
  const q = query(betsRef, where('roundId', '==', roundId), limit(100));

  return onSnapshot(
    q,
    (snap) => {
      const bets = snap.docs.map((d) => d.data() as CrashBet);
      bets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(bets);
    },
    (err) => {
      console.warn('subscribeToRoundBets snapshot error:', err);
    }
  );
}

/**
 * Fetch recent completed crash rounds (for multiplier history pills)
 */
export async function fetchRecentCrashRounds(count: number = 15): Promise<CrashRound[]> {
  try {
    const roundsRef = collection(db, 'crashRoundsHistory');
    const q = query(roundsRef, orderBy('crashedTime', 'desc'), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CrashRound);
  } catch (e) {
    // If composite index is pending, fallback to simple query
    try {
      const roundsRef = collection(db, 'crashRoundsHistory');
      const q = query(roundsRef, limit(count));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => d.data() as CrashRound);
      return list.sort((a, b) => (b.crashedTime || 0) - (a.crashedTime || 0));
    } catch {
      return [];
    }
  }
}

export class CrashGameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrashGameError';
  }
}

function isFirestoreSystemError(error: any): boolean {
  if (!error) return false;
  if (error instanceof CrashGameError || error?.name === 'CrashGameError') return false;
  return typeof error?.code === 'string' && error.code.length > 0;
}

/**
 * Initialize or rotate to next round
 */
export async function initOrAdvanceRound(
  currentRoundNumber: number = 1,
  countdownSeconds: number = 7
): Promise<CrashRound> {
  const activeDocRef = doc(db, 'crashRounds', 'active');
  const serverSeed = generateRandomSeed();
  const nextRoundNumber = currentRoundNumber + 1;
  const { crashPoint, hash } = await calculateCrashPoint(serverSeed, nextRoundNumber);

  const now = Date.now();
  const bettingEndTime = now + countdownSeconds * 1000;
  const roundId = `cr_${nextRoundNumber}_${now}`;

  const newRound: CrashRound = {
    id: roundId,
    roundNumber: nextRoundNumber,
    status: 'betting',
    crashPoint,
    serverSeedHash: hash,
    serverSeed, // Secret until crashed
    bettingStartTime: now,
    bettingEndTime,
    createdAt: new Date().toISOString(),
  };

  await setDoc(activeDocRef, newRound);
  return newRound;
}

/**
 * Start flying phase for active round
 */
export async function startFlyingPhase(roundId: string): Promise<void> {
  const activeDocRef = doc(db, 'crashRounds', 'active');
  const now = Date.now();
  try {
    await updateDoc(activeDocRef, {
      status: 'flying',
      flyingStartTime: now,
    });
  } catch (err) {
    console.warn('startFlyingPhase error:', err);
  }
}

/**
 * Finish round on crash and record to history
 */
export async function finishRoundOnCrash(round: CrashRound): Promise<void> {
  const activeDocRef = doc(db, 'crashRounds', 'active');
  const historyRef = doc(db, 'crashRoundsHistory', round.id);
  const now = Date.now();

  const finishedRound: CrashRound = {
    ...round,
    status: 'crashed',
    crashedTime: now,
  };

  try {
    // Update active
    await setDoc(activeDocRef, finishedRound, { merge: true });

    // Store in history for public audit and pills strip
    await setDoc(historyRef, finishedRound);

    // Settle any un-cashed bets as crashed
    try {
      const betsQ = query(collection(db, 'crashBets'), where('roundId', '==', round.id), where('status', '==', 'placed'));
      const snap = await getDocs(betsQ);
      const batchPromises = snap.docs.map((d) =>
        updateDoc(d.ref, {
          status: 'crashed',
          payout: 0,
          profit: -Number(d.data().stake || 0),
          updatedAt: new Date().toISOString(),
        })
      );
      await Promise.all(batchPromises);
    } catch (settleErr) {
      console.warn('Error settling pending bets on crash:', settleErr);
    }
  } catch (err) {
    console.warn('finishRoundOnCrash error:', err);
  }
}

/**
 * Place a bet on Crash Game atomically
 * Invariant: Deducts exact stake from user balance, writes walletTransactions ledger entry,
 * creates crashBets entry.
 */
export async function placeCrashBet(params: {
  userId: string;
  userName: string;
  userCode: string;
  roundId: string;
  panelIndex: number;
  stake: number;
  minBet: number;
  maxBet: number;
}): Promise<{ success: boolean; betId: string; newBalance: number }> {
  const { userId, userName, userCode, roundId, panelIndex, stake, minBet, maxBet } = params;

  if (stake < minBet) {
    throw new CrashGameError(`Minimum bet is Rs. ${minBet}.`);
  }
  if (stake > maxBet) {
    throw new CrashGameError(`Maximum bet is Rs. ${maxBet}.`);
  }

  const betId = `bet_${roundId}_${userId}_p${panelIndex}_${Date.now()}`;
  const betRef = doc(db, 'crashBets', betId);
  const userRef = doc(db, 'users', userId);
  const roundRef = doc(db, 'crashRounds', 'active');

  try {
    const result = await runTransaction(db, async (tx) => {
      // 1. Check active round status
      const roundSnap = await tx.get(roundRef);
      if (!roundSnap.exists()) {
        throw new CrashGameError('Round is not currently active.');
      }
      const activeRound = roundSnap.data() as CrashRound;
      if (activeRound.id !== roundId) {
        throw new CrashGameError('This round has already closed.');
      }
      if (activeRound.status !== 'betting') {
        throw new CrashGameError('Betting time has closed for this round.');
      }

      // 2. Check user balance
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        throw new CrashGameError('User account not found.');
      }
      const userData = userSnap.data();
      const currentBalance = Number(userData.balance || 0);

      if (currentBalance < stake) {
        throw new CrashGameError(`Insufficient balance. You have Rs. ${currentBalance.toFixed(2)}, but bet is Rs. ${stake.toFixed(2)}.`);
      }

      const newBalance = currentBalance - stake;
      const nowIso = new Date().toISOString();

      // 3. Atomically deduct stake from user
      tx.update(userRef, {
        balance: newBalance,
        updatedAt: nowIso,
      });

      // 4. Create crashBet document
      const newBet: CrashBet = {
        id: betId,
        roundId,
        userId,
        userName,
        userCode,
        panelIndex,
        stake,
        status: 'placed',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      tx.set(betRef, newBet);

      // 5. Create immutable walletTransactions ledger record
      const txnId = `txn_crash_bet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const txnRef = doc(db, 'walletTransactions', txnId);
      const ledgerRecord: WalletTransaction = {
        id: txnId,
        userId,
        type: 'crash_bet',
        amount: -stake,
        previousBalance: currentBalance,
        newBalance: newBalance,
        description: `Crash Bet (Panel ${panelIndex + 1}) - Round #${activeRound.roundNumber}`,
        referenceId: betId,
        status: 'completed',
        createdAt: nowIso,
      };
      tx.set(txnRef, ledgerRecord);

      return { success: true, betId, newBalance };
    });

    return result;
  } catch (error: any) {
    if (error instanceof CrashGameError || error?.name === 'CrashGameError') {
      throw error;
    }
    if (isFirestoreSystemError(error)) {
      handleFirestoreError(error, OperationType.WRITE, `crashBets/${betId}`);
    }
    throw error;
  }
}

/**
 * Cash out active bet atomically
 * Invariant: Validates multiplier against crash point, credits user wallet with payout,
 * updates crashBets status to 'cashed_out', writes walletTransactions ledger entry.
 */
export async function cashOutCrashBet(params: {
  betId: string;
  userId: string;
  roundId: string;
  claimedMultiplier: number;
}): Promise<{ success: boolean; payout: number; multiplier: number; newBalance: number }> {
  const { betId, userId, roundId, claimedMultiplier } = params;

  const betRef = doc(db, 'crashBets', betId);
  const userRef = doc(db, 'users', userId);
  const roundRef = doc(db, 'crashRounds', 'active');

  try {
    const result = await runTransaction(db, async (tx) => {
      // 1. Verify bet is still 'placed'
      const betSnap = await tx.get(betRef);
      if (!betSnap.exists()) {
        throw new CrashGameError('Bet not found.');
      }
      const bet = betSnap.data() as CrashBet;
      if (bet.status !== 'placed') {
        throw new CrashGameError(`Bet has already been ${bet.status}.`);
      }
      if (bet.userId !== userId) {
        throw new CrashGameError('Unauthorized bet access.');
      }

      // 2. Verify active round is flying and multiplier is valid
      const roundSnap = await tx.get(roundRef);
      if (!roundSnap.exists()) {
        throw new CrashGameError('Active round not found.');
      }
      const round = roundSnap.data() as CrashRound;
      if (round.id !== roundId) {
        throw new CrashGameError('Round mismatch.');
      }
      if (round.status === 'crashed') {
        throw new CrashGameError('Rocket already crashed! Cash out failed.');
      }
      if (round.status !== 'flying') {
        throw new CrashGameError('Round is not currently flying.');
      }

      // 3. Multiplier authority check: Cannot exceed round crashPoint
      if (claimedMultiplier > round.crashPoint) {
        throw new CrashGameError(`Crash occurred at ${round.crashPoint.toFixed(2)}x. Cash out missed.`);
      }

      // Calculate payout: stake * multiplier rounded to 2 decimal places
      const finalMultiplier = Math.max(1.01, Math.min(claimedMultiplier, round.crashPoint));
      const payout = Math.floor(bet.stake * finalMultiplier * 100) / 100;
      const profit = Math.floor((payout - bet.stake) * 100) / 100;

      // 4. Read user balance
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) {
        throw new CrashGameError('User not found.');
      }
      const curBal = Number(userSnap.data().balance || 0);
      const newBal = curBal + payout;
      const nowIso = new Date().toISOString();

      // 5. Update bet document
      tx.update(betRef, {
        status: 'cashed_out',
        cashedOutMultiplier: finalMultiplier,
        payout: payout,
        profit: profit,
        updatedAt: nowIso,
      });

      // 6. Atomically credit user balance
      tx.update(userRef, {
        balance: newBal,
        updatedAt: nowIso,
      });

      // 7. Write immutable walletTransactions ledger record
      const txnId = `txn_crash_win_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const txnRef = doc(db, 'walletTransactions', txnId);
      const ledgerRecord: WalletTransaction = {
        id: txnId,
        userId,
        type: 'crash_win',
        amount: payout,
        previousBalance: curBal,
        newBalance: newBal,
        description: `Crash Payout @ ${finalMultiplier.toFixed(2)}x (Stake: Rs. ${bet.stake}, Profit: Rs. ${profit.toFixed(2)})`,
        referenceId: betId,
        status: 'completed',
        createdAt: nowIso,
      };
      tx.set(txnRef, ledgerRecord);

      return {
        success: true,
        payout,
        multiplier: finalMultiplier,
        newBalance: newBal,
      };
    });

    return result;
  } catch (error: any) {
    if (error instanceof CrashGameError || error?.name === 'CrashGameError') {
      throw error;
    }
    if (isFirestoreSystemError(error)) {
      handleFirestoreError(error, OperationType.UPDATE, `crashBets/${betId}`);
    }
    throw error;
  }
}

/**
 * Fetch betting history for a specific user
 */
export async function fetchUserCrashBets(userId: string, limitCount: number = 50): Promise<CrashBet[]> {
  try {
    const q = query(collection(db, 'crashBets'), where('userId', '==', userId), limit(limitCount));
    const snap = await getDocs(q);
    const bets = snap.docs.map((d) => d.data() as CrashBet);
    return bets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'crashBets');
    return [];
  }
}

/**
 * Fetch all crash rounds for admin audit
 */
export async function fetchAdminCrashRounds(limitCount: number = 50): Promise<CrashRound[]> {
  try {
    const q = query(collection(db, 'crashRoundsHistory'), limit(limitCount));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => d.data() as CrashRound);
    return list.sort((a, b) => (b.crashedTime || 0) - (a.crashedTime || 0));
  } catch {
    return [];
  }
}

/**
 * Fetch all crash bets for admin audit
 */
export async function fetchAdminCrashBets(limitCount: number = 100): Promise<CrashBet[]> {
  try {
    const q = query(collection(db, 'crashBets'), limit(limitCount));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => d.data() as CrashBet);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}
