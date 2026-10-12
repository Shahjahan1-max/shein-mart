import React from "react";

interface HeroBackgroundProps {
  productImage?: string;
  motionPhase?: "entering" | "holding" | "exiting";
  isReducedMotion?: boolean;
  discount?: string;
}

export function HeroBackground({ productImage, motionPhase = "holding", isReducedMotion = false, discount }: HeroBackgroundProps) {
  const imgStyle = (): React.CSSProperties => {
    if (isReducedMotion) return { opacity: motionPhase === "holding" ? 1 : 0.2, transition: "opacity 400ms ease-out" };
    if (motionPhase === "entering") return { opacity: 1, transform: "scale(1) translate3d(0,0,0)", transition: "transform 900ms cubic-bezier(0.16,1,0.3,1), opacity 700ms ease-out" };
    if (motionPhase === "exiting") return { opacity: 0, transform: "scale(1.06) translate3d(20px,0,0)", transition: "transform 700ms ease-in, opacity 500ms ease-in" };
    return { opacity: 1, transform: "scale(1) translate3d(0,0,0)", transition: "none" };
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">

      {/* Light theme subtle gradient mesh */}
      <div className="absolute inset-0 block dark:hidden"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(219,234,254,0.7) 0%, transparent 65%), radial-gradient(ellipse 60% 80% at 80% 30%, rgba(238,242,255,0.7) 0%, transparent 60%)"
        }}
      />

      {/* Dark theme deep cinematic base & gradient mesh */}
      <div className="absolute inset-0 hidden dark:block bg-[#04080F]" />
      <div className="absolute inset-0 hidden dark:block"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(15,40,80,0.85) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 30%, rgba(8,20,50,0.7) 0%, transparent 55%)"
        }}
      />

      {/* Right product image showcase */}
      {productImage && (
        <div className="absolute inset-y-0 right-0 w-[55%] flex items-center justify-center" style={imgStyle()}>
          {/* Ambient glow behind product */}
          <div className="absolute inset-0 dark:hidden"
            style={{ background: "radial-gradient(ellipse 70% 80% at 60% 50%, rgba(37,99,235,0.08) 0%, rgba(99,102,241,0.05) 40%, transparent 70%)" }}
          />
          <div className="absolute inset-0 hidden dark:block"
            style={{ background: "radial-gradient(ellipse 70% 80% at 60% 50%, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.08) 40%, transparent 70%)" }}
          />
          <img
            src={productImage}
            alt="Featured Product"
            width={600}
            height={520}
            fetchPriority="high"
            decoding="async"
            className="relative z-10 h-[78%] max-h-[520px] w-auto max-w-[92%] object-contain"
            style={{
              filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.14)) drop-shadow(0 0 40px rgba(37,99,235,0.08))",
            }}
          />
        </div>
      )}

      {/* Left panel — gradient overlay for text legibility */}
      <div className="absolute inset-0 block dark:hidden"
        style={{ background: "linear-gradient(to right, #F8FAFC 0%, #F8FAFC 35%, rgba(248,250,252,0.92) 50%, rgba(248,250,252,0.45) 68%, transparent 85%)" }}
      />
      <div className="absolute inset-0 hidden dark:block"
        style={{ background: "linear-gradient(to right, #04080F 0%, #04080F 35%, rgba(4,8,15,0.88) 50%, rgba(4,8,15,0.30) 65%, transparent 80%)" }}
      />

      {/* Top/bottom subtle vignette */}
      <div className="absolute inset-0 hidden dark:block"
        style={{ background: "linear-gradient(to bottom, rgba(4,8,15,0.55) 0%, transparent 25%, transparent 70%, rgba(4,8,15,0.80) 100%)" }}
      />

      {/* Floating orbs in dark mode */}
      <div className="absolute top-[15%] left-[8%] w-72 h-72 rounded-full opacity-20 dark:opacity-25 blur-[100px]"
        style={{ background: "radial-gradient(circle, rgba(56,189,248,1) 0%, rgba(99,102,241,1) 60%, transparent 100%)" }}
      />
      <div className="absolute bottom-[10%] left-[25%] w-56 h-56 rounded-full opacity-10 dark:opacity-15 blur-[90px]"
        style={{ background: "radial-gradient(circle, rgba(251,191,36,1) 0%, rgba(249,115,22,1) 60%, transparent 100%)" }}
      />

      {/* Subtle dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.028]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />

      {/* Horizontal accent line */}
      <div className="absolute left-0 right-0 bottom-[88px] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
