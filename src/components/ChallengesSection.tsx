import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, doc, runTransaction, onSnapshot, query, getDocs, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, Challenge, ChallengeProgress, ChallengeLead } from "../types";
import { Trophy, Calendar, Award, Hourglass, Plus, Image, CheckCircle, ArrowRight, ShieldCheck, ClipboardCheck, Sparkles, AlertTriangle, FileText, X, Lock, CreditCard } from "lucide-react";

const canManageChallenges = (u: UserProfile) => {
  return u.role === "founder" || u.role === "admin" || (u.role === "co-founder" && u.coFounderPermissions?.manageChallenges === true);
};

interface ChallengesSectionProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void;
}

function Countdown({ endDateStr }: { endDateStr: string }) {
  const end = new Date(endDateStr).getTime();
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Challenge Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${days}d ${hours}h ${minutes}m remaining`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  }, [endDateStr]);

  return (
    <span className="flex items-center space-x-1 text-[11px] font-mono font-semibold text-amber-400">
      <Hourglass className="w-3.5 h-3.5 animate-spin" />
      <span>{timeLeft}</span>
    </span>
  );
}

export default function ChallengesSection({ user, onUpdateUser }: ChallengesSectionProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [progresses, setProgresses] = useState<{ [challengeId: string]: ChallengeProgress }>({});
  const [loading, setLoading] = useState(true);

  // Admin form state
  const [editChallengeId, setEditChallengeId] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState("");
  const [challengeName, setChallengeName] = useState("");
  const [description, setDescription] = useState("");
  const [rewardAmount, setRewardAmount] = useState<number | "">("");
  const [target, setTarget] = useState<number | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [entryFee, setEntryFee] = useState<number | "">("");
  const [adminSuccess, setAdminSuccess] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    // Listen to active challenges
    const unsubscribeChallenges = onSnapshot(
      collection(db, "challenges"),
      (snapshot) => {
        const list: Challenge[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Challenge);
        });
        setChallenges(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "challenges");
      }
    );

    // Listen to current user's challenge progresses
    const qProgress = query(
      collection(db, "challengeProgress"),
      where("userId", "==", user.userId)
    );

    const unsubscribeProgress = onSnapshot(
      qProgress,
      (snapshot) => {
        const map: { [challengeId: string]: ChallengeProgress } = {};
        snapshot.forEach((doc) => {
          const p = doc.data() as ChallengeProgress;
          map[p.challengeId] = { id: doc.id, ...p };
        });
        setProgresses(map);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "challengeProgress");
      }
    );

    return () => {
      unsubscribeChallenges();
      unsubscribeProgress();
    };
  }, [user.userId]);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeName.trim() || !rewardAmount || !target || !startDate || !endDate) {
      setAdminError("Please fill in all required challenge details.");
      return;
    }

    try {
      const banner = bannerImage.trim() || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop";
      
      if (editChallengeId) {
        // Edit Mode
        const { doc, updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "challenges", editChallengeId), {
          bannerImage: banner,
          challengeName: challengeName.trim(),
          description: description.trim(),
          rewardAmount: Number(rewardAmount),
          target: Number(target),
          startDate,
          endDate,
          isPaid: isPaid,
          entryFee: isPaid ? Number(entryFee) : 0,
        });

        setAdminSuccess(true);
        setEditChallengeId(null);
      } else {
        // Create Mode
        await addDoc(collection(db, "challenges"), {
          bannerImage: banner,
          challengeName: challengeName.trim(),
          description: description.trim(),
          rewardAmount: Number(rewardAmount),
          target: Number(target),
          startDate,
          endDate,
          isPaid: isPaid,
          entryFee: isPaid ? Number(entryFee) : 0,
          createdAt: serverTimestamp(),
        });

        // Notify all users about the new challenge
        await addDoc(collection(db, "notifications"), {
          userId: "all",
          title: "🔥 New Challenge Live!",
          body: `Join the "${challengeName}" challenge and win ₹${Number(rewardAmount).toLocaleString("en-IN")}!`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "challenge",
        });

        setAdminSuccess(true);
      }

      setChallengeName("");
      setBannerImage("");
      setDescription("");
      setRewardAmount("");
      setTarget("");
      setStartDate("");
      setEndDate("");
      setIsPaid(false);
      setEntryFee("");
      setAdminError(null);
      setTimeout(() => setAdminSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "challenges");
      setAdminError("Failed to save challenge.");
    }
  };

  const handleStartEditChallenge = (challenge: Challenge) => {
    setEditChallengeId(challenge.id);
    setChallengeName(challenge.challengeName);
    setBannerImage(challenge.bannerImage);
    setDescription(challenge.description);
    setRewardAmount(challenge.rewardAmount);
    setTarget(challenge.target);
    setStartDate(challenge.startDate);
    setEndDate(challenge.endDate);
    setIsPaid(challenge.isPaid || false);
    setEntryFee(challenge.entryFee || "");
    // Scroll smoothly to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    if (!window.confirm("Are you absolutely sure you want to delete this challenge? This action cannot be undone.")) {
      return;
    }

    try {
      const { doc, deleteDoc } = await import("firebase/firestore");
      await deleteDoc(doc(db, "challenges", challengeId));
      alert("Challenge deleted successfully.");
    } catch (err) {
      console.error("Delete challenge error:", err);
      alert("Failed to delete challenge.");
    }
  };

  const handlePayEntryFee = async (challenge: Challenge) => {
    if (!challenge.entryFee || challenge.entryFee <= 0) return;
    
    if (user.walletBalance < challenge.entryFee) {
      alert(`Insufficient wallet balance. You need ₹${challenge.entryFee} to enter this challenge, but your current balance is ₹${user.walletBalance.toLocaleString("en-IN")}.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to pay a ₹${challenge.entryFee} entry fee to enter the "${challenge.challengeName}" challenge? This amount will be deducted from your wallet balance instantly.`)) {
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, "users", user.userId);
      const progressId = `${challenge.id}_${user.userId}`;
      const progressRef = doc(db, "challengeProgress", progressId);

      await runTransaction(db, async (transaction) => {
        // --- STEP 1: READS ---
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User document not found.");
        }
        
        const progSnap = await transaction.get(progressRef);
        if (progSnap.exists() && progSnap.data()?.status === "active") {
          throw new Error("You have already entered this challenge!");
        }

        const userData = userSnap.data() as UserProfile;
        const currentBalance = userData.walletBalance || 0;

        if (currentBalance < challenge.entryFee!) {
          throw new Error(`Insufficient wallet balance (₹${currentBalance}).`);
        }

        // --- STEP 2: WRITES ---
        const nextBalance = currentBalance - challenge.entryFee!;
        transaction.update(userRef, {
          walletBalance: nextBalance,
        });

        transaction.set(progressRef, {
          userId: user.userId,
          challengeId: challenge.id,
          completedCount: 0,
          target: challenge.target,
          status: "active",
          rewardStatus: "Pending",
          rewardClaimed: false,
          challengeName: challenge.challengeName,
          rewardAmount: challenge.rewardAmount,
          username: user.username,
          isPaidEntry: true,
          entryFeePaid: challenge.entryFee,
        });

        // Add user alert notification
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
          userId: user.userId,
          title: "🏆 Registered for Challenge!",
          body: `You successfully paid the entry fee of ₹${challenge.entryFee} and registered for "${challenge.challengeName}". Your progress is now live!`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "challenge",
        });
      });

      // Track platform revenue atomically
      const { addPlatformRevenue } = await import("../utils/revenue");
      await addPlatformRevenue(
        user.userId,
        user.username,
        challenge.entryFee,
        "challenge_entry",
        `Entry fee for challenge: ${challenge.challengeName}`
      );

      // Local state update
      onUpdateUser({
        walletBalance: user.walletBalance - challenge.entryFee,
      });

      alert(`🎉 Success! You have successfully registered for the "${challenge.challengeName}" challenge.`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to process challenge entry fee payment.");
    } finally {
      setLoading(false);
    }
  };

  // Lead submission function is removed as challenge progresses are now updated automatically via Approved Payment Requests.



  return (
    <div className="space-y-10">
      {/* Admin Panel - Challenge Publisher */}
      {canManageChallenges(user) && (
        <div className="rounded-2xl glass-panel p-6 border border-zinc-800 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-blue-500/10 via-blue-500 to-blue-500/10" />
          
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-semibold text-zinc-100">
                {editChallengeId ? "Edit Target Challenge" : "Create New Target Challenge"}
              </h3>
              <p className="text-xs text-zinc-400">
                {editChallengeId ? "Modify and update target parameters." : "Deploy custom targets and rewards for active users."}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateChallenge} className="space-y-4">
            {adminError && (
              <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-xl">
                {adminError}
              </div>
            )}
            {adminSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl">
                {editChallengeId ? "Challenge updated successfully!" : "Challenge published successfully to all dashboards!"}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Challenge Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. June Lead Storm"
                  value={challengeName}
                  onChange={(e) => setChallengeName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-blue-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Banner Image URL</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Image className="w-4 h-4" />
                  </span>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={bannerImage}
                    onChange={(e) => setBannerImage(e.target.value)}
                    className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-3.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Description & Rules</label>
              <textarea
                placeholder="Complete 50 leads to claim the ₹2000 cash prize bonus..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-blue-500/50 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Reward Amount (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="2500"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-blue-500/50 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Target (Leads/Units)</label>
                <input
                  type="number"
                  required
                  placeholder="50"
                  value={target}
                  onChange={(e) => setTarget(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-blue-500/50 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 focus:outline-hidden focus:border-blue-500/50 transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 focus:outline-hidden focus:border-blue-500/50 transition-colors font-mono"
                />
              </div>
            </div>

            {/* Paid Challenge configuration row */}
            <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans text-xs text-zinc-300">
              <div className="space-y-1">
                <span className="font-bold text-zinc-100 uppercase tracking-wider text-[10px] block text-amber-500">Paid Entrance Option</span>
                <p className="text-[11px] text-zinc-400">Require users to pay an upfront wallet entry fee to participate in this bonus challenge scheme.</p>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="isPaidChallenge"
                    checked={isPaid}
                    onChange={(e) => {
                      setIsPaid(e.target.checked);
                      if (!e.target.checked) setEntryFee("");
                    }}
                    className="rounded border-zinc-800 text-blue-500 focus:ring-0 bg-slate-950"
                  />
                  <label htmlFor="isPaidChallenge" className="font-semibold uppercase tracking-wider text-[10px] text-zinc-200">Require Entry Fee</label>
                </div>

                {isPaid && (
                  <div className="flex items-center space-x-2 animate-fade-in">
                    <span className="text-zinc-500 font-mono">₹</span>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Entry Fee"
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value !== "" ? Number(e.target.value) : "")}
                      className="w-24 bg-slate-950 border border-zinc-800 rounded-xl py-1.5 px-3.5 text-xs text-zinc-200 font-mono text-center focus:outline-hidden focus:border-blue-500/50"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              {editChallengeId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditChallengeId(null);
                    setChallengeName("");
                    setBannerImage("");
                    setDescription("");
                    setRewardAmount("");
                    setTarget("");
                    setStartDate("");
                    setEndDate("");
                    setIsPaid(false);
                    setEntryFee("");
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 font-display font-semibold text-zinc-400 text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 font-display font-semibold text-white text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all transform active:scale-98 cursor-pointer"
              >
                {editChallengeId ? "Update Challenge" : "Publish Challenge"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Challenge Listing Grid */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5">
          <Trophy className="w-5.5 h-5.5 text-amber-400" />
          <div>
            <h3 className="text-base font-display font-semibold text-zinc-100">Active Incentive Challenges</h3>
            <p className="text-xs text-zinc-400">Complete performance milestones and secure high-value cash bonuses.</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-80 bg-zinc-900/30 rounded-2xl border border-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : challenges.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800/80 p-12 text-center flex flex-col items-center justify-center space-y-3 bg-slate-950/10">
            <Award className="w-12 h-12 text-zinc-700 stroke-[1.5]" />
            <p className="text-sm text-zinc-500 font-sans">No challenges are currently live. Stay tuned!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {challenges.map((challenge) => {
              const prog = (progresses[challenge.id] || {
                completedCount: 0,
                target: challenge.target,
                rewardClaimed: false,
                status: "active",
              }) as ChallengeProgress;

              const pct = Math.min(Math.round((prog.completedCount / challenge.target) * 100), 100);
              const isFinished = prog.completedCount >= challenge.target;
              const isExpired = new Date(challenge.endDate).getTime() < Date.now();
              const isPaidAndNotJoined = challenge.isPaid && !progresses[challenge.id];

              // Status tracking details
              let statusLabel = "In Progress";
              let statusClass = "bg-amber-500/10 border-amber-500/20 text-amber-400";
              
              if (isPaidAndNotJoined) {
                statusLabel = `₹${challenge.entryFee} Entry Fee`;
                statusClass = "bg-purple-500/20 border-purple-500/40 text-purple-400 font-bold";
              } else if (prog.status === "completed" || prog.rewardStatus === "Pending") {
                statusLabel = "Pending Approval";
                statusClass = "bg-blue-500/10 border-blue-500/20 text-blue-400";
              } else if (prog.status === "approved" || prog.rewardStatus === "Approved" || prog.status === "claimed") {
                statusLabel = "Approved & Credited";
                statusClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
              } else if (prog.status === "rejected" || prog.rewardStatus === "Rejected") {
                statusLabel = "Rejected";
                statusClass = "bg-red-500/10 border-red-500/20 text-red-400";
              } else if (isExpired) {
                statusLabel = "Expired";
                statusClass = "bg-zinc-800 border-zinc-700 text-zinc-500";
              }

              return (
                <div
                  key={challenge.id}
                  className="rounded-2xl bg-zinc-900/20 border border-zinc-800/80 overflow-hidden shadow-xl flex flex-col justify-between group transition-all duration-300 hover:border-zinc-700/80"
                >
                  {/* Card Banner */}
                  <div className="h-32 w-full relative overflow-hidden bg-zinc-950">
                    <img
                      src={challenge.bannerImage}
                      alt={challenge.challengeName}
                      className="w-full h-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                    
                    {/* Floating Countdown */}
                    <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-zinc-800">
                      <Countdown endDateStr={challenge.endDate} />
                    </div>

                    <div className="absolute bottom-3 left-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] uppercase tracking-widest text-amber-400 font-mono">LWA BONUS SCHEME</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono border ${statusClass}`}>
                          {statusLabel.toUpperCase()}
                        </span>
                      </div>
                      <h4 className="text-base font-display font-bold text-zinc-100 leading-tight mt-1">{challenge.challengeName}</h4>
                    </div>
                  </div>

                  {/* Description & Targets */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-zinc-400 leading-relaxed font-sans">{challenge.description}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Validity: {challenge.startDate} to {challenge.endDate}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center bg-slate-950/40 rounded-xl p-3 border border-zinc-900/60 font-sans">
                      <div>
                        <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">Reward Bonus</span>
                        <p className="text-sm font-bold text-emerald-400 font-display">₹{challenge.rewardAmount.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="border-l border-zinc-800">
                        <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">Required Target</span>
                        <p className="text-sm font-bold text-zinc-300">{challenge.target} Leads</p>
                      </div>
                    </div>

                    {/* Progress indicators */}
                    <div className="space-y-3 font-sans">
                      {isPaidAndNotJoined ? (
                        <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-2 text-center">
                          <div className="flex items-center justify-center space-x-1.5 text-purple-400 font-semibold text-xs uppercase tracking-wider">
                            <Lock className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                            <span>Locked • Pay Entry Fee</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 leading-relaxed">
                            Pay entry fee of <strong className="text-zinc-200">₹{challenge.entryFee}</strong> to unlock this bonus scheme and eligible rewards.
                          </p>
                          <button
                            onClick={() => handlePayEntryFee(challenge)}
                            disabled={isExpired}
                            className="w-full py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 text-white font-bold text-[10px] rounded-lg transition-all shadow-md cursor-pointer uppercase tracking-wider flex items-center justify-center space-x-1"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Activate (₹{challenge.entryFee})</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-500 font-mono">Completed / Target</span>
                            <span className="text-zinc-300 font-semibold font-mono">
                              {prog.completedCount} / {challenge.target} ({pct}%)
                            </span>
                          </div>
                          
                          <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isFinished ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          
                          {/* Display Admin Reason for Rejection if exists */}
                          {(prog.status === "rejected" || prog.rewardStatus === "Rejected") && prog.adminReason && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/25 rounded-lg text-[10px] text-red-400 flex items-start space-x-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-semibold block uppercase tracking-wider text-[8px] text-red-500">Rejection Reason</span>
                                <span className="italic">"{prog.adminReason}"</span>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Button Footer */}
                  <div className="px-5 pb-5 border-t border-zinc-800/40 pt-4 bg-slate-950/20">
                    {prog.rewardStatus === "Approved" || prog.status === "approved" || prog.status === "claimed" ? (
                      <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs py-2.5 rounded-xl font-display font-semibold flex items-center justify-center space-x-2">
                        <ShieldCheck className="w-4 h-4" />
                        <span>REWARD COMPLETED & CREDITED</span>
                      </div>
                    ) : prog.rewardStatus === "Pending" || prog.status === "completed" ? (
                      <div className="w-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs py-2.5 rounded-xl font-display font-semibold flex items-center justify-center space-x-2">
                        <Hourglass className="w-4 h-4 animate-spin" />
                        <span>PENDING ADMIN APPROVAL</span>
                      </div>
                    ) : isExpired ? (
                      <div className="w-full bg-zinc-900 border border-zinc-800 text-zinc-500 text-xs py-2.5 rounded-xl font-display font-medium flex items-center justify-center">
                        <span>CHALLENGE EXPIRED</span>
                      </div>
                    ) : (
                      <div className="w-full bg-amber-500/5 border border-amber-500/10 text-amber-500/90 text-xs py-2.5 rounded-xl font-display font-semibold flex items-center justify-center space-x-2">
                        <span>🚀 CHALLENGE ACTIVE</span>
                      </div>
                    )}

                    {canManageChallenges(user) && (
                      <div className="flex space-x-2 mt-3 pt-3 border-t border-zinc-800/40">
                        <button
                          onClick={() => handleStartEditChallenge(challenge)}
                          className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Edit Challenge
                        </button>
                        <button
                          onClick={() => handleDeleteChallenge(challenge.id)}
                          className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer text-center"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
