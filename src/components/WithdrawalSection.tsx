import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch, onSnapshot, query, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, PlatformFees, WithdrawalSettings } from "../types";
import WalletCard from "./WalletCard";
import { Landmark, CheckCircle, AlertTriangle, ArrowUpRight, HelpCircle, Key, Zap, Clock, Calendar, Lock, ShieldAlert, Info, X } from "lucide-react";
import { hashPin } from "../utils/pin";

interface WithdrawalSectionProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void;
}

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function evaluateSchedule(config: WithdrawalSettings | null) {
  const now = new Date();
  const currentDayName = ALL_DAYS[now.getDay()]; // e.g., "Wednesday"
  
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;

  if (!config) {
    return {
      isOpen: true,
      reason: null,
      currentDay: currentDayName,
      currentTime: currentTimeStr,
      minAmount: 100,
      maxAmount: 10000,
      dailyLimit: 20000,
      weeklyLimit: 100000,
      monthlyLimit: 400000,
      allowedDays: ALL_DAYS,
      startTime: "00:00",
      endTime: "23:59",
      enabled: true,
    };
  }

  const enabled = config.enabled ?? true;
  const minAmount = config.minAmount ?? 100;
  const maxAmount = config.maxAmount ?? 10000;
  const dailyLimit = config.dailyLimit ?? 20000;
  const weeklyLimit = config.weeklyLimit ?? 100000;
  const monthlyLimit = config.monthlyLimit ?? 400000;
  const startTime = config.startTime || "00:00";
  const endTime = config.endTime || "23:59";
  const rawAllowedDays = config.allowedDays && config.allowedDays.length > 0 ? config.allowedDays : ALL_DAYS;

  const normalizedAllowedDays = rawAllowedDays.map(d => d.trim().toLowerCase());

  if (!enabled) {
    return {
      isOpen: false,
      reason: "Withdrawal requests are currently disabled globally by administration.",
      currentDay: currentDayName,
      currentTime: currentTimeStr,
      minAmount,
      maxAmount,
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      allowedDays: rawAllowedDays,
      startTime,
      endTime,
      enabled: false,
    };
  }

  const isDayAllowed = normalizedAllowedDays.some(d => 
    d === currentDayName.toLowerCase() || 
    currentDayName.toLowerCase().startsWith(d) ||
    d.startsWith(currentDayName.toLowerCase().substring(0, 3))
  );

  if (!isDayAllowed) {
    return {
      isOpen: false,
      reason: `Withdrawals are not accepted on ${currentDayName}s. Scheduled payout days: ${rawAllowedDays.join(", ")}.`,
      currentDay: currentDayName,
      currentTime: currentTimeStr,
      minAmount,
      maxAmount,
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      allowedDays: rawAllowedDays,
      startTime,
      endTime,
      enabled: true,
    };
  }

  const [currH, currM] = currentTimeStr.split(":").map(Number);
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const currMinutes = (currH || 0) * 60 + (currM || 0);
  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 23) * 60 + (endM || 59);

  if (currMinutes < startMinutes || currMinutes > endMinutes) {
    return {
      isOpen: false,
      reason: `Withdrawal window is closed right now (${currentTimeStr}). Daily schedule window: ${startTime} to ${endTime}.`,
      currentDay: currentDayName,
      currentTime: currentTimeStr,
      minAmount,
      maxAmount,
      dailyLimit,
      weeklyLimit,
      monthlyLimit,
      allowedDays: rawAllowedDays,
      startTime,
      endTime,
      enabled: true,
    };
  }

  return {
    isOpen: true,
    reason: null,
    currentDay: currentDayName,
    currentTime: currentTimeStr,
    minAmount,
    maxAmount,
    dailyLimit,
    weeklyLimit,
    monthlyLimit,
    allowedDays: rawAllowedDays,
    startTime,
    endTime,
    enabled: true,
  };
}

