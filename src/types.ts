export interface CoFounderPermissions {
  manageUsers: boolean;
  manageAccountCreation: boolean;
  managePayments: boolean;
  manageWithdrawals: boolean;
  manageChallenges: boolean;
  manageLeaderboard: boolean;
  manageAnnouncements: boolean;
  manageSettings: boolean;
  manageReports: boolean;
  manageBackup: boolean;
  managePages: boolean;
  manageNotifications: boolean;
}

export interface UserProfile {
  userId: string;
  customUserId?: string;
  username: string;
  email: string;
  phone: string;
  state: string;
  joinDate: string;
  accountStatus: 'Active' | 'Suspended' | 'Pending';
  totalEarnings: number;
  walletBalance: number;
  todayEarnings: number;
  last7DaysEarnings: number;
  last30DaysEarnings: number;
  profilePic?: string;
  role: 'founder' | 'admin' | 'co-founder' | 'user';
  badge: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  kycName?: string;
  kycUpiId?: string;
  kycUpiNumber?: string;
  bannedUntil?: any;
  bannedReason?: string;
  coFounderPermissions?: CoFounderPermissions;
  todayEarningsDate?: string;
  // New Security and Premium Badge System fields
  walletPinHash?: string;
  isPremium?: boolean;
  premiumExpiryDate?: any; // Timestamp or ISO string
  premiumPlanId?: string;
  premiumBadgeStyle?: string; // e.g. "crown", "sparkle", "star"
  vipTagText?: string; // e.g. "VIP MEMBER", "ELITE MEMBER"
  membershipStatus?: 'Active' | 'Expired' | 'Cancelled';
}

export interface PaymentRequest {
  id: string;
  userId: string;
  username: string;
  date: string;
  email: string;
  phone: string;
  totalLeads: number;
  totalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: any; // Firestore Timestamp
  adminRemark?: string;
  txId?: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  date: string;
  email: string;
  phone: string;
  withdrawalAmount: number;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
  timestamp: any; // Firestore Timestamp
  adminRemark?: string;
  holderName: string;
  upiId: string;
  upiNumber: string;
  withdrawalType?: 'Standard' | 'Fast';
  feeDeducted?: number;
}

export interface Challenge {
  id: string;
  bannerImage: string;
  challengeName: string;
  description: string;
  rewardAmount: number;
  target: number;
  startDate: string;
  endDate: string;
  createdAt: any; // Firestore Timestamp
  entryFee?: number;
  isPaid?: boolean;
}

export interface ChallengeProgress {
  id: string; // challengeId_userId
  userId: string;
  challengeId: string;
  completedCount: number;
  target: number;
  rewardClaimed: boolean;
  status: 'active' | 'completed' | 'approved' | 'rejected' | 'claimed';
  rewardStatus?: 'Pending' | 'Approved' | 'Rejected';
  adminReason?: string;
  challengeName?: string;
  rewardAmount?: number;
  username?: string;
  completedAt?: any;
  entryFeePaid?: number;
  isPaidEntry?: boolean;
}

export interface ChallengeLead {
  id: string;
  challengeId: string;
  userId: string;
  username: string;
  leadName: string;
  leadId?: string;
  remarks?: string;
  timestamp: any;
}

export interface WebsiteSettings {
  websiteName: string;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
  dashboardTitle: string;
  welcomeMessage: string;
  buttonTextClaim: string;
  buttonTextWithdraw: string;
  paymentInstructions: string;
  withdrawalInstructions: string;
  challengeText: string;
  leaderboardTitle: string;
  profileLabel: string;
  announcementText: string;
  termsConditions: string;
  privacyPolicy: string;
  supportEmail: string;
  supportPhone: string;
  primaryColor: string;
  accentColor: string;
  dashboardBannerUrl: string;
  dashboardVideoUrl?: string;
  paymentVideoUrl?: string;
  withdrawalVideoUrl?: string;
  profileVideoUrl?: string;
  kycVideoUrl?: string;
  challengeVideoUrl?: string;
}

