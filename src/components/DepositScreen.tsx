import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowDownCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Upload,
  Info,
  Building,
  CreditCard,
  ShieldCheck,
  Clock,
  Sparkles,
  QrCode,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PaymentMethod, AppSettings } from '../types';
import { submitDepositRequest } from '../services/walletService';
import { fetchAppSettings } from '../services/settingsService';

interface DepositScreenProps {
  onSuccessNavigateHistory: () => void;
  onOpenAuth: () => void;
}

export const DepositScreen: React.FC<DepositScreenProps> = ({
  onSuccessNavigateHistory,
  onOpenAuth,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Form states
  const [amount, setAmount] = useState<number | ''>(100);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('esewa');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);

  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successDepositId, setSuccessDepositId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [previewQrModal, setPreviewQrModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAppSettings().then(setSettings).catch(() => {});
  }, []);

  const minDeposit = settings?.minDeposit ?? 100;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, or WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot size must be under 5MB.');
      return;
    }

    setScreenshotName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        setScreenshotData(compressedBase64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser || !userProfile) {
      onOpenAuth();
      return;
    }

    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount < minDeposit) {
      setError(`Minimum deposit limit is Rs. ${minDeposit.toFixed(2)}.`);
      return;
    }

    if (numAmount > 500000) {
      setError('Maximum deposit limit per transaction is Rs. 500,000.');
      return;
    }

    if (!transactionId.trim()) {
      setError('Please enter the Transaction ID / Reference Code from your payment slip.');
      return;
    }

    if (!screenshotData) {
      setError('Please upload a screenshot of your payment receipt as proof.');
      return;
    }

    setLoading(true);

    try {
      const depositId = await submitDepositRequest({
        userId: currentUser.uid,
        userName: userProfile.name,
        userEmail: currentUser.email || '',
        userCode: userProfile.userCode,
        amount: numAmount,
        paymentMethod: selectedMethod,
        transactionId: transactionId.trim(),
        screenshotUrl: screenshotData,
      });

      setSuccessDepositId(depositId);
      setTransactionId('');
      setScreenshotData(null);
      setScreenshotName(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to submit deposit request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [100, 200, 500, 1000, 2500, 5000];

  // Current active QR code from admin settings
  const currentQr =
    selectedMethod === 'esewa'
      ? settings?.esewaQrCode
      : selectedMethod === 'khalti'
      ? settings?.khaltiQrCode
      : settings?.bankQrCode;

  // Current instructions from admin settings
  const currentInstructions =
    selectedMethod === 'esewa'
      ? settings?.esewaInstructions
      : selectedMethod === 'khalti'
      ? settings?.khaltiInstructions
      : settings?.bankInstructions;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      {/* Top Banner */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Deposit Nepali Rupees (Rs.)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-slate-400">
          Transfer via eSewa, Khalti, or Bank QR, then submit your transaction ID & proof.
        </p>
      </div>

      {/* Success Modal / Banner */}
      {successDepositId && (
        <div className="mb-6 p-6 rounded-3xl bg-emerald-950/50 border border-emerald-500/30 text-center animate-fadeIn shadow-xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Deposit Request Submitted!</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto mb-4 leading-relaxed">
            Your deposit of <strong className="text-emerald-400">Rs. {Number(amount).toFixed(2)}</strong> has been registered with ID <code className="text-slate-200 bg-slate-900 px-1.5 py-0.5 rounded text-[11px]">{successDepositId}</code>.
            <br />
            Status: <span className="text-amber-400 font-semibold">Pending Admin Verification</span>. Your balance will update once approved by the admin.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onSuccessNavigateHistory}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition-all"
            >
              View in Deposit History
            </button>
            <button
              onClick={() => setSuccessDepositId(null)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition-all"
            >
              Make Another Deposit
            </button>
          </div>
        </div>
      )}

      {/* Not Logged In Warning */}
      {!currentUser && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-300">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
          <div className="text-xs">
            <p className="font-bold text-white">Authentication Required</p>
            <p className="mt-0.5">Please sign in or register before submitting a deposit request.</p>
            <button
              onClick={onOpenAuth}
              className="mt-2.5 px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-lg hover:bg-amber-400 transition-colors"
            >
              Log In Now
            </button>
          </div>
        </div>
      )}

      {/* Main Deposit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Select Method & QR Code Display */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 1</span>
            <span className="text-xs text-slate-400">Official receiver channels</span>
          </div>
          <h3 className="text-sm font-bold text-white mb-3">Choose Payment Method</h3>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* eSewa */}
            <div
              onClick={() => setSelectedMethod('esewa')}
              className={`p-3.5 rounded-xl border cursor-pointer text-center transition-all ${
                selectedMethod === 'esewa'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center font-bold text-sm">
                e
              </div>
              <div className="text-xs font-bold text-white">eSewa</div>
              <div className="text-[10px] text-slate-400">Instant Wallet</div>
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
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                K
              </div>
              <div className="text-xs font-bold text-white">Khalti</div>
              <div className="text-[10px] text-slate-400">Digital Wallet</div>
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
              <div className="w-8 h-8 mx-auto mb-1.5 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                <Building className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-white">Bank Transfer</div>
              <div className="text-[10px] text-slate-400">ConnectIPS / NCHL</div>
            </div>
          </div>

          {/* Admin Uploaded QR Code Display */}
          {currentQr ? (
            <div className="mb-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-xs font-bold text-slate-300 block mb-2 flex items-center justify-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-400" /> Scan Official {selectedMethod.toUpperCase()} QR Code
              </span>
              <div
                onClick={() => setPreviewQrModal(currentQr)}
                className="inline-block p-2 bg-white rounded-2xl shadow-lg cursor-pointer hover:scale-105 transition-transform"
                title="Click to expand QR"
              >
                <img
                  src={currentQr}
                  alt={`${selectedMethod} payment QR`}
                  className="w-44 h-44 object-contain mx-auto rounded-lg"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Click QR image to enlarge for scanning from your payment app.
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
              <span className="text-slate-300 font-semibold">Payment via Direct Account Transfer:</span> Use the verified account details below.
            </div>
          )}

          {/* Payment Account Details Display */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800 text-xs">
              <span className="font-semibold text-slate-300">Receiving Account Details</span>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin Verified
              </span>
            </div>

            {selectedMethod === 'esewa' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">eSewa Mobile ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">
                      {settings?.esewaId || '9841234567'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(settings?.esewaId || '9841234567', 'esewaId')}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy eSewa ID"
                    >
                      {copiedField === 'esewaId' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Account Name:</span>
                  <span className="font-semibold text-slate-200">
                    {settings?.esewaName || 'Earn Npl Nepal Pvt. Ltd.'}
                  </span>
                </div>
              </div>
            )}

            {selectedMethod === 'khalti' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Khalti Mobile ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">
                      {settings?.khaltiId || '9801234567'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(settings?.khaltiId || '9801234567', 'khaltiId')}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy Khalti ID"
                    >
                      {copiedField === 'khaltiId' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Account Name:</span>
                  <span className="font-semibold text-slate-200">
                    {settings?.khaltiName || 'Earn Npl Official Account'}
                  </span>
                </div>
              </div>
            )}

            {selectedMethod === 'bank' && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bank:</span>
                  <span className="font-bold text-white">{settings?.bankName || 'Nabil Bank Ltd.'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account Name:</span>
                  <span className="font-semibold text-slate-200">{settings?.bankAccountName || 'EARN NPL NETWORK PVT LTD'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {settings?.bankAccountNumber || '01200175029348'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(settings?.bankAccountNumber || '01200175029348', 'bankNo')}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Copy Account Number"
                    >
                      {copiedField === 'bankNo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Branch:</span>
                  <span className="text-slate-300">{settings?.bankBranch || 'New Baneshwor, Kathmandu'}</span>
                </div>
              </div>
            )}

            {/* Admin configured instructions */}
            {currentInstructions && (
              <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 whitespace-pre-line leading-relaxed">
                <strong className="text-slate-300 block mb-1">Payment Instructions:</strong>
                {currentInstructions}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Deposit Amount */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 2</span>
            <span className="text-xs text-slate-400">
              Min: Rs. {minDeposit.toFixed(2)}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white mb-2">Deposit Amount (Rs.)</h3>

          <div className="relative mb-3">
            <span className="absolute left-3.5 top-3 text-slate-400 font-bold text-sm">Rs.</span>
            <input
              type="number"
              min={minDeposit}
              max={500000}
              step="10"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="100"
              className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base sm:text-lg font-mono font-bold focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Quick Amount Chips */}
          <div className="grid grid-cols-6 gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={`py-1.5 px-1 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  amount === q
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Transaction ID & Screenshot Proof */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Step 3</span>
            <span className="text-xs text-slate-400">Payment verification proof</span>
          </div>
          <h3 className="text-sm font-bold text-white mb-3">Transfer Verification</h3>

          {/* Transaction ID */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Transaction ID / Reference Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. 984029348 or TXN18290382"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs sm:text-sm uppercase font-mono tracking-wider focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Found on your eSewa, Khalti, or Mobile Banking payment receipt.
            </p>
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Payment Screenshot <span className="text-rose-400">*</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {!screenshotData ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/60 rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <p className="text-xs font-semibold text-slate-300">Click to upload payment screenshot</p>
                <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, or WEBP up to 5MB</p>
              </div>
            ) : (
              <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={screenshotData}
                    alt="Proof preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{screenshotName || 'Screenshot attached'}</p>
                    <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for verification
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-slate-400 hover:text-white mt-1 underline"
                    >
                      Change screenshot
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Security & Non-Credited Pending Notice */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-white">Important Notice:</span> Submitting a deposit request registers its status as <span className="text-amber-400 font-semibold">Pending</span>. A pending deposit will <strong className="text-white">NOT</strong> increase your available balance until manually verified and approved by the finance admin.
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !currentUser}
          className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 hover:from-emerald-500 hover:to-teal-300 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <ArrowDownCircle className="w-5 h-5" />
              <span>Submit Deposit Request (Rs. {Number(amount || 0).toFixed(2)})</span>
            </>
          )}
        </button>
      </form>

      {/* QR Code Zoom Modal */}
      {previewQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h4 className="text-sm font-bold text-white">Scan Payment QR</h4>
              <button
                onClick={() => setPreviewQrModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-white rounded-2xl inline-block shadow-lg">
              <img
                src={previewQrModal}
                alt="Payment QR Full"
                className="w-64 h-64 object-contain mx-auto"
              />
            </div>
            <p className="text-xs text-slate-300 mt-3 font-semibold">
              Open eSewa or Khalti on another phone to scan
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
