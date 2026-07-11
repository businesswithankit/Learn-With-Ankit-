import { PaymentRequest } from "../types";

export interface RollingEarnings {
  todayEarnings: number;
  last7DaysEarnings: number;
  last30DaysEarnings: number;
  totalEarnings: number;
  todayEarningsDate: string;
}

export function calculateUserRollingEarnings(userPayments: PaymentRequest[]): RollingEarnings {
  const approved = userPayments.filter(p => p.status === "Approved");
  const now = Date.now();
  
  // Start of today in local timezone (12:00 AM)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const todayDateStr = startOfToday.toLocaleDateString("en-CA"); // "YYYY-MM-DD"
  
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  let todayEarnings = 0;
  let last7DaysEarnings = 0;
  let last30DaysEarnings = 0;
  let totalEarnings = 0;

  approved.forEach((p) => {
    let paymentTime = now;
    if (p.timestamp) {
      if (typeof p.timestamp.toMillis === "function") {
        paymentTime = p.timestamp.toMillis();
      } else if (p.timestamp.seconds) {
        paymentTime = p.timestamp.seconds * 1000;
      } else if (p.timestamp instanceof Date) {
        paymentTime = p.timestamp.getTime();
      } else if (typeof p.timestamp === "number") {
        paymentTime = p.timestamp;
      } else {
        paymentTime = new Date(p.timestamp).getTime() || now;
      }
    }

    const amount = p.totalAmount || 0;
    totalEarnings += amount;

    if (paymentTime >= startOfTodayMs) {
      todayEarnings += amount;
    }
    if (paymentTime >= sevenDaysAgo) {
      last7DaysEarnings += amount;
    }
    if (paymentTime >= thirtyDaysAgo) {
      last30DaysEarnings += amount;
    }
  });

  return {
    todayEarnings,
    last7DaysEarnings,
    last30DaysEarnings,
    totalEarnings,
    todayEarningsDate: todayDateStr,
  };
}
