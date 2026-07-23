import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, onSnapshot, setDoc, addDoc, collection, serverTimestamp, query, where, getDoc, updateDoc, writeBatch, orderBy } from "firebase/firestore";
import { auth, db } from "./firebase";
import { UserProfile, PaymentRequest } from "./types";
import { calculateUserRollingEarnings } from "./utils/earnings";

// Component imports
import AnimatedCounter from "./components/AnimatedCounter";
import WalletCard from "./components/WalletCard";
import AnnouncementsBar from "./components/Announcements";
import NotificationsDropdown from "./components/NotificationsDropdown";
import { SkeletonCard, SkeletonStat } from "./components/SkeletonLoader";
import KYCSection from "./components/KYCSection";
import PaymentRequestSection from "./components/PaymentRequestSection";
import WithdrawalSection from "./components/WithdrawalSection";
import Leaderboard from "./components/Leaderboard";
import ChallengesSection from "./components/ChallengesSection";
import ServicesPage from "./components/ServicesPage";
import ProfileSection from "./components/ProfileSection";
import HistoryPage from "./components/HistoryPage";
import AdminPanel from "./components/AdminPanel";
import SocialMediaIcons from "./components/SocialMediaIcons";
import { logAuditAction } from "./utils/audit";


// Icons
import { 
  Trophy, Wallet, CreditCard, Landmark, History, Award, Shield, User, 
  LogOut, ShieldAlert, Key, AlertCircle, RefreshCw, Layers, Sparkles, HelpCircle, X, Menu, Settings,
  Cpu, Activity, Terminal, Wifi, Lock, ShieldCheck, Database, CheckCircle2,
  BarChart2, GraduationCap, Copy, Check, ExternalLink
} from "lucide-react";

