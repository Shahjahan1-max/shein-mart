/**
 * Footer Component
 * Enterprise-grade footer with navigation, newsletter, and trust signals
 */

import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { ExternalLink, Send, Twitter, Facebook, Instagram, Youtube, ArrowUpRight, Heart, Linkedin } from 'lucide-react';

export interface FooterProps {
  siteName?: string;
  logo?: ReactNode;
  description?: string;
  socialLinks?: { platform: string; href: string; label?: string }[];
  navigation?: { title: string; links: { label: string; href: string; external?: boolean }[] }[];
  newsletter?: {
    title: string;
    description: string;
    placeholder: string;
    buttonText: string;
    onSubmit: (email: string) => void;
  };
  copyright?: string;
  showBackToTop?: boolean;
  className?: string;
  telegramSupport?: string;
}

const SOCIAL_ICONS: Record<string, React.ElementType> = {
  twitter: Twitter,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  telegram: Send,
  linkedin: Linkedin,
};

function SocialIcon({ platform, href, label }: { platform: string; href: string; label?: string }) {
  const Icon = SOCIAL_ICONS[platform.toLowerCase()] ?? ExternalLink;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label || platform}
      className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-purple-600 text-gray-400 hover:text-white transition-all duration-200 flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-purple-900/30"
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

export function Footer({
  siteName = 'DealXStocks',
  logo,
  description,
  socialLinks = [],
  navigation = [],
  newsletter,
  copyright,
  showBackToTop = true,
  className,
  telegramSupport,
}: FooterProps) {
  const siteParts = siteName.split(' ');

  return (
    <footer className={cn('bg-gray-950 text-gray-300', className)}>
      {/* Top gradient divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-purple-800/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-8">
        {/* Main footer grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-6 lg:gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 md:col-span-6 lg:col-span-3">
            {/* Logo + name */}
            <a href="/" className="flex items-center gap-3 mb-4 group w-fit">
              {logo || (
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-slate-900 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-white font-extrabold text-sm">DX</span>
                </div>
              )}
              <span className="text-lg font-extrabold text-white leading-none">
                {siteParts.length > 1 ? (
                  <>
                    {siteParts[0]}
                    <span className="text-primary"> {siteParts.slice(1).join(" ")}</span>
                  </>
                ) : (
                  siteName
                )}
              </span>
            </a>

          {description && (
            <p className="text-xs text-gray-400 leading-relaxed mb-4 max-w-[260px]">
              {description}
            </p>
          )}

          {/* Socials */}
          {socialLinks.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {socialLinks.map(s => <SocialIcon key={s.platform} platform={s.platform} href={s.href} label={s.label} />)}
            </div>
          )}

          {/* Telegram CTA */}
          {telegramSupport && (
            <a
              href={telegramSupport}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary-foreground text-xs font-medium rounded-xl transition-all group"
            >
              <Send className="h-3.5 w-3.5" />
              Chat on Telegram
              <ArrowUpRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </a>
          )}
          </div>

          {/* Link groups */}
          {navigation.map(group => (
            <div key={group.title} className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-2">
              <h4 className="text-white font-extrabold text-xs uppercase tracking-wider mb-3">
                {group.title}
              </h4>
              <ul className="space-y-1.5">
                {group.links.filter(l => l.href).map(link => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className="text-xs text-gray-400 hover:text-primary hover:translate-x-0.5 transition-all flex items-center gap-1.5 group w-fit"
                    >
                      <span>{link.label}</span>
                      {link.external && (
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity flex-shrink-0" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        {newsletter && (
          <div className="col-span-full lg:col-span-2 mt-8 pt-8 border-t border-gray-800/50">
            <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-white font-semibold text-lg mb-1">{newsletter.title}</h4>
                  <p className="text-purple-300 text-sm">{newsletter.description}</p>
                </div>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const email = formData.get('email') as string;
                    if (email) newsletter.onSubmit(email);
                  }}
                  className="w-full sm:w-[320px] flex gap-2"
                >
                  <input
                    type="email"
                    name="email"
                    placeholder={newsletter.placeholder}
                    required
                    className="flex-1 px-4 py-3 text-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white/5"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
                  >
                    {newsletter.buttonText}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div className="col-span-full mt-8 pt-8 border-t border-gray-800/50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              {copyright && <span>{copyright}</span>}
              <span className="hidden sm:inline text-gray-700 mx-1">·</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-gray-500">
                Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" /> for growth
              </span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="/login"
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                Sign In
              </a>
              <span className="text-gray-700 text-xs">·</span>
              <a
                href="/register"
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
              >
                Get Started
              </a>
              {telegramSupport && (
                <>
                  <span className="text-gray-700 text-xs">·</span>
                  <a
                    href={telegramSupport}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-blue-400 transition-colors flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" /> Support
                  </a>
                </>
              )}
              {showBackToTop && (
                <>
                  <span className="text-gray-700 text-xs">·</span>
                  <a
                    href="#top"
                    className="text-xs text-gray-500 hover:text-purple-400 transition-colors flex items-center gap-1"
                  >
                    <ArrowUpRight className="h-3 w-3" /> Top
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}