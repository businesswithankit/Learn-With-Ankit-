import { useEffect, useState, useRef } from "react";
import { Bell, Check, Trash2, ShieldCheck, CreditCard, Award, Calendar } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Notification } from "../types";

interface NotificationsDropdownProps {
  userId: string;
  userRole?: string;
}

export default function NotificationsDropdown({ userId, userRole = "user" }: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const targets = [userId, "all"];
    if (userRole && !targets.includes(userRole)) {
      targets.push(userRole);
    }

    // Query notifications for specific user, role, or global "all"
    const q = query(
      collection(db, "notifications"),
      where("userId", "in", targets)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Notification[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Notification);
        });

        // Sort in memory by timestamp desc to avoid Firestore composite index errors
        list.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime();
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime();
          return timeB - timeA;
        });

        setNotifications(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "notifications");
      }
    );

    return () => unsubscribe();
  }, [userId, userRole]);

  // Handle clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((notif) => {
        if (!notif.isRead) {
          const ref = doc(db, "notifications", notif.id);
          batch.update(ref, { isRead: true });
        }
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "notifications");
    }
  };

  const clearAllNotifications = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach((notif) => {
        const ref = doc(db, "notifications", notif.id);
        batch.delete(ref);
      });
      await batch.commit();
      setNotifications([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "notifications");
    }
  };

  const toggleRead = async (id: string, currentRead: boolean) => {
    try {
      const ref = doc(db, "notifications", id);
      await updateDoc(ref, { isRead: !currentRead });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const formatNotificationTime = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case "withdrawal":
        return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      case "challenge":
        return <Award className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-zinc-400 hover:text-amber-400 focus:outline-hidden transition-all duration-300 rounded-full hover:bg-zinc-800/40"
        aria-label="Toggle notifications menu"
      >
        <Bell className="w-5.5 h-5.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white font-sans text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950 scale-100 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-[-8px] sm:right-0 mt-3 w-80 sm:w-96 max-w-[calc(100vw-32px)] rounded-2xl glass-panel shadow-2xl border border-zinc-800 overflow-hidden z-50">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-slate-950/60">
            <h4 className="font-display font-semibold text-zinc-100 flex items-center space-x-2">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded-full font-mono font-medium">
                  {unreadCount} Unread
                </span>
              )}
            </h4>
            <div className="flex space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="p-1 text-zinc-400 hover:text-emerald-400 transition-colors"
                  title="Mark all as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="p-1 text-zinc-400 hover:text-red-400 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-2">
                <Bell className="w-10 h-10 text-zinc-600 stroke-[1.5]" />
                <p className="text-sm text-zinc-500 font-sans">No notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => toggleRead(notif.id, notif.isRead)}
                    className={`p-4 hover:bg-zinc-900/40 cursor-pointer transition-colors relative flex space-x-3 items-start ${
                      !notif.isRead ? "bg-amber-500/[0.02]" : ""
                    }`}
                  >
                    {!notif.isRead && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    )}
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/50 flex items-center justify-center border border-zinc-700/30">
                        {getNotifIcon(notif.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 line-clamp-1">{notif.title}</p>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{notif.body}</p>
                      <span className="text-[10px] text-zinc-500 flex items-center space-x-1 mt-1.5 font-mono">
                        <Calendar className="w-3 h-3 text-zinc-600" />
                        <span>{formatNotificationTime(notif.timestamp)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
