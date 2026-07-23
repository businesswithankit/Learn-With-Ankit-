import React, { useState, useEffect } from "react";
import { User, Mail, Phone, MapPin, Calendar, Award, Shield, DollarSign, Wallet, CheckCircle, Edit, RefreshCw, Lock, Zap, Check, Coins, ShieldCheck, Key, Share2, Briefcase, Building, Send, Clock, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { doc, updateDoc, collection, query, onSnapshot, runTransaction, serverTimestamp, addDoc, getDoc, getDocs, where, limit, orderBy } from "firebase/firestore";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, MembershipPlan, IndustryEarningRecord } from "../types";
import { hashPin } from "../utils/pin";
import SocialMediaIcons from "./SocialMediaIcons";
import { logAuditAction } from "../utils/audit";


interface ProfileSectionProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void;
}

export default function ProfileSection({ user, onUpdateUser }: ProfileSectionProps) {
  const [username, setUsername] = useState(user.username);
  const [phone, setPhone] = useState(user.phone || "");
  const [state, setState] = useState(user.state || "");
  const [profilePic, setProfilePic] = useState(user.profilePic || "");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdError, setPwdError] = useState("");

  // Premium Plans List
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null);

  // PIN states
  const [pinSetupInput, setPinSetupInput] = useState("");
  const [pinSetupConfirm, setPinSetupConfirm] = useState("");
  const [currentPinInput, setCurrentPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmNewPinInput, setConfirmNewPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState("");
  const [pinError, setPinError] = useState("");

  // Purchase state
  const [purchasePin, setPurchasePin] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [badges, setBadges] = useState<any[]>([]);

  // Industry Earnings states
  const [iePlatformName, setIePlatformName] = useState("");
  const [ieStartDate, setIeStartDate] = useState("");
  const [ieEndDate, setIeEndDate] = useState("");
  const [ieAmount, setIeAmount] = useState<number | "">("");
  const [ieProofUrl, setIeProofUrl] = useState("");
  const [ieLoading, setIeLoading] = useState(false);
  const [ieSuccess, setIeSuccess] = useState("");
  const [ieError, setIeError] = useState("");
  const [industryRecords, setIndustryRecords] = useState<IndustryEarningRecord[]>([]);

  // Realtime subscription for user's Industry Earnings requests
  useEffect(() => {
    if (!user?.userId) return;
    const q = query(
      collection(db, "industryEarningsRequests"),
      where("userId", "==", user.userId)
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: IndustryEarningRecord[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as IndustryEarningRecord);
        });
        list.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
        setIndustryRecords(list);
      },
      (err) => {
        console.warn("Error fetching user industry earnings requests:", err);
      }
    );
    return () => unsub();
  }, [user?.userId]);

  const handleSubmitIndustryEarning = async (e: React.FormEvent) => {
    e.preventDefault();
    setIeError("");
    setIeSuccess("");

    if (!iePlatformName.trim()) {
      setIeError("Please enter the platform name.");
      return;
    }
    if (!ieStartDate || !ieEndDate) {
      setIeError("Please select both start and end dates.");
      return;
    }
    if (!ieAmount || Number(ieAmount) <= 0) {
      setIeError("Please enter a valid earnings amount greater than ₹0.");
      return;
    }

    setIeLoading(true);
    try {
      const numAmount = Number(ieAmount);
      const payload = {
        userId: user.userId,
        customUserId: user.customUserId || user.userId,
        username: user.username,
        email: user.email || "",
        phone: user.phone || "",
        platformName: iePlatformName.trim(),
        startDate: ieStartDate,
        endDate: ieEndDate,
        amount: numAmount,
        proofUrl: ieProofUrl.trim() || "",
        status: "Pending",
        timestamp: serverTimestamp(),
        submittedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "industryEarningsRequests"), payload);

      // User notification
      await addDoc(collection(db, "notifications"), {
        userId: user.userId,
        title: "Industry Earnings Request Submitted",
        body: `Your request for ${iePlatformName.trim()} (₹${numAmount.toLocaleString('en-IN')}) has been submitted for admin approval.`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      // Admin notification
      await addDoc(collection(db, "notifications"), {
        userId: "all",
        title: "New Industry Earnings Request",
        body: `${user.username} submitted ₹${numAmount.toLocaleString('en-IN')} from platform "${iePlatformName.trim()}" for verification.`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      setIeSuccess("Industry Earnings request submitted successfully! Pending admin approval.");
      setIePlatformName("");
      setIeStartDate("");
      setIeEndDate("");
      setIeAmount("");
      setIeProofUrl("");
    } catch (err: any) {
      console.error("Error submitting Industry Earnings:", err);
      setIeError(err.message || "Failed to submit Industry Earnings.");
    } finally {
      setIeLoading(false);
    }
  };

  // Fetch Premium Membership plans
  useEffect(() => {
    const unsubPlans = onSnapshot(collection(db, "membershipPlans"), (snapshot) => {
      const list: MembershipPlan[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MembershipPlan);
      });
      setPlans(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "membershipPlans"));

    return () => unsubPlans();
  }, []);

  // Fetch Badges collection
  useEffect(() => {
    const q = query(collection(db, "badges"), orderBy("displayOrder", "asc"));
    const unsubBadges = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setBadges(list);
    }, (err) => {
      console.warn("Error fetching badges in profile:", err);
    });

    return () => unsubBadges();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdLoading(true);
    setPwdSuccess("");
    setPwdError("");

    if (newPassword.length < 6) {
      setPwdError("New password must be at least 6 characters long.");
      setPwdLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      setPwdLoading(false);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setPwdError("No authenticated user session found.");
      setPwdLoading(false);
      return;
    }

    try {
      // 1. Reauthenticate first
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // 2. Update password
      await updatePassword(currentUser, newPassword);

      setPwdSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || "Failed to update password.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        errMsg = "Incorrect current password.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "The new password is too weak.";
      }
      setPwdError(errMsg);
    } finally {
      setPwdLoading(false);
    }
  };

  // Dynamic Badge calculation based on cumulative total earnings
  const getBadgeDetails = (earnings: number) => {
    const activeBadges = badges.filter(b => b.status === "Active");
    if (activeBadges.length > 0) {
      const qualified = [...activeBadges]
        .filter(b => earnings >= (b.minEarnings || 0))
        .sort((a, b) => (b.minEarnings || 0) - (a.minEarnings || 0));
      if (qualified.length > 0) {
        const best = qualified[0];
        return {
          tier: best.name,
          color: best.color || "from-amber-600 via-amber-700 to-amber-800 text-amber-200 border-amber-800/40",
          description: best.description || `Milestone of ₹${best.minEarnings}+`,
          icon: best.icon || "🏅",
        };
      }
    }

    if (earnings >= 200000) {
      return {
        tier: "Diamond",
        color: "from-cyan-400 via-blue-500 to-indigo-600 text-cyan-200 border-cyan-400/40",
        description: "Ultimate Elite Performer - Milestone of ₹2,00,000+",
        icon: "💎",
      };
    } else if (earnings >= 50000) {
      return {
        tier: "Gold",
        color: "from-amber-300 via-yellow-500 to-yellow-600 text-amber-200 border-yellow-400/40",
        description: "Master Earner Legend - Milestone of ₹50,000+",
        icon: "👑",
      };
    } else if (earnings >= 10000) {
      return {
        tier: "Silver",
        color: "from-slate-300 via-slate-400 to-zinc-500 text-slate-100 border-slate-300/40",
        description: "Rising Professional Status - Milestone of ₹10,000+",
        icon: "🛡️",
      };
    } else {
      return {
        tier: "Bronze",
        color: "from-amber-600 via-amber-700 to-amber-800 text-amber-200 border-amber-800/40",
        description: "Initial Starter Affiliate - Milestone of ₹0+",
        icon: "🥉",
      };
    }
  };

  const getBadgeByName = (name: string) => {
    const found = badges.find(b => b.name === name);
    if (found) {
      return {
        tier: found.name,
        color: found.color || "from-amber-600 via-amber-700 to-amber-800 text-amber-200 border-amber-800/40",
        description: found.description || `Milestone of ₹${found.minEarnings}+`,
        icon: found.icon || "🏅"
      };
    }
    return null;
  };

  const rawBadge = getBadgeDetails(user.totalEarnings || 0);
  const matchedBadge = user.badge ? getBadgeByName(user.badge) : null;
  const badge = matchedBadge || {
    ...rawBadge,
    tier: (user as any).customBadge || user.badge || rawBadge.tier,
    description: (user as any).customBadge ? `Custom achievement level specified by Administrator: ${(user as any).customBadge}` : rawBadge.description
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const userRef = doc(db, "users", user.userId);
      const payload = {
        username: username.trim(),
        phone: phone.trim(),
        state: state.trim(),
        profilePic: profilePic.trim() || null,
      };

      await updateDoc(userRef, payload);
      onUpdateUser(payload);

      setSuccess(true);
      setEditing(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.userId}`);
    } finally {
      setLoading(false);
    }
  };

  // --- WALLET SECURITY PIN HANDLERS ---
  const handleSetWalletPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError("");
    setPinSuccess("");
    try {
      if (pinSetupInput.length !== 4 || isNaN(Number(pinSetupInput))) {
        throw new Error("PIN must be exactly 4 digits.");
      }
      if (pinSetupInput !== pinSetupConfirm) {
        throw new Error("Confirmation PIN does not match.");
      }
      const hashed = await hashPin(pinSetupInput);
      const userRef = doc(db, "users", user.userId);
      await updateDoc(userRef, { walletPinHash: hashed });
      onUpdateUser({ walletPinHash: hashed });
      setPinSuccess("Wallet PIN has been set up successfully!");
      setPinSetupInput("");
      setPinSetupConfirm("");
    } catch (err: any) {
      setPinError(err.message || "Failed to set up PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleChangeWalletPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinLoading(true);
    setPinError("");
    setPinSuccess("");
    try {
      if (newPinInput.length !== 4 || isNaN(Number(newPinInput))) {
        throw new Error("New PIN must be exactly 4 digits.");
      }
      if (newPinInput !== confirmNewPinInput) {
        throw new Error("New PINs do not match.");
      }
      const currentHashed = await hashPin(currentPinInput);
      if (currentHashed !== user.walletPinHash) {
        throw new Error("Incorrect current Wallet PIN.");
      }
      const hashedNew = await hashPin(newPinInput);
      const userRef = doc(db, "users", user.userId);
      await updateDoc(userRef, { walletPinHash: hashedNew });
      onUpdateUser({ walletPinHash: hashedNew });
      setPinSuccess("Wallet PIN has been changed successfully!");
      setCurrentPinInput("");
      setNewPinInput("");
      setConfirmNewPinInput("");
    } catch (err: any) {
      setPinError(err.message || "Failed to change PIN.");
    } finally {
      setPinLoading(false);
    }
  };

  // --- PREMIUM PURCHASE ATOMIC TRANSACTION ---
  const handleBuyPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) {
      setPurchaseError("Please select a premium plan first.");
      return;
    }
    setPurchaseLoading(true);
    setPurchaseError("");
    setPurchaseSuccess("");

    try {
      if (!user.walletPinHash) {
        throw new Error("Please set up your Wallet PIN first in the security section below.");
      }
      if (purchasePin.length !== 4 || isNaN(Number(purchasePin))) {
        throw new Error("PIN must be exactly 4 digits.");
      }
      const hashedInput = await hashPin(purchasePin);
      if (hashedInput !== user.walletPinHash) {
        throw new Error("Incorrect Wallet PIN. Please try again.");
      }

      const userRef = doc(db, "users", user.userId);
      const revenueRef = doc(db, "settings", "revenue");
      const notifRef = doc(collection(db, "notifications"));

      await runTransaction(db, async (transaction) => {
        // --- READ ALL REQUIRED DOCUMENTS FIRST ---
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User profile not found.");
        }
        const userData = userSnap.data();
        const currentBalance = userData.walletBalance || 0;

        // Prevent Duplicate/Double Purchase
        if (userData.isPremium) {
          const expiry = userData.premiumExpiryDate;
          if (expiry === "Lifetime") {
            throw new Error("You already have an active Lifetime Premium Membership.");
          } else if (expiry) {
            const expiryTime = new Date(expiry).getTime();
            if (expiryTime > Date.now()) {
              throw new Error(`You already have an active Premium Membership until ${new Date(expiry).toLocaleDateString("en-IN")}.`);
            }
          }
        }

        if (currentBalance < selectedPlan.price) {
          throw new Error(`Insufficient wallet balance. You need ₹${selectedPlan.price.toLocaleString("en-IN")} but have ₹${currentBalance.toLocaleString("en-IN")}.`);
        }

        const revSnap = await transaction.get(revenueRef);

        // --- EXECUTE ALL WRITES AFTER ALL READS ---
        const now = new Date();
        let expiryString = "Never";
        let premiumExpiryVal: any = "Lifetime";
        if (!selectedPlan.isLifetime) {
          const duration = selectedPlan.durationMonths || 1;
          const expiryDate = new Date(now.setMonth(now.getMonth() + duration));
          expiryString = expiryDate.toLocaleDateString("en-IN");
          premiumExpiryVal = expiryDate.toISOString();
        }

        const newBalance = currentBalance - selectedPlan.price;
        transaction.update(userRef, {
          walletBalance: newBalance,
          isPremium: true,
          premiumExpiryDate: premiumExpiryVal,
          premiumPlanId: selectedPlan.id,
          premiumBadgeStyle: selectedPlan.badgeStyle || "👑 VIP MEMBER",
          vipTagText: selectedPlan.badgeStyle || "👑 VIP MEMBER",
        });

        const todayStr = new Date().toLocaleDateString("en-CA");
        
        let revData = {
          today: 0,
          weekly: 0,
          monthly: 0,
          lifetime: 0,
          premiumRevenue: 0,
          challengeRevenue: 0,
          withdrawalRevenue: 0,
          fastWithdrawalRevenue: 0,
          totalUserPayout: 0,
          pendingLiability: 0,
          availableReserve: 0,
          lastUpdatedDate: todayStr,
        };

        if (revSnap.exists()) {
          const existing = revSnap.data();
          revData = { ...revData, ...existing };
        }

        if (revData.lastUpdatedDate !== todayStr) {
          revData.today = 0;
          revData.lastUpdatedDate = todayStr;
        }

        revData.lifetime += selectedPlan.price;
        revData.today += selectedPlan.price;
        revData.weekly += selectedPlan.price;
        revData.monthly += selectedPlan.price;
        revData.availableReserve += selectedPlan.price;
        revData.premiumRevenue += selectedPlan.price;

        transaction.set(revenueRef, revData);

        // Split transaction into GST and Base Membership
        const planPrice = selectedPlan.price;
        const gstAmount = Math.round(planPrice * 18 / 118 * 100) / 100;
        const baseAmount = Number((planPrice - gstAmount).toFixed(2));

        const gstTxRef = doc(collection(db, "revenueTransactions"));
        transaction.set(gstTxRef, {
          userId: user.userId,
          username: user.username,
          amount: gstAmount,
          revenueType: "GST Revenue",
          type: "membership_purchase_gst",
          source: "Membership Upgrade",
          description: `GST portion (18% inclusive) of Premium Membership Purchase: ${selectedPlan.name}`,
          timestamp: serverTimestamp(),
          date: new Date().toLocaleDateString("en-IN"),
          status: "Completed"
        });

        const baseTxRef = doc(collection(db, "revenueTransactions"));
        transaction.set(baseTxRef, {
          userId: user.userId,
          username: user.username,
          amount: baseAmount,
          revenueType: "Membership Revenue",
          type: "membership_purchase_base",
          source: "Membership Upgrade",
          description: `Premium Membership Purchase: ${selectedPlan.name}`,
          timestamp: serverTimestamp(),
          date: new Date().toLocaleDateString("en-IN"),
          status: "Completed"
        });

        transaction.set(notifRef, {
          userId: user.userId,
          title: "👑 Premium Membership Activated!",
          body: `Congratulations! Your Premium Membership "${selectedPlan.name}" has been successfully activated. Expiry Date: ${expiryString}. Welcome to VIP benefits!`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "system",
        });
      });

      const now = new Date();
      let premiumExpiryVal: any = "Lifetime";
      if (!selectedPlan.isLifetime) {
        const duration = selectedPlan.durationMonths || 1;
        premiumExpiryVal = new Date(now.setMonth(now.getMonth() + duration)).toISOString();
      }

      onUpdateUser({
        walletBalance: user.walletBalance - selectedPlan.price,
        isPremium: true,
        premiumExpiryDate: premiumExpiryVal,
        premiumPlanId: selectedPlan.id,
        premiumBadgeStyle: selectedPlan.badgeStyle || "👑 VIP MEMBER",
        vipTagText: selectedPlan.badgeStyle || "👑 VIP MEMBER",
        membershipStatus: "Active",
      });

      // Log Audit Trail
      await logAuditAction(
        user.userId,
        user.username,
        "Membership Purchased",
        user.username,
        `Purchased membership plan: ${selectedPlan.name} for ₹${selectedPlan.price}`
      );

      setPurchaseSuccess(`Successfully upgraded to ${selectedPlan.name}! Welcome to Premium Membership!`);
      setPurchasePin("");
      setSelectedPlan(null);
    } catch (err: any) {
      console.error(err);
      setPurchaseError(err.message || "Failed to complete purchase transaction.");
    } finally {
      setPurchaseLoading(false);
    }
  };

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      {/* Top Card: Overview */}
      <div className="rounded-2xl glass-panel border border-zinc-800 p-6 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5 relative z-10 text-center sm:text-left">
          {user.profilePic ? (
            <img
              src={user.profilePic}
              alt={user.username || "User"}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-800"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 border-2 border-zinc-800 flex items-center justify-center font-display font-bold text-zinc-300 text-2xl">
              {(user.username || "U").charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-1.5 font-sans">
            <div className="flex items-center justify-center sm:justify-start space-x-2 flex-wrap gap-y-1">
              <h2 className="text-xl font-display font-bold text-zinc-100">{user.username}</h2>
              {user.isPremium && (
                <span className="px-2 py-0.5 text-[9px] font-black tracking-wider bg-amber-400 text-slate-950 rounded-full animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                  👑 {user.premiumBadgeStyle || "VIP MEMBER"}
                </span>
              )}
              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest rounded-full ${
                user.role === "admin" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}>
                {user.role}
              </span>
            </div>
            <p className="text-xs text-zinc-500 font-mono">ID: {user.customUserId || user.userId}</p>
            {user.isPremium ? (
              <p className="text-[10px] text-amber-400 font-mono font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-current animate-bounce" />
                <span>Premium Active (Expires: {user.premiumExpiryDate === "Lifetime" ? "Never (Lifetime)" : new Date(user.premiumExpiryDate).toLocaleDateString("en-IN")})</span>
              </p>
            ) : (
              <p className="text-[10px] text-zinc-400">Standard Affiliate Member</p>
            )}
            <p className="text-xs text-zinc-400">Join Date: {user.joinDate}</p>
            {(user as any).customRank && (
              <p className="text-xs text-emerald-400 font-bold font-sans">Rank Status: {(user as any).customRank}</p>
            )}
          </div>
        </div>

        {/* Badge Banner */}
        <div className={`rounded-2xl bg-gradient-to-br ${badge.color} p-4 border shadow-xl max-w-sm w-full text-center sm:text-left flex items-center space-x-4`}>
          <div className="text-4xl animate-bounce">{badge.icon}</div>
          <div className="space-y-1 font-sans">
            <span className="text-[10px] uppercase tracking-widest font-mono opacity-80">Rank Badge Status</span>
            <h4 className="text-lg font-display font-extrabold tracking-wide uppercase leading-none">{badge.tier} Tier</h4>
            <p className="text-[10px] opacity-75">{badge.description}</p>
          </div>
        </div>
      </div>

      {/* 👑 BUY PREMIUM MEMBERSHIP SECTION */}
      <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <h3 className="text-base font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
            <Award className="w-5.5 h-5.5 text-amber-400 fill-amber-400/10" />
            <span>Premium Membership Activation Club</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Unlock priority fast-track withdrawal, priority payments verification review, elite challenges, zero-fee hybrid processing, and a gleaming gold VIP badge style.
          </p>
        </div>

        {purchaseSuccess && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl">
            {purchaseSuccess}
          </div>
        )}

        {purchaseError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-xl">
            {purchaseError}
          </div>
        )}

        {plans.length === 0 ? (
          <div className="text-center py-10 text-zinc-500 border border-dashed border-zinc-800 rounded-xl text-xs font-sans">
            No premium plans have been published by the founder yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Plans Grid */}
            <div className="lg:col-span-2 space-y-3.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">1. Select a Premium Club Membership Plan</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...plans].sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999)).map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const isCurrent = user.premiumPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-amber-500/[0.04] border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] text-zinc-100"
                          : isCurrent
                          ? "bg-zinc-900/40 border-zinc-700 opacity-90 cursor-default"
                          : "bg-zinc-950/40 border-zinc-850 hover:border-zinc-800 hover:bg-zinc-950/60"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-zinc-200">{plan.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-black text-emerald-400 font-mono">₹{plan.price.toLocaleString("en-IN")}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">
                          Duration: {plan.isLifetime ? "LIFETIME" : `${plan.durationMonths} Months`}
                        </p>
                      </div>

                      {plan.features && plan.features.length > 0 && (
                        <div className="mt-3 text-[10px] text-zinc-400 space-y-1">
                          {plan.features.slice(0, 3).map((feat, i) => (
                            <div key={i} className="flex items-center space-x-1 truncate">
                              <span className="text-amber-400 font-bold">✓</span>
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Checkout Sidebar */}
            <div className="lg:col-span-1 bg-zinc-950/30 rounded-2xl border border-zinc-850 p-5 space-y-4 flex flex-col justify-between">
              {selectedPlan ? (
                <form onSubmit={handleBuyPremium} className="space-y-4 text-xs font-sans flex flex-col h-full justify-between">
                  <div className="space-y-3">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block border-b border-zinc-900 pb-1.5">2. Activation Order Summary</span>
                    <div className="space-y-1">
                      <p className="text-zinc-500 text-[10px] uppercase font-mono">Selected Membership:</p>
                      <h4 className="text-sm font-bold text-zinc-100">{selectedPlan.name}</h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-zinc-900">
                      <div>
                        <p className="text-zinc-500 text-[9px] uppercase font-mono">Amount Due</p>
                        <p className="text-sm font-bold text-emerald-400 font-mono font-black">₹{selectedPlan.price.toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500 text-[9px] uppercase font-mono">Your Balance</p>
                        <p className="text-sm font-bold text-zinc-300 font-mono font-semibold">₹{(user.walletBalance || 0).toLocaleString("en-IN")}</p>
                      </div>
                    </div>

                    {selectedPlan.features && selectedPlan.features.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-zinc-500 text-[9px] uppercase font-mono">Club Perks Included:</p>
                        <div className="space-y-1 text-[10px] text-zinc-300 max-h-[100px] overflow-y-auto pr-1">
                          {selectedPlan.features.map((f, i) => (
                            <div key={i} className="flex items-center space-x-1.5">
                              <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                              <span className="truncate text-[10px]">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-900">
                      <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                        <Key className="w-3 h-3 text-amber-500" />
                        <span>Security PIN Verification</span>
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="Enter 4-digit Wallet PIN"
                        value={purchasePin}
                        onChange={(e) => setPurchasePin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 tracking-widest text-center font-mono text-sm focus:outline-hidden focus:border-amber-500/60"
                      />
                      {!user.walletPinHash && (
                        <p className="text-[10px] text-amber-500 mt-1 leading-relaxed">
                          ⚠️ You must establish your 4-digit Wallet PIN first below before buying.
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={purchaseLoading || !user.walletPinHash}
                    className="w-full py-3 mt-4 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-900 disabled:text-zinc-500 disabled:border-zinc-850 disabled:cursor-not-allowed border border-amber-500 text-slate-950 font-black uppercase tracking-wider text-[10px] rounded-xl cursor-pointer shadow-md transition-all flex items-center justify-center space-x-1.5"
                  >
                    {purchaseLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{purchaseLoading ? "Activating VIP..." : `Pay ₹${selectedPlan.price.toLocaleString("en-IN")} & Activate`}</span>
                  </button>
                </form>
              ) : (
                <div className="text-center py-14 text-zinc-500 font-sans text-xs italic">
                  Select a club membership plan from the list to preview benefits and complete upgrade order.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Grid: Stats and Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
        {/* Earnings Stats */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-slate-950/20 rounded-2xl border border-zinc-800/80 p-5 space-y-4 shadow-lg">
            <h3 className="text-sm font-display font-semibold text-zinc-300 uppercase tracking-wider border-b border-zinc-900 pb-2.5">
              Financial Totals
            </h3>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <DollarSign className="w-4.5 h-4.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Total Earnings</span>
              </div>
              <span className="font-display font-bold text-sm text-zinc-200">
                ₹{user.totalEarnings?.toLocaleString("en-IN") || "0.00"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Wallet className="w-4.5 h-4.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Wallet Balance</span>
              </div>
              <span className="font-display font-bold text-sm text-amber-400">
                ₹{user.walletBalance?.toLocaleString("en-IN") || "0.00"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <CheckCircle className="w-4.5 h-4.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Account Status</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {user.accountStatus}
              </span>
            </div>
          </div>

          {/* Badge Unlocks */}
          <div className="bg-slate-950/20 rounded-2xl border border-zinc-800/80 p-5 space-y-4 shadow-lg">
            <h3 className="text-sm font-display font-semibold text-zinc-300 uppercase tracking-wider border-b border-zinc-900 pb-2.5">
              Badge Levels
            </h3>
            
            <div className="space-y-3">
              {(badges.length > 0 ? badges.filter(b => b.status === "Active") : [
                { id: "bronze", name: "Bronze", minEarnings: 0, icon: "🥉" },
                { id: "silver", name: "Silver", minEarnings: 10000, icon: "🛡️" },
                { id: "gold", name: "Gold", minEarnings: 50000, icon: "👑" },
                { id: "diamond", name: "Diamond", minEarnings: 200000, icon: "💎" }
              ]).map((badgeItem) => {
                const isActive = (user.totalEarnings || 0) >= (badgeItem.minEarnings || 0);
                return (
                  <div
                    key={badgeItem.id || badgeItem.name}
                    className={`flex items-center justify-between p-2 rounded-xl border ${
                      isActive
                        ? "bg-amber-500/[0.02] border-amber-500/20 text-zinc-200"
                        : "bg-zinc-950/40 border-zinc-900/60 text-zinc-600"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 text-xs font-medium">
                      <span className={isActive ? "" : "grayscale"}>{badgeItem.icon}</span>
                      <span>{badgeItem.name} Badge</span>
                    </div>
                    <span className="text-[10px] font-mono opacity-80">₹{(badgeItem.minEarnings || 0).toLocaleString("en-IN")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Profile Settings Form */}
        <div className="md:col-span-2 bg-slate-950/10 rounded-2xl border border-zinc-800/80 p-6 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-display font-semibold text-zinc-100">Personal Specifications</h3>
            <button
              onClick={() => setEditing(!editing)}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center space-x-1.5 transition-all duration-300 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>{editing ? "Cancel Edit" : "Modify Profile"}</span>
            </button>
          </div>

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4" />
              <span>Profile metrics saved successfully.</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1.5">Registered Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-600">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full bg-slate-950/40 border border-zinc-900 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-600 cursor-not-allowed font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    disabled={!editing}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950/50 border border-zinc-800 disabled:border-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                    placeholder="e.g. ankit"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    disabled={!editing}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950/50 border border-zinc-800 disabled:border-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                    placeholder="e.g. 9876543210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">State Territory</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    disabled={!editing}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-slate-950/50 border border-zinc-800 disabled:border-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                    placeholder="e.g. Bihar"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Profile Photo Link URL</label>
              <input
                type="url"
                disabled={!editing}
                value={profilePic}
                onChange={(e) => setProfilePic(e.target.value)}
                className="w-full bg-slate-950/50 border border-zinc-800 disabled:border-zinc-900 disabled:text-zinc-500 rounded-xl py-2.5 px-3.5 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            {editing && (
              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs py-2 px-5 rounded-xl font-display font-semibold shadow-md flex items-center space-x-1 transition-all active:scale-98 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}
                  <span>Save Profile Updates</span>
                </button>
              </div>
            )}
          </form>

          {/* Change Password Card */}
          <div className="mt-6 border-t border-zinc-900 pt-6">
            <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2 mb-4">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>Security & Password Management</span>
            </h3>

            {pwdSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            {pwdError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center space-x-2">
                <Shield className="w-4 h-4 text-red-500" />
                <span>{pwdError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 pl-3 pr-4 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                    placeholder="Enter your current password"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 pl-3 pr-4 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                      placeholder="Minimum 6 characters"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 pl-3 pr-4 text-sm text-zinc-200 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-800 text-zinc-300 text-xs py-2 px-5 rounded-xl font-display font-semibold shadow-md flex items-center space-x-1 transition-all active:scale-98 cursor-pointer"
                >
                  {pwdLoading && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}
                  <span>Change Password</span>
                </button>
              </div>
            </form>

            {/* Wallet Security PIN Section */}
            <div className="mt-8 border-t border-zinc-900 pt-6">
              <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2 mb-4">
                <Key className="w-4 h-4 text-amber-500" />
                <span>Wallet Security PIN Management</span>
              </h3>

              {pinSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-sans">
                  {pinSuccess}
                </div>
              )}

              {pinError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-sans">
                  {pinError}
                </div>
              )}

              {!user.walletPinHash ? (
                <form onSubmit={handleSetWalletPin} className="space-y-4">
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Set up a secure, 4-digit numeric PIN. This PIN is required to authorize all future sensitive balance and premium membership operations.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">New 4-Digit Wallet PIN</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="e.g. 1234"
                        value={pinSetupInput}
                        onChange={(e) => setPinSetupInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 px-3 text-sm text-zinc-200 tracking-widest font-mono focus:outline-hidden focus:border-amber-500/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Confirm Wallet PIN</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="Repeat 4 digits"
                        value={pinSetupConfirm}
                        onChange={(e) => setPinSetupConfirm(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 px-3 text-sm text-zinc-200 tracking-widest font-mono focus:outline-hidden focus:border-amber-500/60"
                      />
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={pinLoading}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs py-2 px-5 rounded-xl font-display font-semibold flex items-center space-x-1.5 cursor-pointer transition-all"
                    >
                      {pinLoading && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}
                      <span>Establish Wallet PIN</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleChangeWalletPin} className="space-y-4">
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                    Your Wallet security PIN is active. Use this form to update your PIN securely.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Current Wallet PIN</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="Current 4 digits"
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 px-3 text-sm text-zinc-200 tracking-widest font-mono focus:outline-hidden focus:border-amber-500/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">New Wallet PIN</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="New 4 digits"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 px-3 text-sm text-zinc-200 tracking-widest font-mono focus:outline-hidden focus:border-amber-500/60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Confirm New PIN</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="Confirm new 4 digits"
                        value={confirmNewPinInput}
                        onChange={(e) => setConfirmNewPinInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-950/50 border border-zinc-850 rounded-xl py-2 px-3 text-sm text-zinc-200 tracking-widest font-mono focus:outline-hidden focus:border-amber-500/60"
                      />
                    </div>
                  </div>
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={pinLoading}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs py-2 px-5 rounded-xl border border-zinc-800 font-display font-semibold flex items-center space-x-1.5 cursor-pointer transition-all"
                    >
                      {pinLoading && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}
                      <span>Update Wallet PIN</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Industry Earnings Section */}
            <div className="mt-8 border-t border-zinc-900 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  <span>Industry Earnings Verification Claim</span>
                </h3>
                <span className="text-[10px] font-mono text-zinc-400 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider w-fit">
                  Profile & Dashboard Feature
                </span>
              </div>

              <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-4">
                Did you previously work on another platform (e.g. Zee, AffiliateHub, etc.)? Submit your platform earnings details below for admin verification. Once verified by our team, your Industry Earnings will be prominently displayed on your user profile and main dashboard.
              </p>

              {ieSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{ieSuccess}</span>
                </div>
              )}

              {ieError && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center space-x-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{ieError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitIndustryEarning} className="space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-zinc-850">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">
                      Platform Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Zee Platform, AffiliateHub, etc."
                      value={iePlatformName}
                      onChange={(e) => setIePlatformName(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">
                      Earnings Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 25000"
                      value={ieAmount}
                      onChange={(e) => setIeAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/60 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={ieStartDate}
                      onChange={(e) => setIeStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={ieEndDate}
                      onChange={(e) => setIeEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">
                    Proof Screenshot / Verification Link (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/file/d/..."
                    value={ieProofUrl}
                    onChange={(e) => setIeProofUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 focus:outline-hidden focus:border-emerald-500/60 font-mono"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={ieLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2.5 px-6 rounded-xl font-display font-semibold flex items-center space-x-1.5 cursor-pointer shadow-lg transition-all active:scale-98"
                  >
                    {ieLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1" />
                    )}
                    <span>Submit Request for Verification</span>
                  </button>
                </div>
              </form>

              {/* User Industry Earnings History List */}
              {industryRecords.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Your Submitted Claims ({industryRecords.length})</span>
                  </h4>

                  <div className="space-y-2.5">
                    {industryRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-850 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-zinc-100">{rec.platformName}</span>
                            <span
                              className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                rec.status === "Approved"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                                  : rec.status === "Rejected"
                                  ? "bg-red-500/10 text-red-400 border-red-500/25"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                              }`}
                            >
                              ● {rec.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono">
                            Period: {rec.startDate} to {rec.endDate}
                          </p>
                          {rec.adminRemark && (
                            <p className="text-[11px] text-amber-300 italic">
                              Admin Remark: {rec.adminRemark}
                            </p>
                          )}
                        </div>

                        <div className="text-right flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-900">
                          <span className="text-base font-black text-emerald-400 font-mono">
                            ₹{rec.amount.toLocaleString("en-IN")}
                          </span>
                          {rec.proofUrl && (
                            <a
                              href={rec.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-400 hover:underline flex items-center space-x-1"
                            >
                              <span>Proof Document</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Official Social Media Channels Section */}
            <div className="mt-8 border-t border-zinc-900 pt-6">
              <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2 mb-4">
                <Share2 className="w-4 h-4 text-amber-500" />
                <span>Official Social Media Channels</span>
              </h3>
              <p className="text-xs text-zinc-400 font-sans leading-relaxed mb-4">
                Connect with the founder and our thriving student affiliate community across official social media networks!
              </p>
              <div className="bg-slate-950/30 p-4 rounded-xl border border-zinc-900/80 flex justify-center">
                <SocialMediaIcons />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
