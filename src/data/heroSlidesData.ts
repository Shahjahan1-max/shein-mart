import productsSeed from "./products.json";
import { normalizeExternalImageUrl } from "../lib/imageUrl";

export interface HeroSlideItem {
  id: string;
  productId: string;
  eyebrow: string;
  title: string;
  category: string;
  platform: string;
  price: string;
  comparePrice?: string;
  rating?: number;
  reviews?: number;
  description: string;
  brandMessage: string;
  image: string;
  link: string;
  badge: string;
}

// 10 Featured Real Products selected directly from productsSeed matching exact JSON IDs
const TARGET_PRODUCT_IDS = [
  { id: "amz-el-5", brandMessage: "Immerse yourself in active noise cancellation with curated audio deals." },
  { id: "amz-el-4", brandMessage: "Premium wireless acoustic comfort verified across top global sellers." },
  { id: "amz-el-2", brandMessage: "Elevate your digital reading library with verified marketplace savings." },
  { id: "amz-sh-2", brandMessage: "Smart home security essentials evaluated for maximum value." },
  { id: "amz-hk-2", brandMessage: "Next-gen kitchen technology for healthier daily cooking." },
  { id: "ali-ec-1", brandMessage: "High-fidelity portable TWS audio engineered for global performance." },
  { id: "ali-ec-2", brandMessage: "Portable solar power backup designed for outdoor reliability." },
  { id: "aex-gt-1", brandMessage: "Mini wireless keyboard & touchpad for multi-device workflows." },
  { id: "aex-gt-2", brandMessage: "7-in-1 USB-C multiport hub adapter for modern laptops." },
  { id: "amz-el-1", brandMessage: "Voice-assisted smart audio designed for seamless daily convenience." },
];

function extract10HeroSlides(): HeroSlideItem[] {
  const slides: HeroSlideItem[] = [];
  const platforms = productsSeed.platforms || [];

  for (const target of TARGET_PRODUCT_IDS) {
    let found = false;
    for (const pl of platforms) {
      for (const cat of pl.categories) {
        const prod = cat.products.find(p => p.id === target.id);
        if (prod) {
          slides.push({
            id: prod.id,
            productId: prod.id,
            eyebrow: `${pl.name.toUpperCase()} · ${cat.category_name.toUpperCase()}`,
            title: prod.title,
            category: cat.category_name,
            platform: pl.name,
            price: prod.price,
            comparePrice: prod.compare_price,
            rating: prod.rating,
            reviews: prod.reviews,
            description: prod.description || "Discover verified marketplace deals and authentic product stock on DealX Stocks.",
            brandMessage: target.brandMessage,
            image: normalizeExternalImageUrl(prod.image),
            link: `/products/${prod.id}`,
            badge: "FEATURED DEAL",
          });
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  return slides;
}

export const HERO_SLIDES: HeroSlideItem[] = extract10HeroSlides();
