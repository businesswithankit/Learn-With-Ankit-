import { doc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Atomically increments the platform revenue tracking dashboard and logs a revenue transaction.
 * Also handles rolling/daily resets for 'today' automatically if the date shifts.
 */
export async function addPlatformRevenue(
  userId: string,
  username: string,
  amount: number,
  type: "premium_purchase" | "challenge_entry" | "withdrawal_fee" | "fast_withdrawal_fee" | "platform_fee",
  description: string
) {
  if (amount <= 0) return;
  const revenueRef = doc(db, "settings", "revenue");
  const txRef = doc(collection(db, "revenueTransactions"));

  await runTransaction(db, async (transaction) => {
    const revSnap = await transaction.get(revenueRef);
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    
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
      revData = {
        ...revData,
        ...existing,
      };
    }

    // Reset daily if date changed
    if (revData.lastUpdatedDate !== todayStr) {
      revData.today = 0;
      revData.lastUpdatedDate = todayStr;
    }

    // Increment values
    revData.lifetime += amount;
    revData.today += amount;
    revData.weekly += amount;
    revData.monthly += amount;
    revData.availableReserve += amount;

    if (type === "premium_purchase") {
      revData.premiumRevenue += amount;
    } else if (type === "challenge_entry") {
      revData.challengeRevenue += amount;
    } else if (type === "withdrawal_fee") {
      revData.withdrawalRevenue += amount;
    } else if (type === "fast_withdrawal_fee") {
      revData.fastWithdrawalRevenue += amount;
    } else if (type === "platform_fee") {
      revData.withdrawalRevenue += amount;
    }

    // Update Platform Revenue document
    transaction.set(revenueRef, revData);

    // Save transaction detail
    transaction.set(txRef, {
      userId,
      username,
      amount,
      type,
      description,
      timestamp: serverTimestamp(),
    });
  });
}
