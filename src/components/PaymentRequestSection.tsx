import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile } from "../types";
import WalletCard from "./WalletCard";
import { Sparkles, CheckCircle2, AlertCircle, FileText, TrendingUp } from "lucide-react";

interface PaymentRequestSectionProps {
  user: UserProfile;
}

export default function PaymentRequestSection({ user }: PaymentRequestSectionProps) {
  const [totalLeads, setTotalLeads] = useState<number | "">("");
  const [totalAmount, setTotalAmount] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totalLeads || !totalAmount || totalLeads <= 0 || totalAmount <= 0) {
      setError("Please enter valid quantities for leads and amount.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        userId: user.userId,
        username: user.username,
        date: new Date().toLocaleDateString("en-IN"),
        email: user.email,
        phone: user.phone || "",
        totalLeads: Number(totalLeads),
        totalAmount: Number(totalAmount),
        status: "Pending",
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, "payments"), payload);

      // Create a notification for the admin or system log
      await addDoc(collection(db, "notifications"), {
        userId: "all", // admins monitor system notifications
        title: "New Payment Request",
        body: `${user.username} submitted a payment request of ₹${Number(totalAmount).toLocaleString("en-IN")}`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "payment",
      });

      setSuccess(true);
      setTotalLeads("");
      setTotalAmount("");
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "payments");
      setError("Failed to submit request. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Balance Card at top */}
      <div className="flex justify-center">
        <WalletCard balance={user.walletBalance} username={user.username} />
      </div>

      <div className="w-full max-w-2xl mx-auto rounded-2xl glass-panel p-6 border border-zinc-800 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-amber-500/10 via-amber-500 to-amber-500/10" />

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-display font-semibold text-zinc-100">Submit Leads & Earnings Request</h3>
            <p className="text-xs text-zinc-400">Request payout credit for leads you generated.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Request submitted successfully! Payout is currently pending admin review.</span>
            </div>
          )}

          {/* Read Only/Pre-filled Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Applicant Name</label>
              <div className="bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 px-3.5 text-sm text-zinc-400 font-medium">
                {user.username}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Email Address</label>
              <div className="bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 px-3.5 text-sm text-zinc-400 truncate">
                {user.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Mobile Number</label>
              <div className="bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 px-3.5 text-sm text-zinc-400">
                {user.phone || "Not Set"}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">Request Date</label>
              <div className="bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 px-3.5 text-sm text-zinc-400 font-mono">
                {new Date().toLocaleDateString("en-IN")}
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-900 pt-4">
            <div>
              <label htmlFor="totalLeads" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">
                Total Leads Generated
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Sparkles className="w-4 h-4 text-amber-500/50" />
                </div>
                <input
                  id="totalLeads"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 25"
                  value={totalLeads}
                  onChange={(e) => setTotalLeads(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans font-medium"
                />
              </div>
            </div>

            <div>
              <label htmlFor="totalAmount" className="block text-xs text-zinc-400 font-medium mb-1.5 uppercase tracking-wider">
                Total Amount Requested (₹)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <span className="text-sm font-semibold text-amber-500/60">₹</span>
                </div>
                <input
                  id="totalAmount"
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5000"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans font-medium"
                />
              </div>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 font-display font-semibold text-slate-950 text-sm py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform active:scale-98 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{loading ? "Submitting Request..." : "Submit Payment Request"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
