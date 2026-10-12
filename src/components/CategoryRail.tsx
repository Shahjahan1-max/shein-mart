import { ProductCard } from "./ProductCard";
import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { categoryUrl } from "../lib/seo/urls";

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

interface CategoryRailProps {
  platformName: string;
  categoryName: string;
  products: Product[];
  platformColor: string;
}

export function CategoryRail({ platformName, categoryName, products, platformColor }: CategoryRailProps) {
  if (!products || products.length === 0) return null;

  return (
    <div className="mb-10 sm:mb-12">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Color accent */}
          <div
            className="h-8 w-1 rounded-full flex-shrink-0"
            style={{ backgroundColor: platformColor }}
          />
          <div className="min-w-0">
            <p
              className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: platformColor }}
            >
              {platformName}
            </p>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
              {categoryName}
            </h3>
          </div>
        </div>

        <Link
          href={categoryUrl(platformName, categoryName)}
          className="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 bg-gray-100 dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-3 py-1.5 rounded-full transition-colors"
        >
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {products.slice(0, 5).map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
