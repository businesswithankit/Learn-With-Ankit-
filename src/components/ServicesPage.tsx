import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, runTransaction, serverTimestamp, where, orderBy, getDoc, getDocs, limit } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, Service, ServicePurchase } from "../types";
import { Sparkles, ShoppingBag, CreditCard, History, Trash2, CheckCircle2, ShieldAlert, Clock, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { logAuditAction } from "../utils/audit";
import { hashPin } from "../utils/pin";

interface ServicesPageProps {
  user: UserProfile;
  onUpdateUser: (updatedFields: Partial<UserProfile>) => void;
}

export default function ServicesPage({ user, onUpdateUser }: ServicesPageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [purchases, setPurchases] = useState<ServicePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Purchase Modal / Confirmation
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [pin, setPin] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  
  // History Deletion Modal / State
  const [deletingPurchase, setDeletingPurchase] = useState<ServicePurchase | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Clear PIN on selected service change
  useEffect(() => {
    setPin("");
  }, [selectedService]);

  // Subscriptions for active services and user purchases
  useEffect(() => {
    setLoading(true);
    
    // 1. Fetch Active Services
    const qServices = query(collection(db, "services"), where("status", "==", "Active"));
    const unsubServices = onSnapshot(qServices, (snapshot) => {
      const servicesList: Service[] = [];
      snapshot.forEach((docSnap) => {
        servicesList.push({ id: docSnap.id, ...docSnap.data() } as Service);
      });
      setServices(servicesList);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "services");
      setLoading(false);
    });

    // 2. Fetch User Purchases (excluding hidden ones)
    const qPurchases = query(
      collection(db, "servicePurchases"),
      where("userId", "==", user.userId),
      orderBy("timestamp", "desc")
    );
    const unsubPurchases = onSnapshot(qPurchases, (snapshot) => {
      const purchasesList: ServicePurchase[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.hiddenByUser) {
          purchasesList.push({ id: docSnap.id, ...data } as ServicePurchase);
        }
      });
      setPurchases(purchasesList);
    }, (err) => {
      console.error("Error loading purchases:", err);
    });

    return () => {
      unsubServices();
      unsubPurchases();
    };
  }, [user.userId]);

  // Determine which services the user has already purchased (active/purchased status)
  // Let's load ALL user purchases (even hidden ones) to check if a service is purchased, to prevent duplicate purchases.
  const [allPurchasedServiceIds, setAllPurchasedServiceIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const qAllPurchases = query(
      collection(db, "servicePurchases"),
      where("userId", "==", user.userId)
    );
    const unsubAll = onSnapshot(qAllPurchases, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((docSnap) => {
        ids.add(docSnap.data().serviceId);
      });
      setAllPurchasedServiceIds(ids);
    });
    return () => unsubAll();
  }, [user.userId]);

  // Handle purchasing service via secure transaction
  const handlePurchaseService = async () => {
    if (!selectedService) return;
    setPurchaseLoading(true);
    setPurchaseError(null);
    setPurchaseSuccess(null);

    // Validate PIN
    if (!user.walletPinHash) {
      setPurchaseError("Please set up your secure 4-digit Wallet PIN in the Profile section first.");
      setPurchaseLoading(false);
      return;
    }

    if (pin.length !== 4 || isNaN(Number(pin))) {
      setPurchaseError("Wallet PIN must be exactly 4 digits.");
      setPurchaseLoading(false);
      return;
    }

    try {
      const hashedInput = await hashPin(pin);
      if (hashedInput !== user.walletPinHash) {
        setPurchaseError("Incorrect Wallet PIN. Service purchase denied.");
        setPurchaseLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.userId);
      const serviceRef = doc(db, "services", selectedService.id);
      const purchaseRef = doc(collection(db, "servicePurchases"));
      const notifRef = doc(collection(db, "notifications"));
      const revenueRef = doc(db, "settings", "revenue");
      const txRef = doc(collection(db, "revenueTransactions"));

      // 1. Fetch founder user doc ref outside transaction (due to Firestore transaction read constraint)
      let founderRef = null;
      try {
        const founderQuery = query(collection(db, "users"), where("role", "==", "founder"), limit(1));
        const founderSnap = await getDocs(founderQuery);
        if (!founderSnap.empty) {
          founderRef = founderSnap.docs[0].ref;
        }
      } catch (err) {
        console.warn("Founder query failed: ", err);
      }

      await runTransaction(db, async (transaction) => {
        // 1. Read User Profile
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User profile not found.");
        }
        const userData = userSnap.data();
        const currentBalance = userData.walletBalance || 0;

        // Also fetch founder profile if found
        let founderSnapTx = null;
        if (founderRef) {
          founderSnapTx = await transaction.get(founderRef);
        }

        // Fetch global revenue settings
        const revSnap = await transaction.get(revenueRef);

        const founderWalletRef = doc(db, "settings", "founderRevenueWallet");
        const founderWalletSnap = await transaction.get(founderWalletRef);

        if (currentBalance < selectedService.price) {
          throw new Error("Insufficient Wallet Balance");
        }

        // 2. Perform updates
        const nextBalance = currentBalance - selectedService.price;
        transaction.update(userRef, {
          walletBalance: nextBalance
        });

        // Credit the Founder's Wallet automatically
        if (founderRef && founderSnapTx && founderSnapTx.exists()) {
          const founderData = founderSnapTx.data();
          const currentFounderBalance = founderData.walletBalance || 0;
          transaction.update(founderRef, {
            walletBalance: currentFounderBalance + selectedService.price
          });
        }

        // Credit the dedicated Founder Revenue Wallet
        let founderWalletData = { currentBalance: 0, totalLifetimeRevenue: 0 };
        if (founderWalletSnap.exists()) {
          founderWalletData = founderWalletSnap.data() as any;
        }
        transaction.set(founderWalletRef, {
          currentBalance: (founderWalletData.currentBalance || 0) + selectedService.price,
          totalLifetimeRevenue: (founderWalletData.totalLifetimeRevenue || 0) + selectedService.price,
          updatedAt: serverTimestamp()
        });

        // Calculate duration and expiry
        const nowMs = Date.now();
        let expiryTimestampVal: number | null = null;
        let expiryDateStr = "Lifetime";

        if (selectedService.durationType === "Fixed" && selectedService.durationValue) {
          const days = selectedService.durationUnit === "Months"
            ? selectedService.durationValue * 30
            : selectedService.durationValue;
          expiryTimestampVal = nowMs + (days * 86400000);
          expiryDateStr = new Date(expiryTimestampVal).toLocaleDateString("en-IN");
        }

        // Create Purchase Log
        transaction.set(purchaseRef, {
          userId: user.userId,
          username: user.username,
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          price: selectedService.price,
          purchaseDate: new Date().toLocaleDateString("en-IN"),
          purchaseTimestamp: nowMs,
          expiryDate: expiryDateStr,
          expiryTimestamp: expiryTimestampVal,
          durationType: selectedService.durationType || "Lifetime",
          durationValue: selectedService.durationValue || null,
          durationUnit: selectedService.durationUnit || null,
          description: selectedService.description || "",
          features: selectedService.features || [],
          benefits: selectedService.benefits || [],
          status: "Active",
          timestamp: serverTimestamp(),
          hiddenByUser: false,
        });

        // Create notification for user
        transaction.set(notifRef, {
          userId: user.userId,
          title: "🛠️ Service Purchased!",
          body: `You have successfully purchased "${selectedService.name}" for ₹${selectedService.price}. Your wallet balance has been deducted.`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "system",
        });

        // Update platform revenue tracking document
        const todayStr = new Date().toLocaleDateString("en-CA");
        let revData = {
          today: 0,
          weekly: 0,
          monthly: 0,
          lifetime: 0,
          premiumRevenue: 0,
          serviceRevenue: 0,
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

        revData.lifetime += selectedService.price;
        revData.today += selectedService.price;
        revData.weekly += selectedService.price;
        revData.monthly += selectedService.price;
        revData.availableReserve += selectedService.price;
        revData.serviceRevenue = (revData.serviceRevenue || 0) + selectedService.price;

        transaction.set(revenueRef, revData);

        // Split transaction into GST and Base Service Charge
        const sPrice = selectedService.price;
        const gstAmount = Math.round(sPrice * 18 / 118 * 100) / 100;
        const baseAmount = Number((sPrice - gstAmount).toFixed(2));

        const gstTxRef = doc(collection(db, "revenueTransactions"));
        transaction.set(gstTxRef, {
          userId: user.userId,
          username: user.username,
          amount: gstAmount,
          revenueType: "GST Revenue",
          type: "service_purchase_gst",
          source: "Service Purchase",
          description: `GST portion (18% inclusive) of Service Purchase: ${selectedService.name}`,
          timestamp: serverTimestamp(),
          date: new Date().toLocaleDateString("en-IN"),
          status: "Completed"
        });

        const baseTxRef = doc(collection(db, "revenueTransactions"));
        transaction.set(baseTxRef, {
          userId: user.userId,
          username: user.username,
          amount: baseAmount,
          revenueType: "Service Revenue",
          type: "service_purchase_base",
          source: "Service Purchase",
          description: `Service Purchase: ${selectedService.name}`,
          timestamp: serverTimestamp(),
          date: new Date().toLocaleDateString("en-IN"),
          status: "Completed"
        });
      });

      // Update Local user profile state
      onUpdateUser({
        walletBalance: user.walletBalance - selectedService.price
      });

      // Write Audit Log
      await logAuditAction(
        user.userId,
        user.username,
        "Service Purchased",
        user.username,
        `Purchased service: "${selectedService.name}" for ₹${selectedService.price}`
      );

      setPurchaseSuccess(`Successfully purchased "${selectedService.name}"!`);
      setTimeout(() => {
        setSelectedService(null);
        setPurchaseSuccess(null);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      if (err.message === "Insufficient Wallet Balance") {
        setPurchaseError("Insufficient Wallet Balance");
      } else {
        setPurchaseError(err.message || "Failed to complete service purchase.");
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Delete Purchase history record (Hide from client view)
  const handleDeleteHistory = async () => {
    if (!deletingPurchase) return;
    setDeleteLoading(true);

    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const ref = doc(db, "servicePurchases", deletingPurchase.id);
      
      // Update hiddenByUser to true (does not cancel service)
      await updateDoc(ref, {
        hiddenByUser: true
      });

      setDeletingPurchase(null);
    } catch (err) {
      console.error("Error hiding purchase history:", err);
      alert("Failed to delete history record.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in text-zinc-100 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-zinc-900 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-display font-black text-zinc-100 uppercase tracking-tight flex items-center space-x-2.5">
            <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
            <span>Services Marketplace</span>
          </h2>
          <p className="text-zinc-500 text-xs mt-1">
            Unlock premium expert services, exclusive templates, and custom mentoring directly using your wallet balance.
          </p>
        </div>

        {/* User Balance Display */}
        <div className="flex items-center space-x-3 bg-zinc-950/80 border border-zinc-800 p-3 rounded-2xl">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <CreditCard className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono block">Your Wallet Balance</span>
            <span className="text-sm font-bold text-zinc-200 font-mono">₹{user.walletBalance.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-zinc-500 font-mono">Loading available services...</p>
        </div>
      ) : (
        <>
          {/* Services Grid */}
          <div>
            <h3 className="text-xs uppercase tracking-widest font-mono text-zinc-500 mb-4 flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-zinc-400" />
              <span>Available Schemes & Services</span>
            </h3>

            {services.length === 0 ? (
              <div className="text-center py-16 bg-zinc-950/20 border border-zinc-900 rounded-2xl">
                <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-500">No active services are currently available. Check back later!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map((service) => {
                  const isPurchased = allPurchasedServiceIds.has(service.id);
                  const durationBadgeText = service.durationType === "Fixed" && service.durationValue
                    ? `${service.durationValue} ${service.durationUnit} Access`
                    : "Lifetime Access";

                  return (
                    <div
                      key={service.id}
                      className="bg-zinc-950/30 border border-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-800/80 transition-all duration-300 flex flex-col justify-between group"
                    >
                      {/* Thumbnail & Badges */}
                      <div className="h-44 bg-zinc-900 relative overflow-hidden">
                        {service.thumbnail ? (
                          <img
                            src={service.thumbnail}
                            alt={service.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-slate-950 to-black flex items-center justify-center">
                            <Sparkles className="w-10 h-10 text-zinc-700 group-hover:text-amber-500/35 transition-colors" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-amber-500/10 text-amber-400 border border-amber-500/25 font-bold font-mono text-[10px] px-2.5 py-1 rounded-lg backdrop-blur-md uppercase tracking-wider">
                          {durationBadgeText}
                        </div>
                        <div className="absolute top-3 right-3 bg-slate-950/90 text-amber-400 border border-zinc-800 font-black font-mono text-xs px-2.5 py-1 rounded-lg">
                          ₹{service.price.toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          <h4 className="font-bold text-sm text-zinc-100 group-hover:text-amber-400 transition-colors">
                            {service.name}
                          </h4>

                          {service.description && (
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                              {service.description}
                            </p>
                          )}

                          {/* Features list */}
                          {service.features && service.features.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-zinc-900">
                              <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 font-bold block">
                                Service Features
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {service.features.map((feat, fIdx) => (
                                  <span key={fIdx} className="bg-zinc-900/80 border border-zinc-800/80 px-2 py-0.5 rounded-md text-[10px] text-zinc-300">
                                    • {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Benefits checklist */}
                          {service.benefits && service.benefits.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                              <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 font-bold block">
                                Included Benefits
                              </span>
                              <ul className="space-y-1 text-[11px] text-zinc-300">
                                {service.benefits.map((benefit, bIdx) => (
                                  <li key={bIdx} className="flex items-start space-x-1.5 text-zinc-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                    <span className="leading-tight">{benefit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Action button */}
                        {isPurchased ? (
                          <div className="w-full py-2.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-bold text-[10px] rounded-xl flex items-center justify-center space-x-1.5 uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Purchased & Active</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelectedService(service)}
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-xl uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center justify-center space-x-1.5 shadow-lg shadow-amber-500/10"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{service.buttonText || "Buy Service"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Service Purchase History / Active Subscriptions Section */}
          <div className="border-t border-zinc-900 pt-8 space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-mono text-zinc-400 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>My Purchased Services & Subscriptions</span>
            </h3>

            {purchases.length === 0 ? (
              <div className="text-center py-10 bg-zinc-950/10 border border-zinc-900/60 rounded-2xl text-xs text-zinc-500">
                You haven't purchased any services yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {purchases.map((purchase) => {
                  const now = Date.now();
                  let remainingStr = "Lifetime Access";
                  let isExpired = purchase.status === "Expired";

                  if (purchase.durationType === "Fixed" && purchase.expiryTimestamp) {
                    const diffDays = Math.ceil((purchase.expiryTimestamp - now) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 0 || purchase.status === "Expired") {
                      remainingStr = "0 Days (Expired)";
                      isExpired = true;
                    } else {
                      remainingStr = `${diffDays} Days Remaining`;
                    }
                  } else if (!purchase.durationType || purchase.durationType === "Lifetime") {
                    remainingStr = "Lifetime Access";
                  }

                  return (
                    <div key={purchase.id} className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4 relative overflow-hidden">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-sm text-zinc-100">{purchase.serviceName}</h4>
                            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              Purchased on: <span className="text-zinc-200">{purchase.purchaseDate}</span>
                            </div>
                          </div>
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase ${
                            isExpired ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          }`}>
                            {isExpired ? "Expired" : "Active"}
                          </span>
                        </div>

                        {/* Duration & Expiry Banner */}
                        <div className="p-2.5 bg-zinc-900/60 border border-zinc-850 rounded-xl flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-400">Validity Expiry: <strong className="text-zinc-200">{purchase.expiryDate || "Lifetime"}</strong></span>
                          <span className={`font-bold ${isExpired ? "text-red-400" : "text-amber-400"}`}>{remainingStr}</span>
                        </div>

                        {/* Description */}
                        {purchase.description && (
                          <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                            {purchase.description}
                          </p>
                        )}

                        {/* Features */}
                        {purchase.features && purchase.features.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono uppercase text-zinc-500 font-bold block">Features:</span>
                            <div className="flex flex-wrap gap-1">
                              {purchase.features.map((f, idx) => (
                                <span key={idx} className="bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded text-[9px] text-zinc-300">
                                  • {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-zinc-900/80 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                        <span>Paid: <strong className="text-emerald-400">₹{purchase.price}</strong></span>
                        <button
                          onClick={() => setDeletingPurchase(purchase)}
                          className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Hide Record from Dashboard"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* CONFIRMATION PURCHASE MODAL */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
            
            <h4 className="text-base font-display font-black text-zinc-100 uppercase tracking-wide flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-amber-500" />
              <span>Confirm Purchase</span>
            </h4>

            {purchaseError ? (
              <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl flex items-start space-x-2 text-[11px] text-red-400 font-sans">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{purchaseError}</span>
              </div>
            ) : purchaseSuccess ? (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-start space-x-2 text-[11px] text-emerald-400 font-sans">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{purchaseSuccess}</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-zinc-400 leading-relaxed">
                  Are you sure you want to purchase <strong className="text-zinc-200">{selectedService.name}</strong>?
                </p>

                <div className="bg-zinc-900/50 border border-zinc-850 p-3 rounded-2xl space-y-1.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Service Price:</span>
                    <span className="text-amber-400 font-semibold">₹{selectedService.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Validity Period:</span>
                    <span className="text-zinc-200 font-semibold">
                      {selectedService.durationType === "Fixed" && selectedService.durationValue
                        ? `${selectedService.durationValue} ${selectedService.durationUnit}`
                        : "Lifetime Access"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800/80 pt-1.5 mt-1.5">
                    <span className="text-zinc-500">Your Wallet Balance:</span>
                    <span className="text-zinc-200 font-semibold">₹{user.walletBalance.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-zinc-900 pt-3 mt-3">
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono font-bold">Secure Wallet PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-center text-sm font-mono tracking-widest text-zinc-100 focus:outline-hidden focus:border-amber-500/50"
                  />
                  {!user.walletPinHash && (
                    <p className="text-[10px] text-amber-500/80 italic leading-snug">
                      * You must set up your secure 4-digit Wallet PIN in the Profile tab first.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!purchaseSuccess && (
              <div className="flex space-x-2 pt-2 text-[10px] font-bold uppercase tracking-wider">
                <button
                  onClick={() => setSelectedService(null)}
                  disabled={purchaseLoading}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl border border-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchaseService}
                  disabled={purchaseLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-850 text-slate-950 rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1"
                >
                  {purchaseLoading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                      <span>Purchasing...</span>
                    </>
                  ) : (
                    <span>Confirm Pay</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY DELETION CONFIRMATION MODAL */}
      {deletingPurchase && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
            <h4 className="text-base font-display font-black text-zinc-100 uppercase tracking-wide flex items-center space-x-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span>Delete History Record</span>
            </h4>

            <p className="text-zinc-400 text-xs leading-relaxed">
              Are you sure you want to remove the purchase record of <strong className="text-zinc-200">{deletingPurchase.serviceName}</strong> from your visible history?
            </p>

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-400 leading-relaxed">
              ⚠️ Deleting history record only removes it from this list. It does <strong>NOT</strong> cancel the purchased service.
            </div>

            <div className="flex space-x-2 pt-2 text-[10px] font-bold uppercase tracking-wider">
              <button
                onClick={() => setDeletingPurchase(null)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl border border-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteHistory}
                disabled={deleteLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-zinc-850 text-white rounded-xl cursor-pointer"
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
