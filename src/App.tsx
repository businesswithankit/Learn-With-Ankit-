import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, onSnapshot, setDoc, addDoc, collection, serverTimestamp, query, where, getDoc, updateDoc } from "firebase/firestore";
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
  LogOut, ShieldAlert, Key, AlertCircle, RefreshCw, Layers, Sparkles, HelpCircle, X 
} from "lucide-react";

type ActivePage = string;

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activePage, setActivePage] = useState<ActivePage>("dashboard");

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

  // Global document title sync
  useEffect(() => {
    if (websiteSettings?.websiteName) {
      document.title = websiteSettings.websiteName;
    } else {
      document.title = "LEARN WITH ANKIT";
    }
  }, [websiteSettings]);

  useEffect(() => {
    // Listen to feature toggles for Maintenance Mode
    const unsubFeatures = onSnapshot(doc(db, "settings", "features"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFeatureToggles((prev: any) => ({ ...prev, ...data }));
        setMaintenanceMode(!!data.maintenanceMode);
      }
    });

    // Listen to website settings for dynamic titles, colors, support info, footer, etc.
    const unsubWebsite = onSnapshot(doc(db, "settings", "website"), (snapshot) => {
      if (snapshot.exists()) {
        setWebsiteSettings(snapshot.data());
      }
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
    });

    return () => {
      unsubFeatures();
      unsubWebsite();
      unsubPages();
    };
  }, []);

  // Proactive Maintenance Mode Force Logout
  useEffect(() => {
    if (maintenanceMode && currentUser && currentUser.role !== "founder" && currentUser.role !== "admin") {
      signOut(auth);
      setCurrentUser(null);
      setLoginError("Maintenance Mode Activated. Please try again later.");
    }
  }, [maintenanceMode, currentUser]);

  useEffect(() => {
    // Synchronize Auth user state
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        // Listen to User Profile changes in real-time
        const userRef = doc(db, "users", authUser.uid);
        
        const unsubscribeProfile = onSnapshot(userRef, async (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as UserProfile;
            
            // Enforce Maintenance Mode: Only Founder/Admin allowed
            if (maintenanceMode && data.role !== "founder" && data.role !== "admin") {
              await signOut(auth);
              setCurrentUser(null);
              setLoginError("Maintenance Mode Activated. Please try again later.");
              setAuthLoading(false);
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

            // Log Login event once per session
            if (!sessionStorage.getItem("logged_in_audit")) {
              sessionStorage.setItem("logged_in_audit", "true");
              logAuditAction(
                data.userId,
                data.username,
                "Login",
                "Self",
                `User logged in successfully with role: ${data.role}`
              );
            }
          } else {
            // Document doesn't exist, check if bootstrap admin is logging in
            if (authUser.email === "anmolkumar10290@gmail.com") {
              const profile: UserProfile = {
                userId: authUser.uid,
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
          setAuthLoading(false);
        }, (err) => {
          console.error("User profile read error:", err);
          setAuthLoading(false);
        });

        // Listen to approved payments in real-time to compute and synchronize rolling earnings
        const qPayments = query(
          collection(db, "payments"),
          where("userId", "==", authUser.uid),
          where("status", "==", "Approved")
        );
        const unsubscribePayments = onSnapshot(qPayments, async (paySnapshot) => {
          const userPaymentsList: PaymentRequest[] = [];
          paySnapshot.forEach((pDoc) => {
            userPaymentsList.push({ id: pDoc.id, ...pDoc.data() } as PaymentRequest);
          });
          
          const rolling = calculateUserRollingEarnings(userPaymentsList);
          
          try {
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data() as UserProfile;
              if (
                userData.todayEarnings !== rolling.todayEarnings ||
                userData.last7DaysEarnings !== rolling.last7DaysEarnings ||
                userData.last30DaysEarnings !== rolling.last30DaysEarnings ||
                userData.totalEarnings !== rolling.totalEarnings ||
                userData.todayEarningsDate !== rolling.todayEarningsDate
              ) {
                await updateDoc(userRef, {
                  todayEarnings: rolling.todayEarnings,
                  last7DaysEarnings: rolling.last7DaysEarnings,
                  last30DaysEarnings: rolling.last30DaysEarnings,
                  totalEarnings: rolling.totalEarnings,
                  todayEarningsDate: rolling.todayEarningsDate
                });
              }
            }
          } catch (err) {
            console.error("Error updating user rolling earnings:", err);
          }
        }, (payErr) => {
          console.error("Approved payments rolling sync error:", payErr);
        });

        return () => {
          unsubscribeProfile();
          unsubscribePayments();
        };
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
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
      if (currentUser) {
        await logAuditAction(
          currentUser.userId,
          currentUser.username,
          "Logout",
          "Self",
          "User logged out of session"
        );
      }
      sessionStorage.removeItem("logged_in_audit");
      await signOut(auth);
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="font-display text-zinc-400 text-sm tracking-widest uppercase">Initializing Secure Terminal...</p>
      </div>
    );
  }

  // --- LOGGED OUT LOGIN SCREEN ---
  if (!currentUser) {
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

          <form onSubmit={handleLogin} className="space-y-4 pt-2">
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
  if (currentUser && currentUser.accountStatus === "Suspended" && currentUser.role !== "admin" && currentUser.role !== "founder" && currentUser.role !== "co-founder") {
    let durationString = "Permanent Ban";
    if (currentUser.bannedUntil && currentUser.bannedUntil !== "Permanent") {
      const remainingMs = typeof currentUser.bannedUntil === "number" ? currentUser.bannedUntil - Date.now() : new Date(currentUser.bannedUntil).getTime() - Date.now();
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
            <p className="text-zinc-500"><span className="text-zinc-400 font-semibold uppercase">Affiliate ID:</span> {currentUser.customUserId || currentUser.userId}</p>
            <p className="text-zinc-500"><span className="text-zinc-400 font-semibold uppercase">Ban Duration:</span> <span className="text-red-400 font-bold">{durationString}</span></p>
            {currentUser.bannedReason && (
              <p className="text-zinc-500"><span className="text-zinc-400 font-semibold uppercase">Reason:</span> <span className="text-zinc-300">{currentUser.bannedReason}</span></p>
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

  const sidebarNavItems = [
    { id: "dashboard", label: "Dashboard", icon: <Layers className="w-4.5 h-4.5" />, show: featureToggles.enableDashboard !== false },
    { id: "payment", label: "Payment Claims", icon: <CreditCard className="w-4.5 h-4.5" />, show: featureToggles.enablePaymentRequests !== false },
    { id: "withdrawal", label: "Withdrawals", icon: <Landmark className="w-4.5 h-4.5" />, show: featureToggles.enableWithdrawals !== false },
    { id: "history", label: "History Log", icon: <History className="w-4.5 h-4.5" />, show: true },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy className="w-4.5 h-4.5" />, show: featureToggles.enableLeaderboard !== false },
    { id: "challenge", label: "Challenges", icon: <Award className="w-4.5 h-4.5" />, show: featureToggles.enableChallenges !== false },
    { id: "kyc", label: "KYC Verification", icon: <Shield className="w-4.5 h-4.5" />, show: featureToggles.enableKYCUpload !== false },
    { id: "services", label: "Services", icon: <Sparkles className="w-4.5 h-4.5 text-amber-500/80" />, show: featureToggles.enableServices !== false },
    { id: "profile", label: "My Profile", icon: <User className="w-4.5 h-4.5" />, show: featureToggles.enableSettings !== false },
    ...customPages.map((page) => ({
      id: `custom_page_${page.slug}`,
      label: page.title,
      icon: <Layers className="w-4.5 h-4.5 text-amber-500/80" />,
      show: true
    })),
    ...(currentUser && (currentUser.role === "admin" || currentUser.role === "founder" || currentUser.role === "co-founder" || currentUser.role === "co_founder")
      ? [{ id: "admin", label: "Admin Console", icon: <ShieldAlert className="w-4.5 h-4.5 text-red-400" />, show: true }] 
      : [])
  ].filter(item => item.show);

  useEffect(() => {
    if (currentUser && sidebarNavItems.length > 0) {
      const isCurrentPageVisible = sidebarNavItems.some(item => item.id === activePage || (activePage.startsWith("custom_page_") && item.id === activePage));
      if (!isCurrentPageVisible) {
        setActivePage(sidebarNavItems[0].id as any);
      }
    }
  }, [featureToggles, activePage, currentUser]);

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
      <header className="sticky top-0 bg-slate-950/80 backdrop-blur-xl border-b border-zinc-900 px-4 sm:px-6 py-4 flex items-center justify-between z-40">
        <div className="flex items-center space-x-3 select-none">
          {websiteSettings?.logoUrl ? (
            <img src={websiteSettings.logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 flex items-center justify-center font-display font-extrabold text-slate-950 shadow-md gold-glow">
              ★
            </div>
          )}
          <div>
            <h1 className="text-sm sm:text-base font-display font-black tracking-tight text-zinc-100 uppercase">{websiteSettings?.websiteName || "LEARN WITH ANKIT"}</h1>
            <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-mono">Fintech Elite v1.0</p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {activePageVideo?.url && (
            <button
              onClick={() => {
                setHelpVideoUrl(activePageVideo.url);
                setHelpVideoTitle(activePageVideo.title);
              }}
              className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 rounded-full text-[10px] sm:text-xs font-bold uppercase cursor-pointer transition-all duration-300"
              title="Watch Page Tutorial"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Page Tutorial</span>
            </button>
          )}

          <NotificationsDropdown userId={currentUser.userId} userRole={currentUser.role} />
          
          <button
            onClick={handleLogout}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-900/40 rounded-full transition-all duration-300 cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout Container */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Dynamic Navigation Left Sidebar */}
        <aside className="w-full md:w-64 shrink-0 bg-slate-950 border-r border-zinc-900 p-4 space-y-1 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible md:space-y-1.5 md:p-5">
          {sidebarNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id as ActivePage)}
              className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-300 whitespace-nowrap shrink-0 cursor-pointer ${
                activePage === item.id
                  ? "bg-amber-500 text-slate-950 shadow-md font-extrabold gold-glow"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        {/* Active Content Panel */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 bg-linear-to-b from-slate-950 via-zinc-950/20 to-black overflow-y-auto">
          {maintenanceMode && currentUser?.role !== "founder" && currentUser?.role !== "admin" ? (
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
                  {currentUser.profilePic ? (
                    <img
                      src={currentUser.profilePic}
                      alt={currentUser.username}
                      className="w-14 h-14 rounded-xl object-cover border border-zinc-800"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-zinc-800 to-zinc-900 border border-zinc-700/60 flex items-center justify-center font-display font-extrabold text-zinc-300 text-lg">
                      {(currentUser.username || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="font-sans space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base font-display font-bold text-zinc-100">{currentUser.username || "User"}</h2>
                      <span className="text-[9px] uppercase tracking-widest font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-sm">
                        {currentUser.accountStatus || "Active"}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono">Affiliate User ID: {currentUser.customUserId || currentUser.userId}</p>
                    <p className="text-[10px] text-zinc-400">Join Date: {currentUser.joinDate || "N/A"}</p>
                  </div>
                </div>

                <div className="flex space-x-3 items-center">
                  <div className="text-center bg-slate-950/65 px-4 py-2 rounded-xl border border-zinc-900">
                    <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono block">Achievement level</span>
                    <span className="text-xs font-display font-bold text-amber-400">★ {(currentUser.customBadge || currentUser.badge || "Bronze").toUpperCase()} Badge</span>
                  </div>
                  {(currentUser as any).customRank && (
                    <div className="text-center bg-slate-950/65 px-4 py-2 rounded-xl border border-zinc-900">
                      <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-mono block">Custom Rank</span>
                      <span className="text-xs font-display font-bold text-emerald-400">{(currentUser as any).customRank}</span>
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
                      <AnimatedCounter value={currentUser.todayEarnings || 0} />
                    </div>
                  </div>
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Last 7 Days Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={currentUser.last7DaysEarnings || 0} />
                    </div>
                  </div>
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Last 30 Days Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={currentUser.last30DaysEarnings || 0} />
                    </div>
                  </div>
                  <div className="bg-zinc-950/35 border border-zinc-900/80 rounded-xl p-4 space-y-2 hover:border-zinc-800 transition-colors">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider block">Lifetime Cumulative Earnings</span>
                    <div className="text-xl font-display">
                      <AnimatedCounter value={currentUser.totalEarnings || 0} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallet Card Center Stage */}
              <div className="flex flex-col items-center space-y-4 pt-4 border-t border-zinc-900 pb-4">
                <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-500">Premium Wallet Balance Card</h3>
                <WalletCard balance={currentUser.walletBalance} username={currentUser.username} />
              </div>

              {/* Dashboard Social Footer */}
              <div className="pt-6 border-t border-zinc-900/50 flex flex-col items-center justify-center space-y-3.5 pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Connect with Founder & Community</span>
                <SocialMediaIcons className="scale-95" />
              </div>
            </div>
          )}

          {activePage === "payment" && (
            <PaymentRequestSection user={currentUser} />
          )}

          {activePage === "withdrawal" && (
            <WithdrawalSection user={currentUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "history" && (
            <HistoryPage user={currentUser} />
          )}

          {activePage === "leaderboard" && (
            <Leaderboard currentUser={currentUser} />
          )}

          {activePage === "challenge" && (
            <ChallengesSection user={currentUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "kyc" && (
            <KYCSection user={currentUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "services" && (
            <ServicesPage user={currentUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "profile" && (
            <ProfileSection user={currentUser} onUpdateUser={handleUpdateLocalUser} />
          )}

          {activePage === "admin" && (currentUser.role === "admin" || currentUser.role === "founder" || currentUser.role === "co-founder" || currentUser.role === "co_founder") && (
            <AdminPanel adminUser={currentUser} />
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

    </div>
  );
}
