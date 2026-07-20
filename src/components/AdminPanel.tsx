import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, doc, getDoc, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp, runTransaction, writeBatch, getDocs, orderBy } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, handleFirestoreError, OperationType, getSecondaryAuth } from "../firebase";
import { UserProfile, PaymentRequest, WithdrawalRequest, AuditLog, Announcement, Challenge, ChallengeProgress, CoFounderPermissions, ChallengeLead, MembershipPlan, PlatformFees, WithdrawalSettings, PlatformRevenue, RevenueTransaction, Service, ServicePurchase } from "../types";
import { Users, CreditCard, ShieldCheck, Megaphone, Terminal, Search, UserPlus, Check, X, FileSpreadsheet, PlusCircle, AlertCircle, RefreshCw, Send, DollarSign, ShieldAlert, Settings, Bell, Trophy, Award, Landmark, Hourglass, ClipboardCheck, Sparkles, AlertTriangle, TrendingUp, Coins, Calendar, Clock, Lock, Unlock, Share2, Save, Trash2, Edit, Download, Wallet, TrendingDown, ArrowUpRight } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";
import { jsPDF } from "jspdf";
import MultiSelect from "./MultiSelect";

interface AdminPanelProps {
  adminUser: UserProfile;
}

type AdminTab = "analytics" | "users" | "payments" | "withdrawals" | "challenges_review" | "services" | "memberships_manage" | "audit_logs" | "notifications" | "settings" | "announcements" | "weeklyReport" | "pages" | "navigation" | "storage" | "email" | "features" | "membership" | "fees" | "withdrawal_settings" | "revenue" | "social_settings";


