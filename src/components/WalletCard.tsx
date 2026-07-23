import React, { useState } from "react";
import { Wifi, ShieldCheck, Eye, EyeOff, Copy, Check, Sparkles, Crown, Zap } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface WalletCardProps {
  balance: number;
  username: string;
  walletNumber?: string;
  lastUpdated?: string;
  tierName?: string;
}

export default function WalletCard({
  balance,
  username,
  walletNumber = "LWA-8849-5192-3000",
  tierName = "ROYAL BLACK ELITE",
}: WalletCardProps) {
  const [showBalance, setShowBalance] = useState<boolean>(true);
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);

  const handleCopyCardNumber = () => {
    navigator.clipboard.writeText(walletNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const maskedCardNumber = `•••• •••• •••• ${walletNumber.slice(-4)}`;

  return (
    <div className="relative group w-full max-w-[380px] min-h-[225px] rounded-3xl bg-gradient-to-br from-zinc-950 via-neutral-900 to-black border border-amber-500/30 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(245,158,11,0.12)] hover:border-amber-400/70 hover:shadow-[0_25px_65px_rgba(245,158,11,0.22)] transition-all duration-500 hover:scale-[1.025] overflow-hidden flex flex-col justify-between font-sans select-none ring-1 ring-amber-500/20 hover:ring-amber-400/50">
      
      {/* 1. Metallic Carbon Mesh Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px]" 
      />

      {/* 2. Interactive Light Sheen Sweeping Beam */}
      <div className="absolute top-0 -left-[100%] w-[150%] h-full bg-gradient-to-r from-transparent via-amber-400/10 to-transparent -skew-x-25 group-hover:left-[150%] transition-all duration-1000 ease-in-out pointer-events-none" />

      {/* 3. Multi-layer Gold & Holographic Ambient Glare */}
      <div className="absolute -top-24 -right-24 w-56 h-56 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-transparent rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-tr from-amber-600/10 via-amber-400/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* TOP ROW: Luxury Brand & Holographic Security Badge */}
      <div className="relative z-10 flex justify-between items-center">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-600 p-[1px] shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] font-black uppercase font-mono tracking-[0.25em] bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
                {tierName}
              </span>
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
            </div>
            <span className="text-[8px] font-mono tracking-widest text-zinc-500 block">EXECUTIVE WALLET • VERIFIED</span>
          </div>
        </div>

        {/* Holographic Hologram Stamp & NFC Icon */}
        <div className="flex items-center space-x-2">
          {/* Real Holographic Foil Patch */}
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-teal-400 via-indigo-500 to-amber-400 opacity-80 animate-pulse shadow-sm p-[1px]" title="Holographic Security Seal">
            <div className="w-full h-full bg-black/40 rounded-full backdrop-blur-xs flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white/90" />
            </div>
          </div>
          <Wifi className="w-4 h-4 text-amber-400/70 -rotate-90" />
        </div>
      </div>

      {/* MIDDLE ROW: 3D EMV Metal Chip & Privacy Toggle */}
      <div className="relative z-10 flex items-center justify-between my-2">
        {/* Realistic 3D Gold Contact Chip */}
        <div className="w-10 h-7 rounded-lg bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border border-yellow-200/60 relative overflow-hidden p-1 shadow-[inset_0_1px_3px_rgba(255,255,255,0.6),0_2px_8px_rgba(0,0,0,0.5)]">
          <div className="w-full h-[1px] bg-yellow-900/40 absolute top-1/2 left-0" />
          <div className="w-[1px] h-full bg-yellow-900/40 absolute left-1/3 top-0" />
          <div className="w-[1px] h-full bg-yellow-900/40 absolute left-2/3 top-0" />
          <div className="w-2.5 h-2 rounded-xs border border-yellow-800/40 mx-auto my-auto opacity-70" />
        </div>

        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-amber-500/20 hover:border-amber-400/40 text-[10px] font-mono text-zinc-300 transition-all cursor-pointer shadow-inner active:scale-95"
          title={showBalance ? "Hide Balance" : "Show Balance"}
        >
          {showBalance ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3 text-amber-400" />}
          <span>{showBalance ? "Hide" : "Show"}</span>
        </button>
      </div>

      {/* BALANCE SECTION: Ultra High-End Glowing Numbers */}
      <div className="relative z-10 space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-mono font-bold flex items-center space-x-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Available Balance</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono font-bold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>INSTANT PAYOUT READY</span>
          </span>
        </div>

        <div className="text-3xl sm:text-4xl font-display font-black tracking-tight text-amber-300 flex items-baseline">
          {showBalance ? (
            <div className="bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(245,158,11,0.35)]">
              <AnimatedCounter value={balance} prefix="₹" />
            </div>
          ) : (
            <span className="font-mono text-2xl tracking-widest text-zinc-500">
              •••• ••••
            </span>
          )}
        </div>
      </div>

      {/* BOTTOM ROW: Cardholder Name, Expiry & Copyable Card Number */}
      <div className="relative z-10 border-t border-zinc-800/80 pt-3 flex justify-between items-end">
        <div className="space-y-0.5 max-w-[170px]">
          <span className="text-[7px] uppercase tracking-widest text-zinc-500 font-mono block">Cardholder Name</span>
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-zinc-100 font-black block truncate drop-shadow-xs">
            {username}
          </span>
        </div>

        <div className="space-y-0.5 text-right">
          <div className="flex items-center justify-end space-x-1">
            <span className="text-[7px] uppercase tracking-widest text-zinc-500 font-mono block">Executive ID</span>
            <button
              type="button"
              onClick={handleCopyCardNumber}
              className="text-zinc-500 hover:text-amber-400 transition-colors p-0.5 cursor-pointer"
              title="Copy Card Number"
            >
              {copiedNumber ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <span className="text-[10px] font-mono tracking-wider text-amber-200/90 font-semibold block">
            {copiedNumber ? <span className="text-emerald-400">Copied to Clipboard!</span> : maskedCardNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

