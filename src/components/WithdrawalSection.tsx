import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, PlatformFees } from "../types";
import WalletCard from "./WalletCard";
import { Landmark, CheckCircle, AlertTriangle, ArrowUpRight, HelpCircle, Key, Zap } from "lucide-react";
import { hashPin } from "../utils/pin";

interface WithdrawalSectionProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void;
}

export default function WithdrawalSection({ user, onUpdateUser }: WithdrawalSectionProps) {
  const [withdrawalAmount, setWithdrawalAmount] = useState<number | "">("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time fees configuration state
  const [fees, setFees] = useState<PlatformFees | null>(null);
  const [withdrawalType, setWithdrawalType] = useState<"Standard" | "Fast">("Standard");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "fees"), (snapshot) => {
      if (snapshot.exists()) {
        setFees(snapshot.data() as PlatformFees);
      }
    });
    return () => unsub();
  }, []);

  // Check if KYC is completed
  const isKycCompleted = !!(user.kycName && user.kycUpiId && user.kycUpiNumber);

  const calculateFee = () => {
    if (!fees) return 0;
    
    if (withdrawalType === "Fast") {
      if (user.isPremium) return 0; // Waived for Premium / VIP members
      
      if (!fees.fastWithdrawalFeeEnabled) return 0;
      const fixed = fees.fastWithdrawalFeeFixed || 0;
      const percent = fees.fastWithdrawalFeePercent || 0;
      let calculated = fixed + ((Number(withdrawalAmount) * percent) / 100);
      
      const min = fees.fastWithdrawalFeeMin || 0;
      const max = fees.fastWithdrawalFeeMax || 999999;
      if (calculated < min) calculated = min;
      if (calculated > max) calculated = max;
      return Math.round(calculated);
    } else {
      if (!fees.withdrawalFeeEnabled) return 0;
      
      let calculated = 0;
      const type = fees.withdrawalFeeType || "fixed";
      const fixed = fees.withdrawalFeeFixed || 0;
      const percent = fees.withdrawalFeePercent || 0;
      
      if (type === "fixed") {
        calculated = fixed;
      } else if (type === "percent" || type === "percentage") {
        calculated = (Number(withdrawalAmount) * percent) / 100;
      } else if (type === "hybrid") {
        calculated = fixed + ((Number(withdrawalAmount) * percent) / 100);
      }
      
      const min = fees.withdrawalFeeMin || 0;
      const max = fees.withdrawalFeeMax || 999999;
      if (calculated < min) calculated = min;
      if (calculated > max) calculated = max;
      return Math.round(calculated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isKycCompleted) {
      setError("KYC Verification is required. Please fill in your UPI details on the KYC page first.");
      return;
    }

    if (!withdrawalAmount || withdrawalAmount < 100 || withdrawalAmount > 10000) {
      setError("Withdrawal limit must be between ₹100 and ₹10,000.");
      return;
    }

    if (withdrawalAmount > user.walletBalance) {
      setError(`Insufficient wallet balance. You can withdraw up to ₹${user.walletBalance.toLocaleString("en-IN")}.`);
      return;
    }

    if (!user.walletPinHash) {
      setError("Please set up your secure 4-digit Wallet PIN in the Profile section first.");
      return;
    }

    if (pin.length !== 4 || isNaN(Number(pin))) {
      setError("Wallet PIN must be exactly 4 digits.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const hashedInput = await hashPin(pin);
      if (hashedInput !== user.walletPinHash) {
        setError("Incorrect Wallet PIN. Withdrawal request denied.");
        setLoading(false);
        return;
      }

      const batch = writeBatch(db);
      const computedFee = calculateFee();

      // 1. Add withdrawal request (no immediate deduction)
      const withdrawalRef = doc(collection(db, "withdrawals"));
      batch.set(withdrawalRef, {
        userId: user.userId,
        username: user.username,
        date: new Date().toLocaleDateString("en-IN"),
        email: user.email,
        phone: user.phone || "",
        withdrawalAmount: Number(withdrawalAmount),
        status: "Pending",
        timestamp: serverTimestamp(),
        holderName: user.kycName || "",
        upiId: user.kycUpiId || "",
        upiNumber: user.kycUpiNumber || "",
        withdrawalType: withdrawalType,
        feeDeducted: computedFee,
      });

      // 2. Add system notification for the admin
      const notificationRef = doc(collection(db, "notifications"));
      batch.set(notificationRef, {
        userId: "all",
        title: `New ${withdrawalType} Withdrawal Request`,
        body: `${user.username} requested a ${withdrawalType} withdrawal of ₹${Number(withdrawalAmount).toLocaleString("en-IN")} (Estimated Fee: ₹${computedFee})`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "withdrawal",
      });

      await batch.commit();

      setSuccess(true);
      setWithdrawalAmount("");
      setPin("");
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "withdrawals");
      setError("Failed to process withdrawal request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Balance Card */}
      <div className="flex justify-center">
        <WalletCard balance={user.walletBalance} username={user.username} />
      </div>

      <div className="w-full max-w-2xl mx-auto rounded-2xl glass-panel p-6 border border-zinc-800 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-amber-500/10 via-amber-500 to-amber-500/10" />

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-display font-semibold text-zinc-100">Secure Instant Withdrawal</h3>
            <p className="text-xs text-zinc-400">Withdraw wallet earnings directly to your UPI address.</p>
          </div>
        </div>

        {/* KYC Guard Notice */}
        {!isKycCompleted && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start space-x-3 mb-6">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">KYC Verification Missing</p>
              <p className="text-zinc-400 leading-relaxed">
                You cannot submit a withdrawal request because your payout details are not configured yet. 
                Please head over to the <strong className="text-amber-400">KYC Page</strong> to configure your Account Holder Name, UPI ID, and UPI Number.
              </p>
            </div>
          </div>
        )}

        {isKycCompleted && (
          <div className="p-4 rounded-xl bg-slate-950/40 border border-zinc-800 text-xs space-y-2 mb-6">
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Sending payout to your saved account:</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-zinc-300 font-medium">
              <div>
                <span className="text-zinc-500 block text-[9px] font-mono uppercase">Holder Name</span>
                <span>{user.kycName}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px] font-mono uppercase">UPI ID</span>
                <span className="font-mono text-amber-400">{user.kycUpiId}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px] font-mono uppercase">UPI Number</span>
                <span>+91 {user.kycUpiNumber}</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Withdrawal request placed successfully! Awaiting administrative verification and approval.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Username</label>
              <div className="bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 px-3.5 text-sm text-zinc-400">
                {user.username}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Applicant Email</label>
              <div className="bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 px-3.5 text-sm text-zinc-400 truncate">
                {user.email}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="withdrawalAmount" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">
              Withdrawal Amount (₹)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <span className="text-sm font-semibold text-amber-500/60">₹</span>
              </div>
              <input
                id="withdrawalAmount"
                type="number"
                min="100"
                max="10000"
                required
                disabled={!isKycCompleted}
                placeholder="₹100 - ₹10,000"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans font-medium"
              />
            </div>
            <div className="flex justify-between items-center mt-1.5 px-1 text-[10px] text-zinc-500 font-mono">
              <span>Min: ₹100 | Max: ₹10,000</span>
              <span>Available for withdrawal: ₹{user.walletBalance.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Withdrawal Processing Speed selector */}
          <div className="space-y-2">
            <label className="block text-xs text-zinc-400 font-medium uppercase tracking-wider">
              Withdrawal Processing Speed
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWithdrawalType("Standard")}
                className={`py-3 px-4 rounded-xl border font-semibold text-xs transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  withdrawalType === "Standard"
                    ? "bg-amber-500/10 border-amber-500 text-amber-400"
                    : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-900/40 text-zinc-405"
                }`}
              >
                <Landmark className="w-4 h-4 text-amber-500" />
                <span>Standard Payout</span>
                <span className="text-[9px] text-zinc-500 font-normal">Normal administrative queue</span>
              </button>

              <button
                type="button"
                onClick={() => setWithdrawalType("Fast")}
                className={`py-3 px-4 rounded-xl border font-semibold text-xs transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  withdrawalType === "Fast"
                    ? "bg-purple-500/10 border-purple-500 text-purple-400"
                    : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-900/40 text-zinc-405"
                }`}
              >
                <Zap className="w-4 h-4 text-purple-500" />
                <span>Fast Payout (Priority)</span>
                {user.isPremium ? (
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">★ Waived for VIPs!</span>
                ) : (
                  <span className="text-[9px] text-zinc-500 font-normal">Direct priority processing</span>
                )}
              </button>
            </div>

            {/* Real-time Fee Breakdown Display */}
            {fees && (
              <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-1.5">
                <div className="flex justify-between text-[11px] font-sans">
                  <span className="text-zinc-500">Processing Fee:</span>
                  <span className="font-mono text-zinc-300 font-medium">
                    {calculateFee() > 0 ? `₹${calculateFee().toLocaleString("en-IN")}` : "Free (₹0)"}
                  </span>
                </div>
                {withdrawalType === "Fast" && user.isPremium && (
                  <div className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1">
                    <span className="text-emerald-400">★</span>
                    <span>VIP Member Benefit: Priority withdrawal charges are completely waived!</span>
                  </div>
                )}
                {withdrawalType === "Fast" && !user.isPremium && (
                  <div className="text-[10px] text-amber-500/80 font-medium">
                    💡 Upgrade to Premium/VIP membership to waive priority processing fees completely!
                  </div>
                )}
                <div className="flex justify-between text-xs font-semibold pt-1 border-t border-zinc-900">
                  <span className="text-zinc-300">Estimated Net Receive:</span>
                  <span className="font-mono text-emerald-400">
                    ₹{(withdrawalAmount ? Math.max(0, Number(withdrawalAmount) - calculateFee()) : 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="walletPin" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider flex items-center space-x-1">
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span>Wallet Security PIN</span>
            </label>
            <div className="relative">
              <input
                id="walletPin"
                type="password"
                required
                maxLength={4}
                pattern="\d{4}"
                placeholder="Enter 4-digit Wallet PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm text-zinc-200 tracking-widest text-center font-mono placeholder-zinc-650 focus:outline-hidden focus:border-amber-500/60 transition-colors"
              />
            </div>
            {!user.walletPinHash && (
              <p className="text-[10px] text-amber-500 mt-1 font-sans">
                ⚠️ You have not established your Wallet PIN yet. Please navigate to the Profile section to create one.
              </p>
            )}
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading || !isKycCompleted}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 font-display font-semibold text-slate-950 text-sm py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform active:scale-98 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>{loading ? "Processing..." : "Initiate Withdrawal"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
