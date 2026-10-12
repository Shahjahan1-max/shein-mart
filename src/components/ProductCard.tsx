import { ExternalLink, Star, ShoppingCart } from "lucide-react";
import { useLocation } from "wouter";
import { productSlug } from "../lib/seo/urls";

interface Product {
  id: string;
  title: string;
  price?: string | null;
  compare_price?: string | null;
  image?: string | null;
  product_url?: string | null;
  platform: string;
  rating?: number | null;
  reviews?: number | null;
  description?: string | null;
}

const PLATFORM_BADGE: Record<string, string> = {
  Amazon:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-200/60 dark:ring-orange-800/40",
  Alibaba:    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200/60 dark:ring-amber-800/40",
  AliExpress: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-200/60 dark:ring-red-800/40",
};

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i <= rounded
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-100 text-gray-200 dark:fill-gray-700 dark:text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function ImageFallback({ title }: { title: string }) {
  const initials = title
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-gray-700 dark:via-gray-700 dark:to-gray-600">
      <ShoppingCart className="h-8 w-8 text-purple-300 dark:text-purple-400 mb-2 opacity-60" />
      <span className="text-base font-bold text-purple-400 dark:text-purple-300 opacity-80">{initials}</span>
    </div>
  );
}

function formatReviews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString();
}

function calcDiscount(price: string, comparePrice: string): number | null {
  const p = parseFloat(price.replace(/[^0-9.]/g, ""));
  const c = parseFloat(comparePrice.replace(/[^0-9.]/g, ""));
  if (!p || !c || c <= p) return null;
  return Math.round(((c - p) / c) * 100);
}

export function ProductCard({ product }: { product: Product }) {
  const [, navigate] = useLocation();
  const badgeClass = PLATFORM_BADGE[product.platform] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  const hasLink = Boolean(product.product_url);
  const internalHref = `/products/${productSlug(product.id, product.title)}`;
  const discount =
    product.price && product.compare_price
      ? calcDiscount(product.price, product.compare_price)
      : null;

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`View details for ${product.title}`}
      onClick={() => navigate(internalHref)}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(internalHref);
        }
      }}
      className="group flex flex-col bg-white dark:bg-gray-800/90 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-xl hover:shadow-gray-200/60 dark:hover:shadow-black/30 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden min-w-0 cursor-pointer"
    >

      {/* Image */}
      <div className="relative overflow-hidden bg-gray-50 dark:bg-gray-700/50" style={{ aspectRatio: "4/3" }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            width={400}
            height={300}
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={e => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
              img.parentElement?.classList.add("fallback-shown");
            }}
            loading="lazy"
          />
        ) : (
          <ImageFallback title={product.title} />
        )}

        {/* Platform badge */}
        <span className={`absolute top-2.5 left-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {product.platform}
        </span>

        {/* Discount badge */}
        {discount && discount >= 5 && (
          <span className="absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white shadow-sm">
            -{discount}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3 gap-2 min-w-0">

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
          {product.title}
        </h3>

        {/* Description */}
        {product.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 leading-relaxed flex-1">
            {product.description}
          </p>
        )}

        {/* Rating */}
        {(product.rating || product.reviews) && (
          <div className="flex items-center gap-1.5">
            {product.rating != null && <StarRating rating={product.rating} />}
            {product.rating != null && (
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {product.rating.toFixed(1)}
              </span>
            )}
            {product.reviews != null && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                ({formatReviews(product.reviews)})
              </span>
            )}
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1 min-w-0">
          <div className="min-w-0 flex-1">
            {product.price ? (
              <div className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
                <span className="text-base font-extrabold text-purple-700 dark:text-purple-400 leading-none">
                  {product.price}
                </span>
                {product.compare_price && (
                  <span className="text-xs text-gray-400 line-through leading-none">
                    {product.compare_price}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">Check price</span>
            )}
          </div>

          {hasLink && (
            <a
              href={product.product_url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 px-3 py-1.5 rounded-lg transition-colors shadow-sm hover:shadow-purple-200 dark:hover:shadow-purple-900/30"
              aria-label={`View ${product.title} on ${product.platform}`}
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
