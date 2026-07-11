import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Instagram, Youtube, Facebook } from "lucide-react";
import { SocialSettings } from "../types";

interface SocialMediaIconsProps {
  className?: string;
  iconClassName?: string;
}

const PinterestIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.63 11.16-.1-.95-.2-2.4.04-3.43.22-.93 1.4-5.93 1.4-5.93s-.36-.72-.36-1.77c0-1.66.96-2.9 2.17-2.9 1.02 0 1.51.77 1.51 1.69 0 1.03-.65 2.56-.99 3.98-.28 1.19.6 2.16 1.77 2.16 2.12 0 3.76-2.24 3.76-5.47 0-2.86-2.06-4.86-5-4.86-3.4 0-5.4 2.56-5.4 5.2 0 1.03.4 2.14.9 2.74.1.12.11.23.08.35-.09.37-.29 1.18-.33 1.34-.05.2-.17.25-.39.15-1.46-.68-2.37-2.81-2.37-4.52 0-3.68 2.67-7.06 7.71-7.06 4.05 0 7.2 2.89 7.2 6.75 0 4.03-2.54 7.27-6.07 7.27-1.19 0-2.3-.62-2.69-1.35l-.73 2.78c-.26 1.02-1 2.3-1.49 3.09C10.5 23.83 11.24 24 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z"/>
  </svg>
);

export default function SocialMediaIcons({ className = "", iconClassName = "" }: SocialMediaIconsProps) {
  const [settings, setSettings] = useState<SocialSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "social"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as SocialSettings);
      } else {
        setSettings({
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
      }
    });
    return () => unsub();
  }, []);

  if (!settings) return null;

  const getIcon = (key: string) => {
    switch (key) {
      case "instagram":
        if (!settings.instagramEnabled) return null;
        return {
          icon: <Instagram className={`w-4 h-4 ${iconClassName}`} />,
          url: settings.instagramUrl,
          label: "Instagram",
          hoverColor: "hover:text-pink-500 hover:scale-110",
        };
      case "youtube":
        if (!settings.youtubeEnabled) return null;
        return {
          icon: <Youtube className={`w-4 h-4 ${iconClassName}`} />,
          url: settings.youtubeUrl,
          label: "YouTube",
          hoverColor: "hover:text-red-500 hover:scale-110",
        };
      case "facebook":
        if (!settings.facebookEnabled) return null;
        return {
          icon: <Facebook className={`w-4 h-4 ${iconClassName}`} />,
          url: settings.facebookUrl,
          label: "Facebook",
          hoverColor: "hover:text-blue-500 hover:scale-110",
        };
      case "pinterest":
        if (!settings.pinterestEnabled) return null;
        return {
          icon: <PinterestIcon className={`w-4 h-4 ${iconClassName}`} />,
          url: settings.pinterestUrl,
          label: "Pinterest",
          hoverColor: "hover:text-red-600 hover:scale-110",
        };
      default:
        return null;
    }
  };

  const activeOrder = settings.order || ["instagram", "youtube", "facebook", "pinterest"];

  return (
    <div className={`flex items-center gap-3 justify-center ${className}`}>
      {activeOrder.map((key) => {
        const item = getIcon(key);
        if (!item || !item.url) return null;
        return (
          <a
            key={key}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Follow us on ${item.label}`}
            className={`text-zinc-400 p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-800 transition-all duration-300 flex items-center justify-center ${item.hoverColor}`}
          >
            {item.icon}
          </a>
        );
      })}
    </div>
  );
}
