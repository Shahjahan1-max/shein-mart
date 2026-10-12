/**
 * CtaBanner — reusable conversion banner with a clear CTA hierarchy:
 * one primary action, one secondary action and an optional tertiary link.
 */

import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "../lib/analytics";

export interface CtaAction {
  label: string;
  href: string;
  primary?: boolean;
  external?: boolean;
}

interface CtaBannerProps {
  title: string;
  subtitle?: string;
  actions: CtaAction[];
}

function trackCtaClick(action: CtaAction, bannerTitle: string) {
  trackEvent("cta_click", {
    label: action.label,
    href: action.href,
    primary: action.primary === true,
    banner: bannerTitle,
  });
}

export function CtaBanner({ title, subtitle, actions }: CtaBannerProps) {
  return (
    <section className="py-8 sm:py-12 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 via-violet-700 to-indigo-700 px-6 sm:px-10 py-10 sm:py-14 text-center">
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,white,transparent_40%),radial-gradient(circle_at_70%_80%,white,transparent_35%)]" />
        <div className="relative">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm sm:text-base text-purple-100/90 max-w-2xl mx-auto mb-7">{subtitle}</p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {actions.map(action => {
              const className = action.primary
                ? "inline-flex items-center gap-2 bg-white text-purple-700 font-bold px-6 py-3 rounded-full hover:bg-purple-50 transition-colors shadow-lg"
                : "inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-6 py-3 rounded-full hover:bg-white/10 transition-colors";
              if (action.external) {
                return (
                  <a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer" className={className} onClick={() => trackCtaClick(action, title)}>
                    {action.label} <ArrowRight className="h-4 w-4" />
                  </a>
                );
              }
              return (
                <Link key={action.label} href={action.href} className={className} onClick={() => trackCtaClick(action, title)}>
                  {action.label} <ArrowRight className="h-4 w-4" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function defaultEarnCtaActions(): CtaAction[] {
  return [
    { label: "Start Earning Free", href: "/register", primary: true },
    { label: "Browse Today's Deals", href: "/deals" },
    { label: "Talk to Us", href: "/contact" },
  ];
}
