import React, { useState, useEffect } from "react";
import { User, CreditCard, CheckCircle, AlertTriangle } from "lucide-react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";

interface KYCSectionProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void;
}

export default function KYCSection({ user, onUpdateUser }: KYCSectionProps) {
  const [holderName, setHolderName] = useState(user.kycName || "");
  const [upiId, setUpiId] = useState(user.kycUpiId || "");
  const [upiNumber, setUpiNumber] = useState(user.kycUpiNumber || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHolderName(user.kycName || "");
    setUpiId(user.kycUpiId || "");
    setUpiNumber(user.kycUpiNumber || "");
  }, [user]);

  const isCompleted = user.kycName && user.kycUpiId && user.kycUpiNumber;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holderName.trim() || !upiId.trim() || !upiNumber.trim()) {
      setError("Please fill in all KYC details.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const userRef = doc(db, "users", user.userId);
      await updateDoc(userRef, {
        kycName: holderName.trim(),
        kycUpiId: upiId.trim(),
        kycUpiNumber: upiNumber.trim(),
      });

      onUpdateUser({
        kycName: holderName.trim(),
        kycUpiId: upiId.trim(),
        kycUpiNumber: upiNumber.trim(),
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.userId}`);
      setError("Failed to update KYC information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl glass-panel p-6 border border-zinc-800 relative overflow-hidden shadow-xl">
      <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-amber-500/20 via-amber-500 to-amber-500/20" />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-display font-semibold text-zinc-100">KYC Verification</h3>
          <p className="text-xs text-zinc-400">Manage your UPI payout details for secure withdrawals.</p>
        </div>
        {isCompleted ? (
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-sans text-xs">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>VERIFIED KYC</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-sans text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>PENDING KYC</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>KYC information updated successfully!</span>
          </div>
        )}

        <div>
          <label htmlFor="holderName" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">
            Account Holder Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <User className="w-4 h-4" />
            </div>
            <input
              id="holderName"
              type="text"
              required
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
              placeholder="e.g. Ankit Kumar"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="upiId" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">
              UPI ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <CreditCard className="w-4 h-4" />
              </div>
              <input
                id="upiId"
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                placeholder="ankit@paytm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="upiNumber" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">
              UPI Mobile Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <span className="text-xs font-semibold">+91</span>
              </div>
              <input
                id="upiNumber"
                type="tel"
                required
                pattern="[0-9]{10}"
                value={upiNumber}
                onChange={(e) => setUpiNumber(e.target.value)}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-12 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                placeholder="9876543210"
              />
            </div>
          </div>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 font-display font-semibold text-slate-950 text-sm py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform active:scale-98 cursor-pointer"
          >
            {loading ? "Saving Details..." : "Save KYC Information"}
          </button>
        </div>
      </form>
    </div>
  );
}
