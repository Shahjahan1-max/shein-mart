import { useMemo } from "react";
import {
  DEFAULT_LANDING_PAGE,
  type LandingPageSettings,
} from "../data/landingPageData";
import { saveGenericFirebaseDoc, useFirebaseDoc, useSettings, CATALOG_CACHE_TTL_MS } from "./useApi";

function mergeLandingPage(data?: Partial<LandingPageSettings> | null): LandingPageSettings {
  const p = data ?? {};
  return {
    ...DEFAULT_LANDING_PAGE,
    ...p,
    hero: {
      ...DEFAULT_LANDING_PAGE.hero,
      ...(p.hero ?? {}),
      stats: Array.isArray(p.hero?.stats) ? p.hero.stats : DEFAULT_LANDING_PAGE.hero.stats,
      trustBadges: Array.isArray(p.hero?.trustBadges) ? p.hero.trustBadges : DEFAULT_LANDING_PAGE.hero.trustBadges,
    },
    heroButtons: Array.isArray(p.heroButtons) ? p.heroButtons : DEFAULT_LANDING_PAGE.heroButtons,
    navLinks: Array.isArray(p.navLinks) ? p.navLinks : DEFAULT_LANDING_PAGE.navLinks,
    marketplaceSection: p.marketplaceSection
      ? { ...DEFAULT_LANDING_PAGE.marketplaceSection, ...p.marketplaceSection }
      : DEFAULT_LANDING_PAGE.marketplaceSection,
    marketplaceCards: Array.isArray(p.marketplaceCards) ? p.marketplaceCards : DEFAULT_LANDING_PAGE.marketplaceCards,
    support: p.support
      ? {
          ...DEFAULT_LANDING_PAGE.support,
          ...p.support,
          cards: Array.isArray(p.support.cards) ? p.support.cards : DEFAULT_LANDING_PAGE.support.cards,
        }
      : DEFAULT_LANDING_PAGE.support,
    reviews: Array.isArray(p.reviews) ? p.reviews : DEFAULT_LANDING_PAGE.reviews,
    reviewsSection: p.reviewsSection
      ? { ...DEFAULT_LANDING_PAGE.reviewsSection, ...p.reviewsSection }
      : DEFAULT_LANDING_PAGE.reviewsSection,
    footer: p.footer
      ? {
          ...DEFAULT_LANDING_PAGE.footer,
          ...p.footer,
          groups: Array.isArray(p.footer.groups) ? p.footer.groups : DEFAULT_LANDING_PAGE.footer.groups,
          socials: Array.isArray(p.footer.socials) ? p.footer.socials : DEFAULT_LANDING_PAGE.footer.socials,
        }
      : DEFAULT_LANDING_PAGE.footer,
    comingSoon: p.comingSoon
      ? { ...DEFAULT_LANDING_PAGE.comingSoon, ...p.comingSoon }
      : DEFAULT_LANDING_PAGE.comingSoon,
    cta: p.cta
      ? { ...DEFAULT_LANDING_PAGE.cta, ...p.cta }
      : DEFAULT_LANDING_PAGE.cta,
    visibility: { ...DEFAULT_LANDING_PAGE.visibility, ...(p.visibility ?? {}) },
    updatedAt: p.updatedAt ?? "",
  };
}

function syncSupportLinks(
  page: LandingPageSettings,
  settings?: { telegramSupport?: string; emailSupport?: string } | null,
): LandingPageSettings {
  const telegram = settings?.telegramSupport || "https://t.me/customerservice_160";
  const email = settings?.emailSupport || "support@dealstocks.com";
  const defaultFooterLinks = DEFAULT_LANDING_PAGE.footer.groups.flatMap(g => g.links);

  return {
    ...page,
    support: {
      ...page.support,
      cards: page.support.cards.map(card => {
        const def = DEFAULT_LANDING_PAGE.support.cards.find(c => c.id === card.id);
        if (!def || card.href !== def.href) return card;
        if (def.href.startsWith("https://t.me/")) return { ...card, href: telegram };
        if (def.href.startsWith("mailto:")) return { ...card, href: `mailto:${email}` };
        return card;
      }),
    },
    footer: {
      ...page.footer,
      socials: page.footer.socials.map(s => {
        const def = DEFAULT_LANDING_PAGE.footer.socials.find(fs => fs.id === s.id);
        if (s.platform === "telegram" && def && s.href === def.href) return { ...s, href: telegram };
        return s;
      }),
      groups: page.footer.groups.map(group => ({
        ...group,
        links: group.links.map(link => {
          if (link.id === "fl10") {
            const def = defaultFooterLinks.find(l => l.id === "fl10");
            if (def && link.href === def.href) return { ...link, href: telegram };
          }
          if (link.id === "fl11") {
            const def = defaultFooterLinks.find(l => l.id === "fl11");
            if (def && link.href === def.href) return { ...link, href: `mailto:${email}` };
          }
          return link;
        }),
      })),
    },
  };
}

export function useLandingPageSettings() {
  const page = useFirebaseDoc<LandingPageSettings>("landingPage", "main", DEFAULT_LANDING_PAGE, {
    renderFallbackImmediately: true,
    cacheTtl: CATALOG_CACHE_TTL_MS,
  });
  const { data: platformSettings } = useSettings<{ telegramSupport?: string; emailSupport?: string }>();
  const data = useMemo(
    () => syncSupportLinks(mergeLandingPage(page.data), platformSettings),
    [page.data, platformSettings],
  );
  return { ...page, data };
}

export async function saveLandingPageSettings(
  data: LandingPageSettings,
  adminUsername?: string,
): Promise<LandingPageSettings> {
  return saveGenericFirebaseDoc("landingPage", "main", {
    ...data,
    id: "main",
    status: "draft",
    updatedAt: new Date().toISOString(),
    updatedBy: adminUsername ?? "admin",
  } as LandingPageSettings & { id: string; status: string; updatedBy: string });
}

export async function publishLandingPageSettings(
  data: LandingPageSettings,
  adminUsername?: string,
): Promise<LandingPageSettings> {
  const now = new Date().toISOString();
  const dataRecord = data as unknown as Record<string, unknown>;
  const currentVersion = typeof dataRecord.version === "number"
    ? (dataRecord.version as number)
    : 0;
  return saveGenericFirebaseDoc("landingPage", "main", {
    ...data,
    id: "main",
    status: "published",
    updatedAt: now,
    publishedAt: now,
    updatedBy: adminUsername ?? "admin",
    version: currentVersion + 1,
  } as LandingPageSettings & { id: string; status: string; updatedBy: string; publishedAt: string; version: number });
}
