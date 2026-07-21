import { useEffect, useState } from "react";
import { collection, query, onSnapshot, where, limit, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { UserProfile, LeaderboardUser } from "../types";
import { Trophy, Award, TrendingUp, Sparkles, ChevronUp } from "lucide-react";

interface LeaderboardProps {
  currentUser: UserProfile;
}

type TabType = "today" | "week" | "month" | "lifetime";

export default function Leaderboard({ currentUser }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("lifetime");
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
          return u.totalEarnings || 0;
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
    }));
  };

  const leaderboardData = getSortedLeaderboard();

  // Find current user stats in current leaderboard context
  const currentUserRankData = leaderboardData.find((u) => u.userId === currentUser.userId);
  const currentUserRank = currentUserRankData?.rank || leaderboardData.length + 1;
  const currentUserEarnings = currentUserRankData?.earnings || 0;

  // Next rank target calculation
  const nextUser = currentUserRank > 1 ? leaderboardData[currentUserRank - 2] : null;
  const amountToNextRank = nextUser ? nextUser.earnings - currentUserEarnings : 0;
  const totalDifference = nextUser && currentUserRankData ? nextUser.earnings : 0;
  const progressPercent = nextUser && nextUser.earnings > 0 
    ? Math.min((currentUserEarnings / nextUser.earnings) * 100, 100) 
    : 100;

  const renderMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-display font-bold shadow-lg border-2 border-amber-200 animate-pulse gold-glow shrink-0">
            🥇
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-zinc-300 text-slate-950 flex items-center justify-center font-display font-bold shadow-lg border-2 border-zinc-100 shrink-0">
            🥈
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-700 text-slate-100 flex items-center justify-center font-display font-bold shadow-lg border-2 border-amber-600 shrink-0">
            🥉
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-zinc-900/60 text-zinc-500 border border-zinc-800 flex items-center justify-center font-mono text-xs font-semibold shrink-0">
            #{rank}
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Rank Tracker Panel */}
      <div className="rounded-2xl bg-linear-to-br from-amber-500/[0.04] via-zinc-900/40 to-black p-5 border border-amber-500/15 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 gold-glow">
              <Trophy className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-display font-semibold text-zinc-100">Your Live Rank Tracker</h4>
              <p className="text-xs text-zinc-400">Updates in real-time as your earnings change.</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Current Rank</span>
              <p className="text-lg font-display font-bold text-amber-400">Rank #{currentUserRank}</p>
            </div>
            {nextUser && (
              <div className="text-right border-l border-zinc-800 pl-4">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Next Rank</span>
                <p className="text-lg font-display font-bold text-zinc-300">Rank #{currentUserRank - 1}</p>
              </div>
            )}
          </div>
        </div>

        {nextUser ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-500">Milestone Progress to Next Rank</span>
              <span className="text-amber-400 font-medium">₹{amountToNextRank.toLocaleString("en-IN")} remaining</span>
            </div>
            
            {/* Animated Progress Bar */}
            <div className="w-full bg-zinc-950/60 rounded-full h-2.5 overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all duration-1000 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>₹{currentUserEarnings.toLocaleString("en-IN")} (You)</span>
              <span>₹{nextUser.earnings.toLocaleString("en-IN")} ({nextUser.username})</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 p-2 bg-amber-500/10 rounded-xl border border-amber-500/25">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="text-xs text-amber-300 font-medium">Congratulations! You are currently the #1 Top Earners Champion!</span>
          </div>
        )}
      </div>

      {/* Leaderboard Grid */}
      <div className="rounded-2xl glass-panel p-5 border border-zinc-800 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2.5">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-display font-semibold text-zinc-100">Top Performers Board</h3>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1.5 bg-slate-950/80 border border-zinc-800/80 p-1 rounded-xl">
            {(["today", "week", "month", "lifetime"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 uppercase tracking-wider cursor-pointer ${
                  activeTab === tab
                    ? "bg-amber-500 text-slate-950 font-bold shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab === "week" ? "7 Days" : tab === "month" ? "30 Days" : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Board Rows */}
        <div className="space-y-3.5 max-h-110 overflow-y-auto pr-1">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-zinc-900/30 border border-zinc-800/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-sans">No records found.</div>
          ) : (
            leaderboardData.map((user, idx) => {
              const isMe = user.userId === currentUser.userId;
              const displayId = user.customUserId || `LWA-${user.userId.substring(0, 5).toUpperCase()}`;
              return (
                <div
                  key={user.userId}
                  className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 border ${
                    isMe
                      ? "bg-zinc-950 border-amber-500/30 shadow-md"
                      : user.isPremium
                      ? "bg-amber-500/[0.02] border-amber-500/10 hover:border-amber-500/25 shadow-sm"
                      : "bg-black border-zinc-900 hover:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="shrink-0">
                      {(user as any).customRank ? (
                        <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-mono text-[10px] font-bold">
                          {(user as any).customRank}
                        </div>
                      ) : (
                        renderMedal(user.rank || idx + 1)
                      )}
                    </div>
                    
                    {/* User Profile Avatar */}
                    <div className="relative shrink-0">
                      {user.profilePic ? (
                        <img
                          src={user.profilePic}
                          alt={user.username || "User"}
                          referrerPolicy="no-referrer"
                          className="w-8.5 h-8.5 rounded-lg object-cover border border-zinc-900"
                        />
                      ) : (
                        <div className="w-8.5 h-8.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-display font-bold text-zinc-400 text-xs">
                          {(user.username || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      {isMe && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-500 border border-black rounded-full flex items-center justify-center text-[7px] text-slate-950 font-bold font-mono animate-pulse">
                          ★
                        </span>
                      )}
                    </div>
 
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isMe ? "text-amber-400 font-bold" : "text-zinc-200"}`}>
                          {user.username || "User"}
                        </p>
                        {user.isPremium && (
                          <span className="px-1.5 py-0.5 text-[8px] font-black tracking-wider bg-amber-400 text-slate-950 rounded-xs leading-none shrink-0 animate-pulse">
                            👑 VIP
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-500 font-mono tracking-wide truncate">{displayId}</p>
                    </div>
                  </div>
 
                  <div className="text-right pl-3">
                    <p className="text-xs font-display font-bold text-zinc-100">
                      ₹{user.earnings.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                    </p>
                    <span className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">
                      {activeTab === "today" ? "Today" : activeTab === "week" ? "7 Days" : activeTab === "month" ? "30 Days" : "Lifetime"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
