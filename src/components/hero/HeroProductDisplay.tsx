import React from "react";
import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { type HeroSlideItem } from "../../data/heroSlidesData";

interface HeroProductDisplayProps {
  slide: HeroSlideItem;
  motionPhase: "entering" | "holding" | "exiting";
  isReducedMotion: boolean;
}

export function HeroProductDisplay({ slide, motionPhase, isReducedMotion }: HeroProductDisplayProps) {
  const getMotionStyle = (): React.CSSProperties => {
    if (isReducedMotion) {
      return {
        opacity: motionPhase === "holding" ? 1 : 0.15,
        transition: "opacity 400ms ease-out",
      };
    }

    if (motionPhase === "entering") {
      return {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        transition: "transform 800ms cubic-bezier(0.16, 1, 0.3, 1), opacity 700ms ease-out",
      };
    }

    if (motionPhase === "exiting") {
      return {
        opacity: 0,
        transform: "translate3d(-120%, 0, 0) scale(0.95)",
        transition: "transform 750ms cubic-bezier(0.7, 0, 0.84, 0), opacity 650ms ease-in",
      };
    }

    return {
      opacity: 0,
      transform: "translate3d(120%, 0, 0) scale(0.95)",
      transition: "none",
    };
  };

  return (
    <div className="flex-1 w-full flex justify-center items-center z-10 py-2 sm:py-4">
      <div
        className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg aspect-[4/3] rounded-3xl p-4 sm:p-6 bg-white/80 dark:bg-gradient-to-b dark:from-white/15 dark:via-white/10 dark:to-white/5 border border-slate-200 dark:border-white/20 backdrop-blur-xl shadow-xl dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8)] flex flex-col justify-between overflow-hidden group"
        style={getMotionStyle()}
      >
        {/* Decorative Top Ambient Glow inside card */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/20 dark:bg-primary/30 rounded-full blur-2xl pointer-events-none" />

        {/* Top Card Badge: Marketplace Source */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/15 text-xs text-slate-800 dark:text-white font-bold backdrop-blur-md shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{slide.platform}</span>
          </div>

          <Link
            href={slide.link}
            className="flex items-center gap-1 text-xs text-primary dark:text-blue-200 hover:text-primary/80 dark:hover:text-white font-semibold transition-colors bg-primary/5 dark:bg-white/10 hover:bg-primary/10 dark:hover:bg-white/20 border border-primary/20 dark:border-white/15 px-2.5 py-1 rounded-xl backdrop-blur-md shadow-sm"
          >
            <span>View</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Central Product Image Container */}
        <div className="relative flex-1 flex items-center justify-center py-2 z-10 my-2">
          <img
            src={slide.image}
            alt={slide.title}
            width={320}
            height={240}
            fetchPriority="high"
            decoding="async"
            className="max-h-48 sm:max-h-56 md:max-h-64 w-auto object-contain rounded-2xl drop-shadow-[0_15px_25px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_20px_35px_rgba(0,0,0,0.6)] group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="eager"
          />
        </div>

        {/* Bottom Card Footer: Product Title & Price summary */}
        <div className="z-10 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/15 rounded-2xl p-3 backdrop-blur-md flex items-center justify-between gap-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs text-primary dark:text-blue-200/80 font-medium uppercase tracking-wider">{slide.category}</p>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{slide.title}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm sm:text-base font-black text-slate-900 dark:text-white">{slide.price}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
