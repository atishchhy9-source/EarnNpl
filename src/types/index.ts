export interface UserProfile {
  id: string;
  name: string;
  email: string;
  userCode: string;
  balance: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalDeposited: number;
  totalWithdrawn: number;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'esewa' | 'khalti' | 'bank';

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCode: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  idempotencyKey?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCode: string;
  amount: number;
  paymentMethod: PaymentMethod;
  accountNumber: string;
  accountName: string;
  bankName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  rejectionReason?: string;
  paymentReference?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  paidAt?: string;
  createdAt: string;
}

export type TransactionType =
  | 'deposit_credit'
  | 'withdrawal_reserve'
  | 'withdrawal_refund'
  | 'withdrawal_paid'
  | 'admin_adjustment'
  | 'crash_bet'
  | 'crash_win';

export interface WalletTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  referenceId?: string;
  status: 'completed' | 'pending' | 'failed';
  createdAt: string;
}

export interface CrashRound {
  id: string;
  roundNumber: number;
  status: 'betting' | 'flying' | 'crashed';
  crashPoint: number;
  serverSeedHash: string;
  serverSeed?: string;
  bettingStartTime: number;
  bettingEndTime: number;
  flyingStartTime?: number;
  crashedTime?: number;
  createdAt: string;
}

export interface CrashBet {
  id: string;
  roundId: string;
  userId: string;
  userName: string;
  userCode: string;
  panelIndex: number;
  stake: number;
  status: 'placed' | 'cashed_out' | 'crashed';
  cashedOutMultiplier?: number;
  payout?: number;
  profit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrashAutoplayConfig {
  enabled: boolean;
  roundsRemaining: number;
  totalRounds: number;
  baseStake: number;
  stopOnProfit: number;
  stopOnLoss: number;
  autoCashOutMultiplier: number;
  currentProfit: number;
  currentLoss: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'deposit' | 'withdrawal' | 'system';
  read: boolean;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  minDeposit: number;
  minWithdrawal: number;
  announcementBanner: string;
  maintenanceMode: boolean;
  supportEmail: string;
  supportTelegram: string;
  supportWhatsapp: string;
  // eSewa
  esewaEnabled: boolean;
  esewaId: string;
  esewaName: string;
  esewaQrCode: string;
  esewaInstructions: string;
  // Khalti
  khaltiEnabled: boolean;
  khaltiId: string;
  khaltiName: string;
  khaltiQrCode: string;
  khaltiInstructions: string;
  // Bank
  bankEnabled: boolean;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  bankQrCode: string;
  bankInstructions: string;
  // Crash Multiplier Game Settings
  crashGameEnabled: boolean;
  crashMinBet: number;
  crashMaxBet: number;
  crashAutoplayEnabled: boolean;
  crashMaintenance: boolean;
  crashCountdownSecs: number;
  crashAnnouncement: string;
}
