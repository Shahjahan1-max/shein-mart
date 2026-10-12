import React from "react";
import { Link } from "wouter";
import { ArrowRight, Star, ShieldCheck, Tag, Sparkles, TrendingDown, Zap, ShoppingCart, Eye } from "lucide-react";
import { type HeroSlideItem } from "../../data/heroSlidesData";

interface HeroContentProps {
  slide: HeroSlideItem;
  motionPhase: "entering" | "holding" | "exiting";
  isReducedMotion: boolean;
}

function parseDiscount(price: string, comparePrice?: string): string | null {
  if (!comparePrice) return null;
  const curr = parseFloat(price.replace(/[^0-9.]/g, ""));
  const orig = parseFloat(comparePrice.replace(/[^0-9.]/g, ""));
  if (!curr || !orig || orig <= curr) return null;
  return Math.round(((orig - curr) / orig) * 100) + "% OFF";
}

function parseSavings(price: string, comparePrice?: string): string | null {
  if (!comparePrice) return null;
  const curr = parseFloat(price.replace(/[^0-9.]/g, ""));
  const orig = parseFloat(comparePrice.replace(/[^0-9.]/g, ""));
  if (!curr || !orig || orig <= curr) return null;
  const sym = price.match(/[^0-9.,\s]+/)?.[0] ?? "$";
  return `Save ${sym}${(orig - curr).toFixed(2)}`;
}

export function HeroContent({ slide, motionPhase, isReducedMotion }: HeroContentProps) {
  const discount = parseDiscount(slide.price, slide.comparePrice);
  const savings = parseSavings(slide.price, slide.comparePrice);

  const baseTransition = isReducedMotion
    ? { opacity: motionPhase === "holding" ? 1 : 0, transition: "opacity 300ms ease" }
    : motionPhase === "entering"
    ? { opacity: 1, transform: "translate3d(0,0,0)", transition: "transform 750ms cubic-bezier(0.16,1,0.3,1), opacity 600ms ease-out" }
    : motionPhase === "exiting"
    ? { opacity: 0, transform: "translate3d(-40px,0,0)", transition: "transform 550ms ease-in, opacity 450ms ease-in" }
    : { opacity: 1, transform: "translate3d(0,0,0)" };

  const delay = (ms: number): React.CSSProperties =>
    motionPhase === "entering" ? { ...baseTransition, transitionDelay: `${ms}ms` } : baseTransition;

  return (
    <div className="flex-1 text-left z-10 max-w-[54%] py-4 sm:py-6 space-y-4 sm:space-y-5">

      {/* Row 1 — Badges */}
      <div className="flex items-center gap-2.5 flex-wrap" style={delay(0)}>
        {/* Featured badge */}
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border border-amber-400/60 dark:border-amber-400/50 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />
          {slide.badge}
        </span>

        {/* Marketplace · Category */}
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-primary dark:text-blue-200 border border-primary/20 dark:border-white/15 bg-primary/5 dark:bg-white/10 shadow-sm backdrop-blur-md">
          <Tag className="w-3 h-3 text-primary dark:text-blue-300" />
          {slide.eyebrow}
        </span>

        {/* Discount badge */}
        {discount && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/15 shadow-sm">
            <TrendingDown className="w-3 h-3" />
            {discount}
          </span>
        )}
      </div>

      {/* Row 2 — Product Title */}
      <div style={delay(60)}>
        <h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.2rem] font-black leading-[1.07] tracking-tight text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-blue-100 dark:to-blue-400"
        >
          {slide.title}
        </h1>
      </div>

      {/* Row 3 — Brand message */}
      <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-blue-100/80 font-medium leading-relaxed max-w-lg" style={delay(110)}>
        {slide.brandMessage}
      </p>

      {/* Row 4 — Price + Savings */}
      <div className="flex items-center gap-3 flex-wrap" style={delay(160)}>
        <div className="flex items-baseline gap-2.5 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/12 bg-white/90 dark:bg-white/10 shadow-sm backdrop-blur-md">
          <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
            {slide.price}
          </span>
          {slide.comparePrice && (
            <span className="text-base font-semibold text-slate-400 dark:text-blue-200/55 line-through tabular-nums">{slide.comparePrice}</span>
          )}
        </div>

        {savings && (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-sm font-extrabold text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-400/25 bg-emerald-50 dark:bg-emerald-500/15 shadow-sm backdrop-blur-md">
            <Zap className="w-4 h-4 fill-emerald-500 text-emerald-500 dark:fill-emerald-400 dark:text-emerald-400" />
            {savings}
          </span>
        )}
      </div>

      {/* Row 5 — Rating + Stock Verified */}
      <div className="flex items-center gap-2.5 flex-wrap" style={delay(210)}>
        {slide.rating && (
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-xs sm:text-sm text-slate-800 dark:text-white font-bold bg-white/90 dark:bg-white/10 shadow-sm backdrop-blur-md">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>{slide.rating}</span>
            {slide.reviews && (
              <span className="text-slate-500 dark:text-blue-200/60 font-normal">({slide.reviews.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-400/30 bg-emerald-50 dark:bg-emerald-500/15 shadow-sm backdrop-blur-md">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>In Stock &amp; Verified</span>
        </div>
      </div>

      {/* Row 6 — CTAs */}
      <div className="flex items-center gap-3 pt-1 flex-wrap" style={delay(270)}>
        <Link
          href={slide.link}
          className="inline-flex items-center justify-center gap-2.5 px-7 sm:px-9 py-3.5 sm:py-4 rounded-2xl font-extrabold text-sm sm:text-base text-white shadow-xl bg-primary hover:bg-primary/90 active:scale-[0.97] transition-all duration-200 group"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>Explore Deal</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/deals"
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-sm text-slate-700 dark:text-blue-200 border border-slate-200 dark:border-white/12 bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 hover:text-slate-900 dark:hover:text-white active:scale-95 shadow-sm transition-all duration-200 backdrop-blur-md"
        >
          <Eye className="w-4 h-4" />
          <span>View All Deals</span>
        </Link>
      </div>
    </div>
  );
}
