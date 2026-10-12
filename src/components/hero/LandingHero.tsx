import React, { useState, useEffect, useRef, useCallback } from "react";
import { HERO_SLIDES, type HeroSlideItem } from "../../data/heroSlidesData";
import { HeroBackground } from "./HeroBackground";
import { HeroContent } from "./HeroContent";
import { HeroControls } from "./HeroControls";

const ENTER_MS = 800;
const HOLD_MS = 2500;
const EXIT_MS = 800;

export function LandingHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [motionPhase, setMotionPhase] = useState<"entering" | "holding" | "exiting">("holding");
  const [isPaused, setIsPaused] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setIsReducedMotion(mediaQuery.matches);
      const handleChange = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } catch {}
  }, []);

  // Preload next image in sequence
  useEffect(() => {
    if (HERO_SLIDES.length <= 1) return;
    const nextIdx = (activeIndex + 1) % HERO_SLIDES.length;
    const nextImage = HERO_SLIDES[nextIdx]?.image;
    if (nextImage) {
      const img = new Image();
      img.src = nextImage;
    }
  }, [activeIndex]);

  // Master slide progression trigger
  const triggerNextSlide = useCallback((targetIndex?: number) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);

    const nextIdx = targetIndex !== undefined
      ? targetIndex
      : (activeIndexRef.current + 1) % HERO_SLIDES.length;

    // Start Exit Phase of current slide
    setMotionPhase("exiting");

    transitionTimerRef.current = setTimeout(() => {
      // Transition to next index and enter phase
      setActiveIndex(nextIdx);
      setMotionPhase("entering");

      transitionTimerRef.current = setTimeout(() => {
        // Hold phase
        setMotionPhase("holding");
      }, ENTER_MS);
    }, EXIT_MS);
  }, []);

  const triggerPrevSlide = useCallback(() => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    const prevIdx = (activeIndexRef.current - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
    triggerNextSlide(prevIdx);
  }, [triggerNextSlide]);

  // Auto rotation timer loop - Runs continuously by default
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      if (!isPausedRef.current) {
        triggerNextSlide();
      }
    }, ENTER_MS + HOLD_MS + EXIT_MS);

    return () => {
      clearInterval(interval);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [isPaused, triggerNextSlide]);

  const currentSlide = HERO_SLIDES[activeIndex] || HERO_SLIDES[0];

  return (
    <section
      aria-label="Featured Marketplaces & Products Carousel"
      className="relative text-foreground overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100/70 dark:from-[#04080F] dark:via-[#070D18] dark:to-[#04080F] min-h-[600px] sm:min-h-[660px] flex flex-col justify-center select-none border-b border-border transition-colors duration-300"
    >
      {/* Background Component rendering active product image full-form in background */}
      <HeroBackground
        productImage={currentSlide.image}
        motionPhase={motionPhase}
        isReducedMotion={isReducedMotion}
      />

      {/* Main Container */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full flex flex-col justify-between flex-1 z-10">
        {/* Content Row: Left Text & Deal Details */}
        <div className="flex items-center min-h-[400px] sm:min-h-[440px] my-auto">
          <HeroContent
            slide={currentSlide}
            motionPhase={motionPhase}
            isReducedMotion={isReducedMotion}
          />
        </div>

        {/* Bottom Controls Bar */}
        <HeroControls
          slides={HERO_SLIDES}
          activeIndex={activeIndex}
          onSelectSlide={idx => triggerNextSlide(idx)}
          onPrev={triggerPrevSlide}
          onNext={() => triggerNextSlide()}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused(p => !p)}
        />
      </div>
    </section>
  );
}
