import { AD_GROUPS, type AdGroup } from "../data/adsData";
import { PACKAGES, type AdPackage } from "../data/packagesData";
import { PLATFORMS_DATA, type Platform } from "../data/platformsData";
import productsSeed from "../data/products.json";
import { saveGenericFirebaseDoc, useFirebaseDoc, CATALOG_CACHE_TTL_MS } from "./useApi";

export interface ProductEntry {
  id: string;
  title: string;
  price: string;
  compare_price?: string;
  image: string;
  product_url?: string;
  platform: string;
  rating?: number;
  reviews?: number;
  description?: string;
}

export interface ProductCategory {
  category_name: string;
  products: ProductEntry[];
}

export interface ProductPlatform {
  name: string;
  url?: string;
  logo?: string;
  color?: string;
  categories: ProductCategory[];
}

export interface ProductsCatalog {
  id?: string;
  platform: string;
  version: string;
  platforms: ProductPlatform[];
}

const productsFallback: ProductsCatalog = { id: "products", ...(productsSeed as ProductsCatalog) };
const platformsFallback = { platforms: PLATFORMS_DATA };
const packagesFallback = { packages: PACKAGES };
const adGroupsFallback = { groups: [] }; // Empty fallback - no local data

export function useProductsCatalog() {
  return useFirebaseDoc<ProductsCatalog>("catalogs", "products", productsFallback, {
    renderFallbackImmediately: true,
    cacheTtl: CATALOG_CACHE_TTL_MS,
  });
}

export function usePlatformsCatalog() {
  return useFirebaseDoc<{ platforms: Platform[] }>("catalogs", "platforms", platformsFallback, {
    cacheTtl: CATALOG_CACHE_TTL_MS,
  });
}

export function usePackagesCatalog() {
  return useFirebaseDoc<{ packages: AdPackage[] }>("catalogs", "packages", packagesFallback, {
    cacheTtl: CATALOG_CACHE_TTL_MS,
  });
}

export function useAdGroupsCatalog() {
  return useFirebaseDoc<{ groups: AdGroup[] }>("catalogs", "adGroups", adGroupsFallback, {
    cacheTtl: CATALOG_CACHE_TTL_MS,
  });
}

export async function saveProductsCatalog(data: ProductsCatalog) {
  return saveGenericFirebaseDoc("catalogs", "products", { id: "products", ...data });
}

export async function savePlatformsCatalog(platforms: Platform[]) {
  return saveGenericFirebaseDoc("catalogs", "platforms", { id: "platforms", platforms });
}

export async function savePackagesCatalog(packages: AdPackage[]) {
  return saveGenericFirebaseDoc("catalogs", "packages", { id: "packages", packages });
}

export async function saveAdGroupsCatalog(groups: AdGroup[]) {
  return saveGenericFirebaseDoc("catalogs", "adGroups", { id: "adGroups", groups });
}
