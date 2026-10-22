import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { AppSettings } from '../types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global',
  minDeposit: 100,
  minWithdrawal: 1000,
  announcementBanner: 'Welcome to Earn Npl! Official Nepali earning & wallet platform. Minimum deposit is Rs. 100 and minimum withdrawal is Rs. 1,000.',
  maintenanceMode: false,
  supportEmail: 'support@earnnpl.com.np',
  supportTelegram: '@EarnNplOfficial',
  supportWhatsapp: '+977-9841234567',

  // eSewa
  esewaEnabled: true,
  esewaId: '9841234567',
  esewaName: 'Earn Npl Nepal Pvt. Ltd.',
  esewaQrCode: '',
  esewaInstructions: '1. Scan the eSewa QR code or transfer funds to the eSewa ID shown above.\n2. In the remarks, write your Earn Npl User Code.\n3. Copy the Transaction ID / Reference Code from the completed slip.\n4. Take a screenshot of the receipt and submit below.',

  // Khalti
  khaltiEnabled: true,
  khaltiId: '9801234567',
  khaltiName: 'Earn Npl Official Account',
  khaltiQrCode: '',
  khaltiInstructions: '1. Open your Khalti wallet and send money to the Khalti ID or scan QR.\n2. Keep your User Code in remarks.\n3. Copy the Khalti Transaction Code.\n4. Upload receipt screenshot for verification.',

  // Bank
  bankEnabled: true,
  bankName: 'Nabil Bank Ltd.',
  bankAccountName: 'EARN NPL NETWORK PVT LTD',
  bankAccountNumber: '01200175029348',
  bankBranch: 'New Baneshwor, Kathmandu',
  bankQrCode: '',
  bankInstructions: '1. Transfer via Mobile Banking / ConnectIPS to the account number above.\n2. Take a screenshot of the transfer voucher.\n3. Paste the transaction reference number.',

  // Crash Multiplier Game
  crashGameEnabled: true,
  crashMinBet: 20,
  crashMaxBet: 25000,
  crashAutoplayEnabled: true,
  crashMaintenance: false,
  crashCountdownSecs: 5,
  crashAnnouncement: '🚀 Welcome to Crash Multiplier! Place bets before the countdown ends and cash out before the rocket crashes!',
};

export async function fetchAppSettings(): Promise<AppSettings> {
  try {
    const ref = doc(db, 'appSettings', 'global');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ...DEFAULT_APP_SETTINGS, ...(snap.data() as AppSettings) };
    }
    // Seed default settings into Firestore on first read
    try {
      await setDoc(ref, DEFAULT_APP_SETTINGS);
    } catch {
      // Non-blocking if restricted
    }
    return DEFAULT_APP_SETTINGS;
  } catch (err) {
    console.warn('Using default app settings:', err);
    return DEFAULT_APP_SETTINGS;
  }
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
  const ref = doc(db, 'appSettings', 'global');
  try {
    await setDoc(ref, { ...DEFAULT_APP_SETTINGS, ...settings, id: 'global' }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'appSettings/global');
  }
}
