import { useState } from "react";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";
import { Breadcrumbs } from "../../components/seo/Breadcrumbs";
import { ProductCard } from "../../components/ProductCard";
import { useProductsCatalog } from "../../hooks/useCatalogs";
import { flattenCatalog } from "../../lib/storefront";
import { ShoppingBag, Search, Filter } from "lucide-react";

export default function AllProductsPage() {
  const [search, setSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("All");

  const { data: catalog, loading } = useProductsCatalog();
  const products = flattenCatalog(catalog).map(f => f.product);
  const platforms = ["All", "Amazon", "Alibaba", "AliExpress", "eBay"];

  const filtered = products.filter(p => {
    const matchSearch =
      !search.trim() ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchPlatform = selectedPlatform === "All" || p.platform === selectedPlatform;
    return matchSearch && matchPlatform;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <Header search={search} onSearchChange={setSearch} showNotifications={false} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Breadcrumbs items={[{ label: "Products Catalog" }]} path="/products" />

        <div className="mb-8 border-b border-border pb-6 mt-4">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" />
            Complete Products & Deals Catalog
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Explore thousands of indexed product deals, price comparisons, and marketplace offers across Amazon, Alibaba, AliExpress, and eBay.
          </p>
        </div>

        {/* Platform Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-card p-4 rounded-2xl border border-card-border shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Platform:
            </span>
            {platforms.map(p => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedPlatform === p
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filtered.length}</strong> products
          </span>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-card-border shadow-sm">
            <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-bold text-foreground mb-1">No products match your filter</h3>
            <p className="text-xs text-muted-foreground mb-4">Try clearing your search query or switching marketplace filters.</p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedPlatform("All");
              }}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filtered.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
