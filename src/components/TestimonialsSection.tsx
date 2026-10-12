/**
 * TestimonialsSection — social proof grid for the homepage and /resources.
 * Renders star ratings + quotes from TESTIMONIALS data.
 */

import { Star, Quote } from "lucide-react";
import { TESTIMONIALS, averageTestimonialRating } from "../data/testimonials";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`}
        />
      ))}
    </div>
  );
}

export function TestimonialsSection({ limit = 6 }: { limit?: number }) {
  const avg = averageTestimonialRating();
  const items = TESTIMONIALS.slice(0, limit);

  return (
    <section id="testimonials" className="py-10 sm:py-14 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="text-center mb-8 sm:mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 mb-1">
          Social Proof
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Loved by Shoppers & Earners Worldwide
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl mx-auto">
          {TESTIMONIALS.length} verified-style reviews across deal hunting, marketplace sourcing and earning —{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-300">{avg}/5 average rating</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {items.map(t => (
          <figure
            key={t.author}
            className="p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700/60 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <Stars rating={t.rating} />
              <Quote className="h-4 w-4 text-purple-300 dark:text-purple-600" />
            </div>
            <blockquote className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4 flex-grow">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="border-t border-gray-100 dark:border-gray-700/60 pt-3">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{t.author}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t.role} · {t.location}
              </p>
              <span className="mt-1.5 inline-block text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-600/10 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
                {t.context}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
