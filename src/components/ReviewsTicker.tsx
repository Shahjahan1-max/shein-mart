import { Star, Quote } from "lucide-react";
import { LPReview } from "../data/landingPageData";
import { useLandingPageSettings } from "../hooks/useLandingPageSettings";
import { useLang } from "../contexts/LangContext";
import { translateDisplayText } from "../data/displayTranslations";

const COLORS = [
  "bg-purple-600", "bg-indigo-600", "bg-blue-600", "bg-teal-600",
  "bg-green-600", "bg-orange-600", "bg-red-600", "bg-pink-600",
];

function ReviewCard({ review, colorIdx }: { review: LPReview; colorIdx: number }) {
  return (
    <div className="flex-shrink-0 w-72 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm mx-3 relative overflow-hidden">
      <Quote className="absolute top-3 right-3 h-8 w-8 text-purple-100 dark:text-purple-900" />
      <div className="flex items-center gap-3 mb-3">
        <div className={`${COLORS[colorIdx % COLORS.length]} h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
          {review.avatar}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{review.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{review.location}</p>
        </div>
      </div>
      <div className="flex gap-0.5 mb-2">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 dark:text-gray-600"}`} />
        ))}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">{review.text}</p>
    </div>
  );
}

export function ReviewsTicker() {
  const { data: cfg } = useLandingPageSettings();
  const { lang } = useLang();

  if (!cfg.visibility.showReviews) return null;

  const activeReviews = cfg.reviews.filter(r => r.active);
  if (activeReviews.length === 0) return null;

  const doubled = [...activeReviews, ...activeReviews];
  const { title, subtitle } = cfg.reviewsSection;

  return (
    <section className="py-12 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-900/50 dark:to-indigo-900/20 overflow-hidden">
      <div className="text-center mb-8 px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{translateDisplayText(title, lang)}</h2>
        <p className="text-gray-500 dark:text-gray-400">{translateDisplayText(subtitle, lang)}</p>
      </div>

      <div className="relative">
        <div className="flex animate-[marquee_45s_linear_infinite]">
          {doubled.map((review, i) => (
            <ReviewCard key={`${review.id}-${i}`} review={review} colorIdx={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
