import React from "react";
import { Wifi, ShieldCheck } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface WalletCardProps {
  balance: number;
  username: string;
  walletNumber?: string;
  lastUpdated?: string;
}

export default function WalletCard({
  balance,
  username,
  walletNumber = "LWA-8849-5192-3000",
  lastUpdated = new Date().toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
}: WalletCardProps) {
  return (
    <div className="relative group w-full max-w-[340px] h-[200px] rounded-2xl bg-gradient-to-br from-zinc-900 via-neutral-950 to-black border border-zinc-850 p-5 shadow-[0_15px_35px_rgba(0,0,0,0.6)] hover:border-amber-500/30 transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(245,158,11,0.06)] overflow-hidden flex flex-col justify-between font-sans select-none">
      {/* Subtle brand metallic sheen backdrop */}
      <div className="absolute top-0 -left-1/2 w-full h-full bg-gradient-to-r from-transparent via-zinc-800/5 to-transparent skew-x-12 group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
      
      {/* Gold card accent glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-all duration-500" />

      {/* Top row: Brand & NFC symbol */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-display font-black text-slate-950 text-xs shadow-md">
            ★
          </div>
          <span className="text-[10px] uppercase font-mono tracking-[0.25em] text-zinc-400 font-bold">LWA ELITE</span>
        </div>
        <Wifi className="w-4 h-4 text-zinc-600 -rotate-90" />
      </div>

      {/* Middle row: Card chip & Member Label */}
      <div className="flex items-center justify-between mt-2">
        {/* Real look Mini Gold Metal Chip */}
        <div className="w-8 h-6 rounded-md bg-gradient-to-br from-yellow-600/80 via-amber-400/90 to-yellow-700 border border-yellow-500/40 relative overflow-hidden flex flex-col justify-between p-1 shadow-inner">
          <div className="w-full h-[1px] bg-yellow-950/20 absolute top-1/2 left-0" />
          <div className="w-[1px] h-full bg-yellow-950/20 absolute left-1/3 top-0" />
          <div className="w-[1px] h-full bg-yellow-950/20 absolute left-2/3 top-0" />
        </div>
        <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase">PREMIUM MEMBER</span>
      </div>

      {/* Balance section */}
      <div className="space-y-0.5 my-auto">
        <span className="text-[8px] uppercase tracking-[0.2em] text-zinc-500 font-mono block">Available Balance</span>
        <div className="text-2xl font-display font-bold tracking-tight text-zinc-100 flex items-baseline">
          <AnimatedCounter value={balance} prefix="₹" />
        </div>
      </div>

      {/* Bottom row: Cardholder & security */}
      <div className="flex justify-between items-end border-t border-zinc-900 pt-3">
        <div className="space-y-0.5">
          <span className="text-[7px] uppercase tracking-widest text-zinc-600 font-mono block">Cardholder</span>
          <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-300 font-bold block truncate max-w-[140px]">
            {username}
          </span>
        </div>
        <div className="space-y-0.5 text-right">
          <span className="text-[7px] uppercase tracking-widest text-zinc-600 font-mono block">Card Number</span>
          <span className="text-[9px] font-mono tracking-wider text-zinc-500 block">
            •••• •••• •••• {walletNumber.slice(-4)}
          </span>
        </div>
      </div>
    </div>
  );
}