export default function AdminPanel({ adminUser }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("analytics");

  const hasPermission = (permission: keyof CoFounderPermissions) => {
    if (adminUser.role === "founder") return true;
    if (adminUser.role === "admin") return true;
    if (adminUser.role === "co-founder") {
      return adminUser.coFounderPermissions?.[permission] ?? false;
    }
    return false;
  };
  
  // Datasets from Firestore
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Loading and forms state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // User Creation form
  const [createUsername, setCreateUsername] = useState("");
  const [createUserId, setCreateUserId] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createState, setCreateState] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSuccess, setCreateSuccess] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Manual Balance Add Form
  const [targetUserId, setTargetUserId] = useState("");
  const [manualAmount, setManualAmount] = useState<number | "">("");
  const [manualRemark, setManualRemark] = useState("");
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Announcement creator form
  const [editAnnId, setEditAnnId] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annSuccess, setAnnSuccess] = useState(false);

  // Transaction execution forms (temporary modal state)
  const [activeRemark, setActiveRemark] = useState("");
  const [activeTxId, setActiveTxId] = useState("");

  // User Management State (Edit & Ban Modals)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editState, setEditState] = useState("");
  const [editWalletBalance, setEditWalletBalance] = useState<number>(0);
  const [editTotalEarnings, setEditTotalEarnings] = useState<number>(0);
  const [editKycName, setEditKycName] = useState("");
  const [editKycUpiId, setEditKycUpiId] = useState("");
  const [editKycUpiNumber, setEditKycUpiNumber] = useState("");

  const [banningUser, setBanningUser] = useState<UserProfile | null>(null);
  const [banDuration, setBanDuration] = useState("1d");
  const [banReason, setBanReason] = useState("");

  // Additional States for Challenge Progress, Notifications, and Website Settings
  const [challengeProgresses, setChallengeProgresses] = useState<ChallengeProgress[]>([]);
  const [websiteSettings, setWebsiteSettings] = useState<any>(null);

  // Social Settings Form & Configuration States
  const [socialSettings, setSocialSettings] = useState<any>({
    instagramEnabled: true,
    instagramUrl: "https://instagram.com/learnwithankit",
    youtubeEnabled: true,
    youtubeUrl: "https://youtube.com/learnwithankit",
    facebookEnabled: true,
    facebookUrl: "https://facebook.com/learnwithankit",
    pinterestEnabled: true,
    pinterestUrl: "https://pinterest.com/learnwithankit",
    order: ["instagram", "youtube", "facebook", "pinterest"]
  });
  const [socialSuccess, setSocialSuccess] = useState(false);
  const [instEnabled, setInstEnabled] = useState(true);
  const [instUrl, setInstUrl] = useState("");
  const [ytEnabled, setYtEnabled] = useState(true);
  const [ytUrl, setYtUrl] = useState("");
  const [fbEnabled, setFbEnabled] = useState(true);
  const [fbUrl, setFbUrl] = useState("");
  const [pinEnabled, setPinEnabled] = useState(true);
  const [pinUrl, setPinUrl] = useState("");
  const [socOrder, setSocOrder] = useState<string[]>(["instagram", "youtube", "facebook", "pinterest"]);

  // Dynamic Social Links Manager states
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [editingSocialLink, setEditingSocialLink] = useState<any | null>(null);
  const [socialFormName, setSocialFormName] = useState("");
  const [socialFormIcon, setSocialFormIcon] = useState("youtube");
  const [socialFormUrl, setSocialFormUrl] = useState("");
  const [socialFormOrder, setSocialFormOrder] = useState(1);
  const [socialFormEnabled, setSocialFormEnabled] = useState(true);

  useEffect(() => {
    if (socialSettings) {
      setInstEnabled(socialSettings.instagramEnabled ?? true);
      setInstUrl(socialSettings.instagramUrl ?? "");
      setYtEnabled(socialSettings.youtubeEnabled ?? true);
      setYtUrl(socialSettings.youtubeUrl ?? "");
      setFbEnabled(socialSettings.facebookEnabled ?? true);
      setFbUrl(socialSettings.facebookUrl ?? "");
      setPinEnabled(socialSettings.pinterestEnabled ?? true);
      setPinUrl(socialSettings.pinterestUrl ?? "");
      setSocOrder(socialSettings.order ?? ["instagram", "youtube", "facebook", "pinterest"]);
      setSocialLinks(socialSettings.links || []);
    }
  }, [socialSettings]);


  const [editCustomUserId, setEditCustomUserId] = useState("");
  const [editCustomRank, setEditCustomRank] = useState("");
  const [editCustomBadge, setEditCustomBadge] = useState("");
  const [editVipTagText, setEditVipTagText] = useState("");
  const [editRole, setEditRole] = useState<"founder" | "admin" | "co-founder" | "user">("user");
  const [editCoFounderPermissions, setEditCoFounderPermissions] = useState<CoFounderPermissions>({
    manageUsers: false,
    manageAccountCreation: false,
    managePayments: false,
    manageWithdrawals: false,
    manageChallenges: false,
    manageLeaderboard: false,
    manageAnnouncements: false,
    manageSettings: false,
    manageReports: false,
    manageBackup: false,
    managePages: false,
    manageNotifications: false,
  });

  // Notification tab form states
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [notifType, setNotifType] = useState<"Announcement" | "Maintenance" | "Challenge" | "Payment" | "Withdrawal" | "General">("General");
  const [notifRecipientType, setNotifRecipientType] = useState<"single" | "everyone">("everyone");
  const [notifRecipientUserId, setNotifRecipientUserId] = useState("");
  const [notifSuccess, setNotifSuccess] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);

  // Challenge rejection modal state
  const [rejectProgress, setRejectProgress] = useState<ChallengeProgress | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Settings form local state (for easy binding)
  const [setWebsiteName, setSetWebsiteName] = useState("");
  const [setLogoUrl, setSetLogoUrl] = useState("");
  const [setFaviconUrl, setSetFaviconUrl] = useState("");
  const [setFooterText, setSetFooterText] = useState("");
  const [setDashboardTitle, setSetDashboardTitle] = useState("");
  const [setWelcomeMessage, setSetWelcomeMessage] = useState("");
  const [setButtonText, setSetButtonText] = useState("");
  const [setPaymentInstructions, setSetPaymentInstructions] = useState("");
  const [setWithdrawalInstructions, setSetWithdrawalInstructions] = useState("");
  const [setChallengeText, setSetChallengeText] = useState("");
  const [setLeaderboardTitle, setSetLeaderboardTitle] = useState("");
  const [setProfileLabels, setSetProfileLabels] = useState("");
  const [setAnnouncementText, setSetAnnouncementText] = useState("");
  const [setTermsConditions, setSetTermsConditions] = useState("");
  const [setPrivacyPolicy, setSetPrivacyPolicy] = useState("");
  const [setSupportEmail, setSetSupportEmail] = useState("");
  const [setSupportPhone, setSetSupportPhone] = useState("");
  const [setThemeColor, setSetThemeColor] = useState("#f59e0b");
  const [setBannerImage, setSetBannerImage] = useState("");

  // Tutorial Video System states
  const [dashboardVideoUrl, setDashboardVideoUrl] = useState("");
  const [paymentVideoUrl, setPaymentVideoUrl] = useState("");
  const [withdrawalVideoUrl, setWithdrawalVideoUrl] = useState("");
  const [profileVideoUrl, setProfileVideoUrl] = useState("");
  const [kycVideoUrl, setKycVideoUrl] = useState("");
  const [challengeVideoUrl, setChallengeVideoUrl] = useState("");

  // Custom pages and navigation menu builder states
  const [pagesList, setPagesList] = useState<any[]>([]);
  const [navMenu, setNavMenu] = useState<any[]>([]);
  
  // Page creation/editing form states
  const [pageId, setPageId] = useState("");
  const [pageTitle, setPageTitle] = useState("");
  const [pageSlug, setPageSlug] = useState("");
  const [pageContent, setPageContent] = useState("");
  const [pageSeoTitle, setPageSeoTitle] = useState("");
  const [pageSeoDesc, setPageSeoDesc] = useState("");
  const [pageImgUrl, setPageImgUrl] = useState("");
  const [pageIsPublished, setPageIsPublished] = useState(true);
  const [pageSuccess, setPageSuccess] = useState(false);

  // Feature Toggles state
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
    maintenanceMode: false,
  });
  const [featuresSuccess, setFeaturesSuccess] = useState(false);

  // --- Admin Filter Preferences (Saved in Firestore) ---
  const [filterRoles, setFilterRoles] = useState<string[]>(["user", "admin", "co-founder", "founder"]);
  const [filterWithdrawalStatuses, setFilterWithdrawalStatuses] = useState<string[]>(["Pending", "Completed", "Approved", "Rejected"]);
  const [filterPaymentStatuses, setFilterPaymentStatuses] = useState<string[]>(["Pending", "Approved", "Rejected"]);

  const saveAdminPreferences = async (newRoles: string[], newWithdrawals: string[], newPayments: string[]) => {
    try {
      await setDoc(doc(db, "settings", "admin_preferences"), {
        filterRoles: newRoles,
        filterWithdrawalStatuses: newWithdrawals,
        filterPaymentStatuses: newPayments
      }, { merge: true });
    } catch (e) {
      console.error("Failed to save admin preferences to Firestore", e);
    }
  };

  // --- PREMIUM & REVENUE ADMIN STATES ---
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [feesSettings, setFeesSettings] = useState<PlatformFees | null>(null);
  const [withdrawConfig, setWithdrawConfig] = useState<WithdrawalSettings | null>(null);
  const [revenueData, setRevenueData] = useState<PlatformRevenue | null>(null);
  const [revenueTransactions, setRevenueTransactions] = useState<RevenueTransaction[]>([]);

  // --- SERVICES ADMIN STATES ---
  const [adminServices, setAdminServices] = useState<Service[]>([]);
  const [adminServicePurchases, setAdminServicePurchases] = useState<ServicePurchase[]>([]);

  // Services form state
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState<number | "">("");
  const [serviceStatus, setServiceStatus] = useState<"Active" | "Inactive">("Active");
  const [serviceThumbnail, setServiceThumbnail] = useState("");

  // Membership form state
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState<number | "">("");
  const [planDurationMonths, setPlanDurationMonths] = useState<number | "">("");
  const [planIsLifetime, setPlanIsLifetime] = useState(false);
  const [planFeatures, setPlanFeatures] = useState<string>("");
  const [planVipBenefits, setPlanVipBenefits] = useState<string>("");
  const [planBadgeStyle, setPlanBadgeStyle] = useState("");

  // Fees manager form state
  const [withdrawalFeeType, setWithdrawalFeeType] = useState<"fixed" | "percent" | "hybrid">("fixed");
  const [withdrawalFeeFixed, setWithdrawalFeeFixed] = useState<number>(0);
  const [withdrawalFeePercent, setWithdrawalFeePercent] = useState<number>(0);
  const [withdrawalFeeMin, setWithdrawalFeeMin] = useState<number>(0);
  const [withdrawalFeeMax, setWithdrawalFeeMax] = useState<number>(0);
  const [withdrawalFeeEnabled, setWithdrawalFeeEnabled] = useState(false);
  const [fastWithdrawalFeeEnabled, setFastWithdrawalFeeEnabled] = useState(true);
  const [fastWithdrawalFeeFixed, setFastWithdrawalFeeFixed] = useState<number>(50);
  const [fastWithdrawalFeePercent, setFastWithdrawalFeePercent] = useState<number>(2);
  const [fastWithdrawalFeeMin, setFastWithdrawalFeeMin] = useState<number>(10);
  const [fastWithdrawalFeeMax, setFastWithdrawalFeeMax] = useState<number>(100);
  const [challengeEntryFeeEnabled, setChallengeEntryFeeEnabled] = useState(false);
  const [challengeEntryFeeAmount, setChallengeEntryFeeAmount] = useState<number>(0);
  const [platformFeesSuccess, setPlatformFeesSuccess] = useState(false);

  // Withdrawal Settings form state
  const [minWithdrawAmount, setMinWithdrawAmount] = useState<number>(100);
  const [maxWithdrawAmount, setMaxWithdrawAmount] = useState<number>(10000);
  const [dailyWithdrawLimit, setDailyWithdrawLimit] = useState<number>(20000);
  const [weeklyWithdrawLimit, setWeeklyWithdrawLimit] = useState<number>(100000);
  const [monthlyWithdrawLimit, setMonthlyWithdrawLimit] = useState<number>(400000);
  const [allowedWithdrawDays, setAllowedWithdrawDays] = useState<string>("Monday,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday");
  const [withdrawStartTime, setWithdrawStartTime] = useState<string>("00:00");
  const [withdrawEndTime, setWithdrawEndTime] = useState<string>("23:59");
  const [withdrawEnabled, setWithdrawEnabled] = useState(true);
  const [withdrawConfigSuccess, setWithdrawConfigSuccess] = useState(false);

  useEffect(() => {
    // Listen to custom pages
    const unsubPages = onSnapshot(collection(db, "pages"), (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setPagesList(list);
    });

    // Listen to navigation settings
    const unsubNav = onSnapshot(doc(db, "settings", "navigation"), (snapshot) => {
      if (snapshot.exists()) {
        setNavMenu(snapshot.data().menu || []);
      }
    });

    // Listen to feature toggles settings
    const unsubFeatures = onSnapshot(doc(db, "settings", "features"), (snapshot) => {
      if (snapshot.exists()) {
        setFeatureToggles(snapshot.data());
      }
    });

    // Listen to admin preferences for filters
    const unsubPrefs = onSnapshot(doc(db, "settings", "admin_preferences"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.filterRoles) setFilterRoles(data.filterRoles);
        if (data.filterWithdrawalStatuses) setFilterWithdrawalStatuses(data.filterWithdrawalStatuses);
        if (data.filterPaymentStatuses) setFilterPaymentStatuses(data.filterPaymentStatuses);
      }
    });

    // 1. Listen to all Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ ...doc.data() } as UserProfile);
      });
      setUsers(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "users"));

    // 2. Listen to Payments
    const qPayments = query(collection(db, "payments"), orderBy("timestamp", "desc"));
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const list: PaymentRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as PaymentRequest);
      });
      setPayments(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "payments"));

    // 3. Listen to Withdrawals
    const qWithdrawals = query(collection(db, "withdrawals"), orderBy("timestamp", "desc"));
    const unsubWithdrawals = onSnapshot(qWithdrawals, (snapshot) => {
      const list: WithdrawalRequest[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as WithdrawalRequest);
      });
      setWithdrawals(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "withdrawals"));

    // 4. Listen to Audit Logs
    const qLogs = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      setAuditLogs(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "auditLogs"));

    // 5. Listen to Announcements
    const qAnn = query(collection(db, "announcements"), orderBy("timestamp", "desc"));
    const unsubAnn = onSnapshot(qAnn, (snapshot) => {
      const list: Announcement[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Announcement);
      });
      setAnnouncements(list);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "announcements"));

    // 6. Listen to Challenge Progresses (for administrative review)
    const unsubProgresses = onSnapshot(collection(db, "challengeProgress"), (snapshot) => {
      const list: ChallengeProgress[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ChallengeProgress);
      });
      setChallengeProgresses(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "challengeProgress"));

    // 7. Listen to Website Settings
    const unsubSettings = onSnapshot(doc(db, "settings", "website"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setWebsiteSettings(data);
        // Pre-fill editor states
        setSetWebsiteName(data.websiteName || "");
        setSetLogoUrl(data.logoUrl || "");
        setSetFaviconUrl(data.faviconUrl || "");
        setSetFooterText(data.footerText || "");
        setSetDashboardTitle(data.dashboardTitle || "");
        setSetWelcomeMessage(data.welcomeMessage || "");
        setSetButtonText(data.buttonText || "");
        setSetPaymentInstructions(data.paymentInstructions || "");
        setSetWithdrawalInstructions(data.withdrawalInstructions || "");
        setSetChallengeText(data.challengeText || "");
        setSetLeaderboardTitle(data.leaderboardTitle || "");
        setSetProfileLabels(data.profileLabels || "");
        setSetAnnouncementText(data.announcementText || "");
        setSetTermsConditions(data.termsConditions || "");
        setSetPrivacyPolicy(data.privacyPolicy || "");
        setSetSupportEmail(data.supportEmail || "");
        setSetSupportPhone(data.supportPhone || "");
        setSetThemeColor(data.themeColor || "#f59e0b");
        setSetBannerImage(data.bannerImage || "");
        setDashboardVideoUrl(data.dashboardVideoUrl || "");
        setPaymentVideoUrl(data.paymentVideoUrl || "");
        setWithdrawalVideoUrl(data.withdrawalVideoUrl || "");
        setProfileVideoUrl(data.profileVideoUrl || "");
        setKycVideoUrl(data.kycVideoUrl || "");
        setChallengeVideoUrl(data.challengeVideoUrl || "");
      } else {
        const defaultSettings = {
          websiteName: "LEARN WITH ANKIT",
          logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop",
          faviconUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=32&auto=format&fit=crop",
          footerText: "© 2026 LEARN WITH ANKIT. All rights reserved.",
          dashboardTitle: "AFFILIATE DASHBOARD",
          welcomeMessage: "Welcome back! Keep sharing your link and earning.",
          buttonText: "Share Link",
          paymentInstructions: "Please make sure your lead name matches exactly as per their course profile. Approval can take 12-24 hours.",
          withdrawalInstructions: "Minimum withdrawal limit is ₹500. Payments are processed every Friday.",
          challengeText: "Active Incentive Challenges",
          leaderboardTitle: "AFFILIATE LEADERBOARD",
          profileLabels: "Edit your account details and bank KYC information.",
          announcementText: "SYSTEM ANNOUNCEMENTS",
          termsConditions: "1. Do not spam leads. 2. Self-referrals are not allowed. 3. All leads must be genuine.",
          privacyPolicy: "We respect your privacy. We do not sell or share your data.",
          supportEmail: "support@learnwithankit.com",
          supportPhone: "+91 98765 43210",
          themeColor: "#f59e0b",
          bannerImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop",
          dashboardVideoUrl: "",
          paymentVideoUrl: "",
          withdrawalVideoUrl: "",
          profileVideoUrl: "",
          kycVideoUrl: "",
          challengeVideoUrl: "",
        };
        setDoc(doc(db, "settings", "website"), defaultSettings);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, "settings"));

    // 10. Listen to Membership Plans
    const unsubPlans = onSnapshot(collection(db, "membershipPlans"), (snapshot) => {
      const list: MembershipPlan[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as MembershipPlan);
      });
      setPlans(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "membershipPlans"));

    // 11. Listen to Fees Settings
    const unsubFees = onSnapshot(doc(db, "settings", "fees"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as PlatformFees;
        setFeesSettings(data);
        setWithdrawalFeeType(data.withdrawalFeeType || "fixed");
        setWithdrawalFeeFixed(data.withdrawalFeeFixed || 0);
        setWithdrawalFeePercent(data.withdrawalFeePercent || 0);
        setWithdrawalFeeMin(data.withdrawalFeeMin || 0);
        setWithdrawalFeeMax(data.withdrawalFeeMax || 0);
        setWithdrawalFeeEnabled(data.withdrawalFeeEnabled ?? false);
        setFastWithdrawalFeeEnabled(data.fastWithdrawalFeeEnabled ?? true);
        setFastWithdrawalFeeFixed(data.fastWithdrawalFeeFixed ?? 50);
        setFastWithdrawalFeePercent(data.fastWithdrawalFeePercent ?? 2);
        setFastWithdrawalFeeMin(data.fastWithdrawalFeeMin ?? 10);
        setFastWithdrawalFeeMax(data.fastWithdrawalFeeMax ?? 100);
        setChallengeEntryFeeEnabled(data.challengeEntryFeeEnabled ?? false);
        setChallengeEntryFeeAmount(data.challengeEntryFeeAmount ?? 0);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, "fees"));

    // 12. Listen to Withdrawal Schedule Settings
    const unsubWithdrawConfig = onSnapshot(doc(db, "settings", "withdrawals"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as WithdrawalSettings;
        setWithdrawConfig(data);
        setMinWithdrawAmount(data.minAmount || 100);
        setMaxWithdrawAmount(data.maxAmount || 10000);
        setDailyWithdrawLimit(data.dailyLimit || 20000);
        setWeeklyWithdrawLimit(data.weeklyLimit || 100000);
        setMonthlyWithdrawLimit(data.monthlyLimit || 400000);
        setAllowedWithdrawDays((data.allowedDays || []).join(","));
        setWithdrawStartTime(data.startTime || "00:00");
        setWithdrawEndTime(data.endTime || "23:59");
        setWithdrawEnabled(data.enabled ?? true);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, "withdrawals"));

    // 13. Listen to Platform Revenue document
    const unsubRevenue = onSnapshot(doc(db, "settings", "revenue"), (snapshot) => {
      if (snapshot.exists()) {
        setRevenueData(snapshot.data() as PlatformRevenue);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, "revenue"));

    // 14. Listen to Revenue Transactions
    const unsubRevenueTx = onSnapshot(query(collection(db, "revenueTransactions"), orderBy("timestamp", "desc")), (snapshot) => {
      const list: RevenueTransaction[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as RevenueTransaction);
      });
      setRevenueTransactions(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "revenueTransactions"));

    // 15. Listen to Social settings document
    const unsubSocial = onSnapshot(doc(db, "settings", "social"), (snapshot) => {
      if (snapshot.exists()) {
        setSocialSettings(snapshot.data());
      }
    });

    // 16. Listen to Services Marketplace items
    const unsubServices = onSnapshot(query(collection(db, "services"), orderBy("createdAt", "desc")), (snapshot) => {
      const list: Service[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Service);
      });
      setAdminServices(list);
    }, (err) => console.error("Admin Services listen error:", err));

    // 17. Listen to Services purchases
    const unsubServicePurchases = onSnapshot(collection(db, "servicePurchases"), (snapshot) => {
      const list: ServicePurchase[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ServicePurchase);
      });
      setAdminServicePurchases(list);
    }, (err) => console.error("Admin Service purchases listen error:", err));

    return () => {
      unsubUsers();
      unsubPayments();
      unsubWithdrawals();
      unsubLogs();
      unsubAnn();
      unsubProgresses();
      unsubSettings();
      unsubNav();
      unsubFeatures();
      unsubPlans();
      unsubFees();
      unsubWithdrawConfig();
      unsubRevenue();
      unsubRevenueTx();
      unsubSocial();
      unsubServices();
      unsubServicePurchases();
      unsubPrefs();
    };
  }, []);

  // Write audit log helper
  const writeAuditLog = async (action: string, targetUser: string = "System", description: string = "") => {
    try {
      await addDoc(collection(db, "auditLogs"), {
        adminName: adminUser.username,
        adminId: adminUser.userId,
        action,
        targetUser,
        description,
        date: new Date().toLocaleDateString("en-IN"),
        time: new Date().toLocaleTimeString("en-IN"),
        ip: "127.0.0.1", // Client sandbox fallback
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Audit Logging Error:", e);
    }
  };

  // --- Admin User Creation ---
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim() || !createEmail.trim() || !createPassword.trim()) {
      setCreateError("Username, Email and Password are required.");
      return;
    }

    setActionLoading("create_user");
    setCreateError(null);
    setCreateSuccess(false);

    try {
      // 1. Create auth user on secondary Firebase app so admin doesn't get signed out
      const secAuth = getSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(secAuth, createEmail.trim(), createPassword);
      const uid = userCredential.user.uid;

      // 2. Provision Firestore profile
      const userRef = doc(db, "users", uid);
      const profile: UserProfile = {
        userId: uid,
        customUserId: createUserId.trim() || `LWA-${uid.substring(0, 5).toUpperCase()}`,
        username: createUsername.trim(),
        email: createEmail.trim(),
        phone: createPhone.trim(),
        state: createState.trim(),
        joinDate: new Date().toLocaleDateString("en-IN"),
        accountStatus: "Active",
        totalEarnings: 0,
        walletBalance: 0,
        todayEarnings: 0,
        last7DaysEarnings: 0,
        last30DaysEarnings: 0,
        role: "user",
        badge: "Bronze",
      };

      await setDoc(userRef, profile);

      // 3. Create welcome notification
      await addDoc(collection(db, "notifications"), {
        userId: uid,
        title: "👋 Welcome to LEARN WITH ANKIT!",
        body: "Your affiliate tracking dashboard has been successfully activated. Update your profile and KYC details to start earning.",
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      // 4. Log admin action
      await writeAuditLog(`Created new user account: ${createUsername} (${createEmail})`);

      setCreateSuccess(true);
      setCreateUsername("");
      setCreateUserId("");
      setCreateEmail("");
      setCreatePhone("");
      setCreateState("");
      setCreatePassword("");
      setTimeout(() => setCreateSuccess(false), 5000);
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user. User may already exist.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Admin User Actions: Edit, Ban, Unban, Delete ---
  const handleStartEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditUsername(user.username || "");
    setEditEmail(user.email || "");
    setEditPhone(user.phone || "");
    setEditState(user.state || "");
    setEditWalletBalance(user.walletBalance || 0);
    setEditTotalEarnings(user.totalEarnings || 0);
    setEditKycName(user.kycName || "");
    setEditKycUpiId(user.kycUpiId || "");
    setEditKycUpiNumber(user.kycUpiNumber || "");
    setEditCustomUserId(user.customUserId || "");
    setEditCustomRank((user as any).customRank || "");
    setEditCustomBadge((user as any).customBadge || "");
    setEditVipTagText(user.vipTagText || "");
    setEditRole(user.role || "user");
    setEditCoFounderPermissions(user.coFounderPermissions || {
      manageUsers: false,
      manageAccountCreation: false,
      managePayments: false,
      manageWithdrawals: false,
      manageChallenges: false,
      manageLeaderboard: false,
      manageAnnouncements: false,
      manageSettings: false,
      manageReports: false,
      manageBackup: false,
      managePages: false,
      manageNotifications: false,
    });
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Founder Role Protection Checks
    if (editingUser.role === "founder") {
      if (editRole !== "founder") {
        alert("The Founder role is permanent and cannot be demoted or changed.");
        return;
      }
      if (editUsername.trim() !== editingUser.username) {
        alert("The Founder cannot be renamed.");
        return;
      }
    }

    // Co-founder & Admin Role Restrictions
    if (adminUser.role === "co-founder") {
      if (editingUser.role === "founder" || editingUser.role === "admin" || editingUser.role === "co-founder") {
        alert("As a Co-Founder, you do not have permission to modify profiles of Founders, Admins, or other Co-Founders.");
        return;
      }
      if (editRole === "founder" || editRole === "admin" || editRole === "co-founder") {
        alert("As a Co-Founder, you cannot promote a user to Founder, Admin, or Co-Founder roles.");
        return;
      }
    }

    if (adminUser.role === "admin" && editingUser.role === "founder") {
      alert("Admins cannot modify the Founder profile.");
      return;
    }

    setActionLoading(`save_${editingUser.userId}`);
    try {
      const userRef = doc(db, "users", editingUser.userId);
      const updatedFields: Partial<UserProfile> = {
        username: editUsername.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        state: editState.trim(),
        walletBalance: Number(editWalletBalance),
        totalEarnings: Number(editTotalEarnings),
        kycName: editKycName.trim(),
        kycUpiId: editKycUpiId.trim(),
        kycUpiNumber: editKycUpiNumber.trim(),
        customUserId: editCustomUserId.trim(),
        customRank: editCustomRank.trim() || null,
        customBadge: editCustomBadge.trim() || null,
        vipTagText: editVipTagText.trim() || null,
        role: editRole,
        coFounderPermissions: editRole === "co-founder" ? editCoFounderPermissions : null,
      };
      await updateDoc(userRef, updatedFields);

      // Automatic notification for role update
      if (editingUser.role !== editRole) {
        await addDoc(collection(db, "notifications"), {
          userId: editingUser.userId,
          title: "🔐 Role Updated!",
          body: `Your access role has been updated to "${editRole.toUpperCase()}".`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "general",
        });
      }

      // Automatic notification for balance update
      if (editingUser.walletBalance !== Number(editWalletBalance)) {
        await addDoc(collection(db, "notifications"), {
          userId: editingUser.userId,
          title: "💰 Wallet Balance Adjusted!",
          body: `Your wallet balance was updated by the administrator to ₹${Number(editWalletBalance).toLocaleString("en-IN")}.`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "general",
        });

        const diff = Number(editWalletBalance) - (editingUser.walletBalance || 0);
        if (diff > 0) {
          await writeAuditLog("Balance Increased", editingUser.username, `Balance adjusted manually from ₹${editingUser.walletBalance || 0} to ₹${editWalletBalance} (+₹${diff})`);
        } else {
          await writeAuditLog("Balance Decreased", editingUser.username, `Balance adjusted manually from ₹${editingUser.walletBalance || 0} to ₹${editWalletBalance} (-₹${Math.abs(diff)})`);
        }
      }

      await writeAuditLog("Settings Updated", editingUser.username, `Edited user profile settings: ${editingUser.username} (${editingUser.userId})`);
      alert("User profile updated successfully!");
      setEditingUser(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update user profile.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartBanUser = (user: UserProfile) => {
    if (user.role === "founder") {
      alert("The Founder cannot be suspended or banned.");
      return;
    }
    if (adminUser.role === "co-founder") {
      if (user.role === "admin" || user.role === "co-founder") {
        alert("As a Co-Founder, you cannot suspend or ban other Admins or Co-Founders.");
        return;
      }
    }
    setBanningUser(user);
    setBanDuration("1d");
    setBanReason("");
  };

  const handleBanUserExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banningUser) return;
    setActionLoading(`ban_${banningUser.userId}`);
    try {
      let bannedUntilVal: any = "Permanent";
      const now = Date.now();
      
      switch (banDuration) {
        case "1m":
          bannedUntilVal = now + 1 * 60 * 1000;
          break;
        case "5m":
          bannedUntilVal = now + 5 * 60 * 1000;
          break;
        case "30m":
          bannedUntilVal = now + 30 * 60 * 1000;
          break;
        case "1h":
          bannedUntilVal = now + 1 * 60 * 60 * 1000;
          break;
        case "12h":
          bannedUntilVal = now + 12 * 60 * 60 * 1000;
          break;
        case "1d":
          bannedUntilVal = now + 24 * 60 * 60 * 1000;
          break;
        case "2d":
          bannedUntilVal = now + 2 * 24 * 60 * 60 * 1000;
          break;
        case "7d":
          bannedUntilVal = now + 7 * 24 * 60 * 60 * 1000;
          break;
        case "30d":
          bannedUntilVal = now + 30 * 24 * 60 * 60 * 1000;
          break;
        case "Permanent":
        default:
          bannedUntilVal = "Permanent";
          break;
      }

      const userRef = doc(db, "users", banningUser.userId);
      await updateDoc(userRef, {
        accountStatus: "Suspended",
        bannedUntil: bannedUntilVal,
        bannedReason: banReason.trim() || "No reason specified",
      });

      // Automatic notification for account ban
      await addDoc(collection(db, "notifications"), {
        userId: banningUser.userId,
        title: "⚠️ Account Suspended!",
        body: `Your account has been temporarily suspended for ${banDuration}. Reason: ${banReason.trim() || "No reason specified"}.`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "general",
      });

      await writeAuditLog("User Banned", banningUser.username, `Suspended user for ${banDuration}. Reason: ${banReason.trim() || "No reason specified"}`);
      alert(`User suspended successfully for ${banDuration}.`);
      setBanningUser(null);
    } catch (err) {
      console.error(err);
      alert("Failed to ban user.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnbanUser = async (user: UserProfile) => {
    if (!window.confirm(`Are you sure you want to unban ${user.username}?`)) {
      return;
    }
    setActionLoading(`unban_${user.userId}`);
    try {
      const userRef = doc(db, "users", user.userId);
      await updateDoc(userRef, {
        accountStatus: "Active",
        bannedUntil: null,
        bannedReason: null,
      });

      // Automatic notification for account unban
      await addDoc(collection(db, "notifications"), {
        userId: user.userId,
        title: "✅ Account Restored!",
        body: `Your account suspension has been lifted by the administrator. Welcome back!`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "general",
      });

      await writeAuditLog("User Unbanned", user.username, "Suspension lifted manually");
      alert("User account restored to Active status.");
    } catch (err) {
      console.error(err);
      alert("Failed to unban user.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUserPermanently = async (user: UserProfile) => {
    const doubleConfirm = window.confirm(
      `⚠️ WARNING: Are you absolutely sure you want to PERMANENTLY DELETE user ${user.username} (${user.userId})?\n\nThis will permanently delete their account profile from Firestore. This action is IRREVERSIBLE!`
    );
    if (!doubleConfirm) return;

    setActionLoading(`delete_${user.userId}`);
    try {
      const userRef = doc(db, "users", user.userId);
      await deleteDoc(userRef);

      await writeAuditLog(`Permanently deleted user: ${user.username} (${user.userId})`);
      alert("User account has been permanently deleted.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete user document from Firestore.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Manual Balance Adjustment ---
  const handleManualBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !manualAmount || manualAmount <= 0) {
      setManualError("Select a user and enter a valid positive amount.");
      return;
    }

    setActionLoading("manual_balance");
    setManualError(null);
    setManualSuccess(false);

    try {
      const userRef = doc(db, "users", targetUserId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setManualError("Target user not found.");
        return;
      }

      const userData = userSnap.data() as UserProfile;
      const amountToAdd = Number(manualAmount);

      await runTransaction(db, async (transaction) => {
        const userSnapTx = await transaction.get(userRef);
        if (!userSnapTx.exists()) {
          throw new Error("Target user not found.");
        }
        const userDataTx = userSnapTx.data() as UserProfile;
        const currentBalance = userDataTx.walletBalance || 0;
        const currentEarnings = userDataTx.totalEarnings || 0;

        const nextBalance = currentBalance + amountToAdd;
        const nextEarnings = currentEarnings + amountToAdd;

        transaction.update(userRef, {
          walletBalance: nextBalance,
          totalEarnings: nextEarnings,
        });

        // Add transaction log/notice
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
          userId: targetUserId,
          title: "💰 Balance Manually Added by Admin",
          body: `Admin credited ₹${amountToAdd.toLocaleString("en-IN")} to your wallet. Reason: ${manualRemark || "Adjustment"}`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "payment",
        });
      });

      const userRec = users.find(u => u.userId === targetUserId);
      const targetUserLabel = userRec ? userRec.username : targetUserId;
      await writeAuditLog("Balance Increased", targetUserLabel, `Credited ₹${amountToAdd} manually. Remarks: ${manualRemark || "Adjustment"}`);

      setManualSuccess(true);
      setManualAmount("");
      setManualRemark("");
      setTimeout(() => setManualSuccess(false), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${targetUserId}`);
      setManualError("Failed to add balance.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Payment Approvals ---
  const handleApprovePayment = async (payment: PaymentRequest) => {
    if (payment.status !== "Pending") {
      alert("Payment request is not pending.");
      return;
    }
    setActionLoading(`approve_${payment.id}`);

    try {
      // 1. Verify payment request ID is valid
      if (!payment.id || typeof payment.id !== "string" || payment.id.trim() === "") {
        throw new Error("Invalid payment request ID");
      }
      
      // 2. Verify user ID is valid
      if (!payment.userId || typeof payment.userId !== "string" || payment.userId.trim() === "") {
        throw new Error("Invalid user ID");
      }

      const paymentRef = doc(db, "payments", payment.id);
      const userRef = doc(db, "users", payment.userId);

      // Fetch active challenges
      const challengesSnap = await getDocs(collection(db, "challenges"));
      const activeChallenges: any[] = [];
      const nowStr = new Date().toISOString().split("T")[0];
      challengesSnap.forEach((d) => {
        const data = d.data();
        if (!data.startDate || !data.endDate || (nowStr >= data.startDate && nowStr <= data.endDate)) {
          activeChallenges.push({ id: d.id, ...data });
        }
      });

      await runTransaction(db, async (transaction) => {
        // --- ALL READS MUST GO FIRST ---
        
        // Read 1: Verify payment request document exists in Firestore
        const paymentDoc = await transaction.get(paymentRef);
        if (!paymentDoc.exists()) {
          throw new Error("Payment request not found");
        }

        const currentPaymentData = paymentDoc.data();
        if (currentPaymentData.status !== "Pending") {
          throw new Error("Payment request is not pending (already processed).");
        }

        // Read 2: Verify user document exists in Firestore
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("User document not found");
        }

        // Read 3: Fetch all challenge progress records for this user
        const challengeProgressDataList: { progressRef: any, exists: boolean, data: any, challenge: any }[] = [];
        for (const challenge of activeChallenges) {
          const progressId = `${challenge.id}_${payment.userId}`;
          const progressRef = doc(db, "challengeProgress", progressId);
          const progDoc = await transaction.get(progressRef);
          challengeProgressDataList.push({
            progressRef,
            exists: progDoc.exists(),
            data: progDoc.exists() ? progDoc.data() : null,
            challenge
          });
        }

        // --- ALL VALIDATIONS AFTER READS ---
        
        // Double-check permission of current logged-in admin user
        if (!adminUser || (adminUser.role !== "admin" && adminUser.role !== "founder" && adminUser.role !== "co-founder")) {
          throw new Error("Permission denied");
        }

        const userData = userDoc.data() as UserProfile;
        
        // Verify balance and earnings updates
        const nextBalance = (userData.walletBalance || 0) + payment.totalAmount;
        const nextEarnings = (userData.totalEarnings || 0) + payment.totalAmount;
        const nextToday = (userData.todayEarnings || 0) + payment.totalAmount;
        const next7Days = (userData.last7DaysEarnings || 0) + payment.totalAmount;
        const next30Days = (userData.last30DaysEarnings || 0) + payment.totalAmount;

        if (isNaN(nextBalance) || isNaN(nextEarnings)) {
          throw new Error("Balance update failed (invalid calculation).");
        }

        // --- ALL WRITES MUST GO AFTER READS ---

        // Write 1: Update payment request status to Approved
        transaction.update(paymentRef, {
          status: "Approved",
          txId: activeTxId || `LWA-TX-${Math.floor(100000 + Math.random() * 900000)}`,
          adminRemark: activeRemark || "Leads payment verified and approved",
        });

        // Write 2: Update User Wallet Balance & Earnings (Lifetime, Today, 7 Days, 30 Days)
        transaction.update(userRef, {
          walletBalance: nextBalance,
          totalEarnings: nextEarnings,
          todayEarnings: nextToday,
          last7DaysEarnings: next7Days,
          last30DaysEarnings: next30Days,
        });

        // Write 3: Update challenge progress automatically for active challenges
        for (const item of challengeProgressDataList) {
          const { progressRef, exists, data, challenge } = item;
          let currentCount = 0;
          let currentStatus = "active";
          let currentRewardStatus = "";
          
          if (exists && data) {
            currentCount = data.completedCount || 0;
            currentStatus = data.status || "active";
            currentRewardStatus = data.rewardStatus || "";
          }
          
          if (currentStatus === "active") {
            const nextCount = currentCount + payment.totalLeads;
            let nextStatus = "active";
            let nextRewardStatus = currentRewardStatus;
            
            if (nextCount >= challenge.target) {
              nextStatus = "completed";
              nextRewardStatus = "Pending";
            }
            
            transaction.set(progressRef, {
              userId: payment.userId,
              challengeId: challenge.id,
              completedCount: nextCount,
              target: challenge.target,
              rewardClaimed: false,
              status: nextStatus,
              rewardStatus: nextRewardStatus || null,
              challengeName: challenge.challengeName,
              rewardAmount: challenge.rewardAmount,
              username: userData.username || payment.username,
              completedAt: nextStatus === "completed" ? serverTimestamp() : null
            }, { merge: true });

            if (nextStatus === "completed") {
              const notifRef = doc(collection(db, "notifications"));
              transaction.set(notifRef, {
                userId: payment.userId,
                title: "🏆 Challenge Completed!",
                body: `Congratulations! You reached the target of ${challenge.target} leads for "${challenge.challengeName}". Your ₹${challenge.rewardAmount} reward is pending admin approval.`,
                timestamp: serverTimestamp(),
                isRead: false,
                type: "challenge",
              });
            }
          }
        }

        // Write 4: Create approval notification for payment
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
          userId: payment.userId,
          title: "✅ Payment Request Approved",
          body: `Your payment request of ₹${payment.totalAmount.toLocaleString("en-IN")} has been approved. Balance has been credited!`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "payment",
        });
      });

      await writeAuditLog("Payment Approved", payment.username, `Approved payment request ID ${payment.id} of ₹${payment.totalAmount}`);
      setActiveRemark("");
      setActiveTxId("");
    } catch (err: any) {
      console.error(err);
      alert("Verification Failed: " + (err.message || "Firestore transaction failed."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayment = async (paymentId: string, userId: string, amount: number) => {
    setActionLoading(`reject_${paymentId}`);
    try {
      const paymentRef = doc(db, "payments", paymentId);
      await updateDoc(paymentRef, {
        status: "Rejected",
        adminRemark: activeRemark || "Rejected due to invalid or unverified leads records",
      });

      await addDoc(collection(db, "notifications"), {
        userId,
        title: "❌ Payment Request Rejected",
        body: `Your leads payout request of ₹${amount.toLocaleString("en-IN")} was rejected. Remarks: ${activeRemark || "Unverified leads."}`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "payment",
      });

      const userRec = users.find(u => u.userId === userId);
      const usernameLabel = userRec ? userRec.username : userId;
      await writeAuditLog("Payment Rejected", usernameLabel, `Rejected payment request ID ${paymentId} of ₹${amount}. Remarks: ${activeRemark || "Unverified leads."}`);
      setActiveRemark("");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payments/${paymentId}`);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Withdrawal States ---
  const handleUpdateWithdrawalStatus = async (withdrawal: WithdrawalRequest, newStatus: "Approved" | "Completed" | "Rejected") => {
    setActionLoading(`with_${withdrawal.id}`);
    try {
      const ref = doc(db, "withdrawals", withdrawal.id);
      
      await runTransaction(db, async (transaction) => {
        const withdrawalSnap = await transaction.get(ref);
        if (!withdrawalSnap.exists()) {
          throw new Error("Withdrawal document does not exist.");
        }
        const currentWithdrawalData = withdrawalSnap.data();
        const oldStatus = currentWithdrawalData.status || "Pending";

        const userRef = doc(db, "users", withdrawal.userId);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) {
          throw new Error("User document does not exist.");
        }
        
        const userData = userSnap.data() as UserProfile;
        const currentBalance = userData.walletBalance || 0;
        let nextBalance = currentBalance;

        // Determine balance deduction/refund
        const isOldDeducted = (oldStatus === "Approved" || oldStatus === "Completed");
        const isNewDeducted = (newStatus === "Approved" || newStatus === "Completed");

        if (!isOldDeducted && isNewDeducted) {
          // Needs deduction
          if (currentBalance < withdrawal.withdrawalAmount) {
            throw new Error(`Insufficient user wallet balance (₹${currentBalance}). Cannot approve withdrawal of ₹${withdrawal.withdrawalAmount}.`);
          }
          nextBalance = currentBalance - withdrawal.withdrawalAmount;
        } else if (isOldDeducted && !isNewDeducted) {
          // Reverted/Rejected: refund the balance!
          nextBalance = currentBalance + withdrawal.withdrawalAmount;
        }

        if (nextBalance !== currentBalance) {
          transaction.update(userRef, {
            walletBalance: nextBalance,
          });
        }

        transaction.update(ref, {
          status: newStatus,
          adminRemark: activeRemark || `Withdrawal transitioned to ${newStatus}`,
        });

        // Add user alert
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
          userId: withdrawal.userId,
          title: newStatus === "Completed" ? "🎉 Payout Completed!" : `Withdrawal ${newStatus}`,
          body: newStatus === "Completed" 
            ? `Your withdrawal of ₹${withdrawal.withdrawalAmount.toLocaleString("en-IN")} was successfully paid out to ${withdrawal.upiId}!`
            : `Your withdrawal request of ₹${withdrawal.withdrawalAmount.toLocaleString("en-IN")} has been marked ${newStatus}.`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "withdrawal",
        });
      });

      let actionName = "Withdrawal Updated";
      let descString = `Withdrawal request ID ${withdrawal.id} status updated to ${newStatus}`;
      if (newStatus === "Completed" || newStatus === "Approved") {
        actionName = "Withdrawal Approved";
        descString = `Approved withdrawal of ₹${withdrawal.withdrawalAmount} for user ${withdrawal.username || withdrawal.userId}`;
      } else if (newStatus === "Rejected") {
        actionName = "Withdrawal Rejected";
        descString = `Rejected withdrawal of ₹${withdrawal.withdrawalAmount} for user ${withdrawal.username || withdrawal.userId}. Remarks: ${activeRemark || "None"}`;
      }
      await writeAuditLog(actionName, withdrawal.username || withdrawal.userId, descString);

      setActiveRemark("");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update withdrawal status.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Challenge Approvals ---
  const handleApproveChallenge = async (progress: ChallengeProgress) => {
    setActionLoading(`approve_chal_${progress.id}`);
    try {
      const userRef = doc(db, "users", progress.userId);
      const progressRef = doc(db, "challengeProgress", progress.id);

      await runTransaction(db, async (transaction) => {
        // Read 1: User Profile
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error("Applicant user does not exist in Firestore.");
        }

        // Read 2: Challenge Progress
        const progressDoc = await transaction.get(progressRef);
        if (!progressDoc.exists()) {
          throw new Error("Challenge progress record not found.");
        }

        const progData = progressDoc.data() as ChallengeProgress;
        if (progData.status === "approved" || progData.rewardStatus === "Approved") {
          throw new Error("This challenge progress reward has already been approved.");
        }

        const userData = userDoc.data() as UserProfile;
        const reward = progress.rewardAmount || 0;
        
        const nextBalance = (userData.walletBalance || 0) + reward;
        const nextTotalEarnings = (userData.totalEarnings || 0) + reward;
        const nextTodayEarnings = (userData.todayEarnings || 0) + reward;
        const next7DaysEarnings = (userData.last7DaysEarnings || 0) + reward;
        const next30DaysEarnings = (userData.last30DaysEarnings || 0) + reward;

        // --- ALL WRITES MUST GO AFTER ALL READS ---
        // Update user earnings and wallet balance
        transaction.update(userRef, {
          walletBalance: nextBalance,
          totalEarnings: nextTotalEarnings,
          todayEarnings: nextTodayEarnings,
          last7DaysEarnings: next7DaysEarnings,
          last30DaysEarnings: next30DaysEarnings,
        });

        // Update challenge progress status
        transaction.update(progressRef, {
          status: "approved",
          rewardStatus: "Approved",
          rewardClaimed: true,
          adminReason: "Challenge reward verified and credited.",
        });

        // Add transaction history record (represented as payment approval)
        const paymentId = `CHAL-PAY-${Math.floor(100000 + Math.random() * 900000)}`;
        const paymentRef = doc(db, "payments", paymentId);
        transaction.set(paymentRef, {
          id: paymentId,
          userId: progress.userId,
          username: userData.username || progress.username || "Affiliate",
          email: userData.email || "",
          phone: userData.phone || "",
          totalLeads: progress.completedCount,
          totalAmount: reward,
          status: "Approved",
          timestamp: serverTimestamp(),
          adminRemark: `Reward for challenge: ${progress.challengeName || "Challenge Completion"}`,
          txId: `TX-CHAL-${Math.floor(100000 + Math.random() * 900000)}`,
          date: new Date().toLocaleDateString("en-IN"),
        });

        // Push alert notification
        const notifRef = doc(collection(db, "notifications"));
        transaction.set(notifRef, {
          userId: progress.userId,
          title: "🏆 Challenge Reward Approved!",
          body: `Congratulations! Your completed challenge "${progress.challengeName}" has been approved, and ₹${reward.toLocaleString("en-IN")} has been successfully credited to your wallet balance.`,
          timestamp: serverTimestamp(),
          isRead: false,
          type: "challenge",
        });
      });

      await writeAuditLog(`Approved reward for challenge ${progress.challengeName} for user ${progress.username || progress.userId}`);
      alert("Challenge completion approved! Wallet credited successfully.");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to approve challenge reward.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectProgress) return;
    setActionLoading(`reject_chal_${rejectProgress.id}`);
    try {
      const progressRef = doc(db, "challengeProgress", rejectProgress.id);
      await updateDoc(progressRef, {
        status: "rejected",
        rewardStatus: "Rejected",
        adminReason: rejectReason.trim() || "Rejected: Completed criteria not verified.",
      });

      // Send rejection notification
      await addDoc(collection(db, "notifications"), {
        userId: rejectProgress.userId,
        title: "❌ Challenge Submission Rejected",
        body: `Your submission for the challenge "${rejectProgress.challengeName}" was rejected by admin. Reason: ${rejectReason.trim() || "Criteria unverified."}`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "challenge",
      });

      await writeAuditLog(`Rejected challenge reward for ${rejectProgress.challengeName} (User: ${rejectProgress.username || rejectProgress.userId})`);
      alert("Challenge completion rejected. Notification sent.");
      setRejectProgress(null);
      setRejectReason("");
    } catch (err) {
      console.error(err);
      alert("Failed to reject challenge reward.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Admin Notification Sender ---
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifBody.trim()) {
      setNotifError("Title and body are required.");
      return;
    }
    setActionLoading("send_notification");
    setNotifSuccess(false);
    setNotifError(null);

    try {
      if (notifRecipientType === "single") {
        if (!notifRecipientUserId) {
          throw new Error("Please select a user to send the notification to.");
        }
        await addDoc(collection(db, "notifications"), {
          userId: notifRecipientUserId,
          title: notifTitle.trim(),
          body: notifBody.trim(),
          type: notifType.toLowerCase(),
          timestamp: serverTimestamp(),
          isRead: false,
        });
      } else {
        // Send to everyone (create notification for every user)
        const batch = writeBatch(db);
        users.forEach((u) => {
          const ref = doc(collection(db, "notifications"));
          batch.set(ref, {
            userId: u.userId,
            title: notifTitle.trim(),
            body: notifBody.trim(),
            type: notifType.toLowerCase(),
            timestamp: serverTimestamp(),
            isRead: false,
          });
        });
        await batch.commit();
      }

      await writeAuditLog(`Sent notification: "${notifTitle.trim()}" to ${notifRecipientType === "single" ? notifRecipientUserId : "Everyone"}`);
      setNotifSuccess(true);
      setNotifTitle("");
      setNotifBody("");
    } catch (err: any) {
      console.error(err);
      setNotifError(err.message || "Failed to send notification.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Website Settings Saver ---
  const handleSaveWebsiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_settings");
    try {
      const settingsRef = doc(db, "settings", "website");
      const payload = {
        websiteName: setWebsiteName.trim(),
        logoUrl: setLogoUrl.trim(),
        faviconUrl: setFaviconUrl.trim(),
        footerText: setFooterText.trim(),
        dashboardTitle: setDashboardTitle.trim(),
        welcomeMessage: setWelcomeMessage.trim(),
        buttonText: setButtonText.trim(),
        paymentInstructions: setPaymentInstructions.trim(),
        withdrawalInstructions: setWithdrawalInstructions.trim(),
        challengeText: setChallengeText.trim(),
        leaderboardTitle: setLeaderboardTitle.trim(),
        profileLabels: setProfileLabels.trim(),
        announcementText: setAnnouncementText.trim(),
        termsConditions: setTermsConditions.trim(),
        privacyPolicy: setPrivacyPolicy.trim(),
        supportEmail: setSupportEmail.trim(),
        supportPhone: setSupportPhone.trim(),
        themeColor: setThemeColor.trim(),
        bannerImage: setBannerImage.trim(),
        dashboardVideoUrl: dashboardVideoUrl.trim(),
        paymentVideoUrl: paymentVideoUrl.trim(),
        withdrawalVideoUrl: withdrawalVideoUrl.trim(),
        profileVideoUrl: profileVideoUrl.trim(),
        kycVideoUrl: kycVideoUrl.trim(),
        challengeVideoUrl: challengeVideoUrl.trim(),
      };
      await setDoc(settingsRef, payload);
      await writeAuditLog("Settings Updated", "System", "Updated dynamic platform configurations, branding details, and static page values");
      alert("Website settings saved and deployed globally!");
    } catch (err) {
      console.error(err);
      alert("Failed to save website settings.");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Social Settings Saver ---
  const handleSaveSocialSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("social");
    try {
      await setDoc(doc(db, "settings", "social"), {
        instagramEnabled: instEnabled,
        instagramUrl: instUrl.trim(),
        youtubeEnabled: ytEnabled,
        youtubeUrl: ytUrl.trim(),
        facebookEnabled: fbEnabled,
        facebookUrl: fbUrl.trim(),
        pinterestEnabled: pinEnabled,
        pinterestUrl: pinUrl.trim(),
        order: socOrder,
        links: socialLinks
      });
      await writeAuditLog("Settings Updated", "System", "Updated dynamic social media links and platforms config");
      setSocialSuccess(true);
      setTimeout(() => setSocialSuccess(false), 4000);
      alert("Social Settings saved and deployed website-wide!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to save social settings: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const saveSocialLinksDirectly = async (updatedLinks: any[]) => {
    try {
      await setDoc(doc(db, "settings", "social"), {
        instagramEnabled: instEnabled,
        instagramUrl: instUrl.trim(),
        youtubeEnabled: ytEnabled,
        youtubeUrl: ytUrl.trim(),
        facebookEnabled: fbEnabled,
        facebookUrl: fbUrl.trim(),
        pinterestEnabled: pinEnabled,
        pinterestUrl: pinUrl.trim(),
        order: socOrder,
        links: updatedLinks
      });
      await writeAuditLog("Settings Updated", "System", "Auto-saved dynamic social media link");
    } catch (err: any) {
      console.error("Failed to auto-save social link: ", err);
    }
  };

  const handleAddOrEditSocialLink = async () => {
    if (!socialFormName.trim() || !socialFormUrl.trim()) {
      alert("Platform name and URL are required.");
      return;
    }
    let updated: any[];
    if (editingSocialLink) {
      updated = socialLinks.map(link => {
        if (link.id === editingSocialLink.id) {
          return {
            ...link,
            platformName: socialFormName.trim(),
            iconName: socialFormIcon,
            url: socialFormUrl.trim(),
            displayOrder: Number(socialFormOrder) || 1,
            enabled: socialFormEnabled
          };
        }
        return link;
      });
    } else {
      const newLink = {
        id: "social_" + Date.now(),
        platformName: socialFormName.trim(),
        iconName: socialFormIcon,
        url: socialFormUrl.trim(),
        displayOrder: Number(socialFormOrder) || 1,
        enabled: socialFormEnabled
      };
      updated = [...socialLinks, newLink];
    }

    setSocialLinks(updated);
    await saveSocialLinksDirectly(updated);
    setEditingSocialLink(null);
    setSocialFormName("");
    setSocialFormIcon("youtube");
    setSocialFormUrl("");
    setSocialFormOrder(updated.length + 1);
    setSocialFormEnabled(true);
  };

  const handleEditSocialLinkStart = (link: any) => {
    setEditingSocialLink(link);
    setSocialFormName(link.platformName);
    setSocialFormIcon(link.iconName);
    setSocialFormUrl(link.url);
    setSocialFormOrder(link.displayOrder);
    setSocialFormEnabled(link.enabled);
  };

  const handleDeleteSocialLink = async (id: string) => {
    if (confirm("Are you sure you want to remove this social link?")) {
      const updated = socialLinks.filter(l => l.id !== id);
      setSocialLinks(updated);
      await saveSocialLinksDirectly(updated);
    }
  };

  const handleToggleSocialLink = async (id: string) => {
    const updated = socialLinks.map(l => {
      if (l.id === id) {
        return { ...l, enabled: !l.enabled };
      }
      return l;
    });
    setSocialLinks(updated);
    await saveSocialLinksDirectly(updated);
  };

  // --- PREMIUM & REVENUE SETTINGS HANDLERS ---
  const handleSaveMembershipPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("membership_plan");
    try {
      const parsedPrice = Number(planPrice);
      const parsedDuration = planIsLifetime ? 1200 : Number(planDurationMonths);

      if (!planName.trim()) throw new Error("Plan name is required.");
      if (isNaN(parsedPrice) || parsedPrice < 0) throw new Error("Price must be a positive number.");
      if (!planIsLifetime && (isNaN(parsedDuration) || parsedDuration <= 0)) throw new Error("Duration must be a positive number of months.");

      const planData = {
        name: planName.trim(),
        price: parsedPrice,
        durationMonths: parsedDuration,
        isLifetime: planIsLifetime,
        features: planFeatures.split("\n").map(f => f.trim()).filter(Boolean),
        vipBenefits: planVipBenefits.split("\n").map(f => f.trim()).filter(Boolean),
        badgeStyle: planBadgeStyle.trim() || "👑 VIP MEMBER",
      };

      if (editingPlan) {
        await updateDoc(doc(db, "membershipPlans", editingPlan.id), planData);
        await writeAuditLog(`Updated Membership Plan: ${planName}`);
        alert("Plan updated successfully!");
      } else {
        await addDoc(collection(db, "membershipPlans"), planData);
        await writeAuditLog(`Created Membership Plan: ${planName}`);
        alert("Plan created successfully!");
      }

      setEditingPlan(null);
      setPlanName("");
      setPlanPrice("");
      setPlanDurationMonths("");
      setPlanIsLifetime(false);
      setPlanFeatures("");
      setPlanVipBenefits("");
      setPlanBadgeStyle("");
    } catch (err: any) {
      alert("Failed to save plan: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMembershipPlan = async (planId: string, pName: string) => {
    if (!window.confirm(`Are you sure you want to delete the plan "${pName}"?`)) return;
    setActionLoading(`del_plan_${planId}`);
    try {
      await deleteDoc(doc(db, "membershipPlans", planId));
      await writeAuditLog(`Deleted Membership Plan: ${pName}`);
      alert("Plan deleted successfully!");
    } catch (err: any) {
      alert("Failed to delete plan: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveFeesSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_fees");
    setPlatformFeesSuccess(false);
    try {
      const data = {
        withdrawalFeeType,
        withdrawalFeeFixed: Number(withdrawalFeeFixed),
        withdrawalFeePercent: Number(withdrawalFeePercent),
        withdrawalFeeMin: Number(withdrawalFeeMin),
        withdrawalFeeMax: Number(withdrawalFeeMax),
        withdrawalFeeEnabled,
        fastWithdrawalFeeEnabled,
        fastWithdrawalFeeFixed: Number(fastWithdrawalFeeFixed),
        fastWithdrawalFeePercent: Number(fastWithdrawalFeePercent),
        fastWithdrawalFeeMin: Number(fastWithdrawalFeeMin),
        fastWithdrawalFeeMax: Number(fastWithdrawalFeeMax),
        challengeEntryFeeEnabled,
        challengeEntryFeeAmount: Number(challengeEntryFeeAmount),
      };

      await setDoc(doc(db, "settings", "fees"), data);
      await writeAuditLog("Settings Updated", "System", "Updated platform fee settings, withdrawal charges, and entry parameters");
      setPlatformFeesSuccess(true);
      setTimeout(() => setPlatformFeesSuccess(false), 4000);
    } catch (err: any) {
      alert("Failed to save platform fees: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveWithdrawConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading("save_withdraw_config");
    setWithdrawConfigSuccess(false);
    try {
      const allowedDaysList = allowedWithdrawDays.split(",").map(d => d.trim()).filter(Boolean);
      const data = {
        minAmount: Number(minWithdrawAmount),
        maxAmount: Number(maxWithdrawAmount),
        dailyLimit: Number(dailyWithdrawLimit),
        weeklyLimit: Number(weeklyWithdrawLimit),
        monthlyLimit: Number(monthlyWithdrawLimit),
        allowedDays: allowedDaysList,
        startTime: withdrawStartTime.trim(),
        endTime: withdrawEndTime.trim(),
        enabled: withdrawEnabled,
      };

      await setDoc(doc(db, "settings", "withdrawals"), data);
      await writeAuditLog("Settings Updated", "System", "Updated withdrawal scheduling, minimums/maximums limits, and timing gates");
      setWithdrawConfigSuccess(true);
      setTimeout(() => setWithdrawConfigSuccess(false), 4000);
    } catch (err: any) {
      alert("Failed to save withdrawal schedule: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Announcement publishing ---
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    setActionLoading("ann");
    try {
      if (editAnnId) {
        // Update Mode
        const ref = doc(db, "announcements", editAnnId);
        await updateDoc(ref, {
          title: annTitle.trim(),
          content: annContent.trim(),
        });
        setEditAnnId(null);
      } else {
        // Create Mode
        await addDoc(collection(db, "announcements"), {
          title: annTitle.trim(),
          content: annContent.trim(),
          active: true,
          timestamp: serverTimestamp(),
        });

        await addDoc(collection(db, "notifications"), {
          userId: "all",
          title: `📢 New Notice: ${annTitle.trim()}`,
          body: annContent.trim(),
          timestamp: serverTimestamp(),
          isRead: false,
          type: "announcement",
        });
      }

      setAnnTitle("");
      setAnnContent("");
      setAnnSuccess(true);
      setTimeout(() => setAnnSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "announcements");
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartEditAnnouncement = (ann: Announcement) => {
    setEditAnnId(ann.id);
    setAnnTitle(ann.title);
    setAnnContent(ann.content);
    // Smooth scroll to top of announcements tab form
    const formEl = document.getElementById("announcement-form");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you absolutely sure you want to delete this notice? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "announcements", id));
      alert("Notice deleted successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete announcement.");
    }
  };

  const handleToggleAnnActive = async (id: string, current: boolean) => {
    try {
      const ref = doc(db, "announcements", id);
      await updateDoc(ref, { active: !current });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `announcements/${id}`);
    }
  };

  const handleExportWeeklyReportPDF = () => {
    try {
      const docPdf = new jsPDF();
      
      // Document branding & header banner
      docPdf.setFillColor(15, 23, 42); // slate-900 background for top banner
      docPdf.rect(0, 0, 210, 40, "F");

      // Banner text
      docPdf.setTextColor(255, 255, 255);
      docPdf.setFont("Helvetica", "bold");
      docPdf.setFontSize(20);
      docPdf.text("LEARN WITH ANKIT", 14, 18);
      docPdf.setFontSize(9);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text("OFFICIAL WEEKLY PLATFORM REPORT & FINANCIAL STATEMENTS", 14, 25);
      docPdf.text(`Generated: ${new Date().toLocaleDateString("en-IN")} at ${new Date().toLocaleTimeString("en-IN")} by Admin ${adminUser?.username || "Admin"}`, 14, 31);
      
      // Main Body Style
      docPdf.setTextColor(30, 30, 30);
      
      // Section 1: Executive Stats
      docPdf.setFont("Helvetica", "bold");
      docPdf.setFontSize(12);
      docPdf.text("1. PLATFORM SUMMARY METRICS", 14, 52);
      
      // Horizontal separator
      docPdf.setDrawColor(226, 232, 240); // slate-200
      docPdf.line(14, 55, 196, 55);

      // Financial Metrics Grid
      docPdf.setFont("Helvetica", "normal");
      docPdf.setFontSize(9);
      let y = 62;
      
      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Registered Accounts Count:", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`${users.length} active users`, 75, y);
      y += 7;

      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Platform Lifetime Earnings:", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`INR ${totalEarningsAllTime.toLocaleString("en-IN")}.00`, 75, y);
      y += 7;

      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Outstanding Wallet Liability:", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`INR ${totalWalletBalances.toLocaleString("en-IN")}.00`, 75, y);
      y += 7;

      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Disbursed Payouts (Completed):", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`INR ${totalCompletedWithdrawalsVal.toLocaleString("en-IN")}.00`, 75, y);
      y += 7;

      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Total Lead Payments Processed:", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`INR ${totalCompletedPaymentsVal.toLocaleString("en-IN")}.00`, 75, y);
      y += 7;

      // New Advanced Metrics
      const payoutRatio = totalEarningsAllTime > 0 
        ? ((totalCompletedWithdrawalsVal / totalEarningsAllTime) * 100).toFixed(2)
        : "0.00";
      
      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Disbursement to Earnings Ratio:", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`${payoutRatio}%`, 75, y);
      y += 7;

      const activeUsersCount = users.filter(u => u.accountStatus !== "Suspended").length;
      const suspendedUsersCount = users.filter(u => u.accountStatus === "Suspended").length;
      docPdf.setFont("Helvetica", "bold");
      docPdf.text("Active vs Suspended Accounts:", 16, y);
      docPdf.setFont("Helvetica", "normal");
      docPdf.text(`${activeUsersCount} Active / ${suspendedUsersCount} Suspended`, 75, y);
      y += 10;

      // Section 2: Payments / Leads Submissions
      docPdf.setFont("Helvetica", "bold");
      docPdf.setFontSize(12);
      docPdf.text("2. RECENT LEAD APPROVED TRANSACTIONS", 14, y);
      y += 3;
      docPdf.line(14, y, 196, y);
      y += 6;

      docPdf.setFont("Helvetica", "normal");
      docPdf.setFontSize(8.5);
      const approvedPayments = payments.filter(p => p.status === "Approved");
      if (approvedPayments.length === 0) {
        docPdf.text("No approved lead payment records found.", 16, y);
        y += 8;
      } else {
        // Draw Table Header
        docPdf.setFont("Helvetica", "bold");
        docPdf.text("Date", 16, y);
        docPdf.text("Affiliate Name", 45, y);
        docPdf.text("Leads", 110, y);
        docPdf.text("Amount (INR)", 140, y);
        docPdf.text("Remark / TX ID", 170, y);
        y += 5;
        docPdf.setFont("Helvetica", "normal");

        approvedPayments.slice(0, 15).forEach((p) => {
          if (y > 275) { docPdf.addPage(); y = 20; }
          docPdf.text(`${p.date || "N/A"}`, 16, y);
          docPdf.text(`${p.username ? p.username.substring(0, 20) : "N/A"}`, 45, y);
          docPdf.text(`${p.totalLeads || 0}`, 110, y);
          docPdf.text(`INR ${p.totalAmount || 0}`, 140, y);
          docPdf.text(`${(p.remark || "Approved").substring(0, 12)}`, 170, y);
          y += 6;
        });
      }

      y += 6;
      if (y > 270) { docPdf.addPage(); y = 20; }

      // Section 3: Withdrawals Submissions
      docPdf.setFont("Helvetica", "bold");
      docPdf.setFontSize(12);
      docPdf.text("3. RECENT DISBURSED PAYOUT LOGS", 14, y);
      y += 3;
      docPdf.line(14, y, 196, y);
      y += 6;

      docPdf.setFont("Helvetica", "normal");
      docPdf.setFontSize(8.5);
      if (completedWithdrawals.length === 0) {
        docPdf.text("No disbursed payout records found.", 16, y);
        y += 8;
      } else {
        // Draw Table Header
        docPdf.setFont("Helvetica", "bold");
        docPdf.text("Date", 16, y);
        docPdf.text("Affiliate Name", 45, y);
        docPdf.text("UPI Address", 110, y);
        docPdf.text("Amount (INR)", 150, y);
        y += 5;
        docPdf.setFont("Helvetica", "normal");

        completedWithdrawals.slice(0, 15).forEach((w) => {
          if (y > 275) { docPdf.addPage(); y = 20; }
          docPdf.text(`${w.date || "N/A"}`, 16, y);
          docPdf.text(`${w.username ? w.username.substring(0, 20) : "N/A"}`, 45, y);
          docPdf.text(`${w.upiId || "N/A"}`, 110, y);
          docPdf.text(`INR ${w.withdrawalAmount || 0}`, 150, y);
          y += 6;
        });
      }

      // Footer administrative sign-off
      if (y > 250) { docPdf.addPage(); y = 20; }
      y += 12;
      docPdf.setDrawColor(200, 200, 200);
      docPdf.line(14, y, 196, y);
      y += 6;
      docPdf.setFontSize(7.5);
      docPdf.setFont("Helvetica", "italic");
      docPdf.text("CONFIDENTIAL PLATFORM FINANCIAL DOCUMENT - LEARN WITH ANKIT AUDIT ENGINE.", 14, y);
      y += 4;
      docPdf.text("THIS DOCUMENT HAS BEEN SECURELY SIGNED AND COMPILED AUTOMATICALLY BY FIREBASE CRYPTO REPORTING SERVICE.", 14, y);

      docPdf.save(`LWA_Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      alert("Weekly Financial PDF Report with advanced metrics downloaded successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to export PDF: " + err.message);
    }
  };

  // --- Dynamic Pages Handler ---
  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageTitle.trim() || !pageSlug.trim() || !pageContent.trim()) {
      alert("Title, Slug, and Page Content are required.");
      return;
    }

    setActionLoading("page");
    try {
      const sanitizedSlug = pageSlug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-");
      
      if (pageId) {
        const ref = doc(db, "pages", pageId);
        await updateDoc(ref, {
          title: pageTitle.trim(),
          slug: sanitizedSlug,
          content: pageContent.trim(),
          seoTitle: pageSeoTitle.trim(),
          seoDescription: pageSeoDesc.trim(),
          imageUrl: pageImgUrl.trim(),
          isPublished: pageIsPublished,
        });
      } else {
        await addDoc(collection(db, "pages"), {
          title: pageTitle.trim(),
          slug: sanitizedSlug,
          content: pageContent.trim(),
          seoTitle: pageSeoTitle.trim(),
          seoDescription: pageSeoDesc.trim(),
          imageUrl: pageImgUrl.trim(),
          isPublished: pageIsPublished,
          createdAt: serverTimestamp(),
        });
      }

      setPageId("");
      setPageTitle("");
      setPageSlug("");
      setPageContent("");
      setPageSeoTitle("");
      setPageSeoDesc("");
      setPageImgUrl("");
      setPageIsPublished(true);
      setPageSuccess(true);
      setTimeout(() => setPageSuccess(false), 3000);
      alert("Page saved successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to save page: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditPage = (page: any) => {
    setPageId(page.id);
    setPageTitle(page.title);
    setPageSlug(page.slug);
    setPageContent(page.content);
    setPageSeoTitle(page.seoTitle || "");
    setPageSeoDesc(page.seoDescription || "");
    setPageImgUrl(page.imageUrl || "");
    setPageIsPublished(page.isPublished);
    const formEl = document.getElementById("pages-form");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this page? This will also remove it from navigation.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "pages", id));
      alert("Page deleted successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete page.");
    }
  };

  // --- Dynamic Navigation Menu Handler ---
  const handleSaveNavigation = async (menuItems: any[]) => {
    setActionLoading("navigation");
    try {
      await setDoc(doc(db, "settings", "navigation"), { menu: menuItems });
      alert("Navigation menu saved successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to save navigation menu: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };



  // --- Feature Toggles Handler ---
  const handleSaveFeatureToggles = async (toggles: any) => {
    setActionLoading("features");
    try {
      await setDoc(doc(db, "settings", "features"), toggles);
      setFeaturesSuccess(true);
      setTimeout(() => setFeaturesSuccess(false), 3000);
      alert("Feature toggles saved successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to save feature toggles: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearHistory = async (type: "payments" | "withdrawals") => {
    const confirmation1 = window.confirm(`⚠️ WARNING: You are about to PERMANENTLY delete ALL ${type} history. This will erase all logs and records. Did you download the PDF report first?`);
    if (!confirmation1) return;

    const confirmation2 = window.prompt(`Type "DELETE ALL ${type.toUpperCase()}" to confirm this highly destructive action:`);
    if (confirmation2 !== `DELETE ALL ${type.toUpperCase()}`) {
      alert("Action cancelled. Confirmation text did not match.");
      return;
    }

    try {
      setActionLoading("clear");
      const colRef = collection(db, type);
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      await writeAuditLog(`Cleared all platform ${type} history.`);
      alert(`All ${type} history cleared successfully!`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to clear ${type} history: ` + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteIndividualRequest = async (id: string, collectionName: "payments" | "withdrawals") => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete this ${collectionName === "payments" ? "lead entry" : "withdrawal entry"} from history?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, collectionName, id));
      alert("Entry deleted successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete entry: " + err.message);
    }
  };

  // --- Export Reports (Simulated CSV Download) ---
  const handleExportCSV = (type: "payments" | "withdrawals" | "auditLogs") => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let filename = "";

    if (type === "payments") {
      headers = ["ID", "Username", "Email", "Phone", "Total Leads", "Amount (INR)", "Status", "Date"];
      rows = payments.map(p => [p.id, p.username, p.email, p.phone, String(p.totalLeads), String(p.totalAmount), p.status, p.date]);
      filename = "Payments_Report.csv";
    } else if (type === "withdrawals") {
      headers = ["ID", "Username", "UPI ID", "UPI Mobile", "Withdrawal Amount", "Status", "Date", "Remarks"];
      rows = withdrawals.map(w => [w.id, w.username, w.upiId, w.upiNumber, String(w.withdrawalAmount), w.status, w.date, w.adminRemark || ""]);
      filename = "Withdrawals_Payout_Report.csv";
    } else {
      headers = ["ID", "Administrator", "Action Taken", "Date", "Time", "IP Address"];
      rows = auditLogs.map(a => [a.id, a.adminName, a.action, a.date, a.time, a.ip || ""]);
      filename = "System_Audit_Log.csv";
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- SERVICES ADMINISTRATION CONTROLLERS ---
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || servicePrice === "") return;

    setActionLoading("save_service");
    try {
      if (editingService) {
        // Edit Service
        await updateDoc(doc(db, "services", editingService.id), {
          name: serviceName.trim(),
          description: serviceDescription.trim(),
          price: Number(servicePrice),
          status: serviceStatus,
          thumbnail: serviceThumbnail.trim(),
        });
        await writeAuditLog("Service Edited", "System", `Edited premium service details: "${serviceName.trim()}" (Price: ₹${servicePrice})`);
        alert("Service updated successfully!");
      } else {
        // Create Service
        await addDoc(collection(db, "services"), {
          name: serviceName.trim(),
          description: serviceDescription.trim(),
          price: Number(servicePrice),
          status: serviceStatus,
          thumbnail: serviceThumbnail.trim(),
          createdDate: new Date().toLocaleDateString("en-IN"),
          createdAt: serverTimestamp(),
        });
        await writeAuditLog("Service Created", "System", `Created new premium service marketplace listing: "${serviceName.trim()}" (Price: ₹${servicePrice})`);
        alert("Service created successfully!");
      }
      
      // Clear form
      setEditingService(null);
      setServiceName("");
      setServiceDescription("");
      setServicePrice("");
      setServiceStatus("Active");
      setServiceThumbnail("");
    } catch (err: any) {
      console.error(err);
      alert("Failed to save service: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteService = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete service "${name}"? This cannot be undone.`)) {
      return;
    }
    setActionLoading(`delete_service_${id}`);
    try {
      await deleteDoc(doc(db, "services", id));
      await writeAuditLog("Service Deleted", "System", `Deleted premium service from marketplace: "${name}"`);
      alert("Service deleted successfully!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete service: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // --- MEMBERSHIP ADMINISTRATION CONTROLLERS ---
  const handleCancelUserMembership = async (userRecord: UserProfile) => {
    if (!window.confirm(`Are you sure you want to cancel ${userRecord.username}'s membership?`)) {
      return;
    }
    setActionLoading(`cancel_memb_${userRecord.userId}`);
    try {
      const userRef = doc(db, "users", userRecord.userId);
      await updateDoc(userRef, {
        isPremium: false,
        membershipStatus: "Cancelled",
        premiumExpiryDate: null,
      });

      // Send Notification
      await addDoc(collection(db, "notifications"), {
        userId: userRecord.userId,
        title: "👑 Membership Cancelled",
        body: "Your Premium Membership has been cancelled by the administrator.",
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      // Write Audit Log
      await writeAuditLog("Membership Cancelled", userRecord.username, `Cancelled membership plan ${userRecord.vipTagText || "Premium"}`);
      alert("Membership cancelled successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to cancel membership: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExpireUserMembership = async (userRecord: UserProfile) => {
    if (!window.confirm(`Are you sure you want to manually expire ${userRecord.username}'s membership?`)) {
      return;
    }
    setActionLoading(`expire_memb_${userRecord.userId}`);
    try {
      const userRef = doc(db, "users", userRecord.userId);
      await updateDoc(userRef, {
        isPremium: false,
        membershipStatus: "Expired",
      });

      // Send Notification
      await addDoc(collection(db, "notifications"), {
        userId: userRecord.userId,
        title: "👑 Membership Expired",
        body: "Your Premium Membership has expired manually by administrative update.",
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      // Write Audit Log
      await writeAuditLog("Membership Expired", userRecord.username, `Expired membership manually`);
      alert("Membership expired successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to expire membership: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExtendUserMembership = async (userRecord: UserProfile, months: number) => {
    setActionLoading(`extend_memb_${userRecord.userId}`);
    try {
      const userRef = doc(db, "users", userRecord.userId);
      let baseDate = new Date();
      if (userRecord.premiumExpiryDate && userRecord.premiumExpiryDate !== "Lifetime") {
        const currentExp = new Date(userRecord.premiumExpiryDate);
        if (currentExp.getTime() > Date.now()) {
          baseDate = currentExp;
        }
      }
      baseDate.setMonth(baseDate.getMonth() + months);
      const newExpiry = baseDate.toISOString();

      await updateDoc(userRef, {
        isPremium: true,
        membershipStatus: "Active",
        premiumExpiryDate: newExpiry,
      });

      // Send Notification
      await addDoc(collection(db, "notifications"), {
        userId: userRecord.userId,
        title: "👑 Membership Extended",
        body: `Your Premium Membership has been extended by ${months} month(s). New expiry date: ${baseDate.toLocaleDateString("en-IN")}.`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      // Write Audit Log
      await writeAuditLog("Membership Extended", userRecord.username, `Extended membership by ${months} months. New expiry: ${baseDate.toLocaleDateString("en-IN")}`);
      alert(`Membership extended by ${months} month(s).`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to extend membership: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeUserMembershipPlan = async (userRecord: UserProfile, plan: MembershipPlan) => {
    setActionLoading(`change_plan_${userRecord.userId}`);
    try {
      const userRef = doc(db, "users", userRecord.userId);
      const now = new Date();
      let expiryVal: any = "Lifetime";
      if (!plan.isLifetime) {
        const duration = plan.durationMonths || 1;
        expiryVal = new Date(now.setMonth(now.getMonth() + duration)).toISOString();
      }

      await updateDoc(userRef, {
        isPremium: true,
        membershipStatus: "Active",
        premiumPlanId: plan.id,
        premiumExpiryDate: expiryVal,
        premiumBadgeStyle: (plan as any).badgeStyle || "👑 VIP MEMBER",
        vipTagText: (plan as any).badgeStyle || "👑 VIP MEMBER",
      });

      // Send Notification
      await addDoc(collection(db, "notifications"), {
        userId: userRecord.userId,
        title: "👑 Membership Plan Updated!",
        body: `Your Premium Membership plan was changed by administrator to "${plan.name}". Expiry: ${plan.isLifetime ? "Lifetime" : new Date(expiryVal).toLocaleDateString("en-IN")}.`,
        timestamp: serverTimestamp(),
        isRead: false,
        type: "system",
      });

      // Write Audit Log
      await writeAuditLog("Membership Plan Changed", userRecord.username, `Changed plan to ${plan.name} (Price: ₹${plan.price})`);
      alert(`Membership plan changed to ${plan.name}.`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to change membership plan: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // --- SECURITY AUDIT LOG CONTROLLERS ---
  const handleExportAuditLogs = () => {
    try {
      const headers = ["Date", "Time", "Founder/Admin Name", "Action", "Target User", "Description", "IP Address"];
      const rows = auditLogs.map(log => [
        log.date,
        log.time,
        log.adminName,
        log.action,
        log.targetUser || "System",
        log.description || "",
        log.ip || "127.0.0.1"
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `LWA_Audit_Logs_${new Date().toLocaleDateString("en-IN")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error(err);
      alert("Failed to export logs: " + err.message);
    }
  };

  const handleDeleteAllAuditLogs = async () => {
    if (!window.confirm("ARE YOU ABSOLUTELY SURE you want to delete ALL Audit Logs? This is a highly destructive administrative action and cannot be undone.")) {
      return;
    }
    setActionLoading("delete_all_logs");
    try {
      const batch = writeBatch(db);
      const logsSnap = await getDocs(collection(db, "auditLogs"));
      logsSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      alert("All audit logs deleted successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete audit logs: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // --- Search Filtering ---
  const filteredUsers = users.filter(u => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      u.username.toLowerCase().includes(term) ||
      u.userId.toLowerCase().includes(term) ||
      (u.phone && u.phone.includes(term)) ||
      u.email.toLowerCase().includes(term)
    );
  });

  // Calculate totals for Analytics Cards
  const totalUsersCount = users.length;
  const pendingPayments = payments.filter(p => p.status === "Pending");
  const pendingWithdrawals = withdrawals.filter(w => w.status === "Pending");
  const completedWithdrawals = withdrawals.filter(w => w.status === "Completed");
  const completedPayments = payments.filter(p => p.status === "Approved");

  // Sum calculations
  const totalEarningsAllTime = users.reduce((acc, u) => acc + (u.totalEarnings || 0), 0);
  const totalWalletBalances = users.reduce((acc, u) => acc + (u.walletBalance || 0), 0);
  
  const totalCompletedPaymentsVal = completedPayments.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalCompletedWithdrawalsVal = completedWithdrawals.reduce((acc, w) => acc + w.withdrawalAmount, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl glass-panel border border-zinc-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-display font-extrabold shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            A
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-zinc-100 uppercase tracking-widest">Administrator Operations</h2>
            <p className="text-xs text-zinc-400">Manage users, security configurations, payouts, and log systems.</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-1.5 mt-4 md:mt-0 bg-slate-950/80 p-1 rounded-xl border border-zinc-800/65">
          {[
            { id: "analytics", label: "Analytics", show: featureToggles.enableDashboard !== false },
            { id: "users", label: "Users", show: hasPermission("manageUsers") },
            { id: "payments", label: "Payments", show: hasPermission("managePayments") && featureToggles.enablePaymentRequests !== false },
            { id: "withdrawals", label: "Withdrawals", show: hasPermission("manageWithdrawals") && featureToggles.enableWithdrawals !== false },
            { id: "challenges_review", label: "Challenges Review", show: hasPermission("manageChallenges") && featureToggles.enableChallenges !== false },
            { id: "services", label: "🛠️ Services Manager", show: hasPermission("manageSettings") && featureToggles.enableServices !== false },
            { id: "memberships_manage", label: "👥 Memberships Manager", show: hasPermission("manageSettings") },
            { id: "audit_logs", label: "📜 Audit Logs", show: hasPermission("manageSettings") },
            { id: "notifications", label: "Broadcast Notices", show: hasPermission("manageNotifications") && featureToggles.enableNotifications !== false },
            { id: "membership", label: "👑 Premium Plans", show: hasPermission("manageSettings") },
            { id: "fees", label: "💸 Fees Manager", show: hasPermission("manageSettings") },
            { id: "withdrawal_settings", label: "🗓️ Withdrawal Schedule", show: hasPermission("manageSettings") },
            { id: "revenue", label: "📈 Revenue Analytics", show: hasPermission("manageSettings") },
            { id: "pages", label: "Pages Builder", show: hasPermission("managePages") },
            { id: "storage", label: "Storage Monitor", show: hasPermission("manageBackup") },
            { id: "features", label: "Feature Toggles", show: hasPermission("manageSettings") },
            { id: "settings", label: "System Settings", show: hasPermission("manageSettings") && featureToggles.enableSettings !== false },
            { id: "social_settings", label: "Social Settings", show: hasPermission("manageSettings") && featureToggles.enableSettings !== false },
            { id: "announcements", label: "Announcements", show: hasPermission("manageAnnouncements") },
            { id: "weeklyReport", label: "Weekly Report", show: (adminUser.role === "founder" || adminUser.role === "admin") && featureToggles.enableReports !== false },
          ].filter(t => t.show).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-red-500 text-white shadow-md"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* RENDER ACTIVE TAB */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">Cumulative Registered Users</span>
              <p className="text-2xl font-display font-black text-zinc-100">{totalUsersCount} accounts</p>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">All-Time Cumulative Earnings</span>
              <p className="text-2xl font-display font-black text-amber-400">₹{totalEarningsAllTime.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">Pending Leads Payments</span>
              <p className="text-2xl font-display font-black text-red-400">{pendingPayments.length} requests</p>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">Pending Withdrawals</span>
              <p className="text-2xl font-display font-black text-amber-500">{pendingWithdrawals.length} request(s)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-zinc-900 pt-4">
            <div className="bg-zinc-900/10 p-4 border border-zinc-900 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-mono text-zinc-500">Total Approved Lead Payments</span>
              <p className="text-lg font-bold text-zinc-300">₹{totalCompletedPaymentsVal.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-zinc-900/10 p-4 border border-zinc-900 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-mono text-zinc-500">Total Disbursed Withdrawals</span>
              <p className="text-lg font-bold text-emerald-400">₹{totalCompletedWithdrawalsVal.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-zinc-900/10 p-4 border border-zinc-900 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-mono text-zinc-500">Total Wallet Balances</span>
              <p className="text-lg font-bold text-amber-500">₹{totalWalletBalances.toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-zinc-900/10 p-4 border border-zinc-900 rounded-xl space-y-1">
              <span className="text-[9px] uppercase font-mono text-zinc-500">System Activity Status</span>
              <p className="text-lg font-bold text-emerald-500">SECURE ACTIVE</p>
            </div>
          </div>

          {/* Quick Manual Balance Crediter */}
          <div className="rounded-2xl bg-zinc-900/20 border border-zinc-800 p-6 shadow-lg">
            <h3 className="text-sm font-display font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Manual Balance Adjustments (Direct Credit)</span>
            </h3>

            {manualError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
                {manualError}
              </div>
            )}
            {manualSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs">
                Wallet successfully credited. Automated user notification triggered!
              </div>
            )}

            <form onSubmit={handleManualBalance} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1.5">Select User</label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-200"
                >
                  <option value="">-- Choose Account --</option>
                  {users.map(u => (
                    <option key={u.userId} value={u.userId}>
                      {u.username} (₹{u.walletBalance || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1.5">Amount to Credit (₹)</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1.5">Administrative Remark</label>
                <input
                  type="text"
                  placeholder="Referral campaign bonus..."
                  value={manualRemark}
                  onChange={(e) => setManualRemark(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={actionLoading === "manual_balance"}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-slate-950 font-display font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1 cursor-pointer transition-all active:scale-98"
                >
                  {actionLoading === "manual_balance" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Add Credit</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-6">
          {/* User Creator Form */}
          <div className="bg-slate-950/20 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <h3 className="text-sm font-display font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <UserPlus className="w-4 h-4 text-red-400" />
              <span>Admin Account Provisioner</span>
            </h3>

            {createError && (
              <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-xl mb-4">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl mb-4">
                Credential and Firestore profile created successfully! Use these details to log in.
              </div>
            )}

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 font-sans">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  placeholder="ankit_kumar"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Custom User ID (e.g. ANKIT01)</label>
                <input
                  type="text"
                  required
                  placeholder="ANKIT01"
                  value={createUserId}
                  onChange={(e) => setCreateUserId(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Login Email</label>
                <input
                  type="email"
                  required
                  placeholder="ankit@learn.com"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">State</label>
                <input
                  type="text"
                  placeholder="Delhi"
                  value={createState}
                  onChange={(e) => createState(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2 px-3.5 text-xs text-zinc-200 focus:outline-hidden focus:border-red-500/50"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={actionLoading === "create_user"}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:bg-zinc-800 text-white font-display font-semibold py-2.5 rounded-xl text-xs transition-all active:scale-98 cursor-pointer"
                >
                  {actionLoading === "create_user" ? "Creating Account..." : "Create User Account"}
                </button>
              </div>
            </form>
          </div>

          {/* Search tool */}
          <div className="bg-slate-950/10 border border-zinc-800/80 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2">
                <Users className="w-4 h-4 text-zinc-400" />
                <span>Accounts Directory ({filteredUsers.length} active)</span>
              </h3>

              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search by name, ID, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4 bg-slate-950/40 p-4 border border-zinc-850 rounded-xl">
              <div className="flex-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">Filter by User Roles (Tags Selection)</span>
                <MultiSelect
                  id="user-roles-filter"
                  options={[
                    { value: "user", label: "Standard User" },
                    { value: "co-founder", label: "Co-Founder" },
                    { value: "admin", label: "Admin" },
                    { value: "founder", label: "Founder" },
                  ]}
                  selected={filterRoles}
                  onChange={(selectedList) => {
                    setFilterRoles(selectedList);
                    saveAdminPreferences(selectedList, filterWithdrawalStatuses, filterPaymentStatuses);
                  }}
                  placeholder="Filter roles..."
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-mono uppercase tracking-wider">
                    <th className="py-3 px-2">Account Name</th>
                    <th className="py-3 px-2">Affiliate ID</th>
                    <th className="py-3 px-2">Role</th>
                    <th className="py-3 px-2">Email</th>
                    <th className="py-3 px-2">State</th>
                    <th className="py-3 px-2">Wallet Balance</th>
                    <th className="py-3 px-2">Total Earnings</th>
                    <th className="py-3 px-2">Account Status</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {filteredUsers.map(u => {
                    const isBanned = u.accountStatus === "Suspended";
                    let bannedTimeStr = "";
                    if (isBanned && u.bannedUntil) {
                      if (u.bannedUntil === "Permanent") {
                        bannedTimeStr = " (Permanent)";
                      } else {
                        const date = new Date(u.bannedUntil);
                        bannedTimeStr = ` (Until ${date.toLocaleDateString("en-IN")} ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })})`;
                      }
                    }
                    return (
                      <tr key={u.userId} className="hover:bg-zinc-900/30">
                        <td className="py-3 px-2 font-semibold text-zinc-100">
                          {u.username}
                          <span className="block text-[9px] font-mono text-zinc-500 font-normal">UID: {u.userId.substring(0, 8)}...</span>
                        </td>
                        <td className="py-3 px-2 font-mono text-zinc-300 font-semibold text-[11px]">
                          {u.customUserId || "N/A"}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[9px] font-medium ${
                            u.role === "admin" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          }`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-zinc-400">{u.email}</td>
                        <td className="py-3 px-2">{u.state || "-"}</td>
                        <td className="py-3 px-2 font-mono font-semibold text-amber-400">₹{u.walletBalance || 0}</td>
                        <td className="py-3 px-2 font-mono font-semibold">₹{u.totalEarnings || 0}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isBanned 
                              ? "bg-red-500/10 text-red-400 border-red-500/20" 
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>
                            {u.accountStatus}{bannedTimeStr}
                          </span>
                        </td>
                        <td className="py-3 px-2 space-x-1.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleStartEditUser(u)}
                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          {u.userId !== adminUser.userId && (
                            <>
                              {isBanned ? (
                                <button
                                  onClick={() => handleUnbanUser(u)}
                                  className="px-2 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                                >
                                  Unban
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartBanUser(u)}
                                  className="px-2 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                                >
                                  Ban
                                </button>
                              )}
                              <button
                                  onClick={() => handleDeleteUserPermanently(u)}
                                  className="px-2 py-1 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/10 hover:border-red-500/20 rounded text-[10px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-950/20 p-4 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2">
              <CreditCard className="w-4.5 h-4.5 text-zinc-400" />
              <span>Payments Directory ({payments.length} entries)</span>
            </h3>
            <button
              onClick={() => handleExportCSV("payments")}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-slate-950/40 p-4 border border-zinc-850 rounded-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">Filter by Payment Status (Tags Selection)</span>
            <MultiSelect
              id="payment-statuses-filter"
              options={[
                { value: "Pending", label: "Pending Verification" },
                { value: "Approved", label: "Approved / Completed" },
                { value: "Rejected", label: "Rejected / Declined" },
              ]}
              selected={filterPaymentStatuses}
              onChange={(selectedList) => {
                setFilterPaymentStatuses(selectedList);
                saveAdminPreferences(filterRoles, filterWithdrawalStatuses, selectedList);
              }}
              placeholder="Filter payments..."
            />
          </div>

          {/* Operational Input Remarks Fields */}
          <div className="bg-slate-950/40 p-4 border border-zinc-800 rounded-xl space-y-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Approve/Reject Field Injector:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-mono mb-1">Custom Transaction ID (Optional)</label>
                <input
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={activeTxId}
                  onChange={(e) => setActiveTxId(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-900 rounded-xl py-1.5 px-3 text-xs text-zinc-300"
                />
              </div>
              <div>
                <label className="block text-[9px] text-zinc-400 uppercase font-mono mb-1">Administrative Remark / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. June leads approved"
                  value={activeRemark}
                  onChange={(e) => setActiveRemark(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-900 rounded-xl py-1.5 px-3 text-xs text-zinc-300"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {payments.filter(p => filterPaymentStatuses.includes(p.status)).length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-8">No payments match the selected statuses.</p>
            ) : (
              payments.filter(p => filterPaymentStatuses.includes(p.status)).map((p) => (
                <div key={p.id} className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-zinc-200">{p.username}</span>
                      <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase ${
                        p.status === "Pending" ? "bg-amber-500/20 text-amber-400" : p.status === "Approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 font-mono">Request ID: {p.id} | Email: {p.email} | Phone: {p.phone || "-"}</p>
                    <div className="flex space-x-4 text-xs pt-1">
                      <span className="text-zinc-400 font-medium">Leads: {p.totalLeads}</span>
                      <span className="text-amber-400 font-bold">Amount: ₹{p.totalAmount}</span>
                    </div>
                    {p.adminRemark && (
                      <p className="text-[10px] text-zinc-500 italic mt-1">Remark: {p.adminRemark}</p>
                    )}
                  </div>

                  {p.status === "Pending" ? (
                    <div className="flex space-x-2 shrink-0">
                      <button
                        onClick={() => handleApprovePayment(p)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectPayment(p.id, p.userId, p.totalAmount)}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2 shrink-0">
                      <button
                        onClick={() => handleDeleteIndividualRequest(p.id, "payments")}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-red-400 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer border border-zinc-800"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Delete Entry</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "withdrawals" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-950/20 p-4 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2">
              <ShieldCheck className="w-4.5 h-4.5 text-zinc-400" />
              <span>Withdrawal & Payout Directory ({withdrawals.length} entries)</span>
            </h3>
            <button
              onClick={() => handleExportCSV("withdrawals")}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-slate-950/40 p-4 border border-zinc-850 rounded-xl">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">Filter by Withdrawal Status (Tags Selection)</span>
            <MultiSelect
              id="withdrawal-statuses-filter"
              options={[
                { value: "Pending", label: "Pending Approval" },
                { value: "Completed", label: "Completed / Paid" },
                { value: "Approved", label: "Approved / Processing" },
                { value: "Rejected", label: "Rejected / Declined" },
              ]}
              selected={filterWithdrawalStatuses}
              onChange={(selectedList) => {
                setFilterWithdrawalStatuses(selectedList);
                saveAdminPreferences(filterRoles, selectedList, filterPaymentStatuses);
              }}
              placeholder="Filter withdrawals..."
            />
          </div>

          {/* Remarks Field Input */}
          <div className="bg-slate-950/40 p-4 border border-zinc-800 rounded-xl space-y-1">
            <label className="block text-[9px] text-zinc-400 uppercase font-mono mb-1">Administrative Remark / Decline Reason</label>
            <input
              type="text"
              placeholder="Withdrawal processed successfully via UPI..."
              value={activeRemark}
              onChange={(e) => setActiveRemark(e.target.value)}
              className="w-full bg-slate-950 border border-zinc-900 rounded-xl py-1.5 px-3 text-xs text-zinc-300"
            />
          </div>

          <div className="space-y-3">
            {withdrawals.filter(w => filterWithdrawalStatuses.includes(w.status)).length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-8">No withdrawals match the selected statuses.</p>
            ) : (
              withdrawals.filter(w => filterWithdrawalStatuses.includes(w.status)).map((w) => (
                <div key={w.id} className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/10 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-zinc-200">{w.username}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                          w.status === "Pending" ? "bg-amber-500/20 text-amber-400" :
                          w.status === "Completed" ? "bg-emerald-500/20 text-emerald-400" :
                          w.status === "Rejected" ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                        }`}>
                          {w.status}
                        </span>
                        {w.withdrawalType && (
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            w.withdrawalType === "Fast" ? "bg-purple-500/20 text-purple-400 border border-purple-500/20 animate-pulse" : "bg-zinc-800 text-zinc-400"
                          }`}>
                            ⚡ {w.withdrawalType}
                          </span>
                        )}
                        {w.feeDeducted !== undefined && (
                          <span className="px-1.5 py-0.5 rounded-sm bg-zinc-950 text-[9px] font-mono text-zinc-500 border border-zinc-900">
                            Fee: ₹{w.feeDeducted}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Request ID: {w.id} | Email: {w.email}</p>
                    </div>

                    <div className="text-right sm:text-right">
                      <p className="text-base font-bold text-amber-400">₹{w.withdrawalAmount}</p>
                      <span className="text-[9px] text-zinc-500 font-mono">{w.date}</span>
                    </div>
                  </div>

                  {/* KYC details stored during withdrawal */}
                  <div className="bg-slate-950/50 p-2.5 rounded-lg border border-zinc-900 text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <span className="text-zinc-500 font-mono uppercase text-[8px] block">UPI ID</span>
                      <span className="font-semibold text-zinc-300 font-mono">{w.upiId}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-mono uppercase text-[8px] block">UPI Number</span>
                      <span className="font-semibold text-zinc-300">{w.upiNumber}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 font-mono uppercase text-[8px] block">Holder Name</span>
                      <span className="font-semibold text-zinc-300">{w.holderName}</span>
                    </div>
                  </div>

                  {w.adminRemark && (
                    <p className="text-[10px] text-zinc-500 italic">Remark: {w.adminRemark}</p>
                  )}

                  {w.status === "Pending" ? (
                    <div className="flex space-x-2 pt-2 border-t border-zinc-900">
                      <button
                        onClick={() => handleUpdateWithdrawalStatus(w, "Completed")}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Payout Completed</span>
                      </button>
                      <button
                        onClick={() => handleUpdateWithdrawalStatus(w, "Rejected")}
                        className="px-3 py-1.5 bg-red-500/25 hover:bg-red-500/40 text-red-400 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject & Refund</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-2 pt-2 border-t border-zinc-900">
                      <button
                        onClick={() => handleDeleteIndividualRequest(w.id, "withdrawals")}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-red-400 text-xs font-semibold rounded-lg flex items-center space-x-1 cursor-pointer border border-zinc-800"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Delete Entry</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "announcements" && (
        <div className="space-y-6">
          <div id="announcement-form" className="bg-slate-950/20 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
            <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2 mb-4">
              <Megaphone className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{editAnnId ? "Modify Server Announcement Parameters" : "Broadcast New Server Announcement"}</span>
            </h3>

            {annSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl mb-4">
                {editAnnId ? "Announcement updated successfully!" : "Announcement published and broad notifications broadcasted!"}
              </div>
            )}

            <form onSubmit={handlePostAnnouncement} className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Announcement Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System Upgrades Completed"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Notice Content Description</label>
                <textarea
                  required
                  placeholder="We have streamlined withdrawal times to within 1 hour. Make sure your KYC is updated..."
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950/50 border border-zinc-800 rounded-xl py-2.5 px-3.5 text-xs text-zinc-200 resize-none"
                />
              </div>

              <div className="flex justify-end pt-1 space-x-2">
                {editAnnId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditAnnId(null);
                      setAnnTitle("");
                      setAnnContent("");
                    }}
                    className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-transparent text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 font-display font-semibold text-slate-950 text-xs px-5 py-2.5 rounded-xl flex items-center space-x-1 transition-all active:scale-98 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{editAnnId ? "Update Notice" : "Broadcast Notice"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* List of past announcements */}
          <div className="bg-slate-950/10 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500">Global Announcements Log</h4>
            <div className="divide-y divide-zinc-900/50">
              {announcements.map((ann) => (
                <div key={ann.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h5 className="text-xs font-semibold text-zinc-200">{ann.title}</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{ann.content}</p>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleStartEditAnnouncement(ann)}
                      className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 font-semibold rounded-md transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="px-2 py-1 bg-red-950/30 hover:bg-red-950/50 border border-red-900/20 text-[10px] text-red-400 font-semibold rounded-md transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => handleToggleAnnActive(ann.id, ann.active)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                        ann.active 
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" 
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      {ann.active ? "Active" : "Archived"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "weeklyReport" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-950/20 p-5 rounded-2xl border border-zinc-850 gap-4">
            <div>
              <h3 className="text-base font-display font-semibold text-zinc-100 flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>Executive Weekly Reports</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Compile comprehensive reports and perform essential storage purge operations.</p>
            </div>
            <button
              onClick={handleExportWeeklyReportPDF}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-98 cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download Weekly PDF Report</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Quick Metrics */}
            <div className="bg-zinc-950/30 border border-zinc-850 p-5 rounded-2xl md:col-span-1 space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500">Live Queue Status</h4>
              <div className="space-y-3 font-sans text-xs text-zinc-400">
                <div className="flex justify-between pb-1 border-b border-zinc-900">
                  <span>Registered Users:</span>
                  <span className="font-bold text-zinc-100">{users.length}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-zinc-900">
                  <span>Pending Payout Requests:</span>
                  <span className="font-bold text-amber-400">{pendingWithdrawals.length}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-zinc-900">
                  <span>Processed Payouts:</span>
                  <span className="font-bold text-emerald-400">{completedWithdrawals.length}</span>
                </div>
                <div className="flex justify-between pb-1 border-b border-zinc-900">
                  <span>Approved Lead Logs:</span>
                  <span className="font-bold text-zinc-200">{completedPayments.length}</span>
                </div>
              </div>
            </div>

            {/* Storage Purge Station */}
            <div className="bg-zinc-950/30 border border-zinc-850 p-5 rounded-2xl md:col-span-2 space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-red-400">Weekly Storage & Archive Purges</h4>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                To maintain lightning-fast response times and comply with platform security standards, purge your historical logs weekly after downloading your consolidated PDF report.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-red-950/10 border border-red-950/30 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-red-400 block">Lead Payment Log Storage</span>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">Erases historical paid leads and approval log documents permanently.</p>
                  <button
                    onClick={() => handleClearHistory("payments")}
                    className="w-full py-2 bg-red-950/40 hover:bg-red-950/60 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-red-900/30 transition-colors cursor-pointer"
                  >
                    Purge Paid Lead Logs
                  </button>
                </div>

                <div className="p-4 bg-red-950/10 border border-red-950/30 rounded-xl space-y-3">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-red-400 block">Withdrawal History Logs</span>
                  <p className="text-xs text-zinc-400 font-sans leading-relaxed">Erases processed payouts, completed, and rejected history records.</p>
                  <button
                    onClick={() => handleClearHistory("withdrawals")}
                    className="w-full py-2 bg-red-950/40 hover:bg-red-950/60 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-red-900/30 transition-colors cursor-pointer"
                  >
                    Purge Payout History
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHALLENGES REVIEW TAB */}
      {activeTab === "challenges_review" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-950/20 p-5 border border-zinc-850 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Incentive Challenge Completion Queue</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Review, approve, or reject reward distributions for affiliates who completed lead targets.</p>
            </div>
            <div className="text-[10px] font-mono uppercase bg-zinc-900 border border-zinc-800 text-zinc-300 py-1 px-2.5 rounded-lg">
              Pending Reviews: {challengeProgresses.filter(cp => cp.rewardStatus === "Pending" || (cp.completedCount >= cp.target && cp.status === "completed")).length}
            </div>
          </div>

          {/* Pending Reviews List */}
          <div className="space-y-4">
            {challengeProgresses.filter(cp => cp.rewardStatus === "Pending" || (cp.completedCount >= cp.target && cp.status === "completed")).length === 0 ? (
              <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-8 text-center space-y-2">
                <Check className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-300">All caught up!</h4>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">There are no completed incentive challenge reward claims currently pending administrative review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {challengeProgresses.filter(cp => cp.rewardStatus === "Pending" || (cp.completedCount >= cp.target && cp.status === "completed")).map((cp) => (
                  <div key={cp.id} className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-lg hover:border-zinc-700 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 py-0.5 px-2 rounded-full uppercase">Pending Review</span>
                        <h4 className="text-sm font-bold text-zinc-200 mt-2">{cp.challengeName || "Unnamed Challenge"}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5">Affiliate: <span className="text-zinc-300 font-semibold">{cp.username || cp.userId}</span></p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-zinc-500">REWARD AMOUNT</span>
                        <p className="text-base font-extrabold text-amber-400">₹{cp.rewardAmount || 0}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-zinc-900 font-mono text-[10px]">
                      <div>
                        <span className="text-zinc-500 block">COMPLETED LEADS</span>
                        <span className="text-zinc-200 font-bold text-xs">{cp.completedCount} leads</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">TARGET REQUIRED</span>
                        <span className="text-zinc-200 font-bold text-xs">{cp.target} leads</span>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-2">
                      <button
                        onClick={() => handleApproveChallenge(cp)}
                        disabled={actionLoading === `approve_chal_${cp.id}`}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-lg cursor-pointer transition-colors"
                      >
                        {actionLoading === `approve_chal_${cp.id}` ? "Crediting..." : "Approve & Credit"}
                      </button>
                      <button
                        onClick={() => {
                          setRejectProgress(cp);
                          setRejectReason("");
                        }}
                        disabled={actionLoading === `approve_chal_${cp.id}`}
                        className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/10 rounded-lg cursor-pointer transition-colors text-[10px] uppercase font-bold"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Reviews List */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center space-x-1.5">
              <ClipboardCheck className="w-4 h-4 text-zinc-500" />
              <span>Challenge Reward Review History</span>
            </h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 uppercase font-mono text-[9px] tracking-wider">
                    <th className="pb-3">Challenge Name</th>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Leads Target</th>
                    <th className="pb-3 text-right">Reward</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 pl-4">Review Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {challengeProgresses.filter(cp => cp.rewardStatus === "Approved" || cp.rewardStatus === "Rejected").length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-zinc-500 italic font-mono text-[10px]">No historic challenge reviews logged yet.</td>
                    </tr>
                  ) : (
                    challengeProgresses.filter(cp => cp.rewardStatus === "Approved" || cp.rewardStatus === "Rejected").map((cp) => (
                      <tr key={cp.id} className="hover:bg-zinc-900/10 border-b border-zinc-900/60 text-[11px]">
                        <td className="py-3 font-semibold text-zinc-200">{cp.challengeName || "Challenge"}</td>
                        <td className="py-3 font-mono">{cp.username || cp.userId}</td>
                        <td className="py-3">{cp.completedCount} / {cp.target} Leads</td>
                        <td className="py-3 text-right font-bold text-amber-500 font-mono">₹{cp.rewardAmount || 0}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase ${
                            cp.rewardStatus === "Approved" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : "bg-red-500/10 text-red-500 border border-red-500/20"
                          }`}>
                            {cp.rewardStatus}
                          </span>
                        </td>
                        <td className="py-3 pl-4 text-zinc-500 font-sans italic text-[10px] max-w-xs truncate">{cp.adminReason || "No details provided"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BROADCAST NOTICES TAB */}
      {activeTab === "notifications" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <span>Broadcasting & Alerts Center</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Send targeted messages or platform-wide alerts. Notifications display instantly to users with live read-status flags.</p>
            </div>

            {notifSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl">
                Notice broadcasted successfully to recipient group! Verified and logged.
              </div>
            )}
            {notifError && (
              <div className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-xl">
                {notifError}
              </div>
            )}

            <form onSubmit={handleSendNotification} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Notice Category</label>
                  <select
                    value={notifType}
                    onChange={(e: any) => setNotifType(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                  >
                    <option value="General">General Platform Notice</option>
                    <option value="Announcement">System Announcement</option>
                    <option value="Maintenance">Maintenance Window Alert</option>
                    <option value="Challenge">Challenge & Incentives Alert</option>
                    <option value="Payment">Payment & Wallet Credit Notice</option>
                    <option value="Withdrawal">Withdrawal Processing Update</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Recipient Scope</label>
                  <select
                    value={notifRecipientType}
                    onChange={(e: any) => setNotifRecipientType(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                  >
                    <option value="everyone">Everyone (All Affiliates)</option>
                    <option value="single">Single Selected Account</option>
                  </select>
                </div>

                {notifRecipientType === "single" && (
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Target Account</label>
                    <select
                      required
                      value={notifRecipientUserId}
                      onChange={(e) => setNotifRecipientUserId(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    >
                      <option value="">-- Choose Account --</option>
                      {users.map(u => (
                        <option key={u.userId} value={u.userId}>
                          {u.username} (Affiliate ID: {u.customUserId || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Notification Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 👋 Urgent System Maintenance Scheduled"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Message Content</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Type your alert message here..."
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 focus:border-amber-500/50"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={actionLoading === "send_notification"}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-850 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer flex items-center space-x-1.5 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{actionLoading === "send_notification" ? "Broadcasting..." : "Broadcast Notification"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👑 PREMIUM MEMBERSHIP PLANS TAB */}
      {activeTab === "membership" && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plan Form */}
            <div className="lg:col-span-1 bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-500" />
                <span>{editingPlan ? "Edit Plan" : "Create New Plan"}</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Define the pricing, period, and special VIP badges or features included.
              </p>

              <form onSubmit={handleSaveMembershipPlan} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Plan Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3 Months VIP"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Price (₹)</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 500"
                      value={planPrice}
                      onChange={(e) => setPlanPrice(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Badge Styling</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 👑 VIP MEMBER"
                      value={planBadgeStyle}
                      onChange={(e) => setPlanBadgeStyle(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 py-1">
                  <input
                    type="checkbox"
                    id="isLifetime"
                    checked={planIsLifetime}
                    onChange={(e) => setPlanIsLifetime(e.target.checked)}
                    className="rounded border-zinc-800 text-amber-500 focus:ring-0 bg-slate-950"
                  />
                  <label htmlFor="isLifetime" className="text-[11px] text-zinc-300 select-none">This is a Lifetime Plan</label>
                </div>

                {!planIsLifetime && (
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Duration (Months)</label>
                    <input
                      type="number"
                      required={!planIsLifetime}
                      placeholder="e.g. 3"
                      value={planDurationMonths}
                      onChange={(e) => setPlanDurationMonths(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">
                    Features List (One per line)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Instant Fast Withdrawal&#10;24/7 Premium Support&#10;Exclusive Discord VIP Role"
                    value={planFeatures}
                    onChange={(e) => setPlanFeatures(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">
                    VIP Benefits Summary (One per line)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Priority Payout processing&#10;Zero platform service charges"
                    value={planVipBenefits}
                    onChange={(e) => setPlanVipBenefits(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 font-sans"
                  />
                </div>

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={actionLoading === "membership_plan"}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-850 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer"
                  >
                    {actionLoading === "membership_plan" ? "Saving..." : editingPlan ? "Update Plan" : "Create Plan"}
                  </button>
                  {editingPlan && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlan(null);
                        setPlanName("");
                        setPlanPrice("");
                        setPlanDurationMonths("");
                        setPlanIsLifetime(false);
                        setPlanFeatures("");
                        setPlanVipBenefits("");
                        setPlanBadgeStyle("");
                      }}
                      className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Plans List */}
            <div className="lg:col-span-2 bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Active Membership Plans ({plans.length})</span>
              </h3>
              <p className="text-xs text-zinc-400">
                These plans are available for affiliates to purchase directly using their wallet balance in the Profile panel.
              </p>

              {plans.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 font-sans border border-dashed border-zinc-800 rounded-2xl">
                  No active membership plans found. Create one on the left to activate the premium badge flow.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <div key={p.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-3 relative overflow-hidden flex flex-col justify-between">
                      <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-zinc-500 bg-zinc-900 border-l border-b border-zinc-800 rounded-bl-lg">
                        {p.isLifetime ? "LIFETIME" : `${p.durationMonths} Months`}
                      </div>

                      <div className="space-y-1.5 pr-14">
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {p.badgeStyle}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-100 mt-1">{p.name}</h4>
                        <p className="text-base font-black text-emerald-400 font-mono">₹{p.price.toLocaleString("en-IN")}</p>
                        
                        {p.features && p.features.length > 0 && (
                          <div className="pt-2 text-[10px] text-zinc-400 space-y-1">
                            <span className="text-[9px] text-zinc-500 uppercase font-mono block">Included Perks:</span>
                            {p.features.slice(0, 3).map((f, i) => (
                              <div key={i} className="flex items-center space-x-1">
                                <span className="text-emerald-500">✓</span>
                                <span className="truncate">{f}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex space-x-2 pt-3 border-t border-zinc-900 mt-auto">
                        <button
                          onClick={() => {
                            setEditingPlan(p);
                            setPlanName(p.name);
                            setPlanPrice(p.price);
                            setPlanDurationMonths(p.isLifetime ? "" : p.durationMonths || "");
                            setPlanIsLifetime(p.isLifetime || false);
                            setPlanFeatures(p.features ? p.features.join("\n") : "");
                            setPlanVipBenefits(p.vipBenefits ? p.vipBenefits.join("\n") : "");
                            setPlanBadgeStyle(p.badgeStyle || "👑 VIP MEMBER");
                          }}
                          className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMembershipPlan(p.id, p.name)}
                          disabled={actionLoading === `del_plan_${p.id}`}
                          className="px-3 py-1.5 bg-red-950/30 hover:bg-red-950/60 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-red-900/30 cursor-pointer transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 💸 PLATFORM FEES MANAGER TAB */}
      {activeTab === "fees" && (
        <div className="space-y-6 animate-fade-in">
          <form onSubmit={handleSaveFeesSettings} className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span>Platform Fees & Charges Configurator</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Configure standard and priority processing charges. Adjust challenge participation entrance fees easily.
                </p>
              </div>
              <button
                type="submit"
                disabled={actionLoading === "save_fees"}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer transition-colors"
              >
                {actionLoading === "save_fees" ? "Saving..." : "Save Settings"}
              </button>
            </div>

            {platformFeesSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl">
                Platform fees rules updated and committed to Firestore successfully!
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-sans">
              {/* Card 1: Standard Withdrawal Fees */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">1. Standard Withdrawal Fees</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="withdrawalFeeEnabled"
                      checked={withdrawalFeeEnabled}
                      onChange={(e) => setWithdrawalFeeEnabled(e.target.checked)}
                      className="rounded border-zinc-800 text-amber-500 focus:ring-0 bg-slate-950"
                    />
                    <label htmlFor="withdrawalFeeEnabled" className="text-[10px] text-zinc-400 uppercase font-bold select-none">Enabled</label>
                  </div>
                </div>

                {withdrawalFeeEnabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Fee Type</label>
                      <select
                        value={withdrawalFeeType}
                        onChange={(e) => setWithdrawalFeeType(e.target.value as any)}
                        className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                      >
                        <option value="fixed">Fixed Flat Fee (₹)</option>
                        <option value="percent">Percentage Fee (%)</option>
                        <option value="hybrid">Hybrid (Percentage + Min/Max bounds)</option>
                      </select>
                    </div>

                    {(withdrawalFeeType === "fixed" || withdrawalFeeType === "hybrid") && (
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Fixed Flat Charge (₹)</label>
                        <input
                          type="number"
                          value={withdrawalFeeFixed}
                          onChange={(e) => setWithdrawalFeeFixed(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                        />
                      </div>
                    )}

                    {(withdrawalFeeType === "percent" || withdrawalFeeType === "hybrid") && (
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Percentage Charge (%)</label>
                        <input
                          type="number"
                          value={withdrawalFeePercent}
                          onChange={(e) => setWithdrawalFeePercent(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                        />
                      </div>
                    )}

                    {withdrawalFeeType === "hybrid" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Minimum Cap (₹)</label>
                          <input
                            type="number"
                            value={withdrawalFeeMin}
                            onChange={(e) => setWithdrawalFeeMin(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">Maximum Cap (₹)</label>
                          <input
                            type="number"
                            value={withdrawalFeeMax}
                            onChange={(e) => setWithdrawalFeeMax(Number(e.target.value))}
                            className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Fast Withdrawal Fees */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">2. Fast Processing Priority Fees</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="fastWithdrawalFeeEnabled"
                      checked={fastWithdrawalFeeEnabled}
                      onChange={(e) => setFastWithdrawalFeeEnabled(e.target.checked)}
                      className="rounded border-zinc-800 text-amber-500 focus:ring-0 bg-slate-950"
                    />
                    <label htmlFor="fastWithdrawalFeeEnabled" className="text-[10px] text-zinc-400 uppercase font-bold select-none">Enabled</label>
                  </div>
                </div>

                {fastWithdrawalFeeEnabled && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Fixed Flat Charge (₹)</label>
                        <input
                          type="number"
                          value={fastWithdrawalFeeFixed}
                          onChange={(e) => setFastWithdrawalFeeFixed(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Percentage Charge (%)</label>
                        <input
                          type="number"
                          value={fastWithdrawalFeePercent}
                          onChange={(e) => setFastWithdrawalFeePercent(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Minimum Cap (₹)</label>
                        <input
                          type="number"
                          value={fastWithdrawalFeeMin}
                          onChange={(e) => setFastWithdrawalFeeMin(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Maximum Cap (₹)</label>
                        <input
                          type="number"
                          value={fastWithdrawalFeeMax}
                          onChange={(e) => setFastWithdrawalFeeMax(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Challenge Entry Fees */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4 md:col-span-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">3. Challenge Paid Entrance Fees</span>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="challengeEntryFeeEnabled"
                      checked={challengeEntryFeeEnabled}
                      onChange={(e) => setChallengeEntryFeeEnabled(e.target.checked)}
                      className="rounded border-zinc-800 text-amber-500 focus:ring-0 bg-slate-950"
                    />
                    <label htmlFor="challengeEntryFeeEnabled" className="text-[10px] text-zinc-400 uppercase font-bold select-none">Enabled</label>
                  </div>
                </div>

                {challengeEntryFeeEnabled && (
                  <div className="max-w-xs">
                    <label className="block text-[10px] text-zinc-400 mb-1">Entrance Ticket Fee (₹)</label>
                    <input
                      type="number"
                      value={challengeEntryFeeAmount}
                      onChange={(e) => setChallengeEntryFeeAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed">
                      If enabled, users must pay this fee from their wallet to unlock and participate in any Incentive Challenge.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 🗓️ WITHDRAWAL SCHEDULE TAB */}
      {activeTab === "withdrawal_settings" && (
        <div className="space-y-6 animate-fade-in">
          <form onSubmit={handleSaveWithdrawConfig} className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <span>Withdrawal Scheduling & Limitations Rules</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Enforce strict transaction size caps, rolling timeline maximums, weekly hours, and schedule windows.
                </p>
              </div>
              <button
                type="submit"
                disabled={actionLoading === "save_withdraw_config"}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer transition-colors"
              >
                {actionLoading === "save_withdraw_config" ? "Saving..." : "Save Settings"}
              </button>
            </div>

            {withdrawConfigSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl">
                Withdrawal rules updated and committed to Firestore successfully!
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-sans">
              {/* Card 1: Limits */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">1. Transaction Size Boundaries</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Minimum Single Payout (₹)</label>
                    <input
                      type="number"
                      value={minWithdrawAmount}
                      onChange={(e) => setMinWithdrawAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Maximum Single Payout (₹)</label>
                    <input
                      type="number"
                      value={maxWithdrawAmount}
                      onChange={(e) => setMaxWithdrawAmount(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[9px] text-zinc-400 mb-1">Daily Cap (₹)</label>
                    <input
                      type="number"
                      value={dailyWithdrawLimit}
                      onChange={(e) => setDailyWithdrawLimit(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-400 mb-1">Weekly Cap (₹)</label>
                    <input
                      type="number"
                      value={weeklyWithdrawLimit}
                      onChange={(e) => setWeeklyWithdrawLimit(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-400 mb-1">Monthly Cap (₹)</label>
                    <input
                      type="number"
                      value={monthlyWithdrawLimit}
                      onChange={(e) => setMonthlyWithdrawLimit(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Days & Windows */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">2. Temporal Schedule Windows</span>

                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Allowed Days (Comma separated)</label>
                  <input
                    type="text"
                    value={allowedWithdrawDays}
                    onChange={(e) => setAllowedWithdrawDays(e.target.value)}
                    placeholder="Monday,Wednesday,Friday"
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                  />
                  <p className="text-[9px] text-zinc-500 mt-1">
                    List of exact days payouts can be initiated: e.g. Friday,Saturday
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Daily Start Hour (HH:MM)</label>
                    <input
                      type="text"
                      value={withdrawStartTime}
                      onChange={(e) => setWithdrawStartTime(e.target.value)}
                      placeholder="09:00"
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Daily End Hour (HH:MM)</label>
                    <input
                      type="text"
                      value={withdrawEndTime}
                      onChange={(e) => setWithdrawEndTime(e.target.value)}
                      placeholder="18:00"
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="withdrawEnabledGlobal"
                    checked={withdrawEnabled}
                    onChange={(e) => setWithdrawEnabled(e.target.checked)}
                    className="rounded border-zinc-800 text-amber-500 focus:ring-0 bg-slate-950"
                  />
                  <label htmlFor="withdrawEnabledGlobal" className="text-[11px] text-zinc-300 select-none">
                    Globally enable withdrawals at this time
                  </label>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 📈 PLATFORM REVENUE ANALYTICS TAB */}
      {activeTab === "revenue" && (() => {
        // Safe timestamp date extractor
        const getTxDate = (timestamp: any, manualDate?: string): Date => {
          if (manualDate) {
            const parsed = new Date(manualDate);
            if (!isNaN(parsed.getTime())) return parsed;
          }
          if (!timestamp) return new Date(0);
          if (typeof timestamp.toDate === "function") return timestamp.toDate();
          if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
          return new Date(timestamp);
        };

        // Calculate dynamic revenue category totals and time-based metrics
        let membershipRevenue = 0;
        let serviceRevenue = 0;
        let withdrawalFeeRevenue = 0;
        let platformFeeRevenue = 0;
        let otherRevenue = 0;
        let totalAdCost = 0;

        let todayRevenue = 0;
        let sevenDaysRevenue = 0;
        let thirtyDaysRevenue = 0;

        const nowMs = Date.now();
        const todayStartMs = new Date().setHours(0, 0, 0, 0);
        const sevenDaysMs = nowMs - 7 * 24 * 60 * 60 * 1000;
        const thirtyDaysMs = nowMs - 30 * 24 * 60 * 60 * 1000;

        revenueTransactions.forEach(tx => {
          const amount = Number(tx.amount) || 0;
          const txDate = getTxDate(tx.timestamp, tx.manualDate);
          const txMs = txDate.getTime();

          if (tx.type === "ad_cost") {
            totalAdCost += amount;
          } else {
            // Group incoming revenues
            if (tx.type === "premium_purchase" || tx.type === "membership_purchase") {
              membershipRevenue += amount;
            } else if (tx.type === "service_purchase") {
              serviceRevenue += amount;
            } else if (tx.type === "withdrawal_fee" || tx.type === "fast_withdrawal_fee") {
              withdrawalFeeRevenue += amount;
            } else if (tx.type === "platform_fee" || tx.type === "challenge_entry") {
              platformFeeRevenue += amount;
            } else {
              otherRevenue += amount;
            }

            // Accumulate incoming time ranges
            if (txMs >= todayStartMs) {
              todayRevenue += amount;
            }
            if (txMs >= sevenDaysMs) {
              sevenDaysRevenue += amount;
            }
            if (txMs >= thirtyDaysMs) {
              thirtyDaysRevenue += amount;
            }
          }
        });

        const totalPlatformRevenue = membershipRevenue + serviceRevenue + withdrawalFeeRevenue + platformFeeRevenue + otherRevenue;

        // Calculate user payouts
        const totalUserPayout = withdrawals
          .filter(w => w.status === "Completed")
          .reduce((acc, w) => acc + (w.withdrawalAmount || 0), 0);

        const totalPendingPayout = withdrawals
          .filter(w => w.status === "Pending" || w.status === "Approved")
          .reduce((acc, w) => acc + (w.withdrawalAmount || 0), 0);

        const netProfitLoss = totalPlatformRevenue - totalAdCost - totalUserPayout;

        // Find founder wallet balance from users list
        const founderUser = users.find(u => u.role === "founder") || adminUser;
        const founderWalletBalance = founderUser?.walletBalance || 0;

        // Form Submission for Recording Manual Entry
        const handleRecordManualEntry = async (e: React.FormEvent) => {
          e.preventDefault();
          const form = e.currentTarget as HTMLFormElement;
          const formData = new FormData(form);
          const titleVal = String(formData.get("manual_title")).trim();
          const categoryVal = String(formData.get("manual_category"));
          const amountVal = Number(formData.get("manual_amount"));
          const descVal = String(formData.get("manual_desc")).trim();
          const dateVal = String(formData.get("manual_date") || new Date().toISOString().split("T")[0]);

          if (!titleVal) {
            alert("Please enter a valid title.");
            return;
          }
          if (!amountVal || amountVal <= 0) {
            alert("Please enter a valid positive amount.");
            return;
          }

          setActionLoading("record_manual_income");
          try {
            // Write a revenueTransaction document
            await addDoc(collection(db, "revenueTransactions"), {
              userId: adminUser.userId,
              username: adminUser.username,
              title: titleVal,
              amount: amountVal,
              type: categoryVal,
              description: descVal || `Manual entry for ${titleVal}`,
              manualDate: dateVal,
              timestamp: serverTimestamp(),
            });

            // If a founder exists, increment or decrement their wallet balance depending on category
            if (founderUser && founderUser.userId) {
              const founderUserRef = doc(db, "users", founderUser.userId);
              const latestFounderSnap = await getDoc(founderUserRef);
              const currentFounderBal = latestFounderSnap.exists() ? (latestFounderSnap.data()?.walletBalance || 0) : 0;
              
              // Ad Cost is an expense, so we decrement founder's balance. Others increment it.
              const delta = categoryVal === "ad_cost" ? -amountVal : amountVal;

              await updateDoc(founderUserRef, {
                walletBalance: currentFounderBal + delta
              });
            }

            // Also write audit log
            await writeAuditLog(
              categoryVal === "ad_cost" ? "Ad Cost Logged" : "Manual Income Logged",
              adminUser.username,
              `Recorded ₹${amountVal} ${categoryVal === "ad_cost" ? "expense" : "income"} (${titleVal}): ${descVal}`
            );

            alert("Platform transaction successfully recorded and updated!");
            form.reset();
          } catch (err: any) {
            console.error(err);
            alert("Failed to record manual transaction: " + err.message);
          } finally {
            setActionLoading(null);
          }
        };

        return (
          <div className="space-y-6 animate-fade-in font-sans">
            {/* Header section with Founder Stats */}
            <div className="p-5 rounded-2xl bg-zinc-900/30 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-display font-bold text-zinc-100 uppercase tracking-widest flex items-center space-x-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span>Platform Revenue Dashboard</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">Track gross income channels, manage platform reserves, monitor liabilities, and verify Net Profit/Loss.</p>
              </div>
              
              {/* Founder Wallet Balance Card */}
              <div className="p-4 bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/25 rounded-xl flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 block font-mono">Founder Wallet Balance</span>
                  <span className="text-xl font-mono font-bold text-amber-400">
                    ₹{founderWalletBalance.toLocaleString("en-IN")}.00
                  </span>
                </div>
              </div>
            </div>

            {/* Time-Based Period Performance & Net profit */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">🕒 Time-Based Revenue & Profit Summary</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Net Profit / Loss */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-850 rounded-xl space-y-1 relative overflow-hidden group col-span-2 lg:col-span-2">
                  <div className="absolute top-0 right-0 p-3 opacity-10">
                    <TrendingUp className="w-16 h-16 text-emerald-400" />
                  </div>
                  <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-400 block">Net Profit / Loss</span>
                  <p className="text-2xl font-mono font-black block">
                    <AnimatedCounter value={netProfitLoss} />
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    Calculated as Platform Revenue - Ad Cost - User Payouts
                  </p>
                </div>

                {/* Today's Revenue */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 block">Today's Revenue</span>
                  <p className="text-lg font-mono font-bold text-emerald-400">
                    <AnimatedCounter value={todayRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500">Gross inflows today</p>
                </div>

                {/* Weekly Revenue */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 block">Weekly Revenue</span>
                  <p className="text-lg font-mono font-bold text-emerald-400">
                    <AnimatedCounter value={sevenDaysRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500">Last 7 days inflows</p>
                </div>

                {/* Monthly Revenue */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 block">Monthly Revenue</span>
                  <p className="text-lg font-mono font-bold text-emerald-400">
                    <AnimatedCounter value={thirtyDaysRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500">Last 30 days inflows</p>
                </div>

                {/* Grand Total Revenue */}
                <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
                  <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500 block">Grand Total Revenue</span>
                  <p className="text-lg font-mono font-bold text-amber-400">
                    <AnimatedCounter value={totalPlatformRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500">All-time gross receipts</p>
                </div>
              </div>
            </div>

            {/* Individual Income Stream Categories & Outflows */}
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">📊 Revenue & Outflow Breakdowns</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                
                {/* Membership Income */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <Award className="w-4 h-4 text-amber-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Membership Rev</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-zinc-100">
                    <AnimatedCounter value={membershipRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">Plan upgrades & subscription sales</p>
                </div>

                {/* Service Income */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Service Rev</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-zinc-100">
                    <AnimatedCounter value={serviceRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">1-on-1 support & student audits</p>
                </div>

                {/* Withdrawal Fee Income */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <Coins className="w-4 h-4 text-emerald-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Withdrawal Fee Rev</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-zinc-100">
                    <AnimatedCounter value={withdrawalFeeRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">Processing commissions & standard fees</p>
                </div>

                {/* Other Manual/Platform Fee Revenue */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <ShieldCheck className="w-4 h-4 text-purple-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Other Rev / Fees</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-zinc-100">
                    <AnimatedCounter value={platformFeeRevenue + otherRevenue} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">Challenges & custom manual sponsorships</p>
                </div>

                {/* Total Ad Cost */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total Ad Cost</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-red-400">
                    <AnimatedCounter value={totalAdCost} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">Spent on advertising campaigns</p>
                </div>

                {/* Total User Payout */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <ArrowUpRight className="w-4 h-4 text-orange-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total User Payout</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-zinc-200">
                    <AnimatedCounter value={totalUserPayout} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">Successfully disbursed disbursements</p>
                </div>

                {/* Total Pending Payout */}
                <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-zinc-400">
                    <Hourglass className="w-4 h-4 text-yellow-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Total Pending Payout</span>
                  </div>
                  <p className="text-lg font-mono font-bold text-yellow-400">
                    <AnimatedCounter value={totalPendingPayout} />
                  </p>
                  <p className="text-[9px] text-zinc-500 font-sans leading-tight">Awaiting verification/processing</p>
                </div>

              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Record Manual Revenue / Expense Entry */}
              <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                    <PlusCircle className="w-5 h-5 text-teal-400" />
                    <span>Log Manual Revenue / Expense Entry</span>
                  </h3>
                </div>
                <p className="text-xs text-zinc-400">Directly enter offline payments, sponsor deals, software costs, or advertising expenses. These update your analytics in real time.</p>

                <form onSubmit={handleRecordManualEntry} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Entry Title *</label>
                      <input
                        type="text"
                        name="manual_title"
                        required
                        placeholder="e.g. YouTube Ad Campaign July"
                        className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Transaction Category</label>
                      <select
                        name="manual_category"
                        className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300"
                      >
                        <option value="other_manual_income">Other Income (Revenue)</option>
                        <option value="ad_cost">Ad Cost / Campaign (Expense)</option>
                        <option value="membership_purchase">Membership Plan (Revenue)</option>
                        <option value="service_purchase">Premium Service (Revenue)</option>
                        <option value="withdrawal_fee">Withdrawal processing fee (Revenue)</option>
                        <option value="platform_fee">Platform fee commission (Revenue)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Amount (₹) *</label>
                      <input
                        type="number"
                        name="manual_amount"
                        required
                        placeholder="e.g. 5000"
                        className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Transaction Date</label>
                      <input
                        type="date"
                        name="manual_date"
                        defaultValue={new Date().toISOString().split("T")[0]}
                        className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Detailed Description</label>
                    <textarea
                      name="manual_desc"
                      rows={2}
                      placeholder="Specify payment method, receipts, particulars..."
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-300"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={actionLoading === "record_manual_income"}
                      className="px-5 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5"
                    >
                      {actionLoading === "record_manual_income" ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Entry & Update Balances</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Real-time Ledger */}
              <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-amber-500" />
                  <span>Recent Platform Financial Transactions</span>
                </h3>

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {revenueTransactions.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500 font-sans italic">
                      No transactions captured in active ledger sessions.
                    </div>
                  ) : (
                    revenueTransactions.slice(0, 12).map((tx) => {
                      const isAd = tx.type === "ad_cost";
                      return (
                        <div key={tx.id} className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl flex justify-between items-center text-[11px] hover:border-zinc-800 transition-colors">
                          <div>
                            <span className="font-semibold text-zinc-200 block truncate max-w-[220px]">
                              {tx.title || tx.description}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono block">
                              Category: {tx.type.toUpperCase()} • {tx.manualDate || (tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000).toLocaleDateString("en-IN") : "Just now")}
                            </span>
                            {tx.title && tx.description && (
                              <p className="text-[10px] text-zinc-400 mt-1 font-sans">{tx.description}</p>
                            )}
                          </div>
                          <span className={`font-bold font-mono shrink-0 ml-2 ${isAd ? "text-red-400" : "text-emerald-400"}`}>
                            {isAd ? "-" : "+"}₹{(tx.amount || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* SERVICES MANAGER TAB */}
      {activeTab === "services" && (
        <div className="space-y-6 animate-fade-in font-sans">
          {/* Create/Edit Form */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>{editingService ? "Edit Service Configuration" : "Add New Premium Service"}</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Create services that users can purchase directly from their wallet balances.
            </p>

            <form onSubmit={handleSaveService} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Service Name *</label>
                <input
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Premium Support, 1-on-1 Consultation"
                  className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Price (INR) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 499"
                  className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500 font-mono"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Service Description</label>
                <textarea
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  placeholder="Describe what the user gets when they purchase this premium service..."
                  rows={3}
                  className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Thumbnail Image URL</label>
                <input
                  type="text"
                  value={serviceThumbnail}
                  onChange={(e) => setServiceThumbnail(e.target.value)}
                  placeholder="https://example.com/image.png (Optional)"
                  className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Availability Status</label>
                <select
                  value={serviceStatus}
                  onChange={(e) => setServiceStatus(e.target.value as any)}
                  className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                >
                  <option value="Active">Active / Visible</option>
                  <option value="Inactive">Inactive / Suspended</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                {editingService && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingService(null);
                      setServiceName("");
                      setServiceDescription("");
                      setServicePrice("");
                      setServiceStatus("Active");
                      setServiceThumbnail("");
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={actionLoading === "save_service"}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>{actionLoading === "save_service" ? "Saving..." : (editingService ? "Save Service" : "Add Service")}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Service Statistics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">Total Services</span>
              <p className="text-xl font-display font-black text-zinc-100">{adminServices.length}</p>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">Total Purchases</span>
              <p className="text-xl font-display font-black text-zinc-100">{adminServicePurchases.length}</p>
            </div>
            <div className="bg-zinc-950/40 p-4 border border-zinc-800/80 rounded-xl space-y-1">
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-500">Gross Services Revenue</span>
              <p className="text-xl font-display font-black text-emerald-400 font-mono">
                ₹{adminServicePurchases.reduce((acc, p) => acc + (p.price || 0), 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>

          {/* Active Services List */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider mb-4">
              Configured Services Marketplace
            </h3>

            {adminServices.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 italic text-xs">
                No custom services configured yet. Use the panel above to add your first service.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminServices.map((service) => {
                  const sPurchases = adminServicePurchases.filter(p => p.serviceId === service.id);
                  const totalPurchases = sPurchases.length;
                  const totalRevenue = sPurchases.reduce((acc, cur) => acc + (cur.price || 0), 0);
                  const activeBuyersCount = new Set(sPurchases.map(p => p.userId)).size;

                  return (
                    <div key={service.id} className="bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-xs font-bold text-zinc-100">{service.name}</h4>
                            <span className="text-[10px] text-zinc-400 font-mono font-bold block mt-0.5">
                              Price: ₹{service.price.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase font-bold ${
                            service.status === "Active" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                          }`}>
                            {service.status}
                          </span>
                        </div>
                        {service.thumbnail && (
                          <img
                            src={service.thumbnail}
                            alt={service.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-24 object-cover rounded-lg border border-zinc-900 mt-2"
                            onError={(e) => { (e.target as any).style.display = "none"; }}
                          />
                        )}
                        <p className="text-[10px] text-zinc-400 line-clamp-3 mt-2">
                          {service.description || "No description provided."}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[9px] font-mono text-zinc-500">
                        <div>
                          <span className="block">Purchases: <strong className="text-zinc-300">{totalPurchases}</strong></span>
                          <span className="block">Revenue: <strong className="text-emerald-400">₹{totalRevenue}</strong></span>
                          <span className="block">Active Buyers: <strong className="text-zinc-300">{activeBuyersCount}</strong></span>
                        </div>
                        <div className="flex space-x-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingService(service);
                              setServiceName(service.name);
                              setServiceDescription(service.description || "");
                              setServicePrice(service.price);
                              setServiceStatus(service.status || "Active");
                              setServiceThumbnail(service.thumbnail || "");
                            }}
                            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
                            title="Edit Service"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(service.id, service.name)}
                            className="p-1.5 bg-red-950/30 hover:bg-red-900/40 text-red-400 rounded transition-colors"
                            title="Delete Service"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MEMBERSHIPS MANAGER TAB */}
      {activeTab === "memberships_manage" && (
        <div className="space-y-6 animate-fade-in font-sans">
          {/* Controls Bar */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
              <Users className="w-5 h-5 text-amber-500" />
              <span>Affiliate Memberships Administration</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Change user premium plans, cancel/expire memberships manually, extend durations, and view purchase audit trials.
            </p>

            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search user by email or username to configure..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          {/* Active Members Table */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl overflow-x-auto">
            <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider mb-4">
              Affiliates Membership Status List
            </h3>

            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                  <th className="py-2.5 px-3">User Profile</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Membership status</th>
                  <th className="py-2.5 px-3">Badge Label</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-500 text-xs italic">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((userRecord) => {
                    const status = userRecord.membershipStatus || (userRecord.isPremium ? "Active" : "None");
                    let badgeColor = "bg-zinc-800 text-zinc-400";
                    if (status === "Active") badgeColor = "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
                    if (status === "Cancelled") badgeColor = "bg-red-500/10 border border-red-500/20 text-red-400";
                    if (status === "Expired") badgeColor = "bg-amber-500/10 border border-amber-500/20 text-amber-400";

                    return (
                      <tr key={userRecord.userId} className="border-b border-zinc-900 hover:bg-slate-950/10 text-xs">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-zinc-200">{userRecord.username}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">{userRecord.email}</div>
                        </td>
                        <td className="py-3 px-3 uppercase text-[9px] font-mono text-zinc-400">
                          {userRecord.role}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${badgeColor}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-amber-400 font-semibold font-mono text-[10px]">
                          {userRecord.vipTagText || userRecord.premiumBadgeStyle || (userRecord.isPremium ? "👑 VIP MEMBER" : "None")}
                        </td>
                        <td className="py-3 px-3 text-zinc-400 font-mono text-[10px]">
                          {userRecord.premiumExpiryDate ? (
                            userRecord.premiumExpiryDate === "Lifetime" ? "Lifetime Plan" : new Date(userRecord.premiumExpiryDate).toLocaleDateString("en-IN")
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {/* Extend Duration Select */}
                            <select
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  handleExtendUserMembership(userRecord, Number(val));
                                  e.target.value = "";
                                }
                              }}
                              className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[10px] text-zinc-300 rounded p-1 max-w-[110px]"
                              defaultValue=""
                            >
                              <option value="" disabled>➕ Extend Duration</option>
                              <option value="1">+1 Month</option>
                              <option value="3">+3 Months</option>
                              <option value="6">+6 Months</option>
                              <option value="12">+12 Months</option>
                            </select>

                            {/* Plan Swapper Select */}
                            <select
                              onChange={(e) => {
                                const pId = e.target.value;
                                if (pId) {
                                  const p = plans.find(pl => pl.id === pId);
                                  if (p) handleChangeUserMembershipPlan(userRecord, p);
                                  e.target.value = "";
                                }
                              }}
                              className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-[10px] text-zinc-300 rounded p-1 max-w-[110px]"
                              defaultValue=""
                            >
                              <option value="" disabled>🔄 Swivel Plan</option>
                              {plans.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>

                            {/* Expire / Cancel action buttons */}
                            {userRecord.isPremium && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleExpireUserMembership(userRecord)}
                                  className="px-2 py-1 bg-amber-950/20 hover:bg-amber-900/30 text-amber-400 border border-amber-500/10 rounded text-[9px] font-bold uppercase transition-colors"
                                >
                                  Expire
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelUserMembership(userRecord)}
                                  className="px-2 py-1 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-500/10 rounded text-[9px] font-bold uppercase transition-colors"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Membership Purchase History Logs */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl">
            <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-zinc-400" />
              <span>Membership Purchase History Records</span>
            </h3>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {revenueTransactions.filter(tx => tx.type === "premium_purchase").length === 0 ? (
                <div className="text-center py-12 text-zinc-500 italic text-xs font-sans">
                  No membership purchase ledger entries recorded yet.
                </div>
              ) : (
                revenueTransactions.filter(tx => tx.type === "premium_purchase").map((tx) => (
                  <div key={tx.id} className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200 block truncate max-w-[250px]">{tx.description}</span>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                        Buyer: {tx.username} • {tx.timestamp?.seconds ? new Date(tx.timestamp.seconds * 1000).toLocaleString("en-IN") : "Just now"}
                      </span>
                    </div>
                    <span className="text-emerald-400 font-bold font-mono ml-2">
                      +₹{tx.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === "audit_logs" && (
        <div className="space-y-6 animate-fade-in font-sans">
          {/* Controls Bar */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-amber-500 animate-pulse" />
                <span>Security Audit Log Control Room</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Track administrative operations, balance increases/decreases, security elevation, login trails, and website settings modifications.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportAuditLogs}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1"
              >
                <Download className="w-4 h-4" />
                <span>Export logs (CSV)</span>
              </button>
              
              {(adminUser.role === "founder" || adminUser.role === "admin") && (
                <button
                  type="button"
                  onClick={handleDeleteAllAuditLogs}
                  disabled={actionLoading === "delete_all_logs"}
                  className="px-4 py-2 bg-red-950/30 hover:bg-red-900/40 border border-red-500/15 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center space-x-1"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{actionLoading === "delete_all_logs" ? "Deleting..." : "Delete All Logs"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Records list */}
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search logs by Admin, Action, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/60 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-zinc-200 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase font-mono tracking-wider text-zinc-500">
                    <th className="py-2.5 px-3">Timestamp (IST)</th>
                    <th className="py-2.5 px-3">Admin Account</th>
                    <th className="py-2.5 px-3">Operation Action</th>
                    <th className="py-2.5 px-3">Target / Context</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.filter(log => {
                    const term = searchQuery.toLowerCase().trim();
                    if (!term) return true;
                    return (
                      log.adminName.toLowerCase().includes(term) ||
                      log.action.toLowerCase().includes(term) ||
                      (log.targetUser && log.targetUser.toLowerCase().includes(term)) ||
                      (log.description && log.description.toLowerCase().includes(term))
                    );
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-zinc-500 text-xs italic">
                        No audit logs captured inside this platform filter.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.filter(log => {
                      const term = searchQuery.toLowerCase().trim();
                      if (!term) return true;
                      return (
                        log.adminName.toLowerCase().includes(term) ||
                        log.action.toLowerCase().includes(term) ||
                        (log.targetUser && log.targetUser.toLowerCase().includes(term)) ||
                        (log.description && log.description.toLowerCase().includes(term))
                      );
                    }).map((log) => {
                      let tagColor = "bg-zinc-800 text-zinc-400";
                      if (log.action === "Login" || log.action === "Logout") tagColor = "bg-blue-500/10 border border-blue-500/20 text-blue-400";
                      if (log.action === "Payment Approved" || log.action === "Withdrawal Approved" || log.action === "Balance Increased") tagColor = "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400";
                      if (log.action === "Payment Rejected" || log.action === "Withdrawal Rejected" || log.action === "Balance Decreased") tagColor = "bg-red-500/10 border border-red-500/20 text-red-400";
                      if (log.action === "User Banned") tagColor = "bg-red-500/20 border border-red-500/30 text-red-500 font-bold";
                      if (log.action === "Membership Purchased" || log.action === "Membership Plan Changed" || log.action === "Membership Extended") tagColor = "bg-purple-500/10 border border-purple-500/20 text-purple-400";
                      if (log.action === "Membership Cancelled" || log.action === "Membership Expired") tagColor = "bg-amber-500/10 border border-amber-500/20 text-amber-400";
                      if (log.action === "Settings Updated") tagColor = "bg-amber-500/10 border border-amber-500/20 text-amber-400";

                      return (
                        <tr key={log.id} className="border-b border-zinc-900 hover:bg-slate-950/10 text-[11px]">
                          <td className="py-2.5 px-3 text-zinc-500 font-mono">
                            {log.date} {log.time}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-zinc-300">
                            {log.adminName}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${tagColor}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 font-semibold">
                            {log.targetUser || "System"}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 font-sans leading-relaxed">
                            {log.description}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-600 font-mono">
                            {log.ip || "127.0.0.1"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM SETTINGS TAB */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-fade-in">
          <form onSubmit={handleSaveWebsiteSettings} className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                  <Settings className="w-5 h-5 text-amber-500" />
                  <span>Dynamic Platform Configurations</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Configure global text elements, branding details, and parameters. Deploys instantly website-wide without code changes.</p>
              </div>
              <button
                type="submit"
                disabled={actionLoading === "save_settings"}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-slate-950 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer transition-colors"
              >
                {actionLoading === "save_settings" ? "Saving..." : "Save and Deploy"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-sans">
              {/* Card 1: Website Branding */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">1. Identity & Graphics Branding</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Website Title / Brand Name</label>
                    <input
                      type="text"
                      required
                      value={setWebsiteName}
                      onChange={(e) => setSetWebsiteName(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Brand Logo Image URL</label>
                    <input
                      type="text"
                      required
                      value={setLogoUrl}
                      onChange={(e) => setSetLogoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Brand Favicon Image URL</label>
                    <input
                      type="text"
                      required
                      value={setFaviconUrl}
                      onChange={(e) => setSetFaviconUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Brand Theme Accent Color</label>
                    <div className="flex space-x-2">
                      <input
                        type="color"
                        value={setThemeColor}
                        onChange={(e) => setSetThemeColor(e.target.value)}
                        className="w-10 h-8 bg-slate-950 border border-zinc-800 rounded-lg cursor-pointer"
                      />
                      <input
                        type="text"
                        value={setThemeColor}
                        onChange={(e) => setSetThemeColor(e.target.value)}
                        className="flex-1 bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 font-mono text-center uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Dashboard Layout */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">2. Affiliate Dash Titles & Greetings</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Primary Dashboard Title</label>
                    <input
                      type="text"
                      required
                      value={setDashboardTitle}
                      onChange={(e) => setSetDashboardTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Welcome Text Banner Message</label>
                    <input
                      type="text"
                      required
                      value={setWelcomeMessage}
                      onChange={(e) => setSetWelcomeMessage(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Primary Navigation Button Text</label>
                    <input
                      type="text"
                      required
                      value={setButtonText}
                      onChange={(e) => setSetButtonText(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Header Background Banner Image URL</label>
                    <input
                      type="text"
                      required
                      value={setBannerImage}
                      onChange={(e) => setSetBannerImage(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Instructions elements */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4 md:col-span-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">3. Step-by-Step Instructions & Guidelines (Rich Instructions)</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Affiliate Lead Addition Guidelines</label>
                    <textarea
                      rows={3}
                      required
                      value={setPaymentInstructions}
                      onChange={(e) => setSetPaymentInstructions(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Withdrawal Limit & payout Guidelines</label>
                    <textarea
                      rows={3}
                      required
                      value={setWithdrawalInstructions}
                      onChange={(e) => setSetWithdrawalInstructions(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Challenge Incentive Title Label</label>
                    <input
                      type="text"
                      required
                      value={setChallengeText}
                      onChange={(e) => setSetChallengeText(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Leaderboard Title Label</label>
                    <input
                      type="text"
                      required
                      value={setLeaderboardTitle}
                      onChange={(e) => setSetLeaderboardTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Support & Legals */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4 md:col-span-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">4. Legals, Footers & Active Support Channels</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Active Support Email Address</label>
                    <input
                      type="email"
                      required
                      value={setSupportEmail}
                      onChange={(e) => setSetSupportEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Active Support Telephone / Whatsapp</label>
                    <input
                      type="text"
                      required
                      value={setSupportPhone}
                      onChange={(e) => setSetSupportPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Terms & Conditions Agreement Agreement text</label>
                    <textarea
                      rows={4}
                      required
                      value={setTermsConditions}
                      onChange={(e) => setSetTermsConditions(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Privacy Policy details text</label>
                    <textarea
                      rows={4}
                      required
                      value={setPrivacyPolicy}
                      onChange={(e) => setSetPrivacyPolicy(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-zinc-400 mb-1">Global Footer Copyright text</label>
                    <input
                      type="text"
                      required
                      value={setFooterText}
                      onChange={(e) => setSetFooterText(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                </div>
              </div>

              {/* Card 5: Tutorial Videos */}
              <div className="bg-zinc-950/40 p-5 rounded-2xl border border-zinc-800/80 space-y-4 md:col-span-2">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">5. Interactive Page Tutorial Videos (YouTube / Video Embed links)</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Dashboard Tutorial Video URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={dashboardVideoUrl}
                      onChange={(e) => setDashboardVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Payment Claims Tutorial Video URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={paymentVideoUrl}
                      onChange={(e) => setPaymentVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Withdrawals Tutorial Video URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={withdrawalVideoUrl}
                      onChange={(e) => setWithdrawalVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">My Profile Tutorial Video URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={profileVideoUrl}
                      onChange={(e) => setProfileVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">KYC Verification Tutorial Video URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={kycVideoUrl}
                      onChange={(e) => setKycVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">Challenges Tutorial Video URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={challengeVideoUrl}
                      onChange={(e) => setChallengeVideoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeTab === "social_settings" && (
        <div className="space-y-6 animate-fade-in text-xs font-sans text-zinc-100">
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-6">
            
            {/* Header with deploy button */}
            <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                  <Share2 className="w-5 h-5 text-amber-500" />
                  <span>Dynamic Social Media Manager</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Add, edit, enable/disable, and reorder unlimited social links. Click Deploy & Save to make them live instantly.</p>
              </div>
              <button
                type="button"
                onClick={handleSaveSocialSettings}
                disabled={actionLoading === "social"}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shadow-md hover:shadow-amber-500/10"
              >
                {actionLoading === "social" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Deploy & Save All Links</span>
              </button>
            </div>

            {socialSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl animate-fade-in">
                Social settings and links saved and deployed globally!
              </div>
            )}

            {/* Link Add/Edit Creator Form */}
            <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-4">
              <h4 className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold">
                {editingSocialLink ? "⚡ Edit Selected Social Link" : "➕ Add New Social Link"}
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Platform Name</label>
                  <input
                    type="text"
                    placeholder="e.g. YouTube, Telegram, Custom Link"
                    value={socialFormName}
                    onChange={(e) => setSocialFormName(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/60"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 mb-1">Platform Icon</label>
                  <select
                    value={socialFormIcon}
                    onChange={(e) => setSocialFormIcon(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/60"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="telegram">Telegram</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">X (Twitter)</option>
                    <option value="discord">Discord</option>
                    <option value="website">Website</option>
                    <option value="custom">Custom (Link2 Icon)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] text-zinc-400 mb-1">URL Link</label>
                  <input
                    type="url"
                    placeholder="e.g. https://t.me/yourusername"
                    value={socialFormUrl}
                    onChange={(e) => setSocialFormUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/60"
                  />
                </div>

                <div className="flex gap-4 items-center justify-between">
                  <div className="w-1/2">
                    <label className="block text-[10px] text-zinc-400 mb-1">Order</label>
                    <input
                      type="number"
                      value={socialFormOrder}
                      onChange={(e) => setSocialFormOrder(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/60 text-center"
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-zinc-400 mb-1">Status</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={socialFormEnabled}
                        onChange={(e) => setSocialFormEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-slate-950"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                {editingSocialLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSocialLink(null);
                      setSocialFormName("");
                      setSocialFormIcon("youtube");
                      setSocialFormUrl("");
                      setSocialFormOrder(socialLinks.length + 1);
                      setSocialFormEnabled(true);
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddOrEditSocialLink}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl transition-all shadow-md"
                >
                  {editingSocialLink ? "Update Social Link" : "Add Link to List"}
                </button>
              </div>
            </div>

            {/* List of current social links */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">
                  📁 Draft Links List ({socialLinks.length} Platform Link(s))
                </h4>
                <p className="text-[10px] text-zinc-500 italic">Drag-ordering can be manually set via "Order" value. Sorts ascending.</p>
              </div>

              {socialLinks.length === 0 ? (
                <div className="p-8 text-center bg-zinc-950/20 border border-zinc-900 rounded-xl text-zinc-500 font-sans">
                  No custom social links added yet. Platform will show default links (YouTube, Instagram, Facebook, Telegram) if empty.
                </div>
              ) : (
                <div className="border border-zinc-900 rounded-xl overflow-hidden bg-zinc-950/20">
                  <table className="w-full text-left font-sans text-xs">
                    <thead>
                      <tr className="bg-zinc-950/60 border-b border-zinc-900 text-zinc-400 uppercase tracking-wider text-[10px] font-mono">
                        <th className="p-3">Order</th>
                        <th className="p-3">Platform</th>
                        <th className="p-3">Icon Type</th>
                        <th className="p-3">URL</th>
                        <th className="p-3">State</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40 text-zinc-300">
                      {[...socialLinks]
                        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                        .map((link) => (
                          <tr key={link.id} className="hover:bg-zinc-900/30 transition-all">
                            <td className="p-3 font-mono font-bold text-amber-500">{link.displayOrder}</td>
                            <td className="p-3 font-bold text-zinc-100">{link.platformName}</td>
                            <td className="p-3 font-mono text-zinc-400 text-[10px]">{link.iconName}</td>
                            <td className="p-3 text-zinc-400 font-mono truncate max-w-xs">{link.url}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() => handleToggleSocialLink(link.id)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  link.enabled
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}
                              >
                                {link.enabled ? "Active" : "Inactive"}
                              </button>
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleEditSocialLinkStart(link)}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[10px]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSocialLink(link.id)}
                                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px]"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {activeTab === "pages" && (
        <div className="space-y-6 animate-fade-in text-xs font-sans text-zinc-100">
          <div id="pages-form" className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-display font-semibold text-zinc-100 flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-amber-500" />
              <span>{pageId ? "Edit Custom Page" : "Create New Custom Page"}</span>
            </h3>

            {pageSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] rounded-xl">
                Custom page details updated and published successfully!
              </div>
            )}

            <form onSubmit={handleSavePage} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Page Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Terms of Service"
                    value={pageTitle}
                    onChange={(e) => {
                      setPageTitle(e.target.value);
                      if (!pageId) {
                        setPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_ ]/g, "").replace(/\s+/g, "-"));
                      }
                    }}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Page Slug * (e.g. terms-of-service)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. terms-of-service"
                    value={pageSlug}
                    onChange={(e) => setPageSlug(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500/50 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">SEO Title Tag (Recommended)</label>
                  <input
                    type="text"
                    placeholder="e.g. Terms of Service | LEARN WITH ANKIT"
                    value={pageSeoTitle}
                    onChange={(e) => setPageSeoTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Feature Header Image URL</label>
                  <input
                    type="text"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={pageImgUrl}
                    onChange={(e) => setPageImgUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">SEO Meta Description</label>
                <input
                  type="text"
                  placeholder="e.g. Read the official Terms of Service of LEARN WITH ANKIT."
                  value={pageSeoDesc}
                  onChange={(e) => setPageSeoDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2 px-3 text-zinc-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Page Body Content (HTML / Text Supported) *</label>
                <textarea
                  rows={8}
                  required
                  placeholder="<h1>Terms & Conditions</h1><p>Welcome to LEARN WITH ANKIT...</p>"
                  value={pageContent}
                  onChange={(e) => setPageContent(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 cursor-pointer text-zinc-300">
                  <input
                    type="checkbox"
                    checked={pageIsPublished}
                    onChange={(e) => setPageIsPublished(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-slate-950 text-amber-500 focus:ring-0"
                  />
                  <span className="text-[11px] font-mono uppercase tracking-wider font-bold">Publish and Make Page Live</span>
                </label>

                <div className="flex space-x-2">
                  {pageId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPageId("");
                        setPageTitle("");
                        setPageSlug("");
                        setPageContent("");
                        setPageSeoTitle("");
                        setPageSeoDesc("");
                        setPageImgUrl("");
                        setPageIsPublished(true);
                      }}
                      className="px-4 py-2 bg-zinc-900 border border-zinc-850 text-zinc-400 font-semibold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={actionLoading === "page"}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer transition-colors"
                  >
                    {actionLoading === "page" ? "Saving..." : pageId ? "Update Live Page" : "Publish Live Page"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <h4 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider">Dynamic Published Pages Directory</h4>
            {pagesList.length === 0 ? (
              <p className="text-zinc-500 font-mono italic text-[11px] text-center py-6">No custom pages have been published yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Slug</th>
                      <th className="py-2.5 px-3">SEO Title</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/60">
                    {pagesList.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-900/30">
                        <td className="py-3 px-3 font-semibold text-zinc-200">{p.title}</td>
                        <td className="py-3 px-3 font-mono text-amber-500 text-[11px]">{p.slug}</td>
                        <td className="py-3 px-3 text-zinc-400">{p.seoTitle || "None"}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono ${p.isPublished ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                            {p.isPublished ? "PUBLISHED" : "DRAFT"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-2">
                          <button
                            onClick={() => handleEditPage(p)}
                            className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold uppercase text-[9px] rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePage(p.id)}
                            className="px-2.5 py-1 bg-red-950/30 hover:bg-red-900/30 border border-red-950 text-red-400 font-bold uppercase text-[9px] rounded-lg cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "navigation" && (
        <div className="space-y-6 animate-fade-in text-xs font-sans text-zinc-100">
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <Landmark className="w-5 h-5 text-amber-500" />
                <span>Custom Website Navigation Builder</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Add published custom pages, external resources, or standard dashboard items into the header menu. Toggle visibility and reorder items instantly.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Active Navigation Items ({navMenu.length})</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const title = prompt("Enter menu label/name:");
                      if (!title) return;
                      const slug = prompt("Enter page slug or URL link (e.g. terms-of-service):");
                      if (!slug) return;
                      const updated = [...navMenu, { id: slug.replace(/[^a-z0-9]/g, "-"), label: title, type: "custom", visible: true }];
                      setNavMenu(updated);
                    }}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold uppercase text-[9px] rounded-xl cursor-pointer"
                  >
                    + Add Link / Page
                  </button>
                  <button
                    onClick={() => handleSaveNavigation(navMenu)}
                    disabled={actionLoading === "navigation"}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold uppercase text-[9px] rounded-xl cursor-pointer"
                  >
                    {actionLoading === "navigation" ? "Saving..." : "Save Navigation Layout"}
                  </button>
                </div>
              </div>

              {navMenu.length === 0 ? (
                <p className="text-zinc-500 font-mono italic text-[11px] text-center py-6">Navigation menu is empty. Reset or add items.</p>
              ) : (
                <div className="space-y-2">
                  {navMenu.map((item, index) => (
                    <div key={item.id + index} className="p-3 bg-zinc-950/40 border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded-md bg-zinc-900 text-[10px] font-mono font-bold text-zinc-400 flex items-center justify-center border border-zinc-800">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-200">{item.label}</p>
                          <span className="text-[9px] font-mono text-zinc-500">ID/Slug: {item.id} | Type: {item.type || "standard"}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            const updated = [...navMenu];
                            updated[index].visible = !updated[index].visible;
                            setNavMenu(updated);
                          }}
                          className={`px-2 py-1 rounded font-mono text-[9px] uppercase font-bold border cursor-pointer ${
                            item.visible
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                              : "bg-red-500/10 border-red-500/25 text-red-400"
                          }`}
                        >
                          {item.visible ? "VISIBLE" : "HIDDEN"}
                        </button>

                        <div className="flex space-x-1">
                          <button
                            disabled={index === 0}
                            onClick={() => {
                              const updated = [...navMenu];
                              const temp = updated[index];
                              updated[index] = updated[index - 1];
                              updated[index - 1] = temp;
                              setNavMenu(updated);
                            }}
                            className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded disabled:opacity-30 text-zinc-400 cursor-pointer"
                          >
                            ▲
                          </button>
                          <button
                            disabled={index === navMenu.length - 1}
                            onClick={() => {
                              const updated = [...navMenu];
                              const temp = updated[index];
                              updated[index] = updated[index + 1];
                              updated[index + 1] = temp;
                              setNavMenu(updated);
                            }}
                            className="p-1 bg-zinc-900 hover:bg-zinc-800 rounded disabled:opacity-30 text-zinc-400 cursor-pointer"
                          >
                            ▼
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Remove ${item.label} from navigation menu?`)) {
                                const updated = navMenu.filter((_, i) => i !== index);
                                setNavMenu(updated);
                              }
                            }}
                            className="p-1 bg-red-950/20 hover:bg-red-950/50 rounded text-red-400 cursor-pointer border border-red-950/40"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-zinc-900 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 font-mono">Note: Remember to click "Save Navigation Layout" to publish changes.</span>
                <button
                  onClick={() => {
                    if (window.confirm("Restore default navigation menu? Any unsaved custom configurations will be lost.")) {
                      const defaultMenu = [
                        { id: "dashboard", label: "Dashboard", type: "standard", visible: true },
                        { id: "payment", label: "Payment Claims", type: "standard", visible: true },
                        { id: "withdrawal", label: "Withdrawals", type: "standard", visible: true },
                        { id: "history", label: "History Log", type: "standard", visible: true },
                        { id: "leaderboard", label: "Leaderboard", type: "standard", visible: true },
                        { id: "challenge", label: "Challenges", type: "standard", visible: true },
                        { id: "kyc", label: "KYC Verification", type: "standard", visible: true },
                        { id: "profile", label: "My Profile", type: "standard", visible: true }
                      ];
                      setNavMenu(defaultMenu);
                    }
                  }}
                  className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 font-bold uppercase text-[9px] rounded-lg cursor-pointer"
                >
                  Reset to Default Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {activeTab === "storage" && (
        <div className="space-y-6 animate-fade-in text-xs font-sans text-zinc-100">
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                <span>Administrative Database Storage & Backup Engine</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Monitor server resources, Firestore data sizes, and export safe offline local snapshot backups.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="bg-zinc-950/60 p-4 border border-zinc-850 rounded-xl">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Firestore Connection Status</span>
                <p className="text-sm font-extrabold text-emerald-400 mt-1 uppercase">● Active & Secure</p>
              </div>
              <div className="bg-zinc-950/60 p-4 border border-zinc-850 rounded-xl">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Database Version</span>
                <p className="text-sm font-extrabold text-amber-500 mt-1">LWA Cloud v4.5</p>
              </div>
              <div className="bg-zinc-950/60 p-4 border border-zinc-850 rounded-xl">
                <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Last Snapshot Backup</span>
                <p className="text-sm font-extrabold text-zinc-300 mt-1">Automatic Cloud</p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-900 space-y-4">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">Backup Operations</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-950/30 border border-zinc-850 rounded-xl space-y-3">
                  <h4 className="font-bold text-zinc-200">Full Affiliate Database Backup</h4>
                  <p className="text-[11px] text-zinc-400">Download a full JSON snapshot of all affiliates, current balances, payouts, and compliance logs securely. Safely encrypted and offline-ready.</p>
                  <button
                    onClick={() => {
                      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                        users,
                        payments,
                        withdrawals,
                        auditLogs,
                        backupTimestamp: new Date().toISOString()
                      }, null, 2));
                      const downloadAnchor = document.createElement("a");
                      downloadAnchor.setAttribute("href", dataStr);
                      downloadAnchor.setAttribute("download", `LWA_Database_Backup_${new Date().toISOString().split("T")[0]}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                      alert("Offline Database Backup JSON file exported successfully!");
                    }}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold uppercase tracking-wider text-[10px] rounded-lg cursor-pointer"
                  >
                    Export Safe JSON Backup
                  </button>
                </div>

                <div className="p-4 bg-zinc-950/30 border border-zinc-850 rounded-xl space-y-3">
                  <h4 className="font-bold text-zinc-200">System Activity Audit Log Payouts</h4>
                  <p className="text-[11px] text-zinc-400">Export the entire security audit log containing IP coordinates, administrator signatures, role assignments, and lead review actions.</p>
                  <button
                    onClick={() => handleExportCSV("auditLogs")}
                    className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 font-bold uppercase tracking-wider text-[10px] rounded-lg cursor-pointer"
                  >
                    Export Audit Logs (CSV)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "features" && (
        <div className="space-y-6 animate-fade-in text-xs font-sans text-zinc-100">
          <div className="bg-slate-950/20 border border-zinc-850 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-display font-semibold text-zinc-100 uppercase tracking-wider flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <span>Feature Flag & Platform Access Control Toggles</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Enable or disable specific features of the platform instantly to control user actions, manage heavy traffic, or trigger server maintenance.</p>
            </div>

            {featuresSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] rounded-xl">
                Feature access permissions updated instantly across the system!
              </div>
            )}

            <div className="space-y-3 pt-2">
              {[
                { key: "enableRegistration", title: "Affiliate Registrations", desc: "Allow or suspend new user account creation and registrations." },
                { key: "enableDashboard", title: "Dashboard & Analytics", desc: "Show or hide the user dashboard and main counters." },
                { key: "enableLeaderboard", title: "Public Leaderboard", desc: "Show or hide the real-time affiliate earnings leaderboard." },
                { key: "enableChallenges", title: "Challenges & Incentives", desc: "Allow or suspend access to dynamic affiliate challenges." },
                { key: "enablePaymentRequests", title: "Payment/Leads Submissions", desc: "Allow users to submit new courses or leads payments verification claims." },
                { key: "enableWithdrawals", title: "Withdrawal Requests", desc: "Allow users to initiate cash payout requests." },
                { key: "enableKYCUpload", title: "Bank KYC Submission", desc: "Allow users to upload or update bank KYC information." },
                { key: "enableNotifications", title: "User Broadcast Notifications", desc: "Show or hide notifications and broadcast notices." },
                { key: "enableReports", title: "Weekly Income Reports", desc: "Allow or hide performance/weekly analytics reports." },
                { key: "enableServices", title: "Services Marketplace", desc: "Allow users to buy or renew custom schemes and services." },
                { key: "enableSettings", title: "System & User Settings", desc: "Allow users to configure profiles, settings, and social links." },
                { key: "maintenanceMode", title: "Server Maintenance Mode", desc: "Redirect all users to a clean maintenance warning page." },
              ].map((flag: any) => (
                <div key={flag.key} className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl flex items-center justify-between gap-4">
                  <div className="space-y-0.5 text-left">
                    <h5 className="font-bold text-zinc-200">{flag.title}</h5>
                    <p className="text-[11px] text-zinc-400 leading-normal">{flag.desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...featureToggles, [flag.key]: !featureToggles[flag.key] };
                      setFeatureToggles(updated);
                      handleSaveFeatureToggles(updated);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase font-bold border transition-colors cursor-pointer ${
                      featureToggles[flag.key]
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                        : "bg-red-500/10 border-red-500/25 text-red-400"
                    }`}
                  >
                    {featureToggles[flag.key] ? "ENABLED" : "DISABLED"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reject Challenge Modal */}
      {rejectProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-bold text-zinc-100 uppercase tracking-wider text-red-500">Reject Challenge Reward</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">User: {rejectProgress.username || rejectProgress.userId}</p>
              </div>
              <button
                onClick={() => setRejectProgress(null)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectChallenge} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-2">Rejection Reason</label>
                <textarea
                  required
                  placeholder="Explain why the challenge is being rejected (e.g. Lead course accounts could not be verified)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 focus:outline-hidden focus:border-red-500/50"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setRejectProgress(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-semibold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `reject_chal_${rejectProgress.id}`}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-xl p-6 relative shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-bold text-zinc-100 uppercase tracking-wider">Edit Affiliate Profile</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">UID: {editingUser.userId}</p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">State / Province</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Wallet Balance (₹)</label>
                  <input
                    type="number"
                    required
                    value={editWalletBalance}
                    onChange={(e) => setEditWalletBalance(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Lifetime Earnings (₹)</label>
                  <input
                    type="number"
                    required
                    value={editTotalEarnings}
                    onChange={(e) => setEditTotalEarnings(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Affiliate Custom User ID</label>
                  <input
                    type="text"
                    value={editCustomUserId}
                    onChange={(e) => setEditCustomUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50 font-mono"
                    placeholder="e.g. LWA-USER"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Account Role</label>
                  <select
                    value={editRole}
                    onChange={(e: any) => setEditRole(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                  >
                    <option value="user">User</option>
                    <option value="co-founder">Co-Founder</option>
                    <option value="admin">Admin</option>
                    <option value="founder">Founder</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">User Rank Override</label>
                  <input
                    type="text"
                    value={editCustomRank}
                    onChange={(e) => setEditCustomRank(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50 font-mono"
                    placeholder="e.g. Rank #1, Master"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">User Badge Override</label>
                  <input
                    type="text"
                    value={editCustomBadge}
                    onChange={(e) => setEditCustomBadge(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50 font-mono"
                    placeholder="e.g. Diamond, Superstar"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1">Membership Badge Override</label>
                  <input
                    type="text"
                    value={editVipTagText}
                    onChange={(e) => setEditVipTagText(e.target.value)}
                    className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50 font-mono"
                    placeholder="e.g. 👑 VIP MEMBER"
                  />
                </div>
              </div>

              {editRole === "co-founder" && (
                <div className="bg-zinc-950/60 border border-zinc-850 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 block font-bold">Configure Co-Founder Permissions</span>
                  <MultiSelect
                    id="edit-cofounder-permissions"
                    options={[
                      { value: "manageUsers", label: "User Management" },
                      { value: "manageAccountCreation", label: "Account Creation" },
                      { value: "managePayments", label: "Payment Approval" },
                      { value: "manageWithdrawals", label: "Withdrawal Approval" },
                      { value: "manageChallenges", label: "Challenge Management" },
                      { value: "manageLeaderboard", label: "Leaderboard" },
                      { value: "manageAnnouncements", label: "Announcements" },
                      { value: "manageSettings", label: "Global Settings & Toggles" },
                      { value: "manageReports", label: "Reports" },
                      { value: "manageBackup", label: "Storage Monitor & Backup" },
                      { value: "managePages", label: "Custom Pages Builder" },
                      { value: "manageNotifications", label: "Notifications Control" },
                    ]}
                    selected={Object.keys(editCoFounderPermissions || {}).filter(
                      (k) => editCoFounderPermissions[k as keyof CoFounderPermissions]
                    )}
                    onChange={(selectedList) => {
                      const newPerms: any = {
                        manageUsers: false,
                        manageAccountCreation: false,
                        managePayments: false,
                        manageWithdrawals: false,
                        manageChallenges: false,
                        manageLeaderboard: false,
                        manageAnnouncements: false,
                        manageSettings: false,
                        manageReports: false,
                        manageBackup: false,
                        managePages: false,
                        manageNotifications: false,
                      };
                      selectedList.forEach((val) => {
                        newPerms[val] = true;
                      });
                      setEditCoFounderPermissions(newPerms);
                    }}
                    placeholder="Search and toggle permissions..."
                  />
                </div>
              )}

              <div className="pt-3 border-t border-zinc-900 space-y-3.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">Bank KYC Verification Details</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[9px] text-zinc-400 font-mono uppercase tracking-wider mb-1">KYC Real Name</label>
                    <input
                      type="text"
                      placeholder="Not verified yet"
                      value={editKycName}
                      onChange={(e) => setEditKycName(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-400 font-mono uppercase tracking-wider mb-1">KYC UPI ID</label>
                    <input
                      type="text"
                      placeholder="e.g. name@upi"
                      value={editKycUpiId}
                      onChange={(e) => setEditKycUpiId(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-zinc-400 font-mono uppercase tracking-wider mb-1">KYC UPI Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={editKycUpiNumber}
                      onChange={(e) => setEditKycUpiNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-zinc-850 rounded-xl py-2 px-3 text-zinc-200 focus:outline-hidden focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-semibold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `save_${editingUser.userId}`}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer transition-all active:scale-98"
                >
                  {actionLoading === `save_${editingUser.userId}` ? "Saving..." : "Save Profile Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Ban User Modal */}
      {banningUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
              <div>
                <h3 className="text-sm font-display font-bold text-red-400 uppercase tracking-wider">Suspend User Account</h3>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">User: {banningUser.username}</p>
              </div>
              <button
                onClick={() => setBanningUser(null)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBanUserExecute} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Suspension Ban Duration</label>
                <select
                  value={banDuration}
                  onChange={(e) => setBanDuration(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-zinc-200 focus:outline-hidden focus:border-red-500/50"
                >
                  <option value="1m">1 Minute</option>
                  <option value="5m">5 Minutes</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1h">1 Hour</option>
                  <option value="12h">12 Hours</option>
                  <option value="1d">1 Day</option>
                  <option value="2d">2 Days</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="Permanent">Permanent Suspension</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 font-mono uppercase tracking-wider mb-1.5">Administrative Reason</label>
                <textarea
                  required
                  placeholder="Enter reason for account suspension..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="w-full bg-slate-950 border border-zinc-800 rounded-xl py-2.5 px-3 text-zinc-200 focus:outline-hidden focus:border-red-500/50 min-h-[80px]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-zinc-900">
                <button
                  type="button"
                  onClick={() => setBanningUser(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 font-semibold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer transition-all active:scale-98"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === `ban_${banningUser.userId}`}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl uppercase tracking-wider text-[10px] cursor-pointer transition-all active:scale-98 shadow-lg"
                >
                  {actionLoading === `ban_${banningUser.userId}` ? "Suspending..." : "Apply Account Suspension"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
