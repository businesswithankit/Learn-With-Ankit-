import { useEffect, useState } from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, LeaderboardUser } from "../types";
import { Trophy } from "lucide-react";

interface LeaderboardProps {
  currentUser: UserProfile;
}

type TabType = "today" | "week" | "month" | "lifetime";

export default function Leaderboard({ currentUser }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("today");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read active users to build the leaderboard rankings
    const q = query(
      collection(db, "users"),
      where("accountStatus", "==", "Active")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          list.push({ ...doc.data() } as UserProfile);
        });
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "users");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sort and filter users based on selected period
  const getSortedLeaderboard = (): LeaderboardUser[] => {
    let sorted = [...users];
    
    const getVal = (u: UserProfile) => {
      switch (activeTab) {
        case "today":
          return u.todayEarnings || 0;
        case "week":
          return u.last7DaysEarnings || 0;
        case "month":
          return u.last30DaysEarnings || 0;
        case "lifetime":
          return (u.totalEarnings || 0) + (u.industryEarnings || 0);
      }
    };

    sorted.sort((a, b) => getVal(b) - getVal(a));

    return sorted.map((u, index) => ({
      userId: u.userId,
      customUserId: u.customUserId,
      username: u.username,
      profilePic: u.profilePic,
      earnings: getVal(u),
      rank: index + 1,
      customRank: (u as any).customRank || null,
      isPremium: u.isPremium || false,
      badge: u.badge,
    }));
  };

  const leaderboardData = getSortedLeaderboard();

  // Helper date range text
  const formatDate = (d: Date) => {
    const day = String(d.getDate()).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getDateRangeText = (tab: TabType) => {
    const now = new Date();
    const todayStr = formatDate(now);
    if (tab === "today") {
      return todayStr;
    } else if (tab === "week") {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return `(${todayStr} - ${formatDate(past)})`;
    } else if (tab === "month") {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return `(${todayStr} - ${formatDate(past)})`;
    } else {
      return "All Time Champions";
    }
  };

  const getTabLabel = (tab: TabType) => {
    switch (tab) {
      case "today":
        return "Today";
      case "week":
        return "Last 7 days";
      case "month":
        return "Last Month";
      case "lifetime":
        return "All Time";
    }
  };

  const rank1 = leaderboardData[0];
  const rank2 = leaderboardData[1];
  const rank3 = leaderboardData[2];
  const restUsers = leaderboardData.slice(3);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top Header Card & Filter Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-black text-zinc-100 uppercase tracking-wide">
              User Leaderboard
            </h3>
            <p className="text-xs text-zinc-400">Live Real-time Performance Standings</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-900 border border-zinc-800 p-1 rounded-xl">
          {(["today", "week", "month", "lifetime"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                activeTab === tab
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md scale-105"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab === "today" ? "Today" : tab === "week" ? "7 Days" : tab === "month" ? "30 Days" : "Lifetime"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Leaderboard Panel */}
      <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-4 sm:p-6 shadow-2xl space-y-8">
        
        {/* Banner Card with Curved Orange / Red Header */}
        <div className="rounded-3xl bg-gradient-to-r from-orange-600 via-red-500 to-orange-500 p-6 sm:p-7 text-center text-white shadow-2xl relative overflow-hidden space-y-1">
          <h2 className="text-2xl sm:text-3xl font-display font-black uppercase tracking-tight">
            {getTabLabel(activeTab)}
          </h2>
          <p className="text-xs sm:text-sm font-mono font-medium text-orange-100 opacity-90">
            {getDateRangeText(activeTab)}
          </p>
        </div>

        {/* Top 3 Podium Section */}
        {loading ? (
          <div className="py-12 text-center text-zinc-500 font-mono">Loading rankings...</div>
        ) : leaderboardData.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 font-sans">No leaderboard records found.</div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 pb-2">
              {/* Rank 2 (Left) */}
              <div className="flex flex-col items-center text-center space-y-2 w-28 sm:w-32">
                {rank2 ? (
                  <>
                    <div className="relative">
                      {rank2.profilePic ? (
                        <img
                          src={rank2.profilePic}
                          alt={rank2.username || "Rank 2"}
                          className="w-18 h-18 sm:w-22 sm:h-22 rounded-full object-cover border-4 border-zinc-700 shadow-xl bg-zinc-900"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full bg-zinc-800 border-4 border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-lg shadow-xl">
                          {(rank2.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-zinc-950">
                        2
                      </div>
                    </div>
                    <div className="pt-2 space-y-0.5">
                      <span className="inline-block bg-purple-600 text-white font-black text-[11px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow-md truncate max-w-[110px]">
                        {rank2.username || "User"}
                      </span>
                      <div className="text-orange-400 font-black text-xs sm:text-sm font-mono">
                        ₹ {rank2.earnings.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-zinc-600 text-xs font-mono">No Rank #2</div>
                )}
              </div>

              {/* Rank 1 (Center - Winner) */}
              <div className="flex flex-col items-center text-center space-y-2 w-32 sm:w-36 -mt-6">
                {rank1 ? (
                  <>
                    <div className="relative">
                      <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-300 animate-pulse opacity-75 blur-xs" />
                      {rank1.profilePic ? (
                        <img
                          src={rank1.profilePic}
                          alt={rank1.username || "Rank 1"}
                          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-amber-400 shadow-2xl bg-zinc-900"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 border-4 border-amber-400 flex items-center justify-center font-black text-white text-2xl shadow-2xl">
                          {(rank1.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-sm flex items-center justify-center shadow-xl border-2 border-zinc-950">
                        1
                      </div>
                    </div>
                    <div className="pt-3 space-y-0.5">
                      <span className="inline-block bg-purple-600 text-white font-black text-xs px-4 py-1 rounded-full uppercase tracking-wider shadow-lg truncate max-w-[130px]">
                        {rank1.username || "User"}
                      </span>
                      <div className="text-orange-400 font-black text-sm sm:text-base font-mono">
                        ₹ {rank1.earnings.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-zinc-600 text-xs font-mono">No Rank #1</div>
                )}
              </div>

              {/* Rank 3 (Right) */}
              <div className="flex flex-col items-center text-center space-y-2 w-28 sm:w-32">
                {rank3 ? (
                  <>
                    <div className="relative">
                      {rank3.profilePic ? (
                        <img
                          src={rank3.profilePic}
                          alt={rank3.username || "Rank 3"}
                          className="w-18 h-18 sm:w-22 sm:h-22 rounded-full object-cover border-4 border-zinc-700 shadow-xl bg-zinc-900"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full bg-zinc-800 border-4 border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-lg shadow-xl">
                          {(rank3.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-500 text-white font-black text-xs flex items-center justify-center shadow-lg border-2 border-zinc-950">
                        3
                      </div>
                    </div>
                    <div className="pt-2 space-y-0.5">
                      <span className="inline-block bg-purple-600 text-white font-black text-[11px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow-md truncate max-w-[110px]">
                        {rank3.username || "User"}
                      </span>
                      <div className="text-orange-400 font-black text-xs sm:text-sm font-mono">
                        ₹ {rank3.earnings.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-zinc-600 text-xs font-mono">No Rank #3</div>
                )}
              </div>
            </div>

            {/* Ranks 4+ List */}
            <div className="space-y-3 pt-2">
              {restUsers.map((user) => {
                const isMe = user.userId === currentUser.userId;
                return (
                  <div
                    key={user.userId}
                    className={`flex items-center justify-between p-3 sm:p-3.5 rounded-3xl border transition-all shadow-md ${
                      isMe
                        ? "bg-zinc-900/90 border-amber-500 shadow-amber-500/10"
                        : "bg-zinc-950/80 border-orange-500/30 hover:border-orange-400/60"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      {/* Rank Number Circle */}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-black text-xs sm:text-sm flex items-center justify-center shrink-0 shadow-md">
                        {user.rank}
                      </div>

                      {/* Avatar */}
                      {user.profilePic ? (
                        <img
                          src={user.profilePic}
                          alt={user.username || "User"}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-zinc-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center font-bold text-zinc-300 text-xs shrink-0">
                          {(user.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Name */}
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <p className={`text-sm font-black tracking-tight truncate ${isMe ? "text-amber-400" : "text-purple-400"}`}>
                            {user.username || "User Name"}
                          </p>
                          {isMe && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-bold uppercase shrink-0">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right pl-3 shrink-0">
                      <span className="text-sm sm:text-base font-black text-purple-400 font-mono">
                        ₹ {user.earnings.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
