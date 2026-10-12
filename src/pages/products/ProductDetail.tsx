/**
 * ProductDetail — /products/:slug
 * Public product detail page with real catalog data, external outbound link,
 * Product JSON-LD, breadcrumbs and related products.
 */

import { Link, useParams } from "wouter";
import { ArrowLeft, ExternalLink, Star, ShoppingCart, PackageCheck, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { RelatedLinks } from "../../components/seo/RelatedLinks";
import { PageMeta } from "../../components/seo/PageMeta";
import { JsonLd } from "../../components/seo/JsonLd";
import { useProductsCatalog } from "../../hooks/useCatalogs";
import { ProductCard } from "../../components/ProductCard";
import { resolveProduct, getRelatedProducts } from "../../lib/storefront";
import { productSchema } from "../../lib/seo/jsonld";
import { buildInternalLinks } from "../../lib/seo/internalLinks";
import { productUrl, categoryUrl, isExternalUrl, isSafeLinkUrl } from "../../lib/seo/urls";

function StarRating({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= rounded
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-100 text-gray-200 dark:fill-gray-700 dark:text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function formatReviews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data: catalog, loading } = useProductsCatalog();
  const flat = resolveProduct(catalog, slug);

  if (!flat && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-grow flex flex-col items-center justify-center px-4 py-24 text-center">
          <PageMeta meta={{ title: "Product Not Found", description: "The product you're looking for does not exist.", noindex: true }} />
          <ShoppingCart className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Product Not Found</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">The product you're looking for doesn't exist or was removed.</p>
          <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (!flat) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  const { product, platform, category, href } = flat;
  const title = `${product.title} — Best Price & Deals`;
  const description =
    product.description ||
    `Buy ${product.title} on ${platform}. Compare prices, ratings and deals.`;
  const outbound = isExternalUrl(product.product_url || "") && isSafeLinkUrl(product.product_url || "");
  const related = getRelatedProducts(catalog, flat, 4);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header />
      <PageMeta
        meta={{
          title,
          description,
          canonical: productUrl(product.id, product.title),
          ogType: "product",
          ogImage: product.image || undefined,
        }}
      />
      <JsonLd data={productSchema(product)} />
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-6">
          <Breadcrumbs path={href} />
        </div>

        <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-6 pb-12">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Image */}
            <div className="relative overflow-hidden rounded-3xl bg-gray-100 dark:bg-gray-800" style={{ aspectRatio: "4/3" }}>
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover"
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    img.parentElement?.classList.add("fallback-shown");
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 dark:from-gray-700 dark:via-gray-700 dark:to-gray-600">
                  <ShoppingCart className="h-12 w-12 text-purple-300 dark:text-purple-400 mb-2 opacity-60" />
                  <span className="text-lg font-bold text-purple-400 dark:text-purple-300 opacity-80">
                    {product.title.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
                  </span>
                </div>
              )}
              <span className="absolute top-4 left-4 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 shadow-sm">
                {platform}
              </span>
            </div>

            {/* Info */}
            <div className="flex flex-col min-w-0">
              <nav aria-label="category" className="mb-3">
                <Link
                  href={categoryUrl(platform, category)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  {category}
                </Link>
              </nav>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight mb-3">
                {product.title}
              </h1>

              {(product.rating || product.reviews) && (
                <div className="flex items-center gap-2 mb-4">
                  {product.rating != null && <StarRating rating={product.rating} />}
                  {product.rating != null && (
                    <span className="text-sm font-medium text-foreground">
                      {product.rating.toFixed(1)}
                    </span>
                  )}
                  {product.reviews != null && (
                    <span className="text-sm text-muted-foreground">
                      ({formatReviews(product.reviews)} reviews)
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-baseline gap-2.5 mb-5">
                {product.price && (
                  <span className="text-3xl font-black text-primary">
                    {product.price}
                  </span>
                )}
                {product.compare_price && (
                  <span className="text-lg text-muted-foreground line-through">{product.compare_price}</span>
                )}
              </div>

              {product.description && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-6">
                  {product.description}
                </p>
              )}

              {outbound ? (
                <a
                  href={product.product_url!}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-md mb-6"
                >
                  View on {platform} <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(product.title + " " + platform)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-md mb-6"
                >
                  Explore Offer on {platform} <ExternalLink className="h-4 w-4" />
                </a>
              )}

              {/* Trust badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-auto pt-6 border-t border-gray-100 dark:border-gray-800">
                {[
                  { icon: Truck, label: "Fast Delivery" },
                  { icon: RotateCcw, label: "Easy Returns" },
                  { icon: ShieldCheck, label: "Secure Checkout" },
                  { icon: PackageCheck, label: "Verified Sellers" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Icon className="h-4 w-4 text-purple-500 dark:text-purple-400" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Related products */}
        {related.length > 0 && (
          <section className="max-w-7xl mx-auto px-3 sm:px-6 pb-16">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-5">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {related.map(item => (
                <ProductCard key={item.product.id} product={item.product} />
              ))}
            </div>
          </section>
        )}

        <RelatedLinks
          title="Explore More"
          links={buildInternalLinks({ kind: "product", product: flat }, catalog, { limit: 6 })}
        />
      </main>
      <Footer />
    </div>
  );
}
