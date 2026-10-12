import React from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { type HeroSlideItem } from "../../data/heroSlidesData";

interface HeroControlsProps {
  slides: HeroSlideItem[];
  activeIndex: number;
  onSelectSlide: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
}

export function HeroControls({
  slides,
  activeIndex,
  onSelectSlide,
  onPrev,
  onNext,
  isPaused,
  onTogglePause,
}: HeroControlsProps) {
  const currentFormatted = String(activeIndex + 1).padStart(2, "0");
  const totalFormatted = String(slides.length).padStart(2, "0");

  return (
    <div className="relative z-20 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/80 dark:border-white/10 mt-6 sm:mt-8">
      {/* Left: Slide Counter & Play/Pause Button */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-white tracking-widest tabular-nums">
          <span className="text-base font-black text-primary dark:text-amber-300">{currentFormatted}</span>
          <span className="text-slate-400 dark:text-white/40">/</span>
          <span className="text-slate-500 dark:text-white/60">{totalFormatted}</span>
        </div>

        <button
          onClick={onTogglePause}
          aria-label={isPaused ? "Resume auto rotation" : "Pause auto rotation"}
          title={isPaused ? "Resume auto rotation" : "Pause auto rotation"}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 border border-slate-200 dark:border-white/15 text-xs font-semibold text-slate-700 dark:text-white shadow-sm backdrop-blur-md transition-all active:scale-95"
        >
          {isPaused ? (
            <>
              <Play className="w-3 h-3 fill-slate-700 dark:fill-white text-slate-700 dark:text-white" />
              <span className="text-[11px]">Paused</span>
            </>
          ) : (
            <>
              <Pause className="w-3 h-3 fill-slate-700 dark:fill-white text-slate-700 dark:text-white" />
              <span className="text-[11px]">Auto</span>
            </>
          )}
        </button>
      </div>

      {/* Center: Pagination Dots for All Products */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full px-2">
        {slides.map((slide, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={slide.id}
              onClick={() => onSelectSlide(idx)}
              aria-label={`Go to slide ${idx + 1}: ${slide.title}`}
              title={`${slide.title} (${slide.price})`}
              className={`h-2.5 rounded-full transition-all duration-300 flex-shrink-0 ${
                isActive
                  ? "w-8 sm:w-10 bg-primary dark:bg-gradient-to-r dark:from-amber-400 dark:to-amber-200 shadow-md shadow-primary/20"
                  : "w-2.5 bg-slate-300 hover:bg-slate-400 dark:bg-white/25 dark:hover:bg-white/50"
              }`}
            />
          );
        })}
      </div>

      {/* Right: Chevron Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          aria-label="Previous Product"
          title="Previous Product"
          className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 active:scale-95 border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-700 dark:text-white transition-all shadow-sm backdrop-blur-md"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNext}
          aria-label="Next Product"
          title="Next Product"
          className="w-10 h-10 rounded-2xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 active:scale-95 border border-slate-200 dark:border-white/15 flex items-center justify-center text-slate-700 dark:text-white transition-all shadow-sm backdrop-blur-md"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
