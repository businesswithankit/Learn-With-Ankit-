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

      await runTransaction(db, async (transaction) => {
        // 1. Read User Profile
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User profile not found.");
        }
        const userData = userSnap.data();
        const currentBalance = userData.walletBalance || 0;

        // Fetch global revenue settings
        const revSnap = await transaction.get(revenueRef);

        if (currentBalance < selectedService.price) {
          throw new Error("Insufficient Wallet Balance");
        }

        // 2. Perform updates
        const nextBalance = currentBalance - selectedService.price;
        transaction.update(userRef, {
          walletBalance: nextBalance
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
    <div className="space-y-8 max-w-6xl mx-auto animate-fade-in text-zinc-100 font-sans">
      
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-amber-950/30 border border-amber-500/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>Official Premium Marketplace</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-zinc-100 tracking-tight">
              Services & Schemes
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm max-w-xl leading-relaxed">
              Unlock high-value expert services, exclusive course mentorship, and custom tools directly using your wallet balance.
            </p>
          </div>

          {/* User Balance Display Card */}
          <div className="flex items-center space-x-4 bg-zinc-950/80 backdrop-blur-md border border-amber-500/30 p-4 rounded-2xl shadow-xl shrink-0">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-mono block">Your Available Balance</span>
              <span className="text-xl font-display font-black text-amber-400 font-mono">₹{user.walletBalance.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 rounded-3xl bg-zinc-950/40 border border-zinc-900">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-zinc-400 font-mono">Loading available marketplace schemes...</p>
        </div>
      ) : (
        <>
          {/* Services Grid */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-widest font-mono text-zinc-400 flex items-center space-x-2 font-bold">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>Available Marketplace Services ({services.length})</span>
              </h3>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-20 bg-zinc-950/40 border border-zinc-900/80 rounded-3xl space-y-3">
                <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto" />
                <p className="text-sm text-zinc-400 font-sans">No active services are currently published. Check back soon!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...services].sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999)).map((service) => {
                  const isPurchased = allPurchasedServiceIds.has(service.id);
                  const durationBadgeText = service.durationType === "Fixed" && service.durationValue
                    ? `${service.durationValue} ${service.durationUnit} Access`
                    : "Lifetime Access";

                  return (
                    <div
                      key={service.id}
                      className="bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/80 border border-zinc-800/80 hover:border-amber-500/40 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group relative"
                    >
                      {/* Top Accent line on hover */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-rose-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Thumbnail & Floating Badges */}
                      <div className="h-48 bg-zinc-900 relative overflow-hidden">
                        {service.thumbnail ? (
                          <img
                            src={service.thumbnail}
                            alt={service.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-zinc-950 to-slate-950 flex items-center justify-center">
                            <Sparkles className="w-12 h-12 text-zinc-700 group-hover:text-amber-500/40 transition-colors" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 bg-zinc-950/80 text-amber-400 border border-amber-500/30 font-bold font-mono text-[10px] px-3 py-1 rounded-full backdrop-blur-md uppercase tracking-wider shadow-lg">
                          {durationBadgeText}
                        </div>
                        <div className="absolute top-3 right-3 bg-amber-500 text-slate-950 font-display font-black text-xs px-3 py-1 rounded-full shadow-lg">
                          ₹{service.price.toLocaleString("en-IN")}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                        <div className="space-y-3.5">
                          <h4 className="font-display font-bold text-base text-zinc-100 group-hover:text-amber-400 transition-colors">
                            {service.name}
                          </h4>

                          {service.description && (
                            <p className="text-xs text-zinc-400 leading-relaxed font-sans line-clamp-3">
                              {service.description}
                            </p>
                          )}

                          {/* Features list */}
                          {service.features && service.features.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-zinc-900">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-bold block">
                                Key Highlights
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {service.features.map((feat, fIdx) => (
                                  <span key={fIdx} className="bg-zinc-900/90 border border-zinc-800 px-2.5 py-0.5 rounded-lg text-[10px] text-zinc-300 font-medium">
                                    • {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Benefits checklist */}
                          {service.benefits && service.benefits.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-zinc-900">
                              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-bold block">
                                Member Advantages
                              </span>
                              <ul className="space-y-1.5 text-xs text-zinc-300">
                                {service.benefits.map((benefit, bIdx) => (
                                  <li key={bIdx} className="flex items-start space-x-2 text-zinc-300">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span className="leading-snug">{benefit}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Action button */}
                        {isPurchased ? (
                          <div className="w-full py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-2xl flex items-center justify-center space-x-2 uppercase tracking-wider shadow-inner">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Active Membership</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedService(service)}
                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs rounded-2xl uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 active:scale-98"
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
          <div className="border-t border-zinc-900/80 pt-10 space-y-6">
            <h3 className="text-sm uppercase tracking-widest font-mono text-zinc-300 flex items-center space-x-2 font-bold">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Your Active Schemes & Subscriptions ({purchases.length})</span>
            </h3>

            {purchases.length === 0 ? (
              <div className="text-center py-12 bg-zinc-950/30 border border-zinc-900 rounded-3xl text-xs text-zinc-500">
                You currently have no active service subscriptions.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div key={purchase.id} className="bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between space-y-5 relative overflow-hidden shadow-xl hover:border-zinc-700 transition-all">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-display font-bold text-base text-zinc-100">{purchase.serviceName}</h4>
                            <div className="text-xs text-zinc-400 font-mono mt-1">
                              Purchased: <span className="text-zinc-200">{purchase.purchaseDate}</span>
                            </div>
                          </div>
                          <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                            isExpired ? "bg-red-500/15 text-red-400 border border-red-500/30" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          }`}>
                            {isExpired ? "Expired" : "Active"}
                          </span>
                        </div>

                        {/* Duration & Expiry Banner */}
                        <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-2xl flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-400">Expiry: <strong className="text-zinc-200">{purchase.expiryDate || "Lifetime"}</strong></span>
                          <span className={`font-bold ${isExpired ? "text-red-400" : "text-amber-400"}`}>{remainingStr}</span>
                        </div>

                        {/* Description */}
                        {purchase.description && (
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans line-clamp-2">
                            {purchase.description}
                          </p>
                        )}

                        {/* Features */}
                        {purchase.features && purchase.features.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">Features Included:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {purchase.features.map((f, idx) => (
                                <span key={idx} className="bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-lg text-[10px] text-zinc-300">
                                  • {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-zinc-900 flex justify-between items-center text-xs font-mono text-zinc-400">
                        <span>Paid Amount: <strong className="text-emerald-400 font-bold text-sm">₹{purchase.price}</strong></span>
                        <button
                          type="button"
                          onClick={() => setDeletingPurchase(purchase)}
                          className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                          title="Hide Record from Dashboard"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500" />
            
            <h4 className="text-lg font-display font-black text-zinc-100 uppercase tracking-wide flex items-center space-x-2.5">
              <ShoppingBag className="w-6 h-6 text-amber-500" />
              <span>Confirm Purchase Order</span>
            </h4>

            {purchaseError ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start space-x-3 text-xs text-red-400 font-sans">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{purchaseError}</span>
              </div>
            ) : purchaseSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start space-x-3 text-xs text-emerald-400 font-sans">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{purchaseSuccess}</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-sans">
                <p className="text-zinc-300 leading-relaxed text-sm">
                  Are you sure you want to activate <strong className="text-amber-400 font-bold">{selectedService.name}</strong>?
                </p>

                <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Service Cost:</span>
                    <span className="text-amber-400 font-bold text-sm">₹{selectedService.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Validity Period:</span>
                    <span className="text-zinc-200 font-semibold">
                      {selectedService.durationType === "Fixed" && selectedService.durationValue
                        ? `${selectedService.durationValue} ${selectedService.durationUnit}`
                        : "Lifetime Access"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-2 mt-2">
                    <span className="text-zinc-400">Current Balance:</span>
                    <span className="text-zinc-200 font-bold">₹{user.walletBalance.toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-zinc-900 pt-3">
                  <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-mono font-bold">Enter 4-Digit Wallet Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2.5 px-4 text-center text-base font-mono tracking-widest text-zinc-100 focus:outline-hidden focus:border-amber-500/60"
                  />
                  {!user.walletPinHash && (
                    <p className="text-[11px] text-amber-400/90 italic leading-snug">
                      * Please set up your 4-digit Wallet PIN in the Profile section first.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!purchaseSuccess && (
              <div className="flex space-x-3 pt-2 text-xs font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  disabled={purchaseLoading}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-2xl border border-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePurchaseService}
                  disabled={purchaseLoading}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-2xl cursor-pointer transition-all flex items-center justify-center space-x-1 shadow-lg shadow-amber-500/20"
                >
                  {purchaseLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm Order</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY DELETION CONFIRMATION MODAL */}
      {deletingPurchase && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full space-y-4 shadow-2xl relative overflow-hidden">
            <h4 className="text-base font-display font-black text-zinc-100 uppercase tracking-wide flex items-center space-x-2 text-red-400">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span>Remove History Record</span>
            </h4>

            <p className="text-zinc-300 text-xs leading-relaxed font-sans">
              Are you sure you want to remove <strong className="text-zinc-100">{deletingPurchase.serviceName}</strong> from your visible history?
            </p>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-400 leading-relaxed font-sans">
              ⚠️ Deleting history record only hides it from this list. It does <strong>NOT</strong> cancel the active service.
            </div>

            <div className="flex space-x-3 pt-2 text-xs font-bold uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setDeletingPurchase(null)}
                disabled={deleteLoading}
                className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-2xl border border-zinc-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteHistory}
                disabled={deleteLoading}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white rounded-2xl cursor-pointer shadow-lg"
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
