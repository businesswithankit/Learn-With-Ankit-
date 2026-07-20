import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { PaymentRequest, WithdrawalRequest, UserProfile, RevenueTransaction } from "../types";
import { History, Calendar, CreditCard, ShieldAlert, ArrowUpRight, ArrowDownLeft, MessageSquare, Trash2, Award, Zap } from "lucide-react";

interface HistoryPageProps {
  user: UserProfile;
}

export default function HistoryPage({ user }: HistoryPageProps) {
  const userId = user.userId;
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<RevenueTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<"payments" | "withdrawals" | "transactions">("payments");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Listen to user payment requests
    const qPayments = query(
      collection(db, "payments"),
      where("userId", "==", userId)
    );

    const unsubPayments = onSnapshot(
      qPayments,
      (snapshot) => {
        const list: PaymentRequest[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.hiddenByUser) {
            list.push({ id: doc.id, ...data } as PaymentRequest);
          }
        });
        // Sort in memory by timestamp descending
        list.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tB - tA;
        });
        setPayments(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "payments");
      }
    );

    // Listen to user withdrawal requests
    const qWithdrawals = query(
      collection(db, "withdrawals"),
      where("userId", "==", userId)
    );

    const unsubWithdrawals = onSnapshot(
      qWithdrawals,
      (snapshot) => {
        const list: WithdrawalRequest[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.hiddenByUser) {
            list.push({ id: doc.id, ...data } as WithdrawalRequest);
          }
        });
        // Sort in memory by timestamp descending
        list.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tB - tA;
        });
        setWithdrawals(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "withdrawals");
      }
    );

    // Listen to user purchases/transactions (premium and challenge entries)
    const qTransactions = query(
      collection(db, "revenueTransactions"),
      where("userId", "==", userId)
    );

    const unsubTransactions = onSnapshot(
      qTransactions,
      (snapshot) => {
        const list: RevenueTransaction[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (!data.hiddenByUser) {
            list.push({ id: doc.id, ...data } as RevenueTransaction);
          }
        });
        list.sort((a, b) => {
          const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return tB - tA;
        });
        setTransactions(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "revenueTransactions");
        setLoading(false);
      }
    );

    return () => {
      unsubPayments();
      unsubWithdrawals();
      unsubTransactions();
    };
  }, [userId]);

  const handleDeletePayment = async (id: string, userIdInRecord: string) => {
    if (userIdInRecord !== userId) {
      alert("Unauthorized action. You can only delete your own history entries.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this payment claim history record from your visible list? This will not affect your earnings calculation or status.")) {
      return;
    }
    try {
      await updateDoc(doc(db, "payments", id), { hiddenByUser: true });
      alert("Payment claim history record removed.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete record: " + err.message);
    }
  };

  const handleDeleteWithdrawal = async (id: string, userIdInRecord: string) => {
    if (userIdInRecord !== userId) {
      alert("Unauthorized action. You can only delete your own history entries.");
      return;
    }
    if (!window.confirm("Are you sure you want to remove this withdrawal history record from your visible list? This will not affect your wallet balance or reports.")) {
      return;
    }
    try {
      await updateDoc(doc(db, "withdrawals", id), { hiddenByUser: true });
      alert("Withdrawal history record removed.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete record: " + err.message);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this transaction record from your visible list? This will not affect your membership status or credentials.")) {
      return;
    }
    try {
      await updateDoc(doc(db, "revenueTransactions", id), { hiddenByUser: true });
      alert("Transaction record removed.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete record: " + err.message);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-sans font-semibold text-[10px] uppercase tracking-wider">
            Pending
          </span>
        );
      case "Approved":
      case "Completed":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-sans font-semibold text-[10px] uppercase tracking-wider">
            {status}
          </span>
        );
      case "Rejected":
        return (
          <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400 font-sans font-semibold text-[10px] uppercase tracking-wider">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 font-sans font-semibold text-[10px] uppercase tracking-wider">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center space-x-2.5">
        <History className="w-5.5 h-5.5 text-amber-400" />
        <div>
          <h3 className="text-base font-display font-semibold text-zinc-100">Transaction History Log</h3>
          <p className="text-xs text-zinc-400 font-sans">
            View chronological payment claims and withdrawal records for Affiliate ID: <span className="text-amber-400 font-semibold font-mono">{user.customUserId || user.userId}</span>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950/80 border border-zinc-850 p-1 rounded-xl max-w-md">
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            activeTab === "payments"
              ? "bg-amber-500 text-slate-950 font-extrabold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Payments
        </button>
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            activeTab === "withdrawals"
              ? "bg-amber-500 text-slate-950 font-extrabold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Withdrawals
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex-1 py-2 text-center rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
            activeTab === "transactions"
              ? "bg-amber-500 text-slate-950 font-extrabold"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Transactions
        </button>
      </div>

      {/* Timeline Wrapper */}
      <div className="rounded-2xl glass-panel p-6 border border-zinc-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-amber-500/10 via-amber-500 to-amber-500/10" />

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-zinc-900/20 rounded-xl" />
            ))}
          </div>
        ) : activeTab === "payments" ? (
          payments.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-sans">No payment submissions found.</div>
          ) : (
            <div className="relative border-l border-zinc-800/80 ml-3.5 pl-6 space-y-6">
              {payments.map((p) => (
                <div key={p.id} className="relative">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-slate-950 border-2 border-amber-500 flex items-center justify-center text-[8px] font-sans">
                    <ArrowDownLeft className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  </span>

                  <div className="bg-zinc-950/45 border border-zinc-900 rounded-xl p-4 space-y-2.5 shadow-md">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Submitted on {p.date}</span>
                        </span>
                        <h4 className="text-sm font-semibold text-zinc-100 mt-1">
                          Payment Claim of ₹{p.totalAmount.toLocaleString("en-IN")}
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-sans">Generated {p.totalLeads} affiliate leads</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2 shrink-0">
                        {renderStatusBadge(p.status)}
                        <button
                          onClick={() => handleDeletePayment(p.id, p.userId)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/20 transition-all duration-300 cursor-pointer"
                          title="Delete History Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {(p.adminRemark || p.txId) && (
                      <div className="pt-2 border-t border-zinc-900/60 flex flex-col gap-1 text-[10px] text-zinc-500 font-sans">
                        {p.txId && (
                          <span>
                            Transaction ID: <strong className="font-mono text-zinc-400">{p.txId}</strong>
                          </span>
                        )}
                        {p.adminRemark && (
                          <span className="flex items-center space-x-1.5 text-zinc-400 italic">
                            <MessageSquare className="w-3 h-3 text-zinc-600" />
                            <span>Remark: "{p.adminRemark}"</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === "withdrawals" ? (
          withdrawals.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-sans">No withdrawal requests found.</div>
          ) : (
            <div className="relative border-l border-zinc-800/80 ml-3.5 pl-6 space-y-6">
              {withdrawals.map((w) => (
                <div key={w.id} className="relative">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-slate-950 border-2 border-red-500 flex items-center justify-center text-[8px] font-sans">
                    <ArrowUpRight className="w-2.5 h-2.5 text-red-400 shrink-0" />
                  </span>

                  <div className="bg-zinc-950/45 border border-zinc-900 rounded-xl p-4 space-y-2.5 shadow-md">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                          <span>Initiated on {w.date}</span>
                        </span>
                        <h4 className="text-sm font-semibold text-zinc-100 mt-1">
                          Withdrawal Request of ₹{w.withdrawalAmount.toLocaleString("en-IN")}
                        </h4>
                        <p className="text-[10px] text-zinc-400 font-mono truncate">Recipient UPI: {w.upiId}</p>
                        {w.withdrawalType === "Fast" && (
                          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-mono mt-1">
                            <Zap className="w-3 h-3" />
                            <span>Fast Withdrawal (Fee: ₹{w.feeDeducted || 0})</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end space-y-2 shrink-0">
                        {renderStatusBadge(w.status)}
                        <button
                          onClick={() => handleDeleteWithdrawal(w.id, w.userId)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/20 transition-all duration-300 cursor-pointer"
                          title="Delete History Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {w.adminRemark && (
                      <div className="pt-2 border-t border-zinc-900/60 flex items-center space-x-1.5 text-[10px] text-zinc-400 italic font-sans">
                        <MessageSquare className="w-3 h-3 text-zinc-600" />
                        <span>Admin Response: "{w.adminRemark}"</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          transactions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-sans">No transactions found.</div>
          ) : (
            <div className="relative border-l border-zinc-800/80 ml-3.5 pl-6 space-y-6">
              {transactions.map((tx) => (
                <div key={tx.id} className="relative">
                  {/* Timeline bullet */}
                  <span className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-slate-950 border-2 border-amber-500 flex items-center justify-center text-[8px] font-sans">
                    <CreditCard className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  </span>

                  <div className="bg-zinc-950/45 border border-zinc-900 rounded-xl p-4 space-y-2.5 shadow-md">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                          <span>
                            {tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000).toLocaleString("en-IN") : "Just now"}
                          </span>
                        </span>
                        <h4 className="text-sm font-semibold text-zinc-100 mt-1">
                          {tx.type === "premium_purchase" ? "👑 Premium Membership" : "🎯 Challenge Entry Fee"}
                        </h4>
                        <p className="text-[11px] text-zinc-400 font-sans">{tx.description}</p>
                      </div>
                      <div className="flex flex-col items-end space-y-2 shrink-0">
                        <span className="text-sm font-bold text-red-400 font-mono">-₹{tx.amount}</span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/20 transition-all duration-300 cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