type ActivePage = string;

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [navMenuSettings, setNavMenuSettings] = useState<any[] | null>(null);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dynamic system and feature states
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [featureToggles, setFeatureToggles] = useState<any>({
    enableRegistration: true,
    enableDashboard: true,
    enableLeaderboard: true,
    enableChallenges: true,
    enablePaymentRequests: true,
    enableWithdrawals: true,
    enableKYCUpload: true,
    enableNotifications: true,
    enableReports: true,
    enableServices: true,
    enableSettings: true,
    maintenanceMode: false
  });
  const [websiteSettings, setWebsiteSettings] = useState<any>(null);
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [helpVideoUrl, setHelpVideoUrl] = useState<string | null>(null);
  const [helpVideoTitle, setHelpVideoTitle] = useState("");
  const [badges, setBadges] = useState<any[]>([]);

  // Dashboard modal & interactive states
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [revenueDetailModal, setRevenueDetailModal] = useState<{
    title: string;
    amount: number;
    period: string;
  } | null>(null);

  // Global document title sync
  useEffect(() => {
    if (websiteSettings?.websiteName) {
      document.title = websiteSettings.websiteName;
    } else {
      document.title = "LEARN WITH ANKIT";
    }
  }, [websiteSettings]);

  useEffect(() => {
    // Listen to badges in real-time and auto-seed if empty
    const qBadges = query(collection(db, "badges"), orderBy("displayOrder", "asc"));
    const unsubBadges = onSnapshot(qBadges, async (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      if (list.length === 0) {
        try {
          const batch = writeBatch(db);
          const defaultBadges = [
            {
              name: "Bronze",
              icon: "🥉",
              color: "from-amber-600 via-amber-700 to-amber-800 text-amber-200 border-amber-800/40",
              minEarnings: 0,
              description: "Initial Starter Affiliate - Milestone of ₹0+",
              displayOrder: 1,
              status: "Active"
            },
            {
              name: "Silver",
              icon: "🛡️",
              color: "from-slate-300 via-slate-400 to-zinc-500 text-slate-100 border-slate-300/40",
              minEarnings: 10000,
              description: "Rising Professional Status - Milestone of ₹10,000+",
              displayOrder: 2,
              status: "Active"
            },
            {
              name: "Gold",
              icon: "👑",
              color: "from-amber-300 via-yellow-500 to-yellow-600 text-amber-200 border-yellow-400/40",
              minEarnings: 50000,
              description: "Master Earner Legend - Milestone of ₹50,000+",
              displayOrder: 3,
              status: "Active"
            },
            {
              name: "Diamond",
              icon: "💎",
              color: "from-cyan-400 via-blue-500 to-indigo-600 text-cyan-200 border-cyan-400/40",
              minEarnings: 200000,
              description: "Ultimate Elite Performer - Milestone of ₹2,00,000+",
              displayOrder: 4,
              status: "Active"
            }
          ];
          defaultBadges.forEach((b) => {
            const docRef = doc(collection(db, "badges"));
            batch.set(docRef, b);
          });
          await batch.commit();
        } catch (e) {
          console.error("Failed to seed default badges:", e);
        }
      } else {
        setBadges(list);
      }
    }, (err) => {
      console.warn("Badges subscription error:", err);
    });

    // Listen to feature toggles for Maintenance Mode
    const unsubFeatures = onSnapshot(doc(db, "settings", "features"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFeatureToggles((prev: any) => ({ ...prev, ...data }));
        setMaintenanceMode(!!data.maintenanceMode);
      }
    }, (err) => {
      console.warn("Features settings subscription error (using default toggles):", err);
    });

    // Listen to website settings for dynamic titles, colors, support info, footer, etc.
    const unsubWebsite = onSnapshot(doc(db, "settings", "website"), (snapshot) => {
      if (snapshot.exists()) {
        setWebsiteSettings(snapshot.data());
      }
    }, (err) => {
      console.warn("Website settings subscription error (using fallback defaults):", err);
    });

    // Listen to custom pages in real-time
    const unsubPages = onSnapshot(collection(db, "pages"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((pDoc) => {
        const pData = pDoc.data();
        if (pData.isPublished) {
          list.push({ id: pDoc.id, ...pData });
        }
      });
      setCustomPages(list);
    }, (err) => {
      console.warn("Custom pages subscription error (using empty fallback list):", err);
    });

    // Listen to navigation menu settings
    const unsubNav = onSnapshot(doc(db, "settings", "navigation"), (snapshot) => {
      if (snapshot.exists()) {
        setNavMenuSettings(snapshot.data().menu || []);
      }
    }, (err) => {
      console.warn("Navigation settings subscription error:", err);
    });

    return () => {
      unsubBadges();
      unsubFeatures();
      unsubWebsite();
      unsubPages();
      unsubNav();
    };
  }, []);

  // Handle mobile drawer back button and Escape key press
  useEffect(() => {
    if (isDrawerOpen) {
      window.history.pushState({ drawerOpen: true }, "");
      const handlePopState = () => {
        setIsDrawerOpen(false);
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsDrawerOpen(false);
        }
      };
      window.addEventListener("popstate", handlePopState);
      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isDrawerOpen]);

  // Proactive Maintenance Mode Force Logout
  useEffect(() => {
    if (maintenanceMode && currentUser && currentUser.role !== "founder" && currentUser.role !== "admin") {
      signOut(auth);
      setCurrentUser(null);
      setLoginError("Maintenance Mode Activated. Please try again later.");
    }
  }, [maintenanceMode, currentUser]);

  // Automatic badge calculation & synchronization inside App.tsx
  useEffect(() => {
    if (!currentUser || badges.length === 0) return;

    const isManual = (currentUser as any).badgeMode === "manual";
    if (isManual) return; // Ignore if manual mode is enabled

    const activeBadges = badges.filter(b => b.status === "Active");
    if (activeBadges.length === 0) return;

    // Find highest qualified badge
    const qualified = [...activeBadges]
      .filter(b => (currentUser.totalEarnings || 0) >= (b.minEarnings || 0))
      .sort((a, b) => (b.minEarnings || 0) - (a.minEarnings || 0));

    const correctBadge = qualified.length > 0 ? qualified[0].name : "Bronze";

    if (currentUser.badge !== correctBadge) {
      const userRef = doc(db, "users", currentUser.userId);
      const prevBadge = currentUser.badge || "Bronze";

      updateDoc(userRef, {
        badge: correctBadge
      }).then(() => {
        // Record complete badge history in Firestore
        addDoc(collection(db, "badgeHistory"), {
          userId: currentUser.userId,
          username: currentUser.username,
          previousBadge: prevBadge,
          newBadge: correctBadge,
          changedBy: "System (Auto)",
          mode: "Auto",
          timestamp: serverTimestamp()
        });
      }).catch((err) => {
        console.error("Failed to automatically update user badge:", err);
      });
    }
  }, [currentUser?.totalEarnings, currentUser?.badge, (currentUser as any)?.badgeMode, badges]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribePayments: (() => void) | null = null;

    // Synchronize Auth user state
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseAuthUser) => {
      // Clean up any existing listeners
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (unsubscribePayments) {
        unsubscribePayments();
        unsubscribePayments = null;
      }

      setAuthUser(firebaseAuthUser);
      setAuthLoading(false);

      if (firebaseAuthUser) {
        // Listen to User Profile changes in real-time
        const userRef = doc(db, "users", firebaseAuthUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
          try {
            if (snapshot.exists()) {
              const data = snapshot.data() as UserProfile;
              
              // Enforce Maintenance Mode: Only Founder/Admin allowed
              if (maintenanceMode && data.role !== "founder" && data.role !== "admin") {
                await signOut(auth);
                setCurrentUser(null);
                setAuthUser(null);
                setLoginError("Maintenance Mode Activated. Please try again later.");
                return;
              }
              
              // Check if user is suspended (banned) and whether the ban duration has expired
              if (data.accountStatus === "Suspended" && data.bannedUntil && data.bannedUntil !== "Permanent") {
                const bannedUntilMs = typeof data.bannedUntil === "number" ? data.bannedUntil : new Date(data.bannedUntil).getTime();
                if (Date.now() > bannedUntilMs) {
                  // Ban duration has expired! Automatically restore account status to Active
                  try {
                    await updateDoc(userRef, {
                      accountStatus: "Active",
                      bannedUntil: null,
                      bannedReason: null
                    });
                    return; // The next snapshot trigger will update the UI
                  } catch (err) {
                    console.error("Failed to automatically unban user:", err);
                  }
                }
              }
              
              setCurrentUser(data);
            } else {
              // Document doesn't exist, check if bootstrap admin is logging in
              if (firebaseAuthUser.email === "anmolkumar10290@gmail.com") {
                const profile: UserProfile = {
                  userId: firebaseAuthUser.uid,
                  customUserId: "LWA-ADMIN",
                  username: "Anmol Kumar",
                  email: "anmolkumar10290@gmail.com",
                  phone: "",
                  state: "",
                  role: "admin",
                  badge: "Diamond",
                  accountStatus: "Active",
                  joinDate: new Date().toLocaleDateString("en-IN"),
                  walletBalance: 0,
                  totalEarnings: 0,
                  todayEarnings: 0,
                  last7DaysEarnings: 0,
                  last30DaysEarnings: 0,
                  todayEarningsDate: new Date().toLocaleDateString("en-CA"),
                };
                await setDoc(userRef, profile);
                setCurrentUser(profile);
              } else {
                // Sign out if profile is corrupted
                signOut(auth);
              }
            }
          } catch (snapshotErr) {
            console.error("Error inside profile snapshot handler:", snapshotErr);
          }
        }, (err) => {
          console.error("User profile read error:", err);
        });

        // Listen to approved payments in real-time to compute and synchronize rolling earnings
        const qPayments = query(
          collection(db, "payments"),
          where("userId", "==", firebaseAuthUser.uid),
          where("status", "==", "Approved")
        );
        unsubscribePayments = onSnapshot(qPayments, async (paySnapshot) => {
          try {
            const userPaymentsList: PaymentRequest[] = [];
            paySnapshot.forEach((pDoc) => {
              userPaymentsList.push({ id: pDoc.id, ...pDoc.data() } as PaymentRequest);
            });
            
            const rolling = calculateUserRollingEarnings(userPaymentsList);
            
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data() as UserProfile;
              const updates: Partial<UserProfile> = {};

              if (userData.todayEarnings !== rolling.todayEarnings) {
                updates.todayEarnings = rolling.todayEarnings;
              }
              if (userData.last7DaysEarnings !== rolling.last7DaysEarnings) {
                updates.last7DaysEarnings = rolling.last7DaysEarnings;
              }
              if (userData.last30DaysEarnings !== rolling.last30DaysEarnings) {
                updates.last30DaysEarnings = rolling.last30DaysEarnings;
              }
              if (userData.todayEarningsDate !== rolling.todayEarningsDate) {
                updates.todayEarningsDate = rolling.todayEarningsDate;
              }
              if (userData.totalEarnings === undefined || userData.totalEarnings === null) {
                updates.totalEarnings = rolling.totalEarnings;
              }

              if (Object.keys(updates).length > 0) {
                await updateDoc(userRef, updates);
              }
            }
          } catch (err) {
            console.error("Error updating user rolling earnings:", err);
          }
        }, (payErr) => {
          console.error("Approved payments rolling sync error:", payErr);
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribePayments) unsubscribePayments();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError("Please enter both email and password.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.warn("Auth Login Attempt:", err.code || err.message);

      // Admin Bootstrap Trigger: If email is the designated admin and doesn't exist yet, auto-provision
      if (email.trim() === "anmolkumar10290@gmail.com" && (
        err.code === "auth/user-not-found" || 
        err.code === "auth/invalid-credential" ||
        err.message.includes("not-found") ||
        err.message.includes("invalid-credential")
      )) {
        try {
          const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
          const profile: UserProfile = {
            userId: cred.user.uid,
            customUserId: "LWA-ADMIN",
            username: "Anmol Kumar",
            email: "anmolkumar10290@gmail.com",
            phone: "",
            state: "",
            role: "admin",
            badge: "Diamond",
            accountStatus: "Active",
            joinDate: new Date().toLocaleDateString("en-IN"),
            walletBalance: 0,
            totalEarnings: 0,
            todayEarnings: 0,
            last7DaysEarnings: 0,
            last30DaysEarnings: 0,
          };
          await setDoc(doc(db, "users", cred.user.uid), profile);
        } catch (signupErr) {
          console.error("Admin signup error:", signupErr);
          setLoginError("Account creation error. Try again.");
        }
      } else {
        setLoginError("Invalid credentials. Please contact administration for authorization details.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthUser(null);
      setCurrentUser(null);
      setActivePage("dashboard");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleUpdateLocalUser = (updatedFields: Partial<UserProfile>) => {
    if (currentUser) {
      setCurrentUser({ ...currentUser, ...updatedFields });
    }
  };

  const activeUser: UserProfile | null = currentUser || (authUser ? {
    userId: authUser.uid,
    username: authUser.displayName || authUser.email?.split("@")[0] || "User",
    email: authUser.email || "",
    phone: "",
    state: "",
    role: "user",
    badge: "Bronze",
    accountStatus: "Active",
    joinDate: new Date().toLocaleDateString("en-IN"),
    walletBalance: 0,
    todayEarnings: 0,
    last7DaysEarnings: 0,
    last30DaysEarnings: 0,
    totalEarnings: 0,
  } : null);

  const getNavItemIcon = (id: string) => {
    switch (id) {
      case "dashboard": return <Layers className="w-4.5 h-4.5 text-amber-400 shrink-0" />;
      case "payment": return <CreditCard className="w-4.5 h-4.5 text-emerald-400 shrink-0" />;
      case "withdrawal": return <Landmark className="w-4.5 h-4.5 text-amber-400 shrink-0" />;
      case "history": return <History className="w-4.5 h-4.5 text-blue-400 shrink-0" />;
      case "leaderboard": return <Trophy className="w-4.5 h-4.5 text-yellow-400 shrink-0" />;
      case "challenge": return <Award className="w-4.5 h-4.5 text-purple-400 shrink-0" />;
      case "kyc": return <Shield className="w-4.5 h-4.5 text-cyan-400 shrink-0" />;
      case "services": return <Sparkles className="w-4.5 h-4.5 text-amber-500 shrink-0" />;
      case "profile": return <User className="w-4.5 h-4.5 text-zinc-300 shrink-0" />;
      case "admin": return <ShieldAlert className="w-4.5 h-4.5 text-red-400 shrink-0" />;
      default: return <Layers className="w-4.5 h-4.5 text-amber-400 shrink-0" />;
    }
  };

  const defaultNavList = [
    { id: "dashboard", label: "Dashboard", show: featureToggles.enableDashboard !== false },
    { id: "payment", label: "Payment Claims", show: featureToggles.enablePaymentRequests !== false },
    { id: "withdrawal", label: "Withdrawals", show: featureToggles.enableWithdrawals !== false },
    { id: "history", label: "History Log", show: true },
    { id: "leaderboard", label: "Leaderboard", show: featureToggles.enableLeaderboard !== false },
    { id: "challenge", label: "Challenges", show: featureToggles.enableChallenges !== false },
    { id: "kyc", label: "KYC Verification", show: featureToggles.enableKYCUpload !== false },
    { id: "services", label: "Services", show: featureToggles.enableServices !== false },
    { id: "profile", label: "My Profile", show: featureToggles.enableSettings !== false },
  ];

  let drawerMenuItems: any[] = [];

  if (navMenuSettings && navMenuSettings.length > 0) {
    drawerMenuItems = navMenuSettings
      .filter(item => item.visible !== false && item.id !== "admin")
      .map(item => {
        let isVisibleByFeature = true;
        if (item.id === "dashboard" && featureToggles.enableDashboard === false) isVisibleByFeature = false;
        if (item.id === "payment" && featureToggles.enablePaymentRequests === false) isVisibleByFeature = false;
        if (item.id === "withdrawal" && featureToggles.enableWithdrawals === false) isVisibleByFeature = false;
        if (item.id === "leaderboard" && featureToggles.enableLeaderboard === false) isVisibleByFeature = false;
        if (item.id === "challenge" && featureToggles.enableChallenges === false) isVisibleByFeature = false;
        if (item.id === "kyc" && featureToggles.enableKYCUpload === false) isVisibleByFeature = false;
        if (item.id === "services" && featureToggles.enableServices === false) isVisibleByFeature = false;
        if (item.id === "profile" && featureToggles.enableSettings === false) isVisibleByFeature = false;

        return {
          id: item.id.startsWith("custom_page_") || item.type === "custom" ? (item.id.startsWith("custom_page_") ? item.id : `custom_page_${item.id}`) : item.id,
          label: item.label,
          icon: getNavItemIcon(item.id),
          show: isVisibleByFeature
        };
      })
      .filter(item => item.show);
  } else {
    drawerMenuItems = [
      ...defaultNavList.filter(item => item.show).map(item => ({
        ...item,
        icon: getNavItemIcon(item.id)
      })),
      ...customPages.map(page => ({
        id: `custom_page_${page.slug}`,
        label: page.title,
        icon: <Layers className="w-4.5 h-4.5 text-amber-400 shrink-0" />,
        show: true
      }))
    ];
  }

  const sidebarNavItems = [
    ...drawerMenuItems,
    ...(activeUser && (activeUser.role === "admin" || activeUser.role === "founder" || activeUser.role === "co-founder" || activeUser.role === "co_founder")
      ? [{ id: "admin", label: "Admin Console", icon: <ShieldAlert className="w-4.5 h-4.5 text-red-400 shrink-0" />, show: true }]
      : [])
  ];

  useEffect(() => {
    if (activeUser && sidebarNavItems.length > 0) {
      const isCurrentPageVisible = sidebarNavItems.some(item => item.id === activePage || (activePage.startsWith("custom_page_") && item.id === activePage));
      if (!isCurrentPageVisible) {
        setActivePage(sidebarNavItems[0].id as any);
      }
    }
  }, [featureToggles, activePage, activeUser, navMenuSettings]);


  // --- LOGGED OUT LOGIN SCREEN ---
  if (!activeUser) {
    return (
      <div className="min-h-screen bg-linear-to-b from-slate-950 via-zinc-950 to-black flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-950/40 backdrop-blur-xl border border-zinc-900 rounded-3xl p-8 relative overflow-hidden shadow-2xl space-y-6">
          <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60" />

          {/* Logo Heading */}
          <div className="text-center space-y-1 flex flex-col items-center">
            {websiteSettings?.logoUrl ? (
              <img src={websiteSettings.logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-2 rounded-xl" referrerPolicy="no-referrer" />
            ) : (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-mono tracking-widest font-bold uppercase mb-2">
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span>Fintech Secure Portal</span>
              </span>
            )}
            <h1 className="text-2xl font-display font-black tracking-tight text-zinc-100 uppercase">{websiteSettings?.websiteName || "LEARN WITH ANKIT"}</h1>
            <p className="text-xs text-zinc-500 font-medium">Earnings Tracking & Management Console</p>
          </div>



          {/* Data Loading States */}
          {authLoading ? (
            <div className="py-8 text-center">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
              <p className="text-xs text-zinc-400 font-mono">Loading portal...</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 pt-1">
              {maintenanceMode && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-semibold">Maintenance Mode Activated. Only authorized accounts (Founder/Admin) can log in now.</span>
                </div>
              )}

              {loginError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{loginError}</span>
                </div>
              )}

              <div>
                <label htmlFor="loginEmail" className="block text-[10px] text-zinc-400 font-mono uppercase tracking-widest mb-1.5 font-semibold">
                  Authorization Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-600">
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <input
                    id="loginEmail"
                    type="email"
                    required
                    placeholder="admin@learnwithankit.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/60 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-sans"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="loginPass" className="block text-[10px] text-zinc-400 font-mono uppercase tracking-widest mb-1.5 font-semibold">
                  Access Token Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-600">
                    <Key className="w-4.5 h-4.5" />
                  </span>
                  <input
                    id="loginPass"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/60 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-hidden focus:border-amber-500/60 transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 disabled:from-zinc-800 disabled:to-zinc-900 disabled:text-zinc-600 font-display font-extrabold text-slate-950 text-sm py-3.5 px-4 rounded-xl shadow-lg transition-all duration-300 transform active:scale-98 flex items-center justify-center space-x-2 cursor-pointer gold-glow"
                >
                  {loginLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>AUTHORIZE ACCESS</span>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-zinc-900 pt-4 text-center space-y-3">
            <p className="text-[10px] text-zinc-500 font-mono flex items-center justify-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-zinc-600" />
              <span>SECURED VAULT ACCESS PORTAL</span>
            </p>
            <div className="flex justify-center items-center space-x-3 text-[10px] text-zinc-500 font-sans">
              <a
                href="https://learnwithankit.odoo.com/terms-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-500 transition-colors underline"
              >
                Terms & Conditions
              </a>
              <span className="text-zinc-700">•</span>
              <a
                href="https://learnwithankit.odoo.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-500 transition-colors underline"
              >
                Privacy Policy
              </a>
              <span className="text-zinc-700">•</span>
              <a
                href="https://learnwithankit.odoo.com/community-guidelines"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-500 transition-colors underline"
              >
                Community Guidelines
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- SUSPENDED USER SCREEN ---
  if (activeUser && activeUser.accountStatus === "Suspended" && activeUser.role !== "admin" && activeUser.role !== "founder" && activeUser.role !== "co-founder") {
    let durationString = "Permanent Ban";
    if (activeUser.bannedUntil && activeUser.bannedUntil !== "Permanent") {
      const remainingMs = typeof activeUser.bannedUntil === "number" ? activeUser.bannedUntil - Date.now() : new Date(activeUser.bannedUntil).getTime() - Date.now();
      if (remainingMs > 0) {
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        if (remainingMinutes < 60) {
          durationString = `${remainingMinutes} Minute(s) Remaining`;
        } else {
          const remainingHours = Math.ceil(remainingMinutes / 60);
          if (remainingHours < 24) {
            durationString = `${remainingHours} Hour(s) Remaining`;
          } else {
            const remainingDays = Math.ceil(remainingHours / 24);
            durationString = `${remainingDays} Day(s) Remaining`;
          }
        }
      } else {
        durationString = "Expiring soon... please refresh";
      }
    }

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full max-w-md bg-zinc-950 border border-red-500/20 rounded-3xl p-8 relative shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 text-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-display font-black tracking-tight text-red-400 uppercase">Account Suspended</h1>
            <p className="text-sm text-zinc-400">Your affiliate access has been temporarily or permanently suspended by the administration console.</p>
          </div>
          
          <div className="bg-slate-950/80 rounded-2xl p-4.5 border border-zinc-900 text-left space-y-2.5 font-mono text-xs">
            <p className="text-zinc-500"><span className="text-zinc-400 font-semibold uppercase">Affiliate ID:</span> {activeUser.customUserId || activeUser.userId}</p>
            <p className="text-zinc-500"><span className="text-zinc-400 font-semibold uppercase">Ban Duration:</span> <span className="text-red-400 font-bold">{durationString}</span></p>
            {activeUser.bannedReason && (
              <p className="text-zinc-500"><span className="text-zinc-400 font-semibold uppercase">Reason:</span> <span className="text-zinc-300">{activeUser.bannedReason}</span></p>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs uppercase tracking-wider font-semibold py-3 px-4 rounded-xl cursor-pointer transition-all active:scale-98"
            >
              Check For Status Update
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs uppercase tracking-wider font-semibold py-3 px-4 rounded-xl cursor-pointer transition-all active:scale-98"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOGGED IN DASHBOARD SYSTEM ---
  const activePageVideo = (() => {
    switch (activePage) {
      case "dashboard": return { url: websiteSettings?.dashboardVideoUrl, title: "Dashboard Overview Tutorial" };
      case "payment": return { url: websiteSettings?.paymentVideoUrl, title: "Payment Claim Tutorial" };
      case "withdrawal": return { url: websiteSettings?.withdrawalVideoUrl, title: "Withdrawal Tutorial" };
      case "profile": return { url: websiteSettings?.profileVideoUrl, title: "My Profile Tutorial" };
      case "kyc": return { url: websiteSettings?.kycVideoUrl, title: "KYC Verification Tutorial" };
      case "challenge": return { url: websiteSettings?.challengeVideoUrl, title: "Challenges & Incentives Tutorial" };
      default: return null;
    }
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100 flex flex-col font-sans">
      
      {/* Dynamic Color Theme Injector */}
      {websiteSettings?.themeColor && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --color-amber-500: ${websiteSettings.themeColor} !important;
            --color-amber-400: ${websiteSettings.themeColor} !important;
            --color-amber-600: ${websiteSettings.themeColor} !important;
          }
          .gold-glow {
            box-shadow: 0 0 15px -3px ${websiteSettings.themeColor}33 !important;
          }
        `}} />
      )}

      {/* Top Ticker Announcements Bar */}
      <AnnouncementsBar />
 
      {/* Main Top Header Navigation */}
      <header className="sticky top-0 bg-black/90 backdrop-blur-xl border-b border-zinc-900 px-4 sm:px-6 py-3.5 flex items-center justify-between z-40">
        <div className="flex items-center space-x-3 select-none">
          {/* Hamburger Menu Toggle Button */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 text-zinc-300 hover:text-amber-400 hover:bg-zinc-900 rounded-xl border border-zinc-850 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo & Website Title */}
          <div
            onClick={() => setActivePage("dashboard")}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            {websiteSettings?.logoUrl ? (
              <img src={websiteSettings.logoUrl} alt="Logo" className="w-8.5 h-8.5 object-contain rounded-lg" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center font-display font-extrabold text-slate-950 shadow-md gold-glow group-hover:scale-105 transition-transform">
                ★
              </div>
            )}
            <div>
              <h1 className="text-xs sm:text-sm font-display font-black tracking-tight text-zinc-100 uppercase group-hover:text-amber-400 transition-colors">
                {websiteSettings?.websiteName || "LEARN WITH ANKIT"}
              </h1>
              <p className="text-[8px] uppercase tracking-widest text-amber-500/80 font-mono font-bold">
                FINTECH ELITE V5.0
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {activePageVideo?.url && (
            <button
              onClick={() => {
                setHelpVideoUrl(activePageVideo.url);
                setHelpVideoTitle(activePageVideo.title);
              }}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 rounded-full text-[10px] sm:text-xs font-bold uppercase cursor-pointer transition-all duration-300"
              title="Watch Page Tutorial"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Page Tutorial</span>
            </button>
          )}

          <NotificationsDropdown userId={activeUser.userId || ""} userRole={activeUser.role || "user"} />

          <button
            onClick={() => setActivePage("profile")}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800"
            title="My Profile"
          >
            {activeUser.profilePic ? (
              <img src={activeUser.profilePic} alt={activeUser.username} className="w-7.5 h-7.5 rounded-lg object-cover border border-zinc-800" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-7.5 h-7.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-amber-400 text-xs">
                {(activeUser.username || "U").charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* --- HAMBURGER SIDEBAR NAVIGATION DRAWER --- */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />

          {/* Drawer Sidebar Container */}
          <div className="relative w-80 max-w-[85vw] h-full bg-black border-r border-zinc-900 text-zinc-100 flex flex-col justify-between z-10 shadow-2xl overflow-y-auto animate-slide-in-left select-none">
            
            {/* SIDEBAR HEADER */}
            <div className="p-5 border-b border-zinc-900 bg-zinc-950/90 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {websiteSettings?.logoUrl ? (
                    <img src={websiteSettings.logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center font-display font-extrabold text-slate-950 shadow-md gold-glow">
                      ★
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-display font-black tracking-tight text-zinc-100 uppercase">
                      {websiteSettings?.websiteName || "LEARN WITH ANKIT"}
                    </h2>
                    <p className="text-[9px] uppercase tracking-widest text-amber-400 font-mono font-bold">
                      FINTECH ELITE V5.0
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-colors cursor-pointer"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile Card */}
              <div className="p-3 bg-slate-950 border border-zinc-850 rounded-2xl flex items-center space-x-3 shadow-inner">
                {activeUser.profilePic ? (
                  <img
                    src={activeUser.profilePic}
                    alt={activeUser.username || "User"}
                    className="w-10 h-10 rounded-xl object-cover border border-amber-500/30 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-display font-extrabold text-amber-400 text-sm shrink-0">
                    {(activeUser.username || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden space-y-0.5">
                  <p className="text-xs font-display font-bold text-zinc-100 truncate">
                    {activeUser.username || "User"}
                  </p>
                  <p className="text-[9px] text-zinc-500 font-mono truncate">
                    ID: {activeUser.customUserId || activeUser.userId || "N/A"}
                  </p>
                  <div>
                    <span className={`inline-block px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded-md border ${
                      activeUser.role === "founder" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                      activeUser.role === "co-founder" || activeUser.role === "co_founder" ? "bg-purple-500/20 text-purple-300 border-purple-500/40" :
                      activeUser.role === "admin" ? "bg-red-500/20 text-red-300 border-red-500/40" :
                      "bg-zinc-800 text-zinc-300 border-zinc-700"
                    }`}>
                      {activeUser.role === "founder" ? "Founder" :
                       activeUser.role === "co-founder" || activeUser.role === "co_founder" ? "Co-Founder" :
                       activeUser.role === "admin" ? "Admin" : "User"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MENU ITEMS */}
            <div className="flex-1 p-4 space-y-1 overflow-y-auto">
              <p className="px-3 text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Navigation Menu
              </p>

              {drawerMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                    activePage === item.id
                      ? "bg-amber-500 text-slate-950 font-extrabold shadow-md gold-glow"
                      : "text-zinc-300 hover:text-amber-400 hover:bg-zinc-900/60"
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}

              {/* FOUNDER SECTION */}
              {(activeUser.role === "founder" || activeUser.role === "co-founder" || activeUser.role === "co_founder" || activeUser.role === "admin") && (
                <div className="pt-4 mt-2 border-t border-zinc-900">
                  <div className="px-3 pb-2 flex items-center justify-between">
                    <span className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-widest">
                      FOUNDER
                    </span>
                    <span className="text-[8px] font-mono text-zinc-600 uppercase">Admin Access</span>
                  </div>

                  <button
                    onClick={() => {
                      setActivePage("admin");
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                      activePage === "admin"
                        ? "bg-red-500 text-zinc-100 font-extrabold shadow-md gold-glow"
                        : "text-red-400 hover:bg-red-500/10 border border-red-500/20"
                    }`}
                  >
                    <ShieldAlert className="w-4.5 h-4.5 text-red-400 shrink-0" />
                    <span>Admin Console</span>
                  </button>
                </div>
              )}
            </div>

            {/* BOTTOM MENU */}
            <div className="p-4 border-t border-zinc-900 bg-zinc-950/90 space-y-1">
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  if (activePageVideo?.url) {
                    setHelpVideoUrl(activePageVideo.url);
                    setHelpVideoTitle(activePageVideo.title);
                  } else {
                    alert("Help & Tutorials: Click 'Page Tutorial' on top right or visit Community Guidelines in footer.");
                  }
                }}
                className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-amber-400 hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4.5 h-4.5 text-amber-400 shrink-0" />
                <span>Help & Tutorials</span>
              </button>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setActivePage("profile");
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activePage === "profile" ? "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                <Settings className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                <span>Settings</span>
              </button>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4.5 h-4.5 text-red-400 shrink-0" />
                <span>Logout</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Main Dashboard Layout Container */}
      <div className="flex-1 flex flex-col relative">


        {/* Active Content Panel */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 bg-linear-to-b from-slate-950 via-zinc-950/20 to-black overflow-y-auto">
          {maintenanceMode && activeUser.role !== "founder" && activeUser.role !== "admin" ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4 max-w-md mx-auto text-center py-20 animate-fade-in">
              <AlertCircle className="w-16 h-16 text-amber-500 animate-pulse" />
              <h2 className="text-xl font-display font-black text-zinc-100 uppercase tracking-tight">Maintenance Mode Activated</h2>
              <p className="text-zinc-400 text-xs font-sans">Maintenance Mode Activated. Please try again later.</p>
            </div>
          ) : (
            <>
              {activePage === "dashboard" && (
            <div className="space-y-8 max-w-5xl mx-auto animate-fade-in">
              {/* Profile Top bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-5 rounded-2xl glass-panel border border-zinc-800 shadow-xl gap-4">
                <div className="flex items-center space-x-4">
                  {activeUser.profilePic ? (
                    <img
                      src={activeUser.profilePic}
                      alt={activeUser.username || "User"}
                      className="w-14 h-14 rounded-xl object-cover border border-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center font-display font-extrabold text-zinc-300 text-lg">
                      {(activeUser.username || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="font-sans space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-display font-bold text-zinc-100">{activeUser.username || "User"}</h2>
                      <span className="text-[9px] uppercase tracking-widest font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-sm">
                        {activeUser.accountStatus || "Active"}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono">Affiliate User ID: {activeUser.customUserId || activeUser.userId || "N/A"}</p>
                    <p className="text-[10px] text-zinc-400">Join Date: {activeUser.joinDate || "N/A"}</p>
                  </div>
                </div>

                <div className="flex space-x-3 items-center">
                  <div className="text-center bg-slate-950/65 px-4 py-2 rounded-xl border border-zinc-900">
                    <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono block">Achievement level</span>
                    <span className="text-xs font-display font-bold text-amber-400">
                      {badges.find(b => b.name === activeUser.badge)?.icon || "★"}{" "}
                      {(activeUser.customBadge || activeUser.badge || "Bronze").toUpperCase()} Badge
                    </span>
                  </div>
                  {(activeUser as any).customRank && (
                    <div className="text-center bg-slate-950/65 px-4 py-2 rounded-xl border border-zinc-900">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono block">Custom Rank</span>
                      <span className="text-xs font-display font-bold text-emerald-400">{(activeUser as any).customRank}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Earnings Counters section */}
              <div className="space-y-3.5">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Chronological Earnings Counters</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Today's Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={activeUser.todayEarnings || 0} />
                    </div>
                  </div>
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Last 7 Days Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={activeUser.last7DaysEarnings || 0} />
                    </div>
                  </div>
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Last 30 Days Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={activeUser.last30DaysEarnings || 0} />
                    </div>
                  </div>
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Lifetime Cumulative Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={activeUser.totalEarnings || 0} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallet Card Center Stage */}
              <div className="flex flex-col items-center space-y-4 pt-4 border-t border-zinc-900 pb-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Premium Wallet Balance Card</h3>
                <WalletCard balance={activeUser.walletBalance ?? 0} username={activeUser.username || "User"} />
              </div>

              {/* Dashboard Social Footer */}
              <div className="pt-6 border-t border-zinc-900/50 flex flex-col items-center justify-center space-y-3.5 pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Connect with Founder & Community</span>
                <SocialMediaIcons className="scale-95" />
              </div>
            </div>
          )}

          {activePage === "payment" && (
            <PaymentRequestSection user={activeUser} />
          )}

          {activePage === "withdrawal" && (
            <WithdrawalSection user={activeUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "history" && (
            <HistoryPage user={activeUser} />
          )}

          {activePage === "leaderboard" && (
            <Leaderboard currentUser={activeUser} />
          )}

          {activePage === "challenge" && (
            <ChallengesSection user={activeUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "kyc" && (
            <KYCSection user={activeUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "services" && (
            <ServicesPage user={activeUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "profile" && (
            <ProfileSection user={activeUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "admin" && (activeUser.role === "admin" || activeUser.role === "founder" || activeUser.role === "co-founder" || activeUser.role === "co_founder") && (
            <AdminPanel adminUser={activeUser} />
          )}

          {activePage.startsWith("custom_page_") && (() => {
            const currentSlug = activePage.replace("custom_page_", "");
            const page = customPages.find(p => p.slug === currentSlug);
            if (!page) return <div className="text-zinc-500 text-center py-12">Page not found.</div>;
            return (
              <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
                <div className="space-y-3">
                  <h2 className="text-2xl font-display font-black text-zinc-100 border-b border-zinc-900 pb-3 uppercase tracking-tight">{page.title}</h2>
                  {page.imageUrl && (
                    <img src={page.imageUrl} alt={page.title} className="w-full max-h-80 object-cover rounded-2xl border border-zinc-800 shadow-xl" referrerPolicy="no-referrer" />
                  )}
                </div>
                <div className="prose prose-zinc prose-invert max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans text-sm">
                  {page.content}
                </div>
              </div>
            );
          })()}
            </>
          )}

          {/* Universal Footer */}
          <footer className="mt-12 pt-6 border-t border-zinc-900 text-center space-y-4 pb-4">
            <SocialMediaIcons className="mb-2" />
            <p className="text-zinc-500 text-xs font-sans">
              {websiteSettings?.footerText || "© 2026 LEARN WITH ANKIT. All rights reserved."}
            </p>
            {(websiteSettings?.supportEmail || websiteSettings?.supportPhone) && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-zinc-400">
                {websiteSettings?.supportEmail && (
                  <span>Email Support: <a href={`mailto:${websiteSettings.supportEmail}`} className="text-amber-400 hover:underline">{websiteSettings.supportEmail}</a></span>
                )}
                {websiteSettings?.supportPhone && (
                  <span>Call Support: <a href={`tel:${websiteSettings.supportPhone}`} className="text-amber-400 hover:underline">{websiteSettings.supportPhone}</a></span>
                )}
              </div>
            )}
          </footer>

        </main>
      </div>

      {/* Tutorial Video Player Modal */}
      {helpVideoUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-amber-500/10 via-amber-500 to-amber-500/10" />
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
              <h3 className="font-display font-semibold text-zinc-100 flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <span>{helpVideoTitle}</span>
              </h3>
              <button
                onClick={() => setHelpVideoUrl(null)}
                className="p-1.5 rounded-lg bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Container */}
            <div className="aspect-video bg-black flex items-center justify-center relative">
              {helpVideoUrl.includes("youtube.com") || helpVideoUrl.includes("youtu.be") ? (() => {
                let embedId = "";
                if (helpVideoUrl.includes("embed/")) {
                  embedId = helpVideoUrl.split("embed/")[1]?.split("?")[0] || "";
                } else if (helpVideoUrl.includes("v=")) {
                  embedId = helpVideoUrl.split("v=")[1]?.split("&")[0] || "";
                } else if (helpVideoUrl.includes("youtu.be/")) {
                  embedId = helpVideoUrl.split("youtu.be/")[1]?.split("?")[0] || "";
                }
                
                if (embedId) {
                  return (
                    <iframe
                      src={`https://www.youtube.com/embed/${embedId}`}
                      title="Tutorial Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-none"
                    />
                  );
                }
                return (
                  <video src={helpVideoUrl} controls className="w-full h-full" />
                );
              })() : helpVideoUrl.includes(".mp4") || helpVideoUrl.includes(".webm") || helpVideoUrl.includes(".ogg") ? (
                <video src={helpVideoUrl} controls className="w-full h-full" />
              ) : (
                <div className="p-8 text-center space-y-4">
                  <p className="text-zinc-400 text-sm">This video URL cannot be embedded directly. Please click the button below to view the tutorial.</p>
                  <a
                    href={helpVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all duration-300 shadow-md"
                  >
                    <span>Open Video in New Tab</span>
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-900 flex justify-end">
              <button
                onClick={() => setHelpVideoUrl(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl text-xs border border-zinc-800 transition-colors cursor-pointer"
              >
                Close Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVENUE DETAIL POPUP MODAL */}
      {revenueDetailModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-850">
              <h3 className="text-base font-display font-bold text-zinc-100 flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{revenueDetailModal.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRevenueDetailModal(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900/80 border border-zinc-850 p-5 rounded-2xl text-center space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 block">
                Recorded Revenue ({revenueDetailModal.period})
              </span>
              <div className="text-3xl font-display font-black text-amber-400">
                ₹ {revenueDetailModal.amount.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="space-y-2 text-xs text-zinc-400 font-sans">
              <p className="leading-relaxed">
                This total reflects all verified commissions, platform earnings, and task payouts recorded during the <strong className="text-zinc-200">{revenueDetailModal.period}</strong> timeline for user <strong className="text-amber-400">{activeUser?.username || "Account"}</strong>.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setRevenueDetailModal(null);
                  setActivePage("history");
                }}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all text-center cursor-pointer shadow-md"
              >
                View Full Transaction Logs
              </button>
              <button
                type="button"
                onClick={() => setRevenueDetailModal(null)}
                className="py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-xs transition-all cursor-pointer border border-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