export interface Notification {
  id: string;
  userId: string; // "all" for global announcements/notices
  title: string;
  body: string;
  timestamp: any; // Firestore Timestamp
  isRead: boolean;
  type: 'payment' | 'withdrawal' | 'challenge' | 'announcement' | 'system';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: any; // Firestore Timestamp
  active: boolean;
}

export interface AuditLog {
  id: string;
  adminName: string;
  adminId: string;
  action: string;
  date: string;
  time: string;
  ip?: string;
  timestamp: any; // Firestore Timestamp
  targetUser?: string;
  description?: string;
}

export interface LeaderboardUser {
  userId: string;
  customUserId?: string;
  username: string;
  profilePic?: string;
  earnings: number;
  rank?: number;
  isPremium?: boolean;
}

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  durationMonths: number;
  isLifetime: boolean;
  features: string[];
  benefits: {
    vipBadge: boolean;
    leaderboardHighlight: boolean;
    fastWithdrawal: boolean;
    higherWithdrawalLimits: boolean;
    prioritySupport: boolean;
    priorityPaymentReview: boolean;
    premiumChallenges: boolean;
    specialAnnouncements: boolean;
    earlyAccess: boolean;
  };
  isActive: boolean;
  createdAt: any;
}

export interface PlatformFees {
  withdrawalFeeType: 'fixed' | 'percentage' | 'hybrid';
  withdrawalFeeFixed: number;
  withdrawalFeePercent: number;
  withdrawalFeeMin: number;
  withdrawalFeeMax: number;
  withdrawalFeeEnabled: boolean;
  
  challengeEntryFeeEnabled: boolean;
  challengeEntryFeeFixed: number;
  challengeEntryFeeAmount?: number;
  
  platformFeePercent: number;
  platformFeeEnabled: boolean;
  
  fastWithdrawalFeeEnabled: boolean;
  fastWithdrawalFeeFixed: number;
  fastWithdrawalFeePercent: number;
  fastWithdrawalFeeMin: number;
  fastWithdrawalFeeMax: number;
}

export interface WithdrawalSettings {
  minAmount: number;
  maxAmount: number;
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  allowedDays: string[]; // ['Monday', 'Tuesday', ...]
  startTime: string; // '10:00'
  endTime: string; // '18:00'
  mode: 'Daily' | 'Weekly' | 'Monthly' | 'Custom';
  enabled: boolean;
}

export interface PlatformRevenue {
  id: string; // usually "summary"
  today: number;
  weekly: number;
  monthly: number;
  lifetime: number;
  premiumRevenue: number;
  challengeRevenue: number;
  withdrawalRevenue: number;
  fastWithdrawalRevenue: number;
  totalUserPayout: number;
  pendingLiability: number;
  availableReserve: number;
  lastUpdatedDate?: string;
}

export interface RevenueTransaction {
  id: string;
  userId: string;
  username: string;
  amount: number;
  type: 'premium_purchase' | 'challenge_entry' | 'withdrawal_fee' | 'fast_withdrawal_fee' | 'platform_fee' | 'other_manual_income' | 'ad_cost' | string;
  description: string;
  timestamp: any;
  title?: string;
  manualDate?: string;
}

export interface SocialSettings {
  instagramEnabled: boolean;
  instagramUrl: string;
  youtubeEnabled: boolean;
  youtubeUrl: string;
  facebookEnabled: boolean;
  facebookUrl: string;
  pinterestEnabled: boolean;
  pinterestUrl: string;
  order: string[];
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  createdDate: string;
  status: "Active" | "Inactive";
  thumbnail?: string;
  createdAt: any;
}

export interface ServicePurchase {
  id: string;
  userId: string;
  username: string;
  serviceId: string;
  serviceName: string;
  price: number;
  purchaseDate: string;
  timestamp: any;
  status: string;
  hiddenByUser?: boolean;
}

export interface DynamicSocialLink {
  id: string;
  platformName: string;
  iconName: 'youtube' | 'instagram' | 'facebook' | 'telegram' | 'whatsapp' | 'linkedin' | 'twitter' | 'discord' | 'website' | 'custom';
  url: string;
  displayOrder: number;
  enabled: boolean;
}

