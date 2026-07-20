import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, runTransaction, serverTimestamp, where, orderBy, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, Service, ServicePurchase } from "../types";
import { Sparkles, ShoppingBag, CreditCard, History, Trash2, CheckCircle2, ShieldAlert, Clock, AlertCircle, RefreshCw, Layers } from "lucide-react";
import { logAuditAction } from "../utils/audit";

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
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  
  // History Deletion Modal / State
  const [deletingPurchase, setDeletingPurchase] = useState<ServicePurchase | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

    try {
      const userRef = doc(db, "users", user.userId);
      const serviceRef = doc(db, "services", selectedService.id);
      const purchaseRef = doc(collection(db, "servicePurchases"));
      const notifRef = doc(collection(db, "notifications"));

      await runTransaction(db, async (transaction) => {
        // 1. Read User Profile
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User profile not found.");
        }
        const userData = userSnap.data();
        const currentBalance = userData.walletBalance || 0;

        // Check if already purchased
        const qCheck = query(
          collection(db, "servicePurchases"),
          where("userId", "==", user.userId),
          where("serviceId", "==", selectedService.id)
        );
        // Transactions require all reads first. We can't query inside transaction, 
        // so we rely on client-side check plus atomic verification of funds.
        
        if (currentBalance < selectedService.price) {
          throw new Error("Insufficient Wallet Balance");
        }

        // 2. Perform updates
        const nextBalance = currentBalance - selectedService.price;
        transaction.update(userRef, {
          walletBalance: nextBalance
        });

        // Create Purchase Log
        transaction.set(purchaseRef, {
          userId: user.userId,
          username: user.username,
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          price: selectedService.price,
          purchaseDate: new Date().toLocaleDateString("en-IN"),
          timestamp: serverTimestamp(),
          status: "Purchased",
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
                  return (
                    <div
                      key={service.id}
                      className="bg-zinc-950/30 border border-zinc-900 rounded-2xl overflow-hidden hover:border-zinc-800/80 transition-all duration-300 flex flex-col justify-between group"
                    >
                      {/* Thumbnail */}
                      <div className="h-40 bg-zinc-900 relative overflow-hidden">
                        {service.thumbnail ? (
                          <img
                            src={service.thumbnail}
                            alt={service.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
                            <Sparkles className="w-10 h-10 text-zinc-700 group-hover:text-amber-500/35 transition-colors" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3 bg-slate-950/90 text-amber-500 border border-zinc-800 font-bold font-mono text-xs px-2.5 py-1 rounded-lg">
                          ₹{service.price}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">
                            {service.name}
                          </h4>
                          <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-3">
                            {service.description}
                          </p>
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
                            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-xl uppercase tracking-wider cursor-pointer transition-all duration-300 flex items-center justify-center space-x-1"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>Buy Service</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* User Service Purchase History Section */}
          <div className="border-t border-zinc-900 pt-8">
            <h3 className="text-xs uppercase tracking-widest font-mono text-zinc-500 mb-4 flex items-center space-x-2">
              <History className="w-4 h-4 text-zinc-400" />
              <span>Service Purchase History</span>
            </h3>

            {purchases.length === 0 ? (
              <div className="text-center py-10 bg-zinc-950/10 border border-zinc-900/60 rounded-2xl text-xs text-zinc-500">
                You haven't purchased any services yet.
              </div>
            ) : (
              <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-900 bg-zinc-950/80 text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                        <th className="py-3.5 px-4 font-semibold">Service Name</th>
                        <th className="py-3.5 px-4 font-semibold">Price Paid</th>
                        <th className="py-3.5 px-4 font-semibold">Purchase Date</th>
                        <th className="py-3.5 px-4 font-semibold">Status</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-xs text-zinc-300">
                      {purchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-zinc-900/10 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-zinc-200">{purchase.serviceName}</td>
                          <td className="py-3.5 px-4 font-mono">₹{purchase.price}</td>
                          <td className="py-3.5 px-4 text-zinc-400 font-mono">{purchase.purchaseDate}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/10">
                              {purchase.status || "Purchased"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setDeletingPurchase(purchase)}
                              className="p-1.5 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-zinc-500 hover:text-red-400 rounded-lg transition-all duration-300 cursor-pointer"
                              title="Delete History Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                    <span className="text-zinc-200 font-semibold">₹{selectedService.price}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800/80 pt-1.5 mt-1.5">
                    <span className="text-zinc-500">Your Balance:</span>
                    <span className="text-zinc-200 font-semibold">₹{user.walletBalance.toLocaleString("en-IN")}</span>
                  </div>
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