export default function WithdrawalSection({ user, onUpdateUser }: WithdrawalSectionProps) {
  const [withdrawalAmount, setWithdrawalAmount] = useState<number | "">("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time fees & withdrawal schedule states
  const [fees, setFees] = useState<PlatformFees | null>(null);
  const [withdrawalSettings, setWithdrawalSettings] = useState<WithdrawalSettings | null>(null);
  const [userWithdrawalsHistory, setUserWithdrawalsHistory] = useState<any[]>([]);
  const [withdrawalType, setWithdrawalType] = useState<"Standard" | "Fast">("Standard");
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    const unsubFees = onSnapshot(doc(db, "settings", "fees"), (snapshot) => {
      if (snapshot.exists()) {
        setFees(snapshot.data() as PlatformFees);
      }
    });

    const unsubSchedule = onSnapshot(doc(db, "settings", "withdrawals"), (snapshot) => {
      if (snapshot.exists()) {
        setWithdrawalSettings(snapshot.data() as WithdrawalSettings);
      }
    });

    return () => {
      unsubFees();
      unsubSchedule();
    };
  }, []);

  // Listen to user's historical withdrawal requests for rolling limits
  useEffect(() => {
    if (!user.userId) return;
    const q = query(
      collection(db, "withdrawals"),
      where("userId", "==", user.userId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setUserWithdrawalsHistory(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "withdrawals"));

    return () => unsub();
  }, [user.userId]);

  const scheduleInfo = evaluateSchedule(withdrawalSettings);

  // Calculate requested withdrawal totals
  const getTotals = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();

    let today = 0;
    let week = 0;
    let month = 0;

    userWithdrawalsHistory.forEach((w) => {
      if (w.status === "Rejected") return; // Rejected requests don't consume user limits
      const amount = Number(w.withdrawalAmount) || 0;
      let txTime = 0;
      if (w.timestamp?.seconds) {
        txTime = w.timestamp.seconds * 1000;
      } else if (w.date) {
        txTime = new Date(w.date).getTime();
      }

      if (txTime >= startOfToday) {
        today += amount;
      }
      if (txTime >= startOfWeek) {
        week += amount;
      }
      if (txTime >= startOfMonth) {
        month += amount;
      }
    });

    return { today, week, month };
  };

  const totals = getTotals();

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

  const isWithdrawalAllowed = withdrawalType === "Fast" ? scheduleInfo.enabled : scheduleInfo.isOpen;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isWithdrawalAllowed) {
      if (!scheduleInfo.enabled) {
        setError("Withdrawal requests are currently disabled globally by administration.");
      } else {
        setError("Standard withdrawals are only available during scheduled operating windows. Switch to Fast Payout to process your withdrawal anytime!");
      }
      return;
    }

    if (!isKycCompleted) {
      setError("KYC Verification is required. Please fill in your UPI details on the KYC page first.");
      return;
    }

    const reqAmt = Number(withdrawalAmount);

    if (!reqAmt || reqAmt < scheduleInfo.minAmount) {
      setError(`Minimum withdrawal amount per request is ₹${scheduleInfo.minAmount.toLocaleString("en-IN")}.`);
      return;
    }

    if (reqAmt > scheduleInfo.maxAmount) {
      setError(`Maximum withdrawal amount per request is ₹${scheduleInfo.maxAmount.toLocaleString("en-IN")}.`);
      return;
    }

    if (totals.today + reqAmt > scheduleInfo.dailyLimit) {
      const remainingToday = Math.max(0, scheduleInfo.dailyLimit - totals.today);
      setError(`Daily withdrawal limit of ₹${scheduleInfo.dailyLimit.toLocaleString("en-IN")} exceeded. You have already requested ₹${totals.today.toLocaleString("en-IN")} today (Remaining limit: ₹${remainingToday.toLocaleString("en-IN")}).`);
      return;
    }

    if (totals.week + reqAmt > scheduleInfo.weeklyLimit) {
      const remainingWeek = Math.max(0, scheduleInfo.weeklyLimit - totals.week);
      setError(`Weekly withdrawal limit of ₹${scheduleInfo.weeklyLimit.toLocaleString("en-IN")} exceeded. You have requested ₹${totals.week.toLocaleString("en-IN")} this week (Remaining limit: ₹${remainingWeek.toLocaleString("en-IN")}).`);
      return;
    }

    if (totals.month + reqAmt > scheduleInfo.monthlyLimit) {
      const remainingMonth = Math.max(0, scheduleInfo.monthlyLimit - totals.month);
      setError(`Monthly withdrawal limit of ₹${scheduleInfo.monthlyLimit.toLocaleString("en-IN")} exceeded. You have requested ₹${totals.month.toLocaleString("en-IN")} this month (Remaining limit: ₹${remainingMonth.toLocaleString("en-IN")}).`);
      return;
    }

    if (reqAmt > user.walletBalance) {
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
        withdrawalAmount: reqAmt,
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
        body: `${user.username} requested a ${withdrawalType} withdrawal of ₹${reqAmt.toLocaleString("en-IN")} (Estimated Fee: ₹${computedFee})`,
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
                min={scheduleInfo.minAmount}
                max={scheduleInfo.maxAmount}
                required
                disabled={!isKycCompleted || !isWithdrawalAllowed}
                placeholder={`₹${scheduleInfo.minAmount.toLocaleString("en-IN")} - ₹${scheduleInfo.maxAmount.toLocaleString("en-IN")}`}
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans font-medium disabled:opacity-50"
              />
            </div>
            <div className="flex justify-between items-center mt-1.5 px-1 text-[10px] text-zinc-500 font-mono">
              <span>Min: ₹{scheduleInfo.minAmount.toLocaleString("en-IN")} | Max: ₹{scheduleInfo.maxAmount.toLocaleString("en-IN")}</span>
              <span>Available balance: ₹{user.walletBalance.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Withdrawal Processing Speed selector */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs text-zinc-400 font-medium uppercase tracking-wider">
                Withdrawal Processing Speed
              </label>
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-mono font-bold flex items-center space-x-1 underline cursor-pointer"
              >
                <Info className="w-3 h-3" />
                <span>View Operating Hours & Schedule</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setWithdrawalType("Standard");
                  setShowScheduleModal(true);
                }}
                className={`py-3 px-4 rounded-xl border font-semibold text-xs transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer relative ${
                  withdrawalType === "Standard"
                    ? "bg-amber-500/10 border-amber-500 text-amber-400"
                    : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-900/40 text-zinc-400"
                }`}
              >
                <Landmark className="w-4 h-4 text-amber-500" />
                <span>Standard Payout</span>
                <span className="text-[9px] text-zinc-500 font-normal">Normal administrative queue</span>
                <span className="text-[9px] text-amber-400/90 font-mono font-bold mt-0.5">ℹ️ Tap to view schedule</span>
              </button>

              <button
                type="button"
                onClick={() => setWithdrawalType("Fast")}
                className={`py-3 px-4 rounded-xl border font-semibold text-xs transition-all flex flex-col items-center justify-center space-y-1 cursor-pointer ${
                  withdrawalType === "Fast"
                    ? "bg-purple-500/10 border-purple-500 text-purple-400"
                    : "bg-zinc-950/20 border-zinc-850 hover:bg-zinc-900/40 text-zinc-400"
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
                disabled={!isKycCompleted || !isWithdrawalAllowed}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-4 text-sm text-zinc-200 tracking-widest text-center font-mono placeholder-zinc-650 focus:outline-hidden focus:border-amber-500/60 transition-colors disabled:opacity-50"
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
              disabled={loading || !isKycCompleted || !isWithdrawalAllowed}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 font-display font-semibold text-slate-950 text-sm py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform active:scale-98 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>
                {loading 
                  ? "Processing..." 
                  : !isWithdrawalAllowed 
                  ? (withdrawalType === "Standard" ? "Standard Schedule Closed (Select Fast Payout)" : "Withdrawals Disabled") 
                  : `Initiate ${withdrawalType} Withdrawal`}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* WITHDRAWAL SCHEDULE POPUP MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-zinc-850 gap-2">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2 rounded-xl shrink-0 ${scheduleInfo.isOpen ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                  {scheduleInfo.isOpen ? <Clock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-display font-bold text-zinc-100 uppercase tracking-wider">
                    Withdrawal Schedule & Availability
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-full border ${scheduleInfo.isOpen ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}`}>
                      {scheduleInfo.isOpen ? "🟢 Standard Window Open" : "🟡 Standard Window Closed"}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-full border bg-purple-500/15 text-purple-400 border-purple-500/30">
                      ⚡ Fast Payout: 24/7 Anytime
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-400">
              Current local time: <strong className="text-amber-400 font-mono">{scheduleInfo.currentDay}, {scheduleInfo.currentTime}</strong>
            </p>

            {!scheduleInfo.isOpen && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs flex items-start space-x-2.5">
                <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-purple-300">Standard Payout Schedule Window Closed</p>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    {scheduleInfo.reason} You can still withdraw right now by selecting <strong className="text-purple-400">Fast Payout (Priority)</strong>!
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans pt-1">
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-zinc-850 space-y-1">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">Standard Operating Days</span>
                <span className="font-medium text-zinc-200 text-[11px] truncate block" title={scheduleInfo.allowedDays.join(", ")}>
                  {scheduleInfo.allowedDays.length === 7 ? "Everyday (All 7 Days)" : scheduleInfo.allowedDays.join(", ")}
                </span>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-zinc-850 space-y-1">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">Standard Daily Hours</span>
                <span className="font-mono text-zinc-200 text-[11px] font-medium block">
                  {scheduleInfo.startTime} - {scheduleInfo.endTime}
                </span>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-zinc-850 space-y-1">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">Per Request Min/Max</span>
                <span className="font-mono text-amber-400 text-[11px] font-medium block">
                  ₹{scheduleInfo.minAmount.toLocaleString("en-IN")} - ₹{scheduleInfo.maxAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-zinc-850 space-y-1">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider block">Requested Today</span>
                <span className="font-mono text-emerald-400 text-[11px] font-medium block">
                  ₹{totals.today.toLocaleString("en-IN")} / ₹{scheduleInfo.dailyLimit.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

