import { useEffect, useState } from "react";
import { Megaphone, X, Calendar } from "lucide-react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Announcement } from "../types";

export default function AnnouncementsBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      where("active", "==", true),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Announcement[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        setAnnouncements(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "announcements");
      }
    );

    return () => unsubscribe();
  }, []);

  // Rotate announcements
  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [announcements]);

  if (dismissed || announcements.length === 0) return null;

  const current = announcements[currentIndex];

  return (
    <div className="relative w-full bg-linear-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/5 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-zinc-100 z-50">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 gold-glow">
          <Megaphone className="w-4 h-4 animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-400 text-slate-900 uppercase tracking-widest mr-2.5 shrink-0">
            Announcement
          </span>
          <span className="font-sans text-xs sm:text-sm font-medium text-zinc-200 truncate">
            {current?.title}:{" "}
            <span className="text-zinc-400 font-normal">{current?.content}</span>
          </span>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 text-zinc-400 hover:text-amber-400 transition-colors rounded-md hover:bg-zinc-800/50 ml-2"
        aria-label="Dismiss Announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
