import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  Instagram,
  Youtube,
  Facebook,
  Send,
  MessageCircle,
  Linkedin,
  Twitter,
  MessageSquare,
  Globe,
  Link2
} from "lucide-react";
import { DynamicSocialLink } from "../types";

interface SocialMediaIconsProps {
  className?: string;
  iconClassName?: string;
}

export default function SocialMediaIcons({ className = "", iconClassName = "" }: SocialMediaIconsProps) {
  const [links, setLinks] = useState<DynamicSocialLink[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "social"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.links && Array.isArray(data.links)) {
          setLinks(data.links);
        } else {
          // Compatibility with old structure if present, or defaults
          const legacyLinks: DynamicSocialLink[] = [];
          if (data.instagramUrl) {
            legacyLinks.push({
              id: "legacy_ig",
              platformName: "Instagram",
              iconName: "instagram",
              url: data.instagramUrl,
              displayOrder: 1,
              enabled: data.instagramEnabled !== false
            });
          }
          if (data.youtubeUrl) {
            legacyLinks.push({
              id: "legacy_yt",
              platformName: "YouTube",
              iconName: "youtube",
              url: data.youtubeUrl,
              displayOrder: 2,
              enabled: data.youtubeEnabled !== false
            });
          }
          if (data.facebookUrl) {
            legacyLinks.push({
              id: "legacy_fb",
              platformName: "Facebook",
              iconName: "facebook",
              url: data.facebookUrl,
              displayOrder: 3,
              enabled: data.facebookEnabled !== false
            });
          }
          if (data.pinterestUrl) {
            legacyLinks.push({
              id: "legacy_pin",
              platformName: "Pinterest",
              iconName: "custom",
              url: data.pinterestUrl,
              displayOrder: 4,
              enabled: data.pinterestEnabled !== false
            });
          }

          if (legacyLinks.length > 0) {
            setLinks(legacyLinks);
          } else {
            setLinks(getDefaultLinks());
          }
        }
      } else {
        setLinks(getDefaultLinks());
      }
    });
    return () => unsub();
  }, []);

  const getDefaultLinks = (): DynamicSocialLink[] => [
    { id: "default_yt", platformName: "YouTube", iconName: "youtube", url: "https://youtube.com/learnwithankit", displayOrder: 1, enabled: true },
    { id: "default_ig", platformName: "Instagram", iconName: "instagram", url: "https://instagram.com/learnwithankit", displayOrder: 2, enabled: true },
    { id: "default_fb", platformName: "Facebook", iconName: "facebook", url: "https://facebook.com/learnwithankit", displayOrder: 3, enabled: true },
    { id: "default_tg", platformName: "Telegram", iconName: "telegram", url: "https://t.me/learnwithankit", displayOrder: 4, enabled: true },
  ];

  const renderIcon = (iconName: string) => {
    const sizeClass = `w-4 h-4 ${iconClassName}`;
    switch (iconName) {
      case "youtube":
        return <Youtube className={sizeClass} />;
      case "instagram":
        return <Instagram className={sizeClass} />;
      case "facebook":
        return <Facebook className={sizeClass} />;
      case "telegram":
        return <Send className={sizeClass} />;
      case "whatsapp":
        return <MessageCircle className={sizeClass} />;
      case "linkedin":
        return <Linkedin className={sizeClass} />;
      case "twitter":
        return <Twitter className={sizeClass} />;
      case "discord":
        return <MessageSquare className={sizeClass} />;
      case "website":
        return <Globe className={sizeClass} />;
      default:
        return <Link2 className={sizeClass} />;
    }
  };

  const getHoverColor = (iconName: string) => {
    switch (iconName) {
      case "youtube":
        return "hover:text-red-500 hover:scale-110 hover:border-red-500/30";
      case "instagram":
        return "hover:text-pink-500 hover:scale-110 hover:border-pink-500/30";
      case "facebook":
        return "hover:text-blue-500 hover:scale-110 hover:border-blue-500/30";
      case "telegram":
        return "hover:text-sky-400 hover:scale-110 hover:border-sky-400/30";
      case "whatsapp":
        return "hover:text-emerald-500 hover:scale-110 hover:border-emerald-500/30";
      case "linkedin":
        return "hover:text-indigo-400 hover:scale-110 hover:border-indigo-400/30";
      case "twitter":
        return "hover:text-zinc-100 hover:scale-110 hover:border-zinc-100/30";
      case "discord":
        return "hover:text-indigo-500 hover:scale-110 hover:border-indigo-500/30";
      case "website":
        return "hover:text-amber-500 hover:scale-110 hover:border-amber-500/30";
      default:
        return "hover:text-red-500 hover:scale-110 hover:border-red-500/30";
    }
  };

  // Filter enabled and sort by display order
  const activeLinks = links
    .filter((l) => l.enabled && l.url)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  if (activeLinks.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 justify-center ${className}`}>
      {activeLinks.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Follow us on ${link.platformName}`}
          className={`text-zinc-400 p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-800 transition-all duration-300 flex items-center justify-center ${getHoverColor(
            link.iconName
          )}`}
        >
          {renderIcon(link.iconName)}
        </a>
      ))}
    </div>
  );
}
