/**
 * RelatedLinks — renders a group of contextual internal links.
 * Uses wouter <Link> for SPA navigation; dedupes by href.
 */

import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import type { InternalLink } from "../../lib/seo/internalLinks";
import { dedupeInternalLinks } from "../../lib/seo/internalLinks";

interface RelatedLinksProps {
  links: InternalLink[];
  title?: string;
  maxColumns?: 2 | 3;
}

export function RelatedLinks({ links, title = "Explore More", maxColumns = 3 }: RelatedLinksProps) {
  const unique = dedupeInternalLinks(links);
  if (unique.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-16">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h2>
      <div className={`grid sm:grid-cols-2 ${maxColumns === 3 ? "lg:grid-cols-3" : ""} gap-3`}>
        {unique.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-100 dark:border-gray-700/60 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all"
          >
            <div className="min-w-0">
              {link.group && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-1">
                  {link.group}
                </p>
              )}
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                {link.label}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-purple-500 dark:group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>
    </section>
  );
}
