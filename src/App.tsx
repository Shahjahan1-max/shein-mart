import {
createContext,
useContext,
useEffect,
useMemo,
useRef,
useState,
type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";
import { PdfViewer, fileToBase64 } from "./compat";
import { QRCodeSVG } from "qrcode.react";
import {
formatMoney,
toInr,
tr,
trCategory,
trStatus,
type Currency,
type Lang,
type StrKey,
} from "./i18n";

// Product photos resolve from ./assets at build time. Vite's glob picks up
// whatever files exist: with no photos on disk the map is empty and cards
// render the honest initial-letter tile; when the real photos land in
// src/assets, the same code serves them with no further change.
const _assetModules = import.meta.glob<string>("./assets/*", {
  eager: true,
  query: "?url",
  import: "default",
});
const IMAGE_MAP: Record<string, string> = {};
for (const [path, url] of Object.entries(_assetModules)) {
  IMAGE_MAP[path.split("/").pop() as string] = url;
}

const CATEGORIES = [
  "All",
  "Electronics",
  "Mobiles",
  "Fashion",
  "Shoes",
  "Watches",
  "Home & Kitchen",
  "Beauty",
  "Cosmetics",
  "Bags",
  "Sports",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Jammu & Kashmir", "Ladakh", "Puducherry",
  "Chandigarh", "Andaman & Nicobar Islands", "Dadra & Nagar Haveli and Daman & Diu",
  "Lakshadweep",
];

// Country list for account creation (buyer register + seller application
// step 1). The store welcomes sellers and buyers from many countries —
// the Gulf countries, Türkiye, Iran and South Asia are listed first
// (the regions the owner named), then the rest of the world A–Z. The
// choice is stored on the account as profile information only; it never
// changes currency, language or pricing.
const COUNTRIES = [
  "Pakistan", "India", "Bangladesh", "Saudi Arabia", "Iran", "Türkiye",
  "United Arab Emirates", "Qatar", "Kuwait", "Bahrain", "Oman",
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Belarus", "Belgium",
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Brazil", "Bulgaria",
  "Cambodia", "Canada", "Chile", "China", "Colombia", "Costa Rica",
  "Croatia", "Cyprus", "Czechia", "Denmark", "Dominican Republic",
  "Ecuador", "Egypt", "Estonia", "Ethiopia", "Finland", "France",
  "Georgia", "Germany", "Ghana", "Greece", "Guatemala", "Honduras",
  "Hungary", "Iceland", "Indonesia", "Iraq", "Ireland", "Italy",
  "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg",
  "Malaysia", "Maldives", "Malta", "Mauritius", "Mexico", "Moldova",
  "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Palestine",
  "Panama", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Romania", "Russia", "Rwanda", "Senegal", "Serbia", "Singapore",
  "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea",
  "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Trinidad and Tobago",
  "Tunisia", "Turkmenistan", "Uganda", "Ukraine", "United Kingdom",
  "United States", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam",
  "Yemen", "Zambia", "Zimbabwe", "Other",
];

// Country-aware phone / postal / region rules (mirror of the server's
// tables in actions.ts). The country a customer picks at signup drives
// the phone format they are shown and held to — Pakistan: 03XX XXXXXXX
// (+92), India: 98XXX XXXXX (+91), and so on. Before this, every field
// silently assumed India, so a Pakistani buyer saw an Indian number
// example and could never pass checkout (their 5-digit postal code and
// 11-digit mobile were rejected by India-only rules).
type ClientPhoneSpec = { dial: string; national: number; example: string };
const CLIENT_PHONE_SPECS: Record<string, ClientPhoneSpec> = {
  Pakistan: { dial: "92", national: 10, example: "03XX XXXXXXX" },
  India: { dial: "91", national: 10, example: "98XXX XXXXX" },
  Bangladesh: { dial: "880", national: 10, example: "01XXX XXXXXX" },
  "Saudi Arabia": { dial: "966", national: 9, example: "05X XXX XXXX" },
  "United Arab Emirates": { dial: "971", national: 9, example: "05X XXX XXXX" },
  Qatar: { dial: "974", national: 8, example: "XXXX XXXX" },
  Kuwait: { dial: "965", national: 8, example: "XXXX XXXX" },
  Bahrain: { dial: "973", national: 8, example: "XXXX XXXX" },
  Oman: { dial: "968", national: 8, example: "XXXX XXXX" },
  "Türkiye": { dial: "90", national: 10, example: "05XX XXX XX XX" },
  Iran: { dial: "98", national: 10, example: "09XX XXX XXXX" },
};
function clientPhoneSpec(country: string | null | undefined): ClientPhoneSpec | null {
  if (!country) return null;
  return CLIENT_PHONE_SPECS[country.trim()] ?? null;
}
function phonePlaceholder(country: string | null | undefined): string {
  const spec = clientPhoneSpec(country);
  return spec ? spec.example : "98XXX XXXXX";
}
// True when `raw` is a plausible number for `country` (accepts the
// local form with trunk 0, the bare national form, or the full
// international form with the country code). Countries without a spec
// accept any 7–15 digit number.
function phoneValidForCountry(raw: string, country: string | null | undefined): boolean {
  const d = raw.replace(/\D/g, "");
  const spec = clientPhoneSpec(country);
  if (!spec) return d.length >= 7 && d.length <= 15;
  return (
    d.length === spec.national ||
    (d.length === spec.national + 1 && d.startsWith("0")) ||
    (d.length === spec.national + spec.dial.length && d.startsWith(spec.dial))
  );
}
// Postal / ZIP length per country (null = no fixed postal system there,
// the field is optional).
const CLIENT_POSTAL_LENGTH: Record<string, number | null> = {
  Pakistan: 5,
  India: 6,
  Bangladesh: 4,
  "Saudi Arabia": 5,
  "United Arab Emirates": null,
  Qatar: null,
  Kuwait: 5,
  Bahrain: null,
  Oman: null,
  "Türkiye": 5,
  Iran: 10,
};
function postalLengthFor(country: string | null | undefined): number | null | undefined {
  if (!country) return undefined;
  const key = country.trim();
  return key in CLIENT_POSTAL_LENGTH ? CLIENT_POSTAL_LENGTH[key] : undefined;
}
function postalValidForCountry(country: string | null | undefined, pin: string): boolean {
  const v = pin.trim();
  const len = postalLengthFor(country);
  if (len === undefined || len === null) return v.length <= 10;
  return /^\d+$/.test(v) && v.length === len;
}
// Region (state / province) lists for the countries whose buyers the
// store serves most; anywhere else the checkout takes a typed region.
const CLIENT_REGIONS: Record<string, string[]> = {
  India: INDIAN_STATES,
  Pakistan: [
    "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan",
    "Gilgit-Baltistan", "Azad Jammu & Kashmir", "Islamabad Capital Territory",
  ],
  Bangladesh: [
    "Dhaka", "Chattogram", "Khulna", "Rajshahi", "Barishal", "Sylhet",
    "Rangpur", "Mymensingh",
  ],
  "Saudi Arabia": [
    "Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk",
    "Qassim", "Ha'il", "Northern Borders", "Jazan", "Najran", "Al Bahah",
    "Al Jawf",
  ],
  "United Arab Emirates": [
    "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain",
    "Ras Al Khaimah", "Fujairah",
  ],
  Qatar: [
    "Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Umm Salal", "Al Daayen",
    "Al Shahaniya", "Al Shamal",
  ],
  Kuwait: [
    "Al Asimah (Kuwait City)", "Hawalli", "Farwaniya", "Ahmadi", "Jahra",
    "Mubarak Al-Kabeer",
  ],
  Bahrain: ["Capital", "Muharraq", "Northern", "Southern"],
  Oman: [
    "Muscat", "Dhofar", "Musandam", "Al Buraimi", "Ad Dakhiliyah",
    "North Al Batinah", "South Al Batinah", "South Ash Sharqiyah",
    "North Ash Sharqiyah", "Ad Dhahirah", "Al Wusta",
  ],
};
function regionsFor(country: string | null | undefined): string[] | null {
  if (!country) return null;
  return CLIENT_REGIONS[country.trim()] ?? null;
}
// Display a stored phone with its OWN country code: canonical numbers
// already carry the dial code; a legacy bare 10-digit number gets its
// account country's code (India when unknown, as it was collected).
function fmtPhone(phone: string | null | undefined, country: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  const spec = clientPhoneSpec(country) ?? CLIENT_PHONE_SPECS["India"]!;
  if (d.length > spec.national && d.startsWith(spec.dial)) return `+${d}`;
  if (d.length === 10) return `+${spec.dial} ${d}`;
  return `+${d}`;
}
// The editable national part of a stored phone (for prefilling checkout):
// strips the country code / trunk 0 the canonical form carries.
function nationalPhonePart(phone: string | null | undefined, country: string | null | undefined): string {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  const spec = clientPhoneSpec(country);
  if (!spec) return d;
  if (d.length === spec.national + spec.dial.length && d.startsWith(spec.dial)) return d.slice(spec.dial.length);
  if (d.length === spec.national + 1 && d.startsWith("0")) return d.slice(1);
  return d;
}

type Product = ApiResponse<typeof api, "listProducts">["products"][number];
type User = ApiResponse<typeof api, "login">["user"];
type Order = ApiResponse<typeof api, "listBuyerOrders">["orders"][number];
type Ticket = ApiResponse<typeof api, "listMyTickets">["tickets"][number];
type ChatMessage = ApiResponse<typeof api, "listChatMessages">["messages"][number];
type SellerApplication =
  ApiResponse<typeof api, "listSellerApplications">["applications"][number];
type WalletRequest = ApiResponse<typeof api, "adminWalletRequests">["requests"][number];
type ExternalProduct = ApiResponse<typeof api, "listExternalProducts">["products"][number];

type View =
  | "shop"
  | "external"
  | "cart"
  | "checkout"
  | "orders"
  | "account"
  | "seller"
  | "admin"
  | "support";

const SESSION_KEY = "dropship-session-user";
const LANG_KEY = "sheinstore-lang";
const CURRENCY_KEY = "sheinstore-currency";
const THEME_KEY = "sheinstore-theme";

type ThemeMode = "light" | "dark";

function loadSession(): User {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/* ------------------------- UI prefs (lang + currency) ---------------------- */

type Ui = {
  lang: Lang;
  currency: Currency;
  // Languages / currencies the Admin has switched ON in Settings →
  // Language & Prices. Pickers render only these; `lang` / `currency`
  // above are already the EFFECTIVE values (a switched-off selection
  // has fallen back to English / INR-or-first-ON).
  enabledLangs: Lang[];
  enabledCurrencies: Currency[];
  t: (key: StrKey) => string;
  fmt: (inr: number) => string;
  // Measured height (px) of the sticky app header, which slims down and
  // shrinks further on scroll-down. Sticky bars below it (e.g. the shop
  // category bar) offset themselves by exactly this much.
  headerH: number;
  // Store layout design chosen by the Admin in settings ("classic" |
  // "menu" | "topsearch"); recolours/rearranges chrome for everyone.
  layout: string;
};

const UiContext = createContext<Ui>({
  lang: "en",
  currency: "INR",
  enabledLangs: ["en", "hi", "ar"],
  enabledCurrencies: ["INR", "USD", "USDT"],
  t: (key) => tr("en", key),
  fmt: (n) => formatMoney(n, "INR"),
  headerH: 44,
  layout: "classic",
});

function useUi(): Ui {
  return useContext(UiContext);
}

/* ------------------------------ Small pieces ------------------------------ */

function ProductImage({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  // Every product now carries its own photo: bulk products received
  // their own generated photos, so their imageAsset is shown like any
  // other product's. Products still without a photo (imageAsset empty
  // or unresolvable) render the honest initial-letter tile.
  const src = product.imageAsset ? IMAGE_MAP[product.imageAsset] : undefined;
  const [failed, setFailed] = useState(false);
  // If this product's photo was replaced/renamed, restart with the new src.
  useEffect(() => { setFailed(false); }, [src]);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={product.name}
        className={className ?? "h-full w-full object-cover"}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center bg-[var(--surface-alt)] font-display text-4xl font-bold text-[var(--accent)]"
    >
      {product.name.charAt(0)}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { lang } = useUi();
  const colors: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-900",
    pending: "bg-amber-100 text-amber-900",
    Confirmed: "bg-sky-100 text-sky-900",
    Shipped: "bg-indigo-100 text-indigo-900",
    Delivered: "bg-emerald-100 text-emerald-900",
    Cancelled: "bg-rose-100 text-rose-900",
    Open: "bg-amber-100 text-amber-900",
    Answered: "bg-emerald-100 text-emerald-900",
    Closed: "bg-stone-200 text-stone-800",
    approved: "bg-emerald-100 text-emerald-900",
    completed: "bg-emerald-100 text-emerald-900",
    paid: "bg-emerald-600 text-white",
    rejected: "bg-rose-100 text-rose-900",
    none: "bg-stone-200 text-stone-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] ?? "bg-stone-200 text-stone-800"}`}
    >
      {trStatus(lang, status)}
    </span>
  );
}

/* Green "Verified ✓" pill shown wherever a verified seller/store appears. */
function VerifiedBadge({ className }: { className?: string }) {
  const { t } = useUi();
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white ${className ?? ""}`}
    >
      {t("verif.badge")}
    </span>
  );
}

/* Green "Verified ✓" pill shown right next to a VERIFIED seller's name
   (Account menu header + Profile section header) — the exact same pill
   as the seller/merchant header uses. Rendered ONLY when the account is
   a seller whose application is approved — the same verification that
   shows the "Verified seller ✓" banner. Pending/rejected sellers and
   buyers (no verification flow) never get a pill. */
function VerifiedNamePill({ user }: { user: NonNullable<User> }) {
  if (user.role !== "seller" || user.verificationStatus !== "approved") return null;
  return <VerifiedBadge className="ml-2 align-middle" />;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[var(--text)]">
        {label}
      </span>
      {children}
    </label>
  );
}

/* Written validation: a specific message under the field (never just a red
   border) plus a summary box naming the section and what is left. */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span role="alert" className="mt-1 block text-xs font-semibold leading-snug text-rose-600">
      ⚠ {msg}
    </span>
  );
}

function errInputCls(hasError: boolean): string {
  return hasError
    ? inputCls + " border-rose-500 bg-rose-50 dark:bg-rose-950/30"
    : inputCls;
}

function ValidationSummary({
  sectionLabel,
  items,
}: {
  sectionLabel: string;
  items: Array<{ label: string; msg: string }>;
}) {
  const { t } = useUi();
  if (items.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
    >
      <p className="font-display font-bold">
        {sectionLabel}: {items.length} {t("val.left")} —{" "}
        {items.map((i) => i.label).join(", ")}
      </p>
      <p className="mt-1 font-semibold">{t("val.summaryTitle")}</p>
      <ul className="mt-1 list-inside list-disc flex flex-col gap-0.5">
        {items.map((i) => (
          <li key={i.label}>
            <strong>{i.label}:</strong> {i.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}

function digitsOf(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

function isEmailOk(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Small "NEW" highlight for features added in the latest update, so the
// owner can spot at a glance what changed. When it carries an `id`, the
// badge is a button: clicking it dismisses that highlight for good — the
// dismissal is saved in this browser (localStorage) so the badge stays
// gone after reloads too. Theme colours only, no motion.
const DISMISSED_BADGES_KEY = "sheinstore-dismissed-badges";
function loadDismissedBadges(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_BADGES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function NewBadge({ className, id }: { className?: string; id?: string }) {
  const { t } = useUi();
  const [dismissed, setDismissed] = useState<boolean>(
    () => !!id && loadDismissedBadges().has(id),
  );
  if (id && dismissed) return null;
  const cls = `inline-flex shrink-0 items-center rounded-full bg-[var(--gold)] px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wider text-[var(--gold-ink)] ${className ?? ""}`;
  if (!id) return <span className={cls}>{t("common.new")}</span>;
  return (
    <button
      type="button"
      aria-label={`${t("common.new")} — ${t("common.dismissNew")}`}
      title={t("common.dismissNew")}
      onClick={(e) => {
        e.stopPropagation();
        const set = loadDismissedBadges();
        set.add(id);
        try {
          localStorage.setItem(DISMISSED_BADGES_KEY, JSON.stringify([...set]));
        } catch { /* storage full/blocked — still hide for this view */ }
        setDismissed(true);
      }}
      className={cls + " cursor-pointer"}
    >
      {t("common.new")} ✕
    </button>
  );
}

function EmptyState({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <h2 className="font-display text-xl font-bold text-[var(--text)]">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--dim)]">{text}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className={primaryBtn + " mt-4"}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--text)] outline-none focus:border-[var(--accent)]";

const primaryBtn =
  "rounded-xl bg-[var(--accent)] px-4 py-2.5 font-display text-sm font-bold text-white shadow-sm disabled:opacity-50";
const goldBtn =
  "rounded-xl bg-[var(--gold)] px-4 py-2.5 font-display text-sm font-bold text-white shadow-sm disabled:opacity-50";
const ghostBtn =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] disabled:opacity-50";

/* ------------------------------ Product card ------------------------------ */

function ProductCard({
  product,
  user,
  onAddToCart,
  onAddToMyStore,
  inMyStore,
  dense,
  onOpen,
  onBuyNow,
}: {
  product: Product;
  user: User;
  onAddToCart: (p: Product) => void;
  onOpen?: (p: Product) => void;
  onBuyNow?: (p: Product) => void;
  // Shop is where sellers add products to their own store (restored):
  // a seller tapping "Add to My Store" here adds the product directly,
  // and it then shows only in the seller's Products tab. Buyers keep
  // Add to Cart.
  onAddToMyStore?: (p: Product) => void;
  inMyStore?: boolean;
  // Dense = the 3-column phone grid: cards are ~110px wide there, so
  // padding, type and the profit line all step down one size and the
  // button stays fully tappable without any text spilling out.
  dense?: boolean;
}) {
  const { t, fmt, lang } = useUi();
  const discount = product.oldPrice
    ? Math.round((1 - product.buyerPrice / product.oldPrice) * 100)
    : 0;
  return (
    <article className="product-card flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-shadow hover:shadow-lg">
      <div
      className={`product-media relative aspect-square overflow-hidden ${onOpen ? "cursor-pointer" : ""}`}
      onClick={onOpen ? () => onOpen(product) : undefined}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(product);
              }
            }
          : undefined
      }
    >
        <ProductImage product={product} />
        {discount > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-[var(--gold)] px-1.5 py-0.5 font-display text-xs font-bold text-white">
            -{discount}%
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
            {t("shop.outOfStock")}
          </span>
        )}
      </div>
      <div className={`flex flex-1 flex-col gap-1.5 ${dense ? "p-2" : "p-3"}`}>
        <p className={`font-semibold uppercase tracking-wide text-[var(--dim)] ${dense ? "text-[10px]" : "text-xs"}`}>
          {trCategory(lang, product.category)}
        </p>
        <h3 onClick={onOpen ? () => onOpen(product) : undefined} className={`line-clamp-2 font-semibold leading-snug text-[var(--text)] ${dense ? "text-[13px]" : "text-sm"} ${onOpen ? "cursor-pointer" : ""}`}>
          {product.name}
        </h3>
        <div className="mt-auto pt-1">
          <p className={`font-display font-extrabold leading-tight tracking-tight text-[var(--text)] ${dense ? "text-[15px]" : "text-lg"}`}>
            {fmt(product.buyerPrice)}
          </p>
          {product.oldPrice && (
            <p className="mt-0.5 text-xs text-[var(--dim)] line-through">
              {fmt(product.oldPrice)}
            </p>
          )}
          <p className={`mt-1.5 inline-block rounded-md bg-[var(--surface-alt)] px-1.5 py-0.5 font-semibold text-[var(--accent)] ${dense ? "text-[10px] leading-snug" : "text-xs"}`}>
            {t("shop.sellerProfit")} {fmt(product.profitAmount)} ({product.profitPercent}%)
          </p>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          {(!user || user.role === "buyer") && (
            <>
            <button
              type="button"
              aria-label={`Add ${product.name} to cart`}
              disabled={product.stock <= 0}
              onClick={() => onAddToCart(product)}
              className={goldBtn + (dense ? " w-full px-0.5 py-2 text-xs leading-tight" : " w-full py-2")}
            >
              {t("shop.addToCart")}
            </button>
            {onBuyNow && (
              <button
                type="button"
                aria-label={`Buy ${product.name} now`}
                disabled={product.stock <= 0}
                onClick={() => onBuyNow(product)}
                className={primaryBtn + (dense ? " w-full px-0.5 py-2 text-xs leading-tight" : " w-full py-2")}
              >
                {t("shop.buyNow")}
              </button>
            )}
            </>
          )}
          {user?.role === "seller" &&
            (inMyStore ? (
              <p className="rounded-lg bg-[var(--surface-alt)] px-2 py-2 text-center font-display text-sm font-bold text-[var(--accent)]">
                {t("shop.inStore")}
              </p>
            ) : (
              <button
                type="button"
                aria-label={`Add ${product.name} to my store`}
                disabled={product.stock <= 0}
                onClick={() => onAddToMyStore?.(product)}
                className={primaryBtn + (dense ? " w-full px-0.5 py-2 text-xs leading-tight" : " w-full py-2")}
              >
                {t("shop.addToStore")}
              </button>
            ))}
          {user?.role === "admin" && (
            <p className="text-center text-xs text-[var(--dim)]">
              {t("shop.base")} {fmt(product.basePrice)} · {t("shop.stock")} {product.stock}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/* --------------------------------- Shop ---------------------------------- */

const AMAZON_INDIA_URL = "https://www.amazon.in";
const SHEIN_INDIA_URL = "https://www.sheinindia.in/";

const GRID_KEY = "sheinstore-grid-cols";

/* ------------------------------ Product detail ------------------------------
   Opens when a shop product is tapped: the full product page with order
   options (quantity, Add to Cart, Buy Now) plus related products from the
   same category. Rendered from ShopView so it reuses the shop's cart and
   store actions. */
function ProductDetail({
  product,
  user,
  onBack,
  onAddToCartQty,
  onAddToMyStore,
  inMyStore,
  myStoreIds,
  related,
  onOpenProduct,
  onMoreInCategory,
}: {
  product: Product;
  user: User;
  onBack: () => void;
  onAddToCartQty: (p: Product, qty: number, buyNow: boolean) => void;
  onAddToMyStore?: (p: Product) => void;
  inMyStore?: boolean;
  myStoreIds: Set<number>;
  related: Product[];
  onOpenProduct: (p: Product) => void;
  onMoreInCategory: () => void;
}) {
  const { t, fmt, lang } = useUi();
  const [qty, setQty] = useState(1);
  const discount =
    product.oldPrice && product.oldPrice > product.buyerPrice
      ? Math.round((1 - product.buyerPrice / product.oldPrice) * 100)
      : 0;
  const maxQty = Math.max(1, Math.min(product.stock, 99));
  const safeQty = Math.min(qty, maxQty);
  return (
    <div>
      <button type="button" onClick={onBack} className={ghostBtn + " px-3 py-2 text-sm"}>
        &larr; {t("shop.backToShop")}
      </button>
      <article className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden">
            <ProductImage product={product} />
            {discount > 0 && (
              <span className="absolute left-2 top-2 rounded-md bg-[var(--gold)] px-1.5 py-0.5 font-display text-xs font-bold text-white">
                -{discount}%
              </span>
            )}
            {product.stock <= 0 && (
              <span className="absolute right-2 top-2 rounded-md bg-rose-600 px-1.5 py-0.5 text-xs font-bold text-white">
                {t("shop.outOfStock")}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
              {trCategory(lang, product.category)}
            </p>
            <h1 className="font-display text-xl font-extrabold leading-tight text-[var(--text)] sm:text-2xl">
              {product.name}
            </h1>
            <p className="font-display text-2xl font-extrabold leading-tight tracking-tight text-[var(--text)]">
              {fmt(product.buyerPrice)}
            </p>
            {product.oldPrice && (
              <p className="text-sm text-[var(--dim)] line-through">{fmt(product.oldPrice)}</p>
            )}
            <p className="inline-block w-fit rounded-md bg-[var(--surface-alt)] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent)]">
              {t("shop.sellerProfit")} {fmt(product.profitAmount)} ({product.profitPercent}%)
            </p>
            {product.stock > 0 ? (
              <p className="text-sm font-semibold text-emerald-600">{t("shop.inStock")}</p>
            ) : (
              <p className="text-sm font-semibold text-rose-600">{t("shop.outOfStock")}</p>
            )}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm leading-relaxed text-[var(--text)]">
              <p className="font-display font-bold">{t("shop.deliveryTitle")}</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[13px]">
                <li>&#10003; {t("shop.codLine")}</li>
                <li>&#10003; {t("shop.prepaidLine")}</li>
                <li>&#10003; {t("shop.trackLine")}</li>
                <li>&#10003; {t("shop.returnLine")}</li>
              </ul>
            </div>
            {product.description ? (
              <p className="mt-1 text-sm leading-relaxed text-[var(--text)]">{product.description}</p>
            ) : null}
            <div className="mt-auto pt-3">
              {(!user || user.role === "buyer") && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-[var(--text)]">{t("shop.quantity")}</span>
                    <div className="flex items-center rounded-lg border border-[var(--border)]">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        disabled={safeQty <= 1}
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="px-3 py-2 font-bold disabled:opacity-40"
                      >
                        &minus;
                      </button>
                      <span className="min-w-10 text-center font-bold">{safeQty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        disabled={safeQty >= maxQty}
                        onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                        className="px-3 py-2 font-bold disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => onAddToCartQty(product, safeQty, false)}
                      className={goldBtn + " flex-1 py-2.5"}
                    >
                      {t("shop.addToCart")}
                    </button>
                    <button
                      type="button"
                      disabled={product.stock <= 0}
                      onClick={() => onAddToCartQty(product, safeQty, true)}
                      className={primaryBtn + " flex-1 py-2.5"}
                    >
                      {t("shop.buyNow")}
                    </button>
                  </div>
                </>
              )}
              {user?.role === "seller" &&
                (inMyStore ? (
                  <p className="rounded-lg bg-[var(--surface-alt)] px-3 py-2.5 text-center font-display text-sm font-bold text-[var(--accent)]">
                    {t("shop.inStore")}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddToMyStore?.(product)}
                    className={goldBtn + " w-full py-2.5"}
                  >
                    {t("shop.addToStore")}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </article>
      {related.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-extrabold text-[var(--text)]">
              {t("shop.relatedProducts")}
            </h2>
            <button type="button" onClick={onMoreInCategory} className={ghostBtn + " px-3 py-1.5 text-sm"}>
              {t("shop.moreInCategory")}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                user={user}
                onAddToCart={(pp) => onAddToCartQty(pp, 1, false)}
                onBuyNow={(pp) => onAddToCartQty(pp, 1, true)}
                onAddToMyStore={onAddToMyStore}
                inMyStore={myStoreIds.has(p.id)}
                onOpen={onOpenProduct}
              />
            ))}
          </div>
        </section>
      )}
      <ProductReviews productId={product.id} />
    </div>
  );
}

function ShopView({
  user,
  onNeedAuth,
  onGoSeller,
  onGoCart,
  cartCount,
  category,
  onCategoryChange,
  search,
  onSearchChange,
}: {
  user: User;
  onNeedAuth: () => void;
  onGoSeller: () => void;
  onGoCart: () => void;
  cartCount: number;
  category: string;
  onCategoryChange: (c: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
}) {
  const { t, fmt, lang, headerH } = useUi();
  const queryClient = useQueryClient();
  const setCategory = onCategoryChange;
  const setSearch = onSearchChange;
  // Product grid density: 2 or 3 columns, chosen beside the search box
  // and remembered for this visitor.
  const [gridCols, setGridCols] = useState<2 | 3>(() =>
    typeof localStorage !== "undefined" && localStorage.getItem(GRID_KEY) === "3" ? 3 : 2,
  );
  function changeGridCols(n: 2 | 3) {
    setGridCols(n);
    try { localStorage.setItem(GRID_KEY, String(n)); } catch { /* private mode */ }
  }
  const gridCls = gridCols === 3
    ? "mt-3 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5 xl:grid-cols-6"
    : "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Added-to-cart confirmation: a floating bar pinned above the bottom
  // navigation, visible wherever the buyer has scrolled to — the old
  // inline notice sat at the top of the grid, so a buyer deep in the
  // list tapped "Add to Cart", saw nothing happen, and tapped again
  // (carts were found holding the same product at quantity 20+). The
  // bar names the product, shows the live cart count and carries a
  // View Cart button straight to the cart.
  const [cartToast, setCartToast] = useState<string | null>(null);
  const cartToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showCartToast(productName: string) {
    setCartToast(productName);
    if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
    cartToastTimer.current = setTimeout(() => setCartToast(null), 5000);
  }

  const products = useQuery({
    queryKey: ["products", { category, search }],
    queryFn: () => api.listProducts({ category, search }),
  });

  const allProducts = useQuery({
    queryKey: ["products", { category: "All", search: "" }],
    queryFn: () => api.listProducts({ category: "All", search: "" }),
  });
  // Fresh Arrivals: 8 products rotated deterministically by the current
  // date, so the "New Today" selection genuinely changes every day.
  const freshArrivals = useMemo(() => {
    const list = allProducts.data?.products ?? [];
    if (list.length === 0) return [];
    const day = Math.floor(Date.now() / 86400000);
    const start = (day * 8) % list.length;
    const out: Product[] = [];
    for (let i = 0; i < Math.min(8, list.length); i += 1) {
      out.push(list[(start + i) % list.length]!);
    }
    return out;
  }, [allProducts.data]);

  const sellerPicks = useQuery({
    queryKey: ["seller-products", user?.id],
    queryFn: () => api.listSellerProducts({ sellerId: user!.id }),
    enabled: user?.role === "seller",
  });
  const myStoreIds = useMemo(
    () => new Set((sellerPicks.data?.products ?? []).map((p) => p.id)),
    [sellerPicks.data],
  );

  function flash(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  }

  const addToCart = useMutation({
    mutationFn: (p: Product) =>
      api.addToCart({ buyerId: user!.id, productId: p.id }),
    onSuccess: (_r, p) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showCartToast(p.name);
    },
    onError: (e) => flash(String(e)),
  });

  // Sellers add products to their own store FROM THE SHOP (restored
  // at the owner's request): the same addToMyStore action the seller
  // dashboard uses. The added product then appears ONLY in the
  // seller's Products tab (with Remove) — the Products tab itself no
  // longer carries an add-catalog, so there is no duplication.
  const addToMyStore = useMutation({
    mutationFn: (p: Product) =>
      api.addToMyStore({ sellerId: user!.id, productId: p.id }),
    onSuccess: (r, p) => {
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
      flash(
        r.alreadyAdded
          ? `${p.name} — ${t("shop.alreadyInStore")}`
          : `${p.name} ${t("shop.addedToStore")} ${fmt(p.profitAmount)} ${t("shop.perSale")}`,
      );
    },
    onError: (e) => flash(String(e)),
  });

  function handleAddToMyStore(p: Product) {
    if (!user) {
      onNeedAuth();
      return;
    }
    addToMyStore.mutate(p);
  }

  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [detailProduct]);
  async function handleAddToCartQty(p: Product, qty: number, buyNow: boolean) {
    if (!user) {
      onNeedAuth();
      return;
    }
    try {
      const cart = await api.getCart({ buyerId: user.id });
      const existing = (cart.items ?? []).find((it) => it.product.id === p.id)?.qty ?? 0;
      if (existing === 0) await api.addToCart({ buyerId: user.id, productId: p.id });
      await api.setCartQty({
        buyerId: user.id,
        productId: p.id,
        qty: Math.min(existing + qty, Math.max(1, Math.min(p.stock, 99))),
      });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      showCartToast(p.name);
      if (buyNow) onGoCart();
    } catch (e) {
      flash(String(e));
    }
  }

  function handleAddToCart(p: Product) {
    if (!user) {
      onNeedAuth();
      return;
    }
    addToCart.mutate(p);
  }

  const trustItems = [
    { icon: "🛡️", title: t("trust.verified.t"), text: t("trust.verified.d") },
    { icon: "💵", title: t("trust.cod.t"), text: t("trust.cod.d") },
    { icon: "💬", title: t("trust.live.t"), text: t("trust.live.d") },
    { icon: "🏷️", title: t("trust.prices.t"), text: t("trust.prices.d") },
  ];

  if (detailProduct) {
    const related = (allProducts.data?.products ?? [])
      .filter((p) => p.category === detailProduct.category && p.id !== detailProduct.id)
      .slice(0, 8);
    return (
      <ProductDetail
        key={detailProduct.id}
        product={detailProduct}
        user={user}
        onBack={() => setDetailProduct(null)}
        onAddToCartQty={handleAddToCartQty}
        onAddToMyStore={handleAddToMyStore}
        inMyStore={myStoreIds.has(detailProduct.id)}
        myStoreIds={myStoreIds}
        related={related}
        onOpenProduct={setDetailProduct}
        onMoreInCategory={() => {
          setCategory(detailProduct.category);
          setDetailProduct(null);
        }}
      />
    );
  }

  return (
    <div>
      <section className="rounded-xl bg-[var(--accent)] px-4 py-3 text-white sm:px-5">
        <h2 className="font-display text-lg font-extrabold leading-tight sm:text-xl">
          {t("hero.title")}
        </h2>
        <p className="mt-1 max-w-xl text-[13px] leading-snug text-white/85">{t("hero.sub")}</p>
        {user?.role === "seller" && (
          <button
            type="button"
            onClick={onGoSeller}
            className="mt-2 rounded-lg bg-white px-3 py-1.5 font-display text-[13px] font-bold text-[var(--accent-strong)]"
          >
            {t("hero.sellerCta")}
          </button>
        )}
      </section>

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-sm">
        <p className="text-[13px] font-semibold text-[var(--text)]">{t("daily.explore")}</p>
        <span className="ml-auto rounded-full bg-[var(--accent)] px-2.5 py-1 font-display text-[11px] font-bold text-white">
          ✨ {t("daily.badge")}
        </span>
      </div>

      <div
        className="sticky z-30 -mx-3 mt-3 bg-[var(--bg)] px-3 py-2 transition-[top] duration-300 min-[400px]:-mx-4 min-[400px]:px-4"
        style={{ top: headerH }}
      >
        <div
          className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={`Category ${c}`}
            >
              {trCategory(lang, c)}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex items-stretch gap-2">
          <label className="block min-w-0 flex-1">
            <span className="sr-only">Search products</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("shop.searchPlaceholder")}
              className={inputCls}
              aria-label="Search products"
            />
          </label>
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-[var(--border)]" role="group" aria-label="Product grid view">
            <button
              type="button"
              aria-label={t("shop.grid2")}
              aria-pressed={gridCols === 2}
              onClick={() => changeGridCols(2)}
              className={`px-3 font-display text-sm font-bold ${gridCols === 2 ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--dim)]"}`}
            >
              ▦ 2
            </button>
            <button
              type="button"
              aria-label={t("shop.grid3")}
              aria-pressed={gridCols === 3}
              onClick={() => changeGridCols(3)}
              className={`px-3 font-display text-sm font-bold ${gridCols === 3 ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--dim)]"}`}
            >
              ▦ 3
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm font-medium text-[var(--text)]"
        >
          {notice}
        </p>
      )}

      {products.isPending && (
        <p className="py-10 text-center text-[var(--dim)]">{t("shop.loading")}</p>
      )}
      {products.error && (
        <p className="py-10 text-center text-rose-600">{t("shop.loadError")}</p>
      )}
      {products.data && products.data.products.length === 0 && (
        <p className="py-10 text-center text-[var(--dim)]">{t("shop.empty")}</p>
      )}
      {products.data && products.data.products.length > 0 && (
        <div className={gridCls}>
          {products.data.products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              user={user}
              onAddToCart={handleAddToCart}
              onBuyNow={(p) => handleAddToCartQty(p, 1, true)}
              onOpen={setDetailProduct}
              onAddToMyStore={handleAddToMyStore}
              inMyStore={myStoreIds.has(p.id)}
              dense={gridCols === 3}
            />
          ))}
        </div>
      )}

      {category === "All" && !search.trim() && freshArrivals.length > 0 && (
        <section className="mt-8">
          <h3 className="font-display text-lg font-bold text-[var(--text)]">
            {t("fresh.title")}
          </h3>
          <p className="mt-1 text-sm text-[var(--dim)]">{t("fresh.sub")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {freshArrivals.map((p) => (
              <div key={p.id} className="relative">
                <span className="absolute left-2 top-2 z-10 rounded-md bg-[var(--accent)] px-1.5 py-0.5 font-display text-[11px] font-bold text-white">
                  {t("fresh.badge")}
                </span>
                <ProductCard
                  product={p}
                  user={user}
                  onAddToCart={handleAddToCart}
                  onBuyNow={(p) => handleAddToCartQty(p, 1, true)}
                  onOpen={setDetailProduct}
                  onAddToMyStore={handleAddToMyStore}
                  inMyStore={myStoreIds.has(p.id)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The "Shop from Other Platforms" external section is NOT
          rendered on the shop/home page any more (owner's request):
          the shop shows only the store's own catalog products. The
          external products data and the Admin management stay intact
          (ExternalProductsPage below) so the section can be restored
          later if the owner asks. */}

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="font-display text-lg font-bold text-[var(--text)]">
          {t("how.title")}
        </h3>
        <p className="mt-1 text-sm text-[var(--dim)]">{t("how.sub")}</p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <p className="rounded-lg bg-[var(--surface-alt)] px-3 py-2">
            {t("how.base")} <strong className="font-display">{fmt(1000)}</strong>
          </p>
          <p className="rounded-lg bg-[var(--surface-alt)] px-3 py-2">
            {t("how.profit")} <strong className="font-display">{fmt(200)}</strong>
          </p>
          <p className="rounded-lg bg-[var(--surface-alt)] px-3 py-2">
            {t("how.buyer")} <strong className="font-display">{fmt(1200)}</strong> —{" "}
            {t("how.toSeller")} {fmt(200)} {t("how.profitWord")}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="font-display text-lg font-bold text-[var(--text)]">
          {t("trust.title")}
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {trustItems.map((item) => (
            <div key={item.title} className="flex gap-3">
              <span aria-hidden className="text-2xl leading-none">
                {item.icon}
              </span>
              <div>
                <p className="font-display text-sm font-bold text-[var(--text)]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-sm text-[var(--dim)]">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="font-display text-lg font-bold text-[var(--text)]">
          {t("links.title")}
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={AMAZON_INDIA_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`${t("links.link")}: Amazon India`}
            className="rounded-lg border border-[var(--border)] px-4 py-2 font-display text-sm font-bold text-[var(--text)]"
          >
            {t("links.link")}
          </a>
          <a
            href={SHEIN_INDIA_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`${t("links.link")}: SHEIN India`}
            className="rounded-lg border border-[var(--border)] px-4 py-2 font-display text-sm font-bold text-[var(--text)]"
          >
            {t("links.link")}
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--dim)]">{t("links.note")}</p>
      </section>

      {cartToast && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-[4.75rem] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl bg-[var(--accent)] px-4 py-3 text-white shadow-xl sm:bottom-6"
        >
          <span aria-hidden className="text-lg leading-none">🛒</span>
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">
            <span className="line-clamp-1">{cartToast}</span>
            {t("shop.addedToCart")}
            {cartCount > 0 ? ` · ${cartCount} ${t("shop.inYourCart")}` : ""}
          </p>
          <button
            type="button"
            onClick={() => { setCartToast(null); onGoCart(); }}
            aria-label={t("shop.viewCart")}
            className="shrink-0 rounded-lg bg-white px-3 py-2 font-display text-[13px] font-bold text-[var(--accent-strong)]"
          >
            {t("shop.viewCart")} →
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------- Shop from Other Platforms (external) ------------------ */

function ExternalProductCard({ product }: { product: ExternalProduct }) {
  const { t, fmt, lang } = useUi();
  const initial = (product.brand || product.merchant || product.name).charAt(0).toUpperCase();
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm transition-shadow hover:shadow-lg">
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--surface-alt)]">
        <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-soft)] font-display text-3xl font-extrabold text-[var(--accent)]">
          {initial}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--dim)]">
          {trCategory(lang, product.category)} · {t("ext.soldOn")} {product.merchant}
        </p>
        <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">
          {product.name}
        </h4>
        <p className="text-xs text-[var(--dim)]">
          {t("ext.brand")}: <strong className="text-[var(--text)]">{product.brand}</strong>
        </p>
        <p className="mt-auto pt-1 font-display text-lg font-bold leading-none text-[var(--text)]">
          {fmt(product.priceInr)}
        </p>
        <a
          href={product.productUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${t("ext.viewOn")} ${product.merchant}: ${product.name}`}
          className={goldBtn + " mt-2 block w-full px-2 py-2 text-center"}
        >
          {t("ext.viewOn")} {product.merchant} ↗
        </a>
      </div>
    </article>
  );
}

// Clearly separated section of products sold on OTHER websites. These
// cards link out to the merchant's own product page (new tab) — there
// is deliberately no Add to Cart / checkout / profit here, and these
// products never enter the main catalog. When the Admin switches the
// section OFF (settings), it renders nothing for visitors.
function ExternalProductsSection() {
  const { t, lang } = useUi();
  const [extCategory, setExtCategory] = useState("All");
  const ext = useQuery({
    queryKey: ["external-products"],
    queryFn: () => api.listExternalProducts({}),
  });
  if (ext.isPending) return null;
  if (!ext.data || !ext.data.enabled) return null;
  const all = ext.data.products;
  if (all.length === 0) return null;
  const cats = ["All", ...Array.from(new Set(all.map((p) => p.category)))];
  const shown = extCategory === "All" ? all : all.filter((p) => p.category === extCategory);
  return (
    <section id="external-products" className="mt-8 rounded-2xl border-2 border-[var(--gold)]/50 bg-[var(--surface)] p-4 sm:p-5" aria-label={t("ext.title")}>
      <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">
        🌐 {t("ext.title")} <NewBadge id="ext-section" />
      </h3>
      <p className="mt-1.5 max-w-2xl text-sm leading-snug text-[var(--dim)]">{t("ext.note")}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter external products by category">
        {cats.map((c) => (
          <Chip key={c} active={extCategory === c} onClick={() => setExtCategory(c)} label={`External category ${c}`}>
            {c === "All" ? t("cat.All") : trCategory(lang, c)}
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--dim)]">{t("ext.empty")}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((p) => (
            <ExternalProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

// Full-page view of the same section (reached from the drawer menu).
function ExternalProductsPage() {
  const { t } = useUi();
  const ext = useQuery({
    queryKey: ["external-products"],
    queryFn: () => api.listExternalProducts({}),
  });
  if (ext.isPending) {
    return <p className="py-10 text-center text-[var(--dim)]">{t("shop.loading")}</p>;
  }
  if (!ext.data?.enabled) {
    return <EmptyState title={t("ext.title")} text={t("ext.off")} />;
  }
  return (
    <div>
      <ExternalProductsSection />
    </div>
  );
}

/* ------------------------------ Cart / Orders ----------------------------- */

function CartView({
  user,
  onCheckout,
  onShop,
}: {
  user: User;
  onCheckout: () => void;
  onShop: () => void;
}) {
  const { t, fmt } = useUi();
  const queryClient = useQueryClient();
  const cart = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: () => api.getCart({ buyerId: user!.id }),
    enabled: !!user && user.role === "buyer",
  });
  const setQty = useMutation({
    mutationFn: (args: { productId: number; qty: number }) =>
      api.setCartQty({ buyerId: user!.id, ...args }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  if (!user) {
    return <EmptyState title={t("cart.signInT")} text={t("cart.signInD")} />;
  }
  if (user.role !== "buyer") {
    return <EmptyState title={t("cart.buyerOnlyT")} text={t("cart.buyerOnlyD")} />;
  }
  if (cart.isPending)
    return <p className="py-10 text-center text-[var(--dim)]">{t("cart.loading")}</p>;
  const items = cart.data?.items ?? [];
  const total = items.reduce((s, it) => s + it.product.buyerPrice * it.qty, 0);
  if (items.length === 0) {
    return (
      <EmptyState
        title={t("cart.emptyT")}
        text={t("cart.emptyD")}
        actionLabel={t("cart.browse")}
        onAction={onShop}
      />
    );
  }
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-[var(--text)]">{t("cart.title")}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {items.map(({ product, qty }) => (
          <div
            key={product.id}
            className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
          >
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
              <ProductImage product={product} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="line-clamp-2 text-sm font-semibold text-[var(--text)]">
                {product.name}
              </h3>
              <p className="mt-0.5 font-display font-bold text-[var(--text)]">
                {fmt(product.buyerPrice)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${product.name}`}
                  className="h-10 w-10 shrink-0 rounded-md border border-[var(--border)] font-bold"
                  onClick={() => setQty.mutate({ productId: product.id, qty: qty - 1 })}
                >
                  −
                </button>
                <span aria-label={`Quantity of ${product.name}`} className="min-w-6 text-center font-semibold">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${product.name}`}
                  className="h-10 w-10 shrink-0 rounded-md border border-[var(--border)] font-bold"
                  onClick={() => setQty.mutate({ productId: product.id, qty: qty + 1 })}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${product.name} from cart`}
                  className="ml-auto -my-1 px-2 py-2 text-sm font-medium text-rose-600"
                  onClick={() => setQty.mutate({ productId: product.id, qty: 0 })}
                >
                  {t("cart.remove")}
                </button>
              </div>
            </div>
            <p className="shrink-0 text-right font-display text-sm font-bold text-[var(--text)]">
              {fmt(product.buyerPrice * qty)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap justify-between gap-2 text-base">
          <span className="text-[var(--dim)]">{t("cart.total")}</span>
          <strong className="font-display text-xl text-[var(--text)]">{fmt(total)}</strong>
        </div>
        <p className="mt-1 text-xs text-[var(--dim)]">{t("cart.deliveryNote")}</p>
        <button type="button" onClick={onCheckout} className={goldBtn + " mt-3 w-full"}>
          {t("cart.checkout")}
        </button>
      </div>
    </div>
  );
}

function CheckoutView({
  user,
  onDone,
  onCart,
}: {
  user: User;
  onDone: () => void;
  onCart: () => void;
}) {
  const { t, fmt } = useUi();
  const queryClient = useQueryClient();
  // Delivery details follow the buyer's OWN country (chosen at signup):
  // their phone format, their provinces/states, their postal-code
  // length. The old form hardcoded India (Maharashtra, 10-digit mobile,
  // 6-digit PIN), which made checkout impossible for foreign buyers.
  const country = user?.country ?? null;
  const regions = regionsFor(country);
  const postalLen = postalLengthFor(country);
  const regionLabel = country === "India" ? t("co.state") : t("co.region");
  const postalLabel = country === "India" ? t("co.pin") : t("co.postal");
  const [form, setForm] = useState({
    customerName: user?.name ?? "",
    phone: nationalPhonePart(user?.phone, country),
    address: "",
    city: "",
    state: "",
    pinCode: "",
  });
  // Payment step: WHEN to pay is the buyer's choice — Pay on Delivery
  // (cash at the door) or Pay First (pay now with an enabled method +
  // proof, then the order is delivered). The old select also offered
  // "coming soon" methods that silently placed orders — removed.
  const [payWhen, setPayWhen] = useState<"delivery" | "first">("delivery");
  const [payMethod, setPayMethod] = useState("UPI");
  const [payRef, setPayRef] = useState("");
  const [payShot, setPayShot] = useState<ChatAttachmentData | null>(null);
  const [payShotErr, setPayShotErr] = useState<string | null>(null);
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings({}) });
  const st = settingsQ.data;
  const prepaidMethods: string[] = [];
  if (st?.paymentUpiEnabled) prepaidMethods.push("UPI");
  if (st?.paymentBankEnabled) prepaidMethods.push("Bank Account");
  if (st?.paymentUsdtEnabled) prepaidMethods.push("USDT (Crypto)");
  const effPayMethod = prepaidMethods.includes(payMethod) ? payMethod : (prepaidMethods[0] ?? "");
  const [error, setError] = useState<string | null>(null);
  const [coTouched, setCoTouched] = useState(false);
  const [placed, setPlaced] = useState<{ id: number; total: number; payment: string } | null>(null);

  async function pickPayShot(f: File | null) {
    setPayShotErr(null);
    if (!f) {
      setPayShot(null);
      return;
    }
    const r = await readDepositScreenshot(f);
    if (!r.ok) {
      setPayShotErr(r.error);
      setPayShot(null);
      return;
    }
    setPayShot(r.att);
  }

  type CoErr = { key: string; label: string; msg: string };
  function checkoutErrors(): CoErr[] {
    const errs: CoErr[] = [];
    if (form.customerName.trim().length < 2)
      errs.push({ key: "customerName", label: t("co.fullName"), msg: t("val.name") });
    if (!phoneValidForCountry(form.phone, country))
      errs.push({ key: "phone", label: t("co.mobile"), msg: form.phone.trim() ? t("val.phoneCountry") : t("val.phoneMissing") });
    if (form.address.trim().length < 5)
      errs.push({ key: "address", label: t("co.address"), msg: t("val.address") });
    if (form.city.trim().length < 2)
      errs.push({ key: "city", label: t("co.city"), msg: t("val.city") });
    if (form.state.trim().length < 2)
      errs.push({ key: "state", label: regionLabel, msg: t("val.region") });
    if (!postalValidForCountry(country, form.pinCode))
      errs.push({ key: "pinCode", label: postalLabel, msg: t("val.postal") });
    if (payWhen === "first" && prepaidMethods.length > 0 && !payRef.trim() && !payShot)
      errs.push({ key: "payProof", label: t("co.payment"), msg: t("val.payProof") });
    return errs;
  }
  const coErrFor = (key: string) =>
    coTouched ? checkoutErrors().find((e) => e.key === key)?.msg : undefined;

  const paymentLabel = payWhen === "first" ? `Prepaid — ${effPayMethod}` : "Cash on Delivery";
  const place = useMutation({
    mutationFn: () =>
      api.placeOrder({
        buyerId: user!.id,
        customerName: form.customerName,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        pinCode: form.pinCode,
        paymentMethod: paymentLabel,
        paymentReference: payWhen === "first" ? payRef.trim() || undefined : undefined,
        paymentScreenshot: payWhen === "first" ? payShot ?? undefined : undefined,
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        setError(r.error ?? t("co.failed"));
        return;
      }
      setPlaced({ id: r.orderId!, total: r.total, payment: paymentLabel });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => setError(String(e)),
  });

  if (!user || user.role !== "buyer") {
    return <EmptyState title={t("cart.buyerOnlyT")} text={t("co.buyerOnlyD")} />;
  }
  if (placed) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="font-display text-4xl">✓</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-[var(--text)]">
          {t("co.successT")}
        </h2>
        <p className="mt-2 text-sm text-[var(--dim)]">
          {t("co.orderWord")} #{placed.id} · {t("cart.total")} {fmt(placed.total)} ·{" "}
          {t("co.successD")} {placed.payment}.
        </p>
        {placed.payment.startsWith("Prepaid — ") && (
          <p className="mx-auto mt-2 max-w-md rounded-lg bg-[var(--amber-bg)] px-3 py-2 text-sm font-semibold text-[var(--text)]">⏳ {t("co.successPrepaid")}</p>
        )}
        <button type="button" onClick={onDone} className={primaryBtn + " mt-4"}>
          {t("co.viewOrders")}
        </button>
      </div>
    );
  }
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-[var(--text)]">{t("co.title")}</h2>
      <form
        className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setCoTouched(true);
          if (checkoutErrors().length > 0) return;
          place.mutate();
        }}
      >
        {coTouched && checkoutErrors().length > 0 && (
          <ValidationSummary
            sectionLabel={t("co.title")}
            items={checkoutErrors().map((e) => ({ label: e.label, msg: e.msg }))}
          />
        )}
        <Field label={t("co.fullName")}>
          <input
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            className={errInputCls(!!coErrFor("customerName"))}
            aria-label="Full name"
          />
          <FieldError msg={coErrFor("customerName")} />
        </Field>
        <Field label={t("co.mobile")}>
          <input
            inputMode="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder={phonePlaceholder(country)}
            className={errInputCls(!!coErrFor("phone"))}
            aria-label="Mobile number"
          />
          <FieldError msg={coErrFor("phone")} />
        </Field>
        <Field label={t("co.address")}>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            className={errInputCls(!!coErrFor("address"))}
            aria-label="Delivery address"
          />
          <FieldError msg={coErrFor("address")} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("co.city")}>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className={errInputCls(!!coErrFor("city"))}
              aria-label="City"
            />
            <FieldError msg={coErrFor("city")} />
          </Field>
          <Field label={regionLabel}>
            {regions ? (
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className={errInputCls(!!coErrFor("state"))}
                aria-label={regionLabel}
              >
                <option value="">—</option>
                {regions.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className={errInputCls(!!coErrFor("state"))}
                aria-label={regionLabel}
              />
            )}
            <FieldError msg={coErrFor("state")} />
          </Field>
          <Field label={postalLabel}>
            <input
              inputMode="numeric"
              maxLength={postalLen ?? 10}
              value={form.pinCode}
              onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
              placeholder={country === "Pakistan" ? "54000" : country === "India" ? "400001" : ""}
              className={errInputCls(!!coErrFor("pinCode"))}
              aria-label={postalLabel}
            />
            <FieldError msg={coErrFor("pinCode")} />
          </Field>
        </div>
        <div>
          <p className="font-display text-sm font-bold text-[var(--text)]">{t("co.payment")}</p>
          <div role="radiogroup" aria-label={t("co.payment")} className="mt-1.5 flex flex-col gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={payWhen === "delivery"}
              onClick={() => setPayWhen("delivery")}
              className={`rounded-xl border p-3 text-left ${payWhen === "delivery" ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
            >
              <span className="block font-display text-sm font-bold text-[var(--text)]">💵 {t("co.payOnDelivery")} — {t("co.cod")}</span>
              <span className="mt-0.5 block text-xs leading-snug text-[var(--dim)]">{t("co.payOnDeliveryD")}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={payWhen === "first"}
              onClick={() => setPayWhen("first")}
              className={`rounded-xl border p-3 text-left ${payWhen === "first" ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)]"}`}
            >
              <span className="block font-display text-sm font-bold text-[var(--text)]">⚡ {t("co.payFirst")}</span>
              <span className="mt-0.5 block text-xs leading-snug text-[var(--dim)]">{t("co.payFirstD")}</span>
            </button>
          </div>
          {payWhen === "first" && (
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
              {prepaidMethods.length === 0 ? (
                <p className="text-sm leading-snug text-[var(--dim)]">{t("co.payLocalNote")}</p>
              ) : (
                <>
                  <Field label={t("co.payMethod")}>
                    <select
                      value={effPayMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className={inputCls}
                      aria-label={t("co.payMethod")}
                    >
                      {prepaidMethods.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </Field>
                  {effPayMethod === "USDT (Crypto)" ? (
                    st?.usdtDepositAddress ? (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <p className="text-sm font-semibold text-[var(--text)]">{t("co.payToAddress")}</p>
                        <p className="mt-1 inline-block rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-white">USDT — {st.depositNetwork}</p>
                        <p className="mt-2 break-all font-mono text-sm font-semibold text-[var(--text)]">{st.usdtDepositAddress}</p>
                        <div className="mt-2 inline-block rounded-lg bg-white p-1.5">
                          <QRCodeSVG value={st.usdtDepositAddress} size={132} bgColor="#FFFFFF" fgColor="#111827" level="M" marginSize={1} aria-label="USDT payment address QR code" />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-snug text-[var(--dim)]">{t("co.payUsdtSetup")}</p>
                    )
                  ) : (
                    <p className="text-sm leading-snug text-[var(--dim)]">{t("co.payLocalNote")}</p>
                  )}
                  <Field label={`${t("co.payRefLabel")}${payShot ? ` ${t("co.payRefOptional")}` : ""}`}>
                    <input
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      className={errInputCls(!!coErrFor("payProof"))}
                      aria-label="Payment transaction reference ID"
                    />
                  </Field>
                  <Field label={t("co.payShotLabel")}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(e) => pickPayShot(e.target.files?.[0] ?? null)}
                      className={inputCls}
                      aria-label="Payment screenshot"
                    />
                    {payShot && (
                      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                        📷 {payShot.fileName}
                        <button type="button" onClick={() => pickPayShot(null)} aria-label="Remove payment screenshot" className="text-rose-600">✕</button>
                      </p>
                    )}
                    {payShotErr && <p role="alert" className="mt-1 text-sm font-semibold text-rose-600">⚠ {payShotErr}</p>}
                  </Field>
                  <p className="text-xs leading-snug text-[var(--dim)]">{t("co.payProofHint")}</p>
                  <FieldError msg={coErrFor("payProof")} />
                </>
              )}
            </div>
          )}
        </div>
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onCart} className={ghostBtn}>
            {t("co.back")}
          </button>
          <button type="submit" disabled={place.isPending} className={goldBtn + " flex-1"}>
            {place.isPending ? t("co.placing") : t("co.place")}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProductReviews({ productId }: { productId: number }) {
  const { t } = useUi();
  const q = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: () => api.listProductReviews({ productId }),
  });
  const reviews = q.data?.reviews ?? [];
  const count = q.data?.count ?? 0;
  const avg = q.data?.avgRating ?? 0;
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-extrabold text-[var(--text)]">{t("reviews.title")}</h2>
      {q.isPending ? (
        <p className="mt-2 text-sm text-[var(--dim)]">{t("orders.loading")}</p>
      ) : count === 0 ? (
        <p className="mt-2 text-sm text-[var(--dim)]">{t("reviews.none")}</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-[var(--text)]">
            {"★".repeat(Math.round(avg))}
            {"☆".repeat(5 - Math.round(avg))} {avg.toFixed(1)} · {count} {count === 1 ? t("reviews.one") : t("reviews.many")}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {reviews.map((r: any) => (
              <li key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <p className="text-sm font-bold text-[var(--text)]">
                  {"★".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                  <span className="ml-1 font-semibold text-[var(--dim)]">
                    {r.buyerName} · {t("reviews.verified")}
                  </span>
                </p>
                {r.comment && <p className="mt-1 text-sm text-[var(--text)]">{r.comment}</p>}
                <p className="mt-1 text-xs text-[var(--dim)]">{new Date(r.createdAt).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function OrderItemReviews({ order, buyerId }: { order: Order; buyerId: number }) {
  const { t } = useUi();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<number | null>(null);
  const mine = useQuery({
    queryKey: ["my-reviews", buyerId],
    queryFn: () => api.listMyReviews({ buyerId }),
  });
  const reviewed = new Set((mine.data?.reviewed ?? []).map((r: any) => `${r.orderId}:${r.productId}`));
  const submit = useMutation({
    mutationFn: (args: { productId: number; rating: number; comment: string }) =>
      api.submitReview({ buyerId, orderId: order.id, productId: args.productId, rating: args.rating, comment: args.comment }),
    onSuccess: (res: any, args: { productId: number }) => {
      if (!res?.ok) {
        setErr(res?.error ?? "Could not submit review.");
        return;
      }
      setDoneId(args.productId);
      setOpenId(null);
      setStars(0);
      setComment("");
      setErr(null);
      queryClient.invalidateQueries({ queryKey: ["my-reviews", buyerId] });
      queryClient.invalidateQueries({ queryKey: ["product-reviews", args.productId] });
    },
    onError: (e: any) => setErr(String(e?.message ?? e)),
  });
  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border)] pt-2">
      {order.items.map((it: any) => {
        const key = `${order.id}:${it.productId}`;
        if (reviewed.has(key) || doneId === it.productId) {
          return (
            <p key={key} className="text-xs font-semibold text-emerald-600">
              {t("reviews.submitted")} — {it.productName}
            </p>
          );
        }
        return (
          <div key={key}>
            <button
              type="button"
              onClick={() => {
                setOpenId(openId === it.productId ? null : it.productId);
                setErr(null);
              }}
              className={ghostBtn + " px-3 py-1.5 text-xs"}
            >
              {t("reviews.write")} — {it.productName}
            </button>
            {openId === it.productId && (
              <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                <p className="text-xs font-bold text-[var(--text)]">{t("reviews.yourRating")}</p>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} star`}
                      onClick={() => setStars(n)}
                      className={`text-2xl ${stars >= n ? "text-amber-500" : "text-[var(--dim)]"}`}
                    >
                      {stars >= n ? "★" : "☆"}
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder={t("reviews.yourComment")}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                />
                {err && (
                  <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">
                    {err}
                  </p>
                )}
                <button
                  type="button"
                  disabled={submit.isPending}
                  onClick={() => {
                    if (!stars) {
                      setErr(t("reviews.pickRating"));
                      return;
                    }
                    submit.mutate({ productId: it.productId, rating: stars, comment });
                  }}
                  className={goldBtn + " mt-2 px-4 py-2 text-sm"}
                >
                  {t("reviews.submit")}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OrderCard({ order, hideItems, proofViewerId, reviewBuyerId, codActor }: { order: Order; hideItems?: boolean; proofViewerId?: number; reviewBuyerId?: number; codActor?: { role: "seller" | "admin"; id: number } }) {
  const { fmt, t } = useUi();
  const queryClient = useQueryClient();
  const [codBusy, setCodBusy] = useState(false);
  const [codErr, setCodErr] = useState<string | null>(null);
  // WhatsApp number for the COD confirmation chat: Pakistan 03XX numbers
  // get +92, Indian 10-digit numbers get +91, a leading + is kept as-is.
  const waDigits = (order.phone || "").replace(/\D/g, "");
  const waPhone = order.phone.trim().startsWith("+")
    ? waDigits
    : waDigits.length === 11 && waDigits.startsWith("0")
      ? `92${waDigits.slice(1)}`
      : waDigits.length === 10
        ? `91${waDigits}`
        : waDigits;
  const waLink = waPhone
    ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello, this is about your sheinmart order #${order.id} (Cash on Delivery). Please confirm that you will accept this order when it arrives.`)}`
    : "";
  const byCustomer = order.placedBy === "admin";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display font-bold text-[var(--text)]">Order #{order.id}</h3>
        <StatusBadge status={order.status} />
        {byCustomer && (
          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-strong)]">🧾 {t("order.byCustomer")}</span>
        )}
        <span className="ml-auto text-xs text-[var(--dim)]">
          {new Date(order.createdAt).toLocaleString()}
        </span>
      </div>
      {order.status !== "Cancelled" && (
        <div className="mt-3">
          <div className="relative mx-3">
            <div className="absolute left-3 right-3 top-3 h-0.5 bg-[var(--border)]" />
            <div
              className="absolute left-3 top-3 h-0.5 bg-emerald-600"
              style={{
                width:
                  order.status === "Delivered"
                    ? "calc(100% - 24px)"
                    : order.status === "Shipped"
                      ? "calc(50% - 12px)"
                      : "0%",
              }}
            />
            <div className="relative flex justify-between">
              {[
                { key: "placed", label: t("track.placed"), done: true },
                {
                  key: "shipped",
                  label: t("track.shipped"),
                  done: order.status === "Shipped" || order.status === "Delivered",
                },
                { key: "delivered", label: t("track.delivered"), done: order.status === "Delivered" },
              ].map((s, idx) => (
                <div key={s.key} className="flex flex-col items-center gap-1">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      s.done ? "bg-emerald-600 text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"
                    }`}
                  >
                    {s.done ? "✓" : idx + 1}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${s.done ? "text-[var(--text)]" : "text-[var(--dim)]"}`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* The products strip (the row of ordered products) is shown for
          buyers and Admin, but NOT in the seller's order area: there it
          only cluttered the order details. Product viewing and removal
          live only in the seller's Products tab. */}
      {!hideItems && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-[var(--text)]">
          {order.items.map((it) => (
            <li key={it.productId} className="flex justify-between gap-2">
              <span>
                {it.productName} × {it.qty}
              </span>
              <span className="font-medium">{fmt(it.buyerPrice * it.qty)}</span>
            </li>
          ))}
        </ul>
      )}
      {reviewBuyerId === order.buyerId && order.status === "Delivered" && (
        <OrderItemReviews order={order} buyerId={reviewBuyerId} />
      )}
      <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-[var(--border)] pt-2 text-sm">
        <span className="text-[var(--dim)]">
          {byCustomer ? (
            <>{t("order.byCustomer")} · {order.paymentMethod}</>
          ) : (
            <>
              {order.customerName} · {order.city}
              {order.state ? `, ${order.state}` : ""}
              {order.pinCode ? ` — ${order.pinCode}` : ""} · {order.paymentMethod}
            </>
          )}
        </span>
        <strong className="font-display text-[var(--text)]">{fmt(order.total)}</strong>
      </div>
      {/* Full delivery details — the street address and phone the
          buyer gave at checkout. This card is the ONLY order surface
          every viewer shares (the buyer, the fulfilling seller and
          Customer Service in the Admin Panel), and without it nobody
          could deliver the order or contact the buyer: earlier the
          card showed only name / city / PIN. Shown only to the order's
          own buyer, its attributed sellers and the Admin — the reads
          behind this card never return another customer's order. */}
      {(order.address || order.phone) && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--dim)]">
          📍 {t("order.deliverTo")}:{" "}
          <span className="text-[var(--text)]">
            {order.address}
            {order.city ? `, ${order.city}` : ""}
            {order.state ? `, ${order.state}` : ""}
            {order.pinCode ? ` — ${order.pinCode}` : ""}
          </span>
          {order.phone && (
            <>
              {" "}· 📞 <span className="text-[var(--text)]">{order.phone}</span>
            </>
          )}
        </p>
      )}
      {(order.paymentReference || order.hasPaymentProof) && (
        <p className="mt-1.5 text-xs text-[var(--dim)]">
          {order.paymentReference && (
            <>🧾 {t("order.payRef")}: <strong className="break-all text-[var(--text)]">{order.paymentReference}</strong></>
          )}
          {order.paymentReference && order.hasPaymentProof ? " · " : ""}
          {order.hasPaymentProof && <>📷 {t("order.proofAttached")}</>}
        </p>
      )}
      {/* Prepaid payment verification gate — clear stage text for the
          buyer (and the Admin). Sellers never receive these orders in
          their lists, so nothing here appears on the seller side. */}
      {order.paymentStatus === "pending" && (
        <p className="mt-2 rounded-lg bg-[var(--amber-bg)] px-3 py-2 text-xs font-semibold text-[var(--text)]">⏳ {t("paygate.under")}</p>
      )}
      {order.paymentStatus === "verified" && order.status !== "Delivered" && (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {t("paygate.verified")}</p>
      )}
      {order.paymentStatus === "rejected" && (
        <p role="alert" className="mt-2 rounded-lg bg-[var(--alert-bg)] px-3 py-2 text-xs font-semibold text-[var(--text)]">
          ✕ {t("paygate.rejected")}
          {order.paymentRejectReason && <> {t("paygate.reason")}: {order.paymentRejectReason}</>}
        </p>
      )}
      {order.paymentMethod === "Cash on Delivery" && order.codConfirmed ? (
        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {t("cod.confirmed")}</p>
      ) : order.paymentMethod === "Cash on Delivery" && order.status !== "Delivered" && order.status !== "Cancelled" ? (
        <div className="mt-2 rounded-lg bg-[var(--amber-bg)] px-3 py-2">
          <p className="text-xs font-semibold text-[var(--text)]">⏳ {t("cod.awaiting")}</p>
          {codActor && (
            <div className="mt-1.5 flex flex-wrap gap-2">
              {waLink && (
                <a href={waLink} target="_blank" rel="noreferrer" className={ghostBtn + " px-3 py-1.5 text-xs"}>💬 {t("cod.whatsapp")}</a>
              )}
              <button
                type="button"
                disabled={codBusy}
                onClick={async () => {
                  setCodBusy(true);
                  setCodErr(null);
                  try {
                    const res: any = await api.markCodConfirmed({ actorRole: codActor.role, actorId: codActor.id, orderId: order.id });
                    if (!res?.ok) {
                      setCodErr(res?.error ?? "Could not mark COD confirmed.");
                      setCodBusy(false);
                      return;
                    }
                    queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
                    queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
                    queryClient.invalidateQueries({ queryKey: ["admin-seller-orders"] });
                    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
                  } catch (e: any) {
                    setCodErr(String(e?.message ?? e));
                  }
                  setCodBusy(false);
                }}
                className={goldBtn + " px-3 py-1.5 text-xs"}
              >
                ✓ {t("cod.markConfirmed")}
              </button>
            </div>
          )}
          {codErr && (
            <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">
              {codErr}
            </p>
          )}
        </div>
      ) : null}
      {proofViewerId !== undefined && order.hasPaymentProof && (
        <div className="mt-2"><OrderPaymentProofView orderId={order.id} adminId={proofViewerId} /></div>
      )}
    </div>
  );
}

function OrdersView({ user }: { user: User }) {
  const { t } = useUi();
  const orders = useQuery({
    queryKey: ["buyer-orders", user?.id],
    queryFn: () => api.listBuyerOrders({ buyerId: user!.id }),
    enabled: !!user && user.role === "buyer",
  });
  if (!user) {
    return <EmptyState title={t("cart.signInT")} text={t("orders.signInD")} />;
  }
  if (user.role !== "buyer") {
    return <EmptyState title={t("orders.title")} text={t("orders.buyerOnlyD")} />;
  }
  if (orders.isPending)
    return <p className="py-10 text-center text-[var(--dim)]">{t("orders.loading")}</p>;
  const list = orders.data?.orders ?? [];
  if (list.length === 0) {
    return <EmptyState title={t("orders.emptyT")} text={t("orders.emptyD")} />;
  }
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-[var(--text)]">{t("orders.title")}</h2>
      <div className="mt-4 flex flex-col gap-3">
        {list.map((o) => (
          <OrderCard key={o.id} order={o} proofViewerId={user.id} reviewBuyerId={user.id} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Seller application form ------------------------ */


type UploadInfo = { blobKey: string; fileName: string; contentType: string; size: number; previewUrl: string };

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 1200;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale >= 1 && file.size < 900000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    const cx = canvas.getContext("2d"); if (!cx) return file;
    cx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob ?? file;
  } catch { return file; }
}

function FileNameField({ label, value, onChange, required, kind, onUpload }: {
  label: string; value: string; onChange: (name: string) => void; required?: boolean;
  kind?: "photo" | "logo" | "docFront" | "docBack"; onUpload?: (info: UploadInfo | null) => void;
}) {
  const { t } = useUi();
  const [busy, setBusy] = useState(false);
  const [uerr, setUerr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <Field label={label}>
      <input type="file" required={required} aria-label={label} accept="image/*,application/pdf"
        onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          onChange(file.name); setUerr(null); setDone(false);
          if (file.size > 3 * 1024 * 1024 && !file.type.startsWith("image/")) { setUerr(t("sa.tooLarge")); return; }
          if (!kind || !onUpload) return;
          setBusy(true);
          try {
            const prepared = await compressImage(file);
            const asFile = prepared instanceof File ? prepared : new File([prepared], file.name.replace(/\.(png|webp)$/i, ".jpg"), { type: prepared.type || file.type });
            const enc = await fileToBase64(asFile);
            if (enc.dataBase64.length > 5800000) { setUerr(t("sa.tooLarge")); setBusy(false); return; }
            const r = await api.uploadSellerDocument({ fileName: file.name, contentType: enc.mimeType, dataBase64: enc.dataBase64, kind });
            if (!r.ok || !r.blobKey) { setUerr(r.error ?? t("sa.tooLarge")); setBusy(false); return; }
            const pv = enc.mimeType.startsWith("image/") ? URL.createObjectURL(asFile) : "";
            setPreview(pv || null); setDone(true);
            onUpload({ blobKey: r.blobKey, fileName: r.fileName, contentType: r.contentType, size: r.size, previewUrl: pv });
          } catch (err) { setUerr(String(err)); }
          setBusy(false);
        }}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
      {busy && <span className="mt-1 block text-xs font-semibold text-[var(--dim)]">{t("sa.uploading")}</span>}
      {uerr && <span role="alert" className="mt-1 block text-xs font-semibold text-rose-600">⚠ {uerr}</span>}
      {value && !uerr && <span className="mt-1 block text-xs text-[var(--dim)]">📎 {value}{done ? ` — ${t("sa.uploaded")}` : ""}</span>}
      {preview && <img src={preview} alt={label} className="mt-2 h-20 w-20 rounded-lg object-cover border border-[var(--border)]" />}
    </Field>
  );
}

function formatBytes(n: number | null | undefined): string { if (!n) return ""; if (n < 1024) return `${n} B`; if (n < 1048576) return `${Math.round(n / 1024)} KB`; return `${(n / 1048576).toFixed(1)} MB`; }
function kindLabel(kind: string): string { if (kind === "admin_credit") return "Customer Service Credit"; if (kind === "order_completed") return "Order Completed"; if (kind === "order_payment_held") return "Order Payment Held"; if (kind === "order_payment_released") return "Order Payment Released"; if (kind === "balance_correction") return "Balance Correction — completed orders"; if (kind === "deposit") return "Deposit"; if (kind === "withdraw") return "Withdrawal"; if (kind === "withdraw_paid") return "Withdrawal Paid"; if (kind === "admin_withdraw") return "Customer Service Withdrawal"; if (kind === "order_payment") return "Order Payment"; return kind; }

type WithdrawalEntry = { id: number; kind: string; amount: number; method: string; paymentReference: string; note: string; status: string; createdAt: string };
type DepositEntry = { id: number; kind: string; amount: number; method: string; reference: string; note: string; createdAt: string };

function FinanceSummary({ finance, compact, hideBalance }: { finance: { availableBalance: number; totalBalance?: number; pendingOrderHolds?: number; usedAmount: number; pendingWithdrawal: number; pendingDeposit: number; pendingOrderEarnings: number; totalPending: number; totalOrderValue: number; orderCount: number; totalDeposited?: number; totalWithdrawn?: number; withdrawals?: WithdrawalEntry[]; deposits?: DepositEntry[]; totalAdminCredit?: number; earningsCleared?: number; orders?: Array<{ orderId: number; pendingAmount: number; status: string }> }; compact?: boolean; hideBalance?: boolean }) {
  const { t, fmt } = useUi();
  // Pending = ONLY order cost held for orders in Shipment. Total =
  // Available + Pending. Deposit/withdrawal requests awaiting approval
  // are shown separately below and are never part of Pending.
  const pendingHeld = finance.pendingOrderHolds ?? finance.totalPending;
  const totalBalance = finance.totalBalance ?? finance.availableBalance + pendingHeld;
  const heldOrders = (finance.orders ?? []).filter((o) => o.pendingAmount > 0);
  return (<div>
    {/* 1 — Total Balance (big) + 2 — Available / 3 — Pending. Skipped when
        hideBalance is set: the Seller Wallet shows these same three
        figures in its compact balance strip at the very top instead, so
        the balance is never shown twice. */}
    {!hideBalance && (<>
    <div className="rounded-2xl bg-[var(--accent)] p-4 text-center text-white">
      <p className="font-display text-2xl font-extrabold min-[400px]:text-3xl">{fmt(totalBalance)}</p>
      <p className="mt-0.5 text-sm font-bold text-white/90">{t("fin.total")}</p>
      <p className="mt-0.5 text-xs text-white/75">{t("fin.totalSub")}</p>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
        <p className="font-display text-base font-extrabold leading-tight text-[var(--text)] min-[400px]:text-lg">{fmt(finance.availableBalance)}</p>
        <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">{t("w.balance")}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--dim)]">{t("fin.availableSub")}</p>
      </div>
      <div className="min-w-0 rounded-xl border border-[var(--amber)] bg-[var(--amber-bg)] p-3 text-center">
        <p className="font-display text-base font-extrabold leading-tight text-[var(--text)] min-[400px]:text-lg">{fmt(pendingHeld)}</p>
        <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">{t("fin.pendingCard")}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--dim)]">{t("fin.pendingSub")}</p>
      </div>
    </div>
    </>)}
    {/* Per-order held list — exactly what makes up Pending */}
    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-sm font-bold text-[var(--text)]">⏳ {t("fin.heldOrders")}</p>
      {heldOrders.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--dim)]">{t("fin.noHeld")}</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {heldOrders.map((o) => (
            <li key={o.orderId} className="flex flex-wrap items-center gap-2 text-sm">
              <strong className="text-[var(--text)]">Order #{o.orderId}</strong>
              <StatusBadge status={o.status} />
              <span className="ml-auto font-display font-bold text-[var(--text)]">{t("fin.heldAmount")}: {fmt(o.pendingAmount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
    <div className="mt-3 grid gap-2 rounded-xl bg-[var(--surface-alt)] p-3 text-sm sm:grid-cols-3">
      <p><span className="text-[var(--dim)]">{t("fin.used")}:</span> <strong>{fmt(finance.usedAmount)}</strong></p>
      <p><span className="text-[var(--dim)]">{t("fin.ordersTotal")}:</span> <strong>{fmt(finance.totalOrderValue)}</strong> <span className="text-[var(--dim)]">({finance.orderCount} {t("fin.ordersCount")})</span></p>
      {finance.totalAdminCredit !== undefined && <p><span className="text-[var(--dim)]">{t("fin.adminCredit")}:</span> <strong>{fmt(finance.totalAdminCredit)}</strong></p>}
      {finance.earningsCleared !== undefined && <p><span className="text-[var(--dim)]">{t("fin.profit")} ({t("sord.secCompleted")}):</span> <strong>{fmt(finance.earningsCleared)}</strong></p>}
    </div>
    {/* Requests awaiting approval — separate from Pending, no effect on it */}
    <div className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
      <p className="font-semibold text-[var(--text)]">🕐 {t("fin.requestsAwaiting")}</p>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <p><span className="text-[var(--dim)]">{t("fin.pendingDeposit")}:</span> <strong>{fmt(finance.pendingDeposit)}</strong></p>
        <p><span className="text-[var(--dim)]">{t("fin.pendingWithdraw")}:</span> <strong>{fmt(finance.pendingWithdrawal)}</strong></p>
      </div>
    </div>
    {/* Total Withdrawn / Total Deposited — money that has ACTUALLY moved.
        Withdrawn counts only payouts (Paid ✓ requests + direct Admin
        Withdrawals); pending/rejected requests never count. Deposited
        counts Admin-approved deposits PLUS direct Customer Service
        Credits (Admin → Add Amount), each exactly once. Both come from
        the same shared finance computation as every figure above. */}
    {finance.totalWithdrawn !== undefined && (
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
            <p className="font-display text-base font-extrabold leading-tight text-[var(--text)] min-[400px]:text-lg">{fmt(finance.totalWithdrawn)}</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">⬆️ {t("w.withdrawn")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--dim)]">{t("fin.withdrawnSub")}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
            <p className="font-display text-base font-extrabold leading-tight text-[var(--text)] min-[400px]:text-lg">{fmt(finance.totalDeposited ?? 0)}</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--text)]">⬇️ {t("w.deposited")}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--dim)]">{t("fin.depositedSub")}</p>
          </div>
        </div>
        {finance.withdrawals !== undefined && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm font-bold text-[var(--text)]">⬆️ {t("fin.withdrawalsList")} ({finance.withdrawals.length})</p>
            {finance.withdrawals.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--dim)]">{t("fin.noWithdrawals")}</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {finance.withdrawals.map((wd) => (
                  <li key={wd.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{t("fin.paidBadge")}</span>
                    <span className="min-w-0 text-[var(--text)]">{wd.kind === "admin_withdraw" ? t("fin.adminWithdrawal") : wd.method || t("w.withdraw")}{wd.paymentReference ? ` · ${wd.paymentReference}` : ""}{wd.note && wd.kind === "admin_withdraw" ? ` · ${wd.note}` : ""}</span>
                    <span className="ml-auto font-display font-bold text-[var(--text)]">−{fmt(wd.amount)}</span>
                    <span className="w-full text-[11px] text-[var(--dim)]">{new Date(wd.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {finance.deposits !== undefined && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm font-bold text-[var(--text)]">⬇️ {t("fin.depositsList")} ({finance.deposits.length})</p>
            {finance.deposits.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--dim)]">{t("fin.noDeposits")}</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {finance.deposits.map((dp) => (
                  <li key={dp.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 text-[var(--text)]">{dp.kind === "admin_credit" ? t("fin.adminCredit") : dp.method}{dp.kind !== "admin_credit" && dp.reference ? ` · ${dp.reference}` : ""}{dp.kind === "admin_credit" && dp.note ? ` · ${dp.note}` : ""}</span>
                    <span className="ml-auto font-display font-bold text-[var(--text)]">+{fmt(dp.amount)}</span>
                    <span className="w-full text-[11px] text-[var(--dim)]">{new Date(dp.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )}
  </div>);
}

function FinanceOrdersLedger({ finance }: { finance: { orders: Array<{ orderId: number; createdAt: string; productNames: string; orderAmount: number; profit: number; clearedAmount: number; pendingAmount: number; status: string; payableCost?: number; paidFromWallet?: boolean }>; ledger: Array<{ id: string; kind: string; amount: number; direction: string; method: string; reference: string; note: string; status: string; runningBalance: number; createdAt: string }> } }) {
  const { t, fmt } = useUi();
  return (<div className="mt-4 grid gap-5 lg:grid-cols-2">
    <div><h4 className="font-display font-bold text-[var(--text)]">{t("fin.orderBreakdown")} ({finance.orders.length})</h4>
      {finance.orders.length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noOrders")}</p> : <div className="mt-2 flex flex-col gap-2">{finance.orders.map((o) => (<div key={o.orderId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"><div className="flex flex-wrap gap-2"><strong>Order #{o.orderId}</strong><StatusBadge status={o.status} />{o.paidFromWallet && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{t("sord.paidFromWallet")}</span>}<span className="ml-auto font-display font-bold">{fmt(o.orderAmount)}</span></div><p className="mt-1 text-xs text-[var(--dim)]">{o.productNames} · {new Date(o.createdAt).toLocaleString()}</p><p className="mt-1 text-xs">{t("fin.profit")}: <strong>{fmt(o.profit)}</strong> · {t("fin.clearedFull")}: <strong>{fmt(o.clearedAmount)}</strong> · {t("fin.heldAmount")}: <strong>{fmt(o.pendingAmount)}</strong>{o.payableCost !== undefined && <> · {t("sord.payable")}: <strong>{fmt(o.payableCost)}</strong></>}</p></div>))}</div>}
    </div>
    <div><h4 className="font-display font-bold text-[var(--text)]">{t("fin.ledger")} ({finance.ledger.length})</h4>
      {finance.ledger.length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("w.noHistory")}</p> : <div className="mt-2 flex flex-col gap-2">{finance.ledger.map((e) => (<div key={e.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"><div className="flex flex-wrap gap-2"><strong>{kindLabel(e.kind)}</strong><StatusBadge status={e.status} /><span className="ml-auto font-display font-bold">{e.direction === "debit" ? "−" : "+"}{fmt(e.amount)}</span></div><p className="mt-1 text-xs text-[var(--dim)]">{e.method}{e.reference ? ` · ${e.reference}` : ""}{e.note ? ` · ${e.note}` : ""} · {new Date(e.createdAt).toLocaleString()}</p><p className="text-xs">{t("fin.running")}: <strong>{fmt(e.runningBalance)}</strong></p></div>))}</div>}
    </div>
  </div>);
}

function SellerApplicationForm({ onDone }: { onDone: () => void }) {
  const { t } = useUi();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [f, setF] = useState({
    country: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pinCode: "",
    dateOfBirth: "",
    photoFileName: "",
    storeName: "",
    storeDescription: "",
    storeLogoFileName: "",
    storeAddress: "",
    businessType: "Individual",
    gstNumber: "",
    docType: "Aadhaar Card" as
      | "Aadhaar Card"
      | "Ration Card"
      | "PAN Card"
      | "Voter ID",
    docNumber: "",
    docFrontFileName: "",
    docBackFileName: "",
  });
  const [touched, setTouched] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);
  const [uploads, setUploads] = useState<Record<string, UploadInfo | null>>({});

  type FieldErr = { key: string; label: string; msg: string };
  function stepErrors(s: number): FieldErr[] {
    const errs: FieldErr[] = [];
    if (s === 1) {
      if (!f.country)
        errs.push({ key: "country", label: t("acc.country"), msg: t("val.country") });
      if (f.name.trim().length < 2)
        errs.push({ key: "name", label: t("sa.fullName"), msg: t("val.name") });
      const emailGiven = f.email.trim() !== "";
      const phoneGiven = f.phone.trim() !== "";
      if (!emailGiven && !phoneGiven)
        errs.push({ key: "contact", label: `${t("auth.withGmail")} / ${t("auth.withMobile")}`, msg: t("val.oneContact") });
      if (emailGiven && !isEmailOk(f.email))
        errs.push({ key: "email", label: t("sa.email"), msg: t("val.email") });
      if (phoneGiven && !phoneValidForCountry(f.phone, f.country))
        errs.push({ key: "phone", label: t("sa.phone"), msg: t("val.phoneCountry") });
      if (f.password.length === 0)
        errs.push({ key: "password", label: t("sa.password"), msg: t("val.passwordMissing") });
      else if (f.password.length < 4)
        errs.push({ key: "password", label: t("sa.password"), msg: t("val.password") });
      if (f.address.trim().length < 5)
        errs.push({ key: "address", label: t("sa.address"), msg: t("val.address") });
      if (f.city.trim().length < 2)
        errs.push({ key: "city", label: t("sa.city"), msg: t("val.city") });
      if (f.state.trim().length < 2)
        errs.push({ key: "state", label: t("sa.state"), msg: t("val.region") });
      if (!postalValidForCountry(f.country, f.pinCode))
        errs.push({ key: "pinCode", label: t("sa.pin"), msg: t("val.postal") });
      if (!f.dateOfBirth)
        errs.push({ key: "dateOfBirth", label: t("sa.dob"), msg: t("val.dob") });
    }
    if (s === 2) {
      if (f.storeName.trim().length < 2)
        errs.push({ key: "storeName", label: t("sa.storeName"), msg: t("val.storeName") });
      if (f.storeDescription.trim().length < 10)
        errs.push({ key: "storeDescription", label: t("sa.storeDesc"), msg: t("val.storeDesc") });
      if (f.storeAddress.trim().length < 5)
        errs.push({ key: "storeAddress", label: t("sa.storeAddress"), msg: t("val.storeAddress") });
    }
    if (s === 3) {
      if (!f.docType)
        errs.push({ key: "docType", label: t("sa.docType"), msg: t("val.docType") });
      if (f.docNumber.trim().length < 4)
        errs.push({ key: "docNumber", label: t("sa.docNumber"), msg: t("val.docNumber") });
      if (!f.docFrontFileName)
        errs.push({ key: "docFrontFileName", label: t("sa.docFront"), msg: t("val.docFront") });
    }
    return errs;
  }
  const currentErrors = touched ? stepErrors(step) : [];
  const errFor = (key: string) =>
    touched ? stepErrors(step).find((e) => e.key === key)?.msg : undefined;

  const apply = useMutation({
    mutationFn: () =>
      api.registerSeller({
        country: f.country,
        name: f.name,
        email: f.email.trim() || undefined,
        password: f.password,
        phone: f.phone,
        address: f.address,
        city: f.city,
        state: f.state,
        pinCode: f.pinCode,
        dateOfBirth: f.dateOfBirth,
        photoFileName: f.photoFileName || undefined,
        storeName: f.storeName,
        storeDescription: f.storeDescription,
        storeLogoFileName: f.storeLogoFileName || undefined,
        storeAddress: f.storeAddress,
        businessType: f.businessType,
        gstNumber: f.gstNumber || undefined,
        docType: f.docType,
        docNumber: f.docNumber,
        docFrontFileName: f.docFrontFileName,
        docBackFileName: f.docBackFileName || undefined,
        photoBlobKey: uploads.photo?.blobKey, photoContentType: uploads.photo?.contentType, photoSize: uploads.photo?.size,
        storeLogoBlobKey: uploads.logo?.blobKey, storeLogoContentType: uploads.logo?.contentType, storeLogoSize: uploads.logo?.size,
        docFrontBlobKey: uploads.docFront?.blobKey, docFrontContentType: uploads.docFront?.contentType, docFrontSize: uploads.docFront?.size,
        docBackBlobKey: uploads.docBack?.blobKey, docBackContentType: uploads.docBack?.contentType, docBackSize: uploads.docBack?.size,
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        setError(r.error ?? "Application failed.");
        return;
      }
      setSubmitted(true);
    },
    onError: (e) => setError(String(e)),
  });

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <p className="font-display text-4xl">🕒</p>
        <h3 className="mt-2 font-display text-xl font-bold text-[var(--text)]">
          {t("sa.doneT")}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--dim)]">{t("sa.doneD")}</p>
        <button type="button" onClick={onDone} className={primaryBtn + " mt-4"}>
          {t("acc.signIn")}
        </button>
      </div>
    );
  }

  const steps = [t("sa.step1"), t("sa.step2"), t("sa.step3")];

  return (
    <div ref={topRef} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="font-display text-xl font-bold text-[var(--text)]">{t("sa.title")}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">{t("sa.sub")}</p>
      <ol className="mt-4 flex gap-2" aria-label="Application steps">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-bold ${
              step === i + 1
                ? "bg-[var(--accent)] text-white"
                : step > i + 1
                  ? "bg-[var(--surface-alt)] text-[var(--accent)]"
                  : "bg-[var(--surface-alt)] text-[var(--dim)]"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {touched && currentErrors.length > 0 && (
        <div className="mt-4">
          <ValidationSummary
            sectionLabel={`Step ${step} – ${steps[step - 1]}`}
            items={currentErrors.map((e) => ({ label: e.label, msg: e.msg }))}
          />
        </div>
      )}
      {touched && errFor("contact") && step === 1 && (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30">
          ⚠ {errFor("contact")}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {step === 1 && (
          <>
            <Field label={t("acc.country")}>
              <select value={f.country} onChange={(e) => { const c = e.target.value; setF({ ...f, country: c, state: regionsFor(c) ? "" : f.state }); }} className={errInputCls(!!errFor("country"))} aria-label="Seller country">
                <option value="">{t("acc.countryPh")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <FieldError msg={errFor("country")} />
            </Field>
            <Field label={t("sa.fullName")}>
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={errInputCls(!!errFor("name"))} aria-label="Seller full name" />
              <FieldError msg={errFor("name")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("acc.emailOpt")}>
                <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!errFor("email"))} aria-label="Seller email" />
                <FieldError msg={errFor("email")} />
              </Field>
              <Field label={t("sa.password")}>
                <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={errInputCls(!!errFor("password"))} aria-label="Seller password" />
                <FieldError msg={errFor("password")} />
              </Field>
              <Field label={t("sa.phone")}>
                <input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder={phonePlaceholder(f.country)} className={errInputCls(!!errFor("phone"))} aria-label="Seller mobile number" />
                <FieldError msg={errFor("phone")} />
              </Field>
              <Field label={t("sa.dob")}>
                <input type="date" value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} className={errInputCls(!!errFor("dateOfBirth"))} aria-label="Date of birth" />
                <FieldError msg={errFor("dateOfBirth")} />
              </Field>
            </div>
            <Field label={t("sa.address")}>
              <textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className={errInputCls(!!errFor("address"))} aria-label="Home address" />
              <FieldError msg={errFor("address")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("sa.city")}>
                <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={errInputCls(!!errFor("city"))} aria-label="Seller city" />
                <FieldError msg={errFor("city")} />
              </Field>
              <Field label={t("sa.state")}>
                {regionsFor(f.country) ? (
                  <select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className={inputCls} aria-label="Seller state">
                    <option value="">—</option>
                    {regionsFor(f.country)!.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className={inputCls} aria-label="Seller state" />
                )}
                <FieldError msg={errFor("state")} />
              </Field>
              <Field label={t("sa.pin")}>
                <input inputMode="numeric" maxLength={postalLengthFor(f.country) ?? 10} value={f.pinCode} onChange={(e) => setF({ ...f, pinCode: e.target.value })} className={errInputCls(!!errFor("pinCode"))} aria-label="Seller PIN code" />
                <FieldError msg={errFor("pinCode")} />
              </Field>
            </div>
            <FileNameField kind="photo" onUpload={(info) => setUploads((u) => ({ ...u, photo: info }))}
              label={t("sa.photo")}
              value={f.photoFileName}
              onChange={(name) => setF({ ...f, photoFileName: name })}
            />
          </>
        )}

        {step === 2 && (
          <>
            <Field label={t("sa.storeName")}>
              <input value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} placeholder="e.g. Sharma Fashion Store" className={errInputCls(!!errFor("storeName"))} aria-label="Store name" />
              <FieldError msg={errFor("storeName")} />
            </Field>
            <Field label={t("sa.storeDesc")}>
              <textarea rows={3} value={f.storeDescription} onChange={(e) => setF({ ...f, storeDescription: e.target.value })} placeholder={t("sa.storeDescPh")} className={errInputCls(!!errFor("storeDescription"))} aria-label="Store description" />
              <FieldError msg={errFor("storeDescription")} />
            </Field>
            <FileNameField kind="logo" onUpload={(info) => setUploads((u) => ({ ...u, logo: info }))}
              label={t("sa.storeLogo")}
              value={f.storeLogoFileName}
              onChange={(name) => setF({ ...f, storeLogoFileName: name })}
            />
            <Field label={t("sa.storeAddress")}>
              <textarea rows={2} value={f.storeAddress} onChange={(e) => setF({ ...f, storeAddress: e.target.value })} className={errInputCls(!!errFor("storeAddress"))} aria-label="Store address" />
              <FieldError msg={errFor("storeAddress")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("sa.businessType")}>
                <select value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })} className={inputCls} aria-label="Business type">
                  <option>Individual</option>
                  <option>Proprietorship</option>
                  <option>Partnership</option>
                  <option>Private Limited Company</option>
                  <option>Other</option>
                </select>
              </Field>
              <Field label={t("sa.gst")}>
                <input value={f.gstNumber} onChange={(e) => setF({ ...f, gstNumber: e.target.value })} placeholder="22AAAAA0000A1Z5" className={inputCls} aria-label="GST number" />
              </Field>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("sa.docType")}>
                <select
                  value={f.docType}
                  onChange={(e) => setF({ ...f, docType: e.target.value as typeof f.docType })}
                  className={inputCls}
                  aria-label="Document type"
                >
                  <option>Aadhaar Card</option>
                  <option>Ration Card</option>
                  <option>PAN Card</option>
                  <option>Voter ID</option>
                  <option>Passport</option>
                  <option>National ID Card</option>
                </select>
              </Field>
              <Field label={t("sa.docNumber")}>
                <input value={f.docNumber} onChange={(e) => setF({ ...f, docNumber: e.target.value })} className={errInputCls(!!errFor("docNumber"))} aria-label="Document number" />
                <FieldError msg={errFor("docNumber")} />
              </Field>
            </div>
            <div>
              <FileNameField kind="docFront" onUpload={(info) => setUploads((u) => ({ ...u, docFront: info }))}
                label={t("sa.docFront")}
                required
                value={f.docFrontFileName}
                onChange={(name) => setF({ ...f, docFrontFileName: name })}
              />
              <FieldError msg={errFor("docFrontFileName")} />
            </div>
            <FileNameField kind="docBack" onUpload={(info) => setUploads((u) => ({ ...u, docBack: info }))}
              label={t("sa.docBack")}
              value={f.docBackFileName}
              onChange={(name) => setF({ ...f, docBackFileName: name })}
            />
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {t("sa.docNote2")}
            </p>
          </>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30">{error}</p>}
      <div className="mt-4 flex gap-2">
        {step > 1 && (
          <button type="button" onClick={() => { setStep(step - 1); setTouched(false); setError(null); }} className={ghostBtn}>
            {t("sa.back")}
          </button>
        )}
        {step < 3 && (
          <button
            type="button"
            className={primaryBtn + " flex-1"}
            onClick={() => {
              setTouched(true);
              const errs = stepErrors(step);
              if (errs.length > 0) {
                setError(null);
                topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
              }
              setTouched(false);
              setError(null);
              setStep(step + 1);
            }}
          >
            {t("sa.continue")}
          </button>
        )}
        {step === 3 && (
          <button
            type="button"
            disabled={apply.isPending}
            className={primaryBtn + " flex-1"}
            onClick={() => {
              // Check every step; jump back to the first step with problems
              // and name exactly what is missing or wrong there.
              for (const s of [1, 2, 3]) {
                if (stepErrors(s).length > 0) {
                  setStep(s);
                  setTouched(true);
                  setError(null);
                  topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
              }
              setError(null);
              apply.mutate();
            }}
          >
            {apply.isPending ? t("sa.submitting") : t("sa.submit")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Auth / Account ---------------------------- */

function VerificationBanner({ user }: { user: NonNullable<User> }) {
  const { t } = useUi();
  if (user.role !== "seller") return null;
  if (user.verificationStatus === "pending") {
    return (
      <div className="mt-4 rounded-xl bg-[var(--amber-bg)] px-4 py-3 text-sm text-[var(--text)]">
        <strong>⏳ {t("acc.pendingT")}</strong>
        <p className="mt-0.5">{t("acc.pendingD")}</p>
      </div>
    );
  }
  if (user.verificationStatus === "rejected") {
    return (
      <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
        <strong>{t("acc.rejectedT")}</strong>
        <p className="mt-0.5">{t("acc.rejectedD")}</p>
      </div>
    );
  }
  if (user.verificationStatus === "approved") {
    return (
      <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <strong>{t("acc.approvedT")}</strong>
        <p className="mt-0.5">{t("acc.approvedD")}</p>
      </div>
    );
  }
  return null;
}


/* Self-service change password (buyer / seller / admin): current required. */
function ChangeMyPasswordPanel({ userId, onDone }: { userId: number; onDone?: () => void }) {
  const { t } = useUi();
  const [f, setF] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [touched, setTouched] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  type CpErr = { key: string; label: string; msg: string };
  function errs(): CpErr[] { const e: CpErr[] = []; if (!f.currentPassword) e.push({ key: "currentPassword", label: t("cp.current"), msg: t("cp.val.currentMissing") }); if (!f.newPassword) e.push({ key: "newPassword", label: t("cp.new"), msg: t("cp.val.newMissing") }); else if (f.newPassword.length < 4) e.push({ key: "newPassword", label: t("cp.new"), msg: t("cp.val.newShort") }); if (f.confirmPassword !== f.newPassword) e.push({ key: "confirmPassword", label: t("cp.confirm"), msg: t("cp.val.mismatch") }); return e; }
  const errFor = (k: string) => touched ? errs().find((e) => e.key === k)?.msg : undefined;
  const mut = useMutation({ mutationFn: () => api.changeMyPassword({ userId, currentPassword: f.currentPassword, newPassword: f.newPassword }), onSuccess: (r) => { if (!r.ok) { setServerErr(r.error ?? "Failed."); setOk(null); return; } setServerErr(null); setOk(t("cp.ok")); setF({ currentPassword: "", newPassword: "", confirmPassword: "" }); setTouched(false); onDone?.(); }, onError: (e) => setServerErr(String(e)) });
  return (
    <form className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); setServerErr(null); if (errs().length > 0) return; mut.mutate(); }}>
      <h3 className="font-display font-bold text-[var(--text)]">🔑 {t("cp.title")}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">{t("cp.sub")}</p>
      {touched && errs().length > 0 && <div className="mt-3"><ValidationSummary sectionLabel={t("cp.title")} items={errs().map((e) => ({ label: e.label, msg: e.msg }))} /></div>}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={t("cp.current")}><input type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} className={errInputCls(!!errFor("currentPassword"))} aria-label="Your current password" /><FieldError msg={errFor("currentPassword")} /></Field>
        <Field label={t("cp.new")}><input type="password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} className={errInputCls(!!errFor("newPassword"))} aria-label="Your new password" /><FieldError msg={errFor("newPassword")} /></Field>
        <Field label={t("cp.confirm")}><input type="password" value={f.confirmPassword} onChange={(e) => setF({ ...f, confirmPassword: e.target.value })} className={errInputCls(!!errFor("confirmPassword"))} aria-label="Confirm your new password" /><FieldError msg={errFor("confirmPassword")} /></Field>
      </div>
      {serverErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {serverErr}</p>}
      {ok && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {ok}</p>}
      <button type="submit" disabled={mut.isPending} className={primaryBtn + " mt-3"}>{t("cp.btn")}</button>
    </form>
  );
}

/* --------- Seller profile photo & store logo (display + change) --------- */

// Shows the seller's stored profile photo / store logo (real uploaded file,
// fetched through getMyDocumentUrl — the same blob storage used at signup),
// or a clean initial-letter tile when no file is on record.
function SellerMediaImage({
  sellerId,
  kind,
  hasFile,
  fallbackText,
  className,
}: {
  sellerId: number;
  kind: "photo" | "logo";
  hasFile: boolean;
  fallbackText: string;
  className: string;
}) {
  const doc = useQuery({
    queryKey: ["my-doc", sellerId, kind],
    queryFn: () => api.getMyDocumentUrl({ sellerId, kind }),
    enabled: hasFile,
  });
  const url = doc.data?.url ?? null;
  const isImg = (doc.data?.contentType ?? "").startsWith("image/");
  if (hasFile && url && isImg) {
    return <img src={url} alt="" className={`${className} object-cover`} />;
  }
  return (
    <span
      aria-hidden
      className={`${className} flex items-center justify-center bg-[var(--accent)] font-display font-bold text-white`}
    >
      {fallbackText.charAt(0).toUpperCase()}
    </span>
  );
}

// One editable image (profile photo OR store logo). On open it shows ONLY
// the current image with a plain "Change Photo" / "Change Logo" button —
// no upload control is dumped on the page. Tapping Change reveals the
// upload control (file pick + Save + Cancel) for THIS item only; on Save
// it uploads through the same uploadSellerDocument + saveDocumentUploads
// storage used at registration (so every screen reading the seller record
// updates at once) and collapses back to the plain Change-button view.
// Same validation as always: image types only, 12 MB size limit.
function MediaEditRow({
  user,
  kind,
  onUpdated,
}: {
  user: NonNullable<User>;
  kind: "photo" | "logo";
  onUpdated?: (u: NonNullable<User>) => void;
}) {
  const { t } = useUi();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  // Collapsed by default: only the "Change Photo" / "Change Logo" button
  // shows. Tapping it reveals the upload controls for this item.
  const [editing, setEditing] = useState(false);
  const isPhoto = kind === "photo";
  const label = isPhoto ? t("sd.photoFile") : t("sd.logoFile");
  const hasFile = isPhoto ? user.hasPhotoFile : user.hasLogoFile;
  const fileName = isPhoto ? user.photoFileName : user.storeLogoFileName;
  const fallbackText = isPhoto ? user.name : (user.storeName ?? user.name);
  const shapeCls = isPhoto
    ? "h-16 w-16 shrink-0 rounded-full text-xl"
    : "h-16 w-16 shrink-0 rounded-xl text-xl";

  function clearPick() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
  }

  function pick(f: File | undefined) {
    setSaved(false);
    setErr(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr(t("prof.notImage"));
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setErr(t("prof.tooLargeRaw"));
      return;
    }
    clearPick();
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const prepared = await compressImage(file);
      const asFile =
        prepared instanceof File
          ? prepared
          : new File([prepared], file.name.replace(/\.(png|webp)$/i, ".jpg"), {
              type: prepared.type || file.type,
            });
      const enc = await fileToBase64(asFile);
      if (enc.dataBase64.length > 5800000) {
        setErr(t("sa.tooLarge"));
        setBusy(false);
        return;
      }
      const r = await api.uploadSellerDocument({
        fileName: file.name,
        contentType: enc.mimeType,
        dataBase64: enc.dataBase64,
        kind,
      });
      if (!r.ok || !r.blobKey) {
        setErr(r.error ?? t("sa.tooLarge"));
        setBusy(false);
        return;
      }
      await api.saveDocumentUploads(
        isPhoto
          ? {
              sellerId: user.id,
              photoBlobKey: r.blobKey,
              photoFileName: r.fileName,
              photoContentType: r.contentType,
              photoSize: r.size,
            }
          : {
              sellerId: user.id,
              storeLogoBlobKey: r.blobKey,
              storeLogoFileName: r.fileName,
              storeLogoContentType: r.contentType,
              storeLogoSize: r.size,
            },
      );
      queryClient.invalidateQueries({ queryKey: ["my-doc", user.id, kind] });
      queryClient.invalidateQueries({ queryKey: ["admin-doc"] });
      queryClient.invalidateQueries({ queryKey: ["admin-doc-view"] });
      queryClient.invalidateQueries({ queryKey: ["seller-applications"] });
      clearPick();
      setSaved(true);
      setEditing(false);
      onUpdated?.(
        isPhoto
          ? { ...user, photoFileName: r.fileName, hasPhotoFile: true }
          : { ...user, storeLogoFileName: r.fileName, hasLogoFile: true },
      );
    } catch (e) {
      setErr(String(e));
    }
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center gap-3">
        {preview ? (
          <img src={preview} alt={label} className={`${shapeCls} object-cover`} />
        ) : (
          <SellerMediaImage
            sellerId={user.id}
            kind={kind}
            hasFile={hasFile}
            fallbackText={fallbackText}
            className={shapeCls}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold text-[var(--text)]">{label}</p>
          <p className="truncate text-xs text-[var(--dim)]">
            {file ? file.name : (fileName ?? t("prof.noImage"))}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {!editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                  setErr(null);
                }}
                aria-label={isPhoto ? t("prof.changePhoto") : t("prof.changeLogo")}
                className={ghostBtn + " px-3 py-1.5 text-xs"}
              >
                {isPhoto ? t("prof.changePhoto") : t("prof.changeLogo")}
              </button>
            ) : (
              <>
                <label className={ghostBtn + " cursor-pointer px-3 py-1.5 text-xs"}>
                  {t("prof.chooseImage")}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={t("prof.chooseImage")}
                    onChange={(e) => {
                      pick(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {file && (
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    aria-label={`${t("prof.save")} ${label}`}
                    className={primaryBtn + " px-3 py-1.5 text-xs"}
                  >
                    {busy ? t("sa.uploading") : t("prof.save")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    clearPick();
                    setErr(null);
                    setEditing(false);
                  }}
                  disabled={busy}
                  aria-label={`${t("prof.cancel")} ${label}`}
                  className="px-2 py-1.5 text-xs font-semibold text-[var(--dim)]"
                >
                  {t("prof.cancel")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {err && <FieldError msg={err} />}
      {saved && !file && (
        <p
          role="status"
          className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
        >
          ✓ {t("prof.saved")}
        </p>
      )}
    </div>
  );
}

// Profile media section for a signed-in account: the profile photo for
// every account, plus the store logo for sellers — both editable in one
// place (the Account → Profile section and the Seller "My" tab share
// this). Rendered ONLY inside the Profile section, never dumped on the
// Account menu itself.
function SellerMediaEditor({
  user,
  onUpdated,
}: {
  user: NonNullable<User>;
  onUpdated?: (u: NonNullable<User>) => void;
}) {
  const { t } = useUi();
  const isSeller = user.role === "seller";
  return (
    <section
      aria-label={isSeller ? t("prof.title") : t("prof.titlePhotoOnly")}
      className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4"
    >
      <h3 className="font-display font-bold text-[var(--text)]">🖼️ {isSeller ? t("prof.title") : t("prof.titlePhotoOnly")}</h3>
      <p className="mt-1 text-sm text-[var(--dim)]">{isSeller ? t("prof.sub") : t("prof.subPhotoOnly")}</p>
      <div className={`mt-3 grid gap-3 ${isSeller ? "sm:grid-cols-2" : ""}`}>
        <MediaEditRow user={user} kind="photo" onUpdated={onUpdated} />
        {isSeller && <MediaEditRow user={user} kind="logo" onUpdated={onUpdated} />}
      </div>
    </section>
  );
}

// Store logo thumbnail for Admin cards (seller list / wallet store cards):
// reads the same seller record via adminGetDocumentUrl, initial fallback.
function AdminSellerLogo({
  adminId,
  sellerId,
  hasFile,
  fallbackText,
}: {
  adminId: number;
  sellerId: number;
  hasFile: boolean;
  fallbackText: string;
}) {
  const doc = useQuery({
    queryKey: ["admin-doc", adminId, sellerId, "logo"],
    queryFn: () => api.adminGetDocumentUrl({ adminId, sellerId, kind: "logo" }),
    enabled: hasFile,
  });
  const url = doc.data?.url ?? null;
  const isImg = (doc.data?.contentType ?? "").startsWith("image/");
  if (hasFile && url && isImg) {
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-display font-bold text-white"
    >
      {fallbackText.charAt(0).toUpperCase()}
    </span>
  );
}

function AccountView({
  user,
  onAuth,
  onSignOut,
  onGoSeller,
  onGoAdmin,
  onGoSupport,
  onUserUpdated,
}: {
  user: User;
  onAuth: (u: NonNullable<User>) => void;
  onSignOut: () => void;
  onGoSeller: () => void;
  onGoAdmin: () => void;
  onGoSupport?: () => void;
  onUserUpdated?: (u: NonNullable<User>) => void;
}) {
  const { t, lang } = useUi();
  const [mode, setMode] = useState<"login" | "register" | "admin">("login");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [method, setMethod] = useState<"gmail" | "mobile">("gmail");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", country: "" });
  const [error, setError] = useState<string | null>(null);
  const [authTouched, setAuthTouched] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotId, setForgotId] = useState("");
  const [forgotStore, setForgotStore] = useState("");
  const [forgotErr, setForgotErr] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  // Signed-in Account is a tidy menu ("menu") with a separate Profile
  // section ("profile") inside it — photo/logo/password editing lives
  // ONLY in the Profile section, never dumped on the menu itself.
  const [section, setSection] = useState<"menu" | "profile">("menu");
  // A customer on a temporary (Admin/Customer-Service-set) password is
  // taken straight to the Profile section, where the Change Password
  // form lives — the must-change-password notice flow is unchanged.
  useEffect(() => {
    if (user?.mustChangePassword) setSection("profile");
  }, [user?.mustChangePassword]);
  const forgotMut = useMutation({ mutationFn: () => api.requestPasswordReset({ identifier: forgotId.trim(), storeName: forgotStore.trim() || undefined, lang }), onSuccess: () => { setForgotSent(true); setForgotErr(null); }, onError: () => { setForgotSent(true); setForgotErr(null); } });
  const hasAdmin = useQuery({
    queryKey: ["has-admin"],
    queryFn: () => api.hasAdmin({}),
    enabled: !user,
  });

  // Written per-field validation for the login / buyer-register / admin
  // forms. The identifier in use (Gmail or mobile) is required; the other
  // one is optional but must be valid when filled.
  type AuthErr = { key: string; label: string; msg: string };
  function authErrors(): AuthErr[] {
    const errs: AuthErr[] = [];
    if (mode === "register" && !form.country)
      errs.push({ key: "country", label: t("acc.country"), msg: t("val.country") });
    if (mode !== "login" && form.name.trim().length < 2)
      errs.push({ key: "name", label: t("acc.name"), msg: t("val.name") });
    if (mode === "admin") {
      if (!form.email.trim())
        errs.push({ key: "email", label: t("acc.email"), msg: t("val.emailMissing") });
      else if (!isEmailOk(form.email))
        errs.push({ key: "email", label: t("acc.email"), msg: t("val.email") });
    } else if (method === "gmail") {
      if (!form.email.trim() && mode === "login")
        errs.push({ key: "email", label: t("auth.identifierGmail"), msg: t("val.emailMissing") });
      if (!form.email.trim() && mode === "register" && !form.phone.trim())
        errs.push({ key: "contact", label: `${t("auth.withGmail")} / ${t("auth.withMobile")}`, msg: t("val.oneContact") });
      if (form.email.trim() && !isEmailOk(form.email))
        errs.push({ key: "email", label: t("acc.email"), msg: t("val.email") });
      if (form.phone.trim() && !(mode === "register" ? phoneValidForCountry(form.phone, form.country) : phoneValidForCountry(form.phone, null)))
        errs.push({ key: "phone", label: t("acc.mobileOpt"), msg: t("val.phoneCountry") });
    } else {
      if (!form.phone.trim() && mode === "login")
        errs.push({ key: "phone", label: t("auth.identifierMobile"), msg: t("val.phoneMissing") });
      if (!form.phone.trim() && mode === "register" && !form.email.trim())
        errs.push({ key: "contact", label: `${t("auth.withGmail")} / ${t("auth.withMobile")}`, msg: t("val.oneContact") });
      if (form.phone.trim() && !(mode === "register" ? phoneValidForCountry(form.phone, form.country) : phoneValidForCountry(form.phone, null)))
        errs.push({ key: "phone", label: t("acc.mobileReq"), msg: t("val.phoneCountry") });
      if (form.email.trim() && !isEmailOk(form.email))
        errs.push({ key: "email", label: t("acc.emailOpt"), msg: t("val.email") });
    }
    if (!form.password)
      errs.push({ key: "password", label: t("acc.password"), msg: t("val.passwordMissing") });
    else if (mode !== "login" && form.password.length < 4)
      errs.push({ key: "password", label: t("acc.password"), msg: t("val.password") });
    return errs;
  }
  const shownAuthErrors = authTouched ? authErrors() : [];
  const authErrFor = (key: string) =>
    authTouched ? authErrors().find((e) => e.key === key)?.msg : undefined;

  const login = useMutation({
    mutationFn: () =>
      api.login({
        identifier: method === "gmail" ? form.email.trim() : form.phone.trim(),
        password: form.password,
      }),
    onSuccess: (r) => {
      if (!r.ok || !r.user) setError(r.error ?? "Login failed.");
      else onAuth(r.user);
    },
    onError: (e) => setError(String(e)),
  });
  const register = useMutation({
    mutationFn: () =>
      api.register({
        name: form.name,
        email: form.email.trim() || undefined,
        password: form.password,
        role: "buyer",
        phone: form.phone.trim() || undefined,
        country: form.country,
      }),
    onSuccess: (r) => {
      if (!r.ok || !r.user) setError(r.error ?? "Registration failed.");
      else onAuth(r.user);
    },
    onError: (e) => setError(String(e)),
  });
  const createAdmin = useMutation({
    mutationFn: () =>
      api.createAdmin({ name: form.name, email: form.email, password: form.password }),
    onSuccess: (r) => {
      if (!r.ok || !r.user) setError(r.error ?? "Admin creation failed.");
      else onAuth(r.user);
    },
    onError: (e) => setError(String(e)),
  });

  if (user) {
    const loginId = user.email ?? (user.phone ? fmtPhone(user.phone, user.country) : "");
    const handleUpdated = (u: NonNullable<User>) => (onUserUpdated ?? onAuth)(u);
    const menuRowCls =
      "flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-alt)] focus-visible:bg-[var(--surface-alt)]";
    if (section === "profile") {
      // ---- Profile section (its own view inside Account) ----
      // ONLY here: change profile photo, change store logo (sellers)
      // and change password. Back returns to the Account menu.
      return (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <button
            type="button"
            onClick={() => setSection("menu")}
            aria-label={t("acc.back")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-bold text-[var(--text)]"
          >
            <span aria-hidden className="inline-block rtl:-scale-x-100">←</span> {t("acc.back")}
          </button>
          <div className="mt-4 flex items-center gap-3">
            <SellerMediaImage
              sellerId={user.id}
              kind="photo"
              hasFile={user.hasPhotoFile}
              fallbackText={user.name}
              className="h-12 w-12 shrink-0 rounded-full text-lg"
            />
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold leading-tight text-[var(--text)]">
                {t("acc.profile")}
              </h2>
              <p className="truncate text-sm text-[var(--dim)]">
                {user.name}
                <VerifiedNamePill user={user} />
                {user.role === "seller" && user.storeName ? ` · ${user.storeName}` : ""}
              </p>
              <p className="text-sm text-[var(--dim)]">
                {t("acc.country")}: {user.country ?? t("acc.notSet")}
              </p>
            </div>
          </div>
          {user.role !== "admin" && (
            <SellerMediaEditor user={user} onUpdated={handleUpdated} />
          )}
          <ChangeMyPasswordPanel userId={user.id} onDone={() => onAuth({ ...user, mustChangePassword: false })} />
        </div>
      );
    }
    // ---- Account menu: profile summary header + tidy option rows ----
    // No upload blocks or forms are dumped here — editing lives inside
    // the Profile section above.
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-3">
          <SellerMediaImage
            sellerId={user.id}
            kind="photo"
            hasFile={user.hasPhotoFile}
            fallbackText={user.name}
            className="h-14 w-14 shrink-0 rounded-full text-xl"
          />
          <div className="min-w-0">
            <h2 className="font-display text-2xl font-bold leading-tight text-[var(--text)]">
              {user.name}
              <VerifiedNamePill user={user} />
            </h2>
            {user.role === "seller" && user.storeName && (
              <p className="truncate text-sm font-semibold text-[var(--text)]">
                🏪 {user.storeName}
              </p>
            )}
            <p className="text-sm text-[var(--dim)]">
              {t("acc.loginId")}: {loginId} ·{" "}
              <span className="font-semibold capitalize">{user.role}</span> {t("acc.accountWord")}
            </p>
            {user.country && (
              <p className="text-sm text-[var(--dim)]">🌍 {user.country}</p>
            )}
          </div>
        </div>
        <VerificationBanner user={user} />
        <nav
          aria-label={t("acc.profile")}
          className="mt-4 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]"
        >
          <button
            type="button"
            onClick={() => setSection("profile")}
            aria-label={t("acc.profile")}
            className={menuRowCls}
          >
            <span aria-hidden className="text-xl leading-none">👤</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-bold text-[var(--text)]">
                {t("acc.profile")}
              </span>
              <span className="block truncate text-xs text-[var(--dim)]">
                {user.role === "seller"
                  ? t("acc.profileSubSeller")
                  : user.role === "admin"
                    ? t("acc.profileSubAdmin")
                    : t("acc.profileSubBuyer")}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-lg text-[var(--dim)] rtl:-scale-x-100">›</span>
          </button>
          {user.role === "seller" && (
            <button
              type="button"
              onClick={onGoSeller}
              aria-label={t("acc.sellerDash")}
              className={menuRowCls}
            >
              <span aria-hidden className="text-xl leading-none">🏪</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-bold text-[var(--text)]">
                  {t("acc.sellerDash")}
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-lg text-[var(--dim)] rtl:-scale-x-100">›</span>
            </button>
          )}
          {user.role === "admin" && (
            <button
              type="button"
              onClick={onGoAdmin}
              aria-label={t("acc.adminPanel")}
              className={menuRowCls}
            >
              <span aria-hidden className="text-xl leading-none">🛠️</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-bold text-[var(--text)]">
                  {t("acc.adminPanel")}
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-lg text-[var(--dim)] rtl:-scale-x-100">›</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            aria-label={t("acc.signOut")}
            className={menuRowCls}
          >
            <span aria-hidden className="text-xl leading-none">🚪</span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-bold text-rose-600">
                {t("acc.signOut")}
              </span>
            </span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="flex gap-2" role="group" aria-label="Account form mode">
        <Chip active={mode === "login"} onClick={() => { setMode("login"); setAuthTouched(false); setError(null); }} label="Show sign in form">
          {t("acc.signIn")}
        </Chip>
        <Chip active={mode === "register"} onClick={() => { setMode("register"); setAuthTouched(false); setError(null); }} label="Show register form">
          {t("acc.register")}
        </Chip>
        {hasAdmin.data && !hasAdmin.data.hasAdmin && (
          <Chip active={mode === "admin"} onClick={() => { setMode("admin"); setAuthTouched(false); setError(null); }} label="Show create admin form">
            {t("acc.createAdmin")}
          </Chip>
        )}
      </div>

      {mode !== "admin" && !(mode === "register" && role === "seller") && (
        <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Continue with Gmail or mobile number">
          <button
            type="button"
            aria-label="Continue with Gmail"
            aria-pressed={method === "gmail"}
            onClick={() => { setMethod("gmail"); setAuthTouched(false); setError(null); }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${method === "gmail" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
          >
            ✉️ {t("auth.withGmail")}
          </button>
          <button
            type="button"
            aria-label="Continue with Mobile Number"
            aria-pressed={method === "mobile"}
            onClick={() => { setMethod("mobile"); setAuthTouched(false); setError(null); }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-bold ${method === "mobile" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
          >
            📱 {t("auth.withMobile")}
          </button>
        </div>
      )}

      {mode === "register" && (
        <div className="mt-4 flex gap-2" role="group" aria-label="Choose account type">
          <Chip active={role === "buyer"} onClick={() => setRole("buyer")} label="Register as buyer">
            {t("acc.buyer")}
          </Chip>
          <Chip active={role === "seller"} onClick={() => setRole("seller")} label="Apply as seller">
            {t("acc.seller")}
          </Chip>
        </div>
      )}

      {mode === "register" && role === "seller" ? (
        <div className="mt-4">
          <SellerApplicationForm onDone={() => setMode("login")} />
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setAuthTouched(true);
            if (authErrors().length > 0) return;
            if (mode === "login") login.mutate();
            else if (mode === "register") register.mutate();
            else createAdmin.mutate();
          }}
        >
          <h2 className="font-display text-xl font-bold text-[var(--text)]">
            {mode === "login"
              ? t("acc.welcome")
              : mode === "register"
                ? t("acc.createBuyer")
                : t("acc.adminTitle")}
          </h2>
          {mode !== "admin" && (
            <p className="text-sm text-[var(--dim)]">
              {mode === "login"
                ? method === "gmail"
                  ? t("auth.loginHintGmail")
                  : t("auth.loginHintMobile")
                : method === "gmail"
                  ? t("auth.registerHintGmail")
                  : t("auth.registerHintMobile")}
            </p>
          )}
          {authTouched && shownAuthErrors.length > 0 && (
            <ValidationSummary
              sectionLabel={mode === "login" ? t("acc.signIn") : t("acc.register")}
              items={shownAuthErrors.map((e) => ({ label: e.label, msg: e.msg }))}
            />
          )}
          {mode === "register" && (
            <Field label={t("acc.country")}>
              <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={errInputCls(!!authErrFor("country"))} aria-label="Your country">
                <option value="">{t("acc.countryPh")}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <FieldError msg={authErrFor("country")} />
            </Field>
          )}
          {mode !== "login" && (
            <Field label={t("acc.name")}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={errInputCls(!!authErrFor("name"))} aria-label="Your name" />
              <FieldError msg={authErrFor("name")} />
            </Field>
          )}
          {mode === "admin" ? (
            <Field label={t("acc.email")}>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!authErrFor("email"))} aria-label="Email address" />
              <FieldError msg={authErrFor("email")} />
            </Field>
          ) : mode === "login" ? (
            method === "gmail" ? (
              <Field label={t("auth.identifierGmail")}>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!authErrFor("email"))} aria-label="Gmail or email address" />
                <FieldError msg={authErrFor("email")} />
              </Field>
            ) : (
              <Field label={t("auth.identifierMobile")}>
                <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="98XXX XXXXX / 03XX XXXXXXX" className={errInputCls(!!authErrFor("phone"))} aria-label="Mobile number" />
                <FieldError msg={authErrFor("phone")} />
              </Field>
            )
          ) : method === "gmail" ? (
            <>
              <Field label={t("auth.identifierGmail")}>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!authErrFor("email"))} aria-label="Gmail or email address" />
                <FieldError msg={authErrFor("email")} />
              </Field>
              <Field label={t("acc.mobileOpt")}>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" placeholder={phonePlaceholder(form.country)} className={errInputCls(!!authErrFor("phone"))} aria-label="Mobile number optional" />
                <FieldError msg={authErrFor("phone")} />
              </Field>
            </>
          ) : (
            <>
              <Field label={t("acc.mobileReq")}>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" placeholder={phonePlaceholder(form.country)} className={errInputCls(!!authErrFor("phone"))} aria-label="Mobile number" />
                <FieldError msg={authErrFor("phone")} />
              </Field>
              <Field label={t("acc.emailOpt")}>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!authErrFor("email"))} aria-label="Gmail or email optional" />
                <FieldError msg={authErrFor("email")} />
              </Field>
            </>
          )}
          {authTouched && authErrFor("contact") && (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30">
              ⚠ {authErrFor("contact")}
            </p>
          )}
          <Field label={t("acc.password")}>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={errInputCls(!!authErrFor("password"))} aria-label="Password" />
            <FieldError msg={authErrFor("password")} />
          </Field>
          {mode === "login" && (
            <div className="-mt-1">
              <button type="button" onClick={() => { setShowForgot(!showForgot); setForgotSent(false); setForgotErr(null); }} aria-expanded={showForgot} className="text-sm font-bold text-[var(--accent)] underline underline-offset-2">{t("fp.link")}</button>
              {showForgot && (
                <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
                  <p className="font-display text-sm font-bold text-[var(--text)]">{t("fp.title")}</p>
                  <p className="mt-1 text-xs leading-snug text-[var(--dim)]">{t("fp.sub")}</p>
                  {forgotSent ? (
                    <>
                      <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {t("fp.neutral")}</p>
                      <p className="mt-2 text-sm font-semibold text-[var(--text)]">{t("fp.sentToService")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {onGoSupport && <button type="button" onClick={onGoSupport} className={primaryBtn + " px-3 py-2 text-[13px]"}>{t("fp.openLiveChat")}</button>}
                        <button type="button" onClick={() => setShowForgot(false)} className={ghostBtn + " px-3 py-2 text-[13px]"}>{t("fp.backToLogin")}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-2">
                        <Field label={t("fp.identifier")}>
                          <input value={forgotId} onChange={(e) => setForgotId(e.target.value)} placeholder="name@gmail.com / mobile number" className={inputCls} aria-label="Gmail or mobile number for password reset" />
                        </Field>
                        {forgotErr && <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">⚠ {forgotErr}</p>}
                      </div>
                      <div className="mt-2">
                        <Field label={t("fp.storeName")}>
                          <input value={forgotStore} onChange={(e) => setForgotStore(e.target.value)} className={inputCls} aria-label="Store name for password reset, sellers only" />
                        </Field>
                        <p className="mt-1 text-[11px] leading-snug text-[var(--dim)]">{t("fp.storeHelp")}</p>
                      </div>
                      <button type="button" disabled={forgotMut.isPending} onClick={() => { const v = forgotId.trim(); const okId = v.includes("@") ? isEmailOk(v) : phoneValidForCountry(v, null); if (!okId) { setForgotErr(t("fp.identifierMissing")); return; } setForgotErr(null); forgotMut.mutate(); }} className={primaryBtn + " mt-2 w-full py-2 text-[13px]"}>{t("fp.submit")}</button>
                    </>
                  )}
                  <p className="mt-2 text-[11px] leading-snug text-[var(--dim)]">{t("fp.note")}</p>
                </div>
              )}
            </div>
          )}
          {mode === "admin" && (
            <p className="text-xs text-[var(--dim)]">{t("acc.adminNote")}</p>
          )}
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30">{error}</p>}
          <button
            type="submit"
            disabled={login.isPending || register.isPending || createAdmin.isPending}
            className={primaryBtn}
          >
            {mode === "login"
              ? t("acc.signIn")
              : mode === "register"
                ? t("acc.register")
                : t("acc.createAdminBtn")}
          </button>
        </form>
      )}
    </div>
  );
}

/* ------------------------- Deposit address card --------------------------- */

// The store's USDT deposit destination, exactly as saved by the Admin in
// settings. The QR code is generated here, in-app, from the address
// string itself (qrcode.react) — it always encodes exactly the address
// shown under it, and updates the moment the saved address changes.
// With no address saved yet it shows the setup note instead of a QR.
function DepositAddressCard({ address, network }: { address: string; network: string }) {
  const { t } = useUi();
  const [copied, setCopied] = useState(false);
  const addr = address.trim();
  const net = network.trim() || "BEP20 (BNB Smart Chain)";
  useEffect(() => { setCopied(false); }, [addr]);
  const copyAddress = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(addr);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = addr;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  };
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-display font-bold text-[var(--text)]">💠 {t("dep.title")}</h4>
        <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-bold text-white">USDT — {net}</span>
      </div>
      {addr ? (
        <>
          <p role="alert" className="mt-2 rounded-lg bg-[var(--amber-bg)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
            ⚠ {t("dep.sendOnly").replace("{network}", net)}
          </p>
          <div className="mt-3 flex justify-center">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={addr} size={176} bgColor="#FFFFFF" fgColor="#111827" level="M" marginSize={2} aria-label="USDT deposit address QR code" />
            </div>
          </div>
          <p className="mt-3 break-all rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-center font-mono text-sm font-semibold text-[var(--text)]" aria-label="USDT deposit address">
            {addr}
          </p>
          <div className="mt-2 flex justify-center">
            <button type="button" onClick={copyAddress} aria-label="Copy USDT deposit address" className={copied ? "rounded-lg bg-emerald-600 px-4 py-2 font-display text-sm font-bold text-white" : primaryBtn}>
              {copied ? t("dep.copied") : `⧉ ${t("dep.copy")}`}
            </button>
          </div>
        </>
      ) : (
        <p role="status" className="mt-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
          {t("dep.setup")}
        </p>
      )}
    </div>
  );
}

/* ------------------------------- Wallet ---------------------------------- */

function WalletPanel({ user, compact, onGoSupport }: { user: NonNullable<User>; compact?: boolean; onGoSupport?: () => void }) {
  const { t, fmt, currency } = useUi();
  const queryClient = useQueryClient();
  const wallet = useQuery({
    queryKey: ["wallet", user.id],
    queryFn: () => api.getWallet({ sellerId: user.id }),
  });
  // Deposit destination + ON/OFF switch, saved by the Admin in settings.
  // Always re-read on opening the Wallet: the Deposit ON/OFF state is
  // money-relevant and must never be a stale cached copy.
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: () => api.getSettings({}), refetchOnMount: "always" });
  const depositsOn = settingsQ.data?.depositsEnabled ?? true;
  // Payment Methods ON/OFF (Admin → Settings → Payment Methods): an OFF
  // method is hidden from both pickers below; the effective method
  // falls back to the first method still ON. All three OFF → the forms
  // are replaced by a written "currently unavailable" note.
  const pmUpi = settingsQ.data?.paymentUpiEnabled ?? true;
  const pmBank = settingsQ.data?.paymentBankEnabled ?? true;
  const pmUsdt = settingsQ.data?.paymentUsdtEnabled ?? true;
  const depMethods = [pmUpi ? "UPI" : null, pmBank ? "Bank Transfer" : null, pmUsdt ? "USDT (Crypto)" : null].filter(Boolean) as Array<"UPI" | "Bank Transfer" | "USDT (Crypto)">;
  const wdMethods = [pmUpi ? "UPI" : null, pmBank ? "Bank Account" : null, pmUsdt ? "USDT (Crypto)" : null].filter(Boolean) as Array<"UPI" | "Bank Account" | "USDT (Crypto)">;
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [dep, setDep] = useState({ amount: "", method: "UPI" as "UPI" | "Bank Transfer" | "USDT (Crypto)", reference: "", note: "" });
  const depMethod = depMethods.includes(dep.method) ? dep.method : depMethods[0];
  // Optional payment screenshot for the deposit request: the seller can
  // attach one INSTEAD of typing the Transaction Hash (or as well).
  const [depShot, setDepShot] = useState<ChatAttachmentData | null>(null);
  const [depShotErr, setDepShotErr] = useState<string | null>(null);
  async function pickDepositScreenshot(f: File | null) {
    setDepShotErr(null);
    if (!f) return;
    const r = await readDepositScreenshot(f);
    if (!r.ok) { setDepShotErr(r.error); return; }
    setDepShot(r.att);
  }
  const [wd, setWd] = useState({
    amount: "",
    method: "UPI" as "UPI" | "Bank Account" | "USDT (Crypto)",
    upiId: "",
    accountHolder: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
    usdtAddress: "",
    note: "",
  });
  const wdMethod = wdMethods.includes(wd.method) ? wd.method : wdMethods[0];
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const deposit = useMutation({
    mutationFn: () =>
      api.requestDeposit({
        sellerId: user.id,
        amountInr: toInr(parseFloat(dep.amount) || 0, currency),
        method: depMethod ?? dep.method,
        reference: dep.reference,
        note: dep.note || undefined,
        screenshot: depShot ?? undefined,
      }),
    onSuccess: () => {
      setMsg(t("w.sent"));
      setErr(null);
      setDep({ amount: "", method: "UPI", reference: "", note: "" });
      setDepShot(null);
      setDepShotErr(null);
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => setErr(String(e)),
  });
  const withdraw = useMutation({
    mutationFn: () =>
      api.requestWithdraw({
        sellerId: user.id,
        amountInr: toInr(parseFloat(wd.amount) || 0, currency),
        method: wdMethod ?? wd.method,
        upiId: wdMethod === "UPI" ? wd.upiId : undefined,
        accountHolder: wdMethod === "Bank Account" ? wd.accountHolder : undefined,
        accountNumber: wdMethod === "Bank Account" ? wd.accountNumber : undefined,
        ifsc: wdMethod === "Bank Account" ? wd.ifsc : undefined,
        bankName: wdMethod === "Bank Account" ? wd.bankName : undefined,
        usdtAddress: wdMethod === "USDT (Crypto)" ? wd.usdtAddress : undefined,
        note: wd.note || undefined,
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        setErr(r.error ?? "Withdrawal failed.");
        return;
      }
      setMsg(t("w.sent"));
      setErr(null);
      setWd({ amount: "", method: "UPI", upiId: "", accountHolder: "", accountNumber: "", ifsc: "", bankName: "", usdtAddress: "", note: "" });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => setErr(String(e)),
  });

  if (wallet.isPending) {
    return <p className="py-6 text-center text-[var(--dim)]">{t("common.loading")}</p>;
  }
  if (wallet.error || !wallet.data) {
    return <p className="py-6 text-center text-rose-600">{String(wallet.error)}</p>;
  }
  const w = wallet.data;
  const financeView = { availableBalance: w.availableBalance, totalBalance: w.totalBalance, pendingOrderHolds: w.pendingOrderHolds, usedAmount: w.usedAmount, pendingWithdrawal: w.pendingWithdrawal, pendingDeposit: w.pendingDeposit, pendingOrderEarnings: w.pendingOrderEarnings, totalPending: w.totalPending, totalOrderValue: w.totalOrderValue, orderCount: w.orderCount, totalDeposited: w.totalDeposited, totalWithdrawn: w.totalWithdrawn, withdrawals: w.withdrawals, deposits: w.deposits, totalAdminCredit: w.totalAdminCredit, earningsCleared: w.earningsCleared, orders: w.financeOrders, ledger: w.ledger };
  // Compact balance strip figures — the SAME shared computation as
  // FinanceSummary: Pending is only order cost held for Shipment
  // orders, and Total = Available + Pending.
  const stripPending = w.pendingOrderHolds ?? w.totalPending;
  const stripTotal = w.totalBalance ?? w.availableBalance + stripPending;

  return (
    <div>
      {!compact && <h3 className="font-display text-lg font-bold text-[var(--text)]">👛 {t("w.title")}</h3>}

      {/* Compact balance strip — Total / Available / Pending, right
          under the heading, so the balance is visible at the very top
          without scrolling. Attractive accent panel: Total prominent
          on the left, Available / Pending as two soft mini-tiles, the
          Total = Available + Pending note underneath. Same figures,
          same shared computation as always. This REPLACES the full
          balance block: the FinanceSummary below the deposit section
          is told hideBalance so the figures never appear twice. */}
      <div className="mt-2 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] px-4 py-3 text-white shadow-md" role="group" aria-label={t("fin.total")}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-white/75">👛 {t("fin.total")}</p>
            <p className="font-display text-[26px] font-extrabold leading-tight">{fmt(stripTotal)}</p>
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            <div className="rounded-xl bg-white/10 px-3 py-1.5">
              <p className="text-[10px] font-bold text-white/70">✅ {t("w.balance")}</p>
              <p className="font-display text-sm font-bold leading-snug">{fmt(w.availableBalance)}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-1.5">
              <p className="text-[10px] font-bold text-white/70">⏳ {t("fin.pendingCard")}</p>
              <p className="font-display text-sm font-bold leading-snug">{fmt(stripPending)}</p>
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-white/70">{t("fin.totalSub")}</p>
      </div>

      {/* Deposit / Withdraw actions and the Deposit Address card come
          next, right under the compact balance strip, so the deposit
          address shows immediately without scrolling. The remaining
          details (totals, requests, money ledger) sit BELOW this
          section. */}
      <div className="mt-3 flex gap-2" role="group" aria-label="Wallet action">
        <Chip active={tab === "deposit"} onClick={() => setTab("deposit")} label="Show deposit form">
          ⬇️ {t("w.deposit")}
        </Chip>
        <Chip active={tab === "withdraw"} onClick={() => setTab("withdraw")} label="Show withdraw form">
          ⬆️ {t("w.withdraw")}
        </Chip>
      </div>

      {msg && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
          ✓ {msg}
        </p>
      )}
      {err && <p className="mt-3 text-sm font-medium text-rose-600">{err}</p>}

      {tab === "deposit" ? (
        settingsQ.isPending ? (
          <p className="mt-3 py-4 text-center text-sm text-[var(--dim)]">{t("common.loading")}</p>
        ) : !depositsOn ? (
          <div role="status" className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-bold text-[var(--text)]">⏸ {t("dep.off")}</p>
            {onGoSupport && (
              <button type="button" onClick={onGoSupport} className={primaryBtn + " mt-3"}>
                💬 {t("dep.contact")}
              </button>
            )}
          </div>
        ) : depMethods.length === 0 ? (
          <div role="status" className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-bold text-[var(--text)]">⏸ {t("pm.depUnavailable")}</p>
            {onGoSupport && (
              <button type="button" onClick={onGoSupport} className={primaryBtn + " mt-3"}>
                💬 {t("dep.contact")}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {/* USDT OFF hides the Deposit Address card / QR entirely. */}
            {pmUsdt && <DepositAddressCard address={settingsQ.data?.usdtDepositAddress ?? ""} network={settingsQ.data?.depositNetwork ?? "BEP20 (BNB Smart Chain)"} />}
            {(pmUpi || pmBank) && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="text-sm font-medium text-[var(--text)]">{(settingsQ.data?.localDepositNote ?? "").trim() ? settingsQ.data!.localDepositNote : t("dep.local")}</p>
                {onGoSupport && (
                  <button type="button" onClick={onGoSupport} className={ghostBtn + " mt-2 px-3 py-2 text-[13px]"}>
                    💬 {t("dep.contact")}
                  </button>
                )}
              </div>
            )}
            <form
              className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
              onSubmit={(e) => {
                e.preventDefault();
                setMsg(null);
                setErr(null);
                setDepShotErr(null);
                // Payment proof rule for EVERY method (also enforced
                // server-side): the Transaction / UTR reference ID OR
                // a payment screenshot — one of the two is required.
                // With a screenshot attached, the reference ID is not
                // needed.
                if (!dep.reference.trim() && !depShot) {
                  setErr(t("dep.hashOrShotErr"));
                  return;
                }
                deposit.mutate();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`${t("w.amount")} (${currency})`}>
                  <input required type="number" min={1} step="any" value={dep.amount} onChange={(e) => setDep({ ...dep, amount: e.target.value })} className={inputCls} aria-label="Deposit amount" />
                </Field>
                <Field label={t("w.method")}>
                  <select value={depMethod} onChange={(e) => setDep({ ...dep, method: e.target.value as typeof dep.method })} className={inputCls} aria-label="Deposit method">
                    {depMethods.map((m) => (
                      <option key={m} value={m}>{m === "UPI" ? t("w.upi") : m === "Bank Transfer" ? t("w.bankTransfer") : t("dep.usdtMethod")}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={depShot ? (depMethod === "USDT (Crypto)" ? t("dep.txnHashOpt") : t("dep.txnRefOpt")) : (depMethod === "USDT (Crypto)" ? t("dep.txnHash") : t("w.txnRef"))}>
                <input required={!depShot} value={dep.reference} onChange={(e) => setDep({ ...dep, reference: e.target.value })} className={inputCls} aria-label={depMethod === "USDT (Crypto)" ? "Transaction hash" : "Transaction reference ID"} />
              </Field>
              {/* Payment screenshot — the alternative to typing the
                  hash/reference above: attach a photo of the payment
                  instead (or as well). JPG/PNG, max 3 MB. */}
              <div>
                <Field label={t("dep.shotLabel")}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    aria-label="Payment screenshot"
                    onChange={(e) => {
                      pickDepositScreenshot(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                  />
                </Field>
                <p className="mt-1 text-[11px] leading-snug text-[var(--dim)]">{t("dep.shotHint")}</p>
                {depShot && (
                  <span className="mt-1.5 flex w-fit max-w-full items-center gap-1 rounded-lg bg-[var(--surface-alt)] px-2 py-1 text-xs font-semibold text-[var(--text)]">
                    <span className="truncate">📷 {depShot.fileName} — {t("dep.shotAttached")}</span>
                    <button type="button" aria-label="Remove payment screenshot" onClick={() => setDepShot(null)} className="shrink-0 px-1 font-bold text-rose-600">
                      ✕
                    </button>
                  </span>
                )}
                {depShotErr && <p role="alert" className="mt-1.5 text-xs font-semibold text-rose-600">⚠ {depShotErr}</p>}
              </div>
              <Field label={t("w.note")}>
                <input value={dep.note} onChange={(e) => setDep({ ...dep, note: e.target.value })} className={inputCls} aria-label="Deposit note" />
              </Field>
              <button type="submit" disabled={deposit.isPending} className={primaryBtn + " self-start"}>
                {t("w.submitDeposit")}
              </button>
            </form>
          </div>
        )
      ) : wdMethods.length === 0 ? (
        <div role="status" className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-bold text-[var(--text)]">⏸ {t("pm.wdUnavailable")}</p>
          {onGoSupport && (
            <button type="button" onClick={onGoSupport} className={primaryBtn + " mt-3"}>
              💬 {t("dep.contact")}
            </button>
          )}
        </div>
      ) : (
        <form
          className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            setErr(null);
            if (toInr(parseFloat(wd.amount) || 0, currency) > w.balance) {
              setErr(t("w.exceeds"));
              return;
            }
            withdraw.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${t("w.amount")} (${currency})`}>
              <input required type="number" min={1} step="any" value={wd.amount} onChange={(e) => setWd({ ...wd, amount: e.target.value })} className={inputCls} aria-label="Withdrawal amount" />
            </Field>
            <Field label={t("w.method")}>
              <select value={wdMethod} onChange={(e) => setWd({ ...wd, method: e.target.value as typeof wd.method })} className={inputCls} aria-label="Payout method">
                {wdMethods.map((m) => (
                  <option key={m} value={m}>{m === "UPI" ? t("w.upi") : m === "Bank Account" ? t("w.bankAccount") : t("dep.usdtMethod")}</option>
                ))}
              </select>
            </Field>
          </div>
          {wdMethod === "UPI" ? (
            <Field label={t("w.upiId")}>
              <input required value={wd.upiId} onChange={(e) => setWd({ ...wd, upiId: e.target.value })} placeholder="name@okhdfcbank" className={inputCls} aria-label="UPI ID" />
            </Field>
          ) : wdMethod === "USDT (Crypto)" ? (
            <div className="flex flex-col gap-2">
              <Field label={t("w.usdtAddress")}>
                <input required value={wd.usdtAddress} onChange={(e) => setWd({ ...wd, usdtAddress: e.target.value })} placeholder="0x…" className={inputCls} aria-label="USDT wallet address" />
              </Field>
              <p className="rounded-lg bg-[var(--amber-bg)] px-3 py-2 text-xs font-semibold leading-snug text-[var(--text)]">
                ⚠ {t("w.usdtReceiveNote").replace("{network}", (settingsQ.data?.depositNetwork ?? "").trim() || "BEP20 (BNB Smart Chain)")}
              </p>
              {(parseFloat(wd.amount) || 0) > 0 && (
                <p className="text-sm font-semibold text-[var(--text)]">
                  {t("w.usdtApprox").replace("{amount}", (toInr(parseFloat(wd.amount) || 0, currency) / 83).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("w.accHolder")}>
                <input required value={wd.accountHolder} onChange={(e) => setWd({ ...wd, accountHolder: e.target.value })} className={inputCls} aria-label="Account holder name" />
              </Field>
              <Field label={t("w.accNumber")}>
                <input required value={wd.accountNumber} onChange={(e) => setWd({ ...wd, accountNumber: e.target.value })} className={inputCls} aria-label="Account number" />
              </Field>
              <Field label={t("w.ifsc")}>
                <input required value={wd.ifsc} onChange={(e) => setWd({ ...wd, ifsc: e.target.value })} placeholder="HDFC0001234" className={inputCls} aria-label="IFSC code" />
              </Field>
              <Field label={t("w.bankName")}>
                <input required value={wd.bankName} onChange={(e) => setWd({ ...wd, bankName: e.target.value })} className={inputCls} aria-label="Bank name" />
              </Field>
            </div>
          )}
          <Field label={t("w.note")}>
            <input value={wd.note} onChange={(e) => setWd({ ...wd, note: e.target.value })} className={inputCls} aria-label="Withdrawal note" />
          </Field>
          <button type="submit" disabled={withdraw.isPending} className={primaryBtn + " self-start"}>
            {t("w.submitWithdraw")}
          </button>
        </form>
      )}

      {/* Remaining finance details (held orders, Total Deposited,
          Total Withdrawn, requests awaiting approval) — below the
          deposit/withdraw address section. hideBalance: Total /
          Available / Pending already show in the compact strip at the
          top, so FinanceSummary must not repeat them here. The Wallet
          is money only: balance, deposit, withdraw and the money
          ledger below. Order history lives in the Seller section's
          Orders area (Pending / Shipment / Completed), never here. */}
      <div className="mt-6"><FinanceSummary finance={financeView} hideBalance /></div>
      <p className="mt-3 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-xs text-[var(--text)]">
        {t("w.ledgerNote")}
      </p>

      <h4 className="mt-6 font-display font-bold text-[var(--text)]">{t("w.history")}</h4>
      {w.ledger.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dim)]">{t("w.noHistory")}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {w.ledger.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span aria-hidden>{e.kind === "deposit" ? "⬇️" : e.kind === "withdraw" || e.kind === "withdraw_paid" ? "⬆️" : e.kind === "admin_withdraw" ? "🏦" : e.kind === "order_payment_held" || e.kind === "order_payment_released" ? "🧾" : e.kind === "order_completed" ? "✅" : "💰"}</span>
                <strong className="text-[var(--text)]">{kindLabel(e.kind)}</strong>
                <span className="ml-auto font-display font-bold text-[var(--text)]">
                  {e.kind === "balance_correction" || e.kind === "order_payment_released" ? "" : e.direction === "debit" ? "−" : "+"}
                  {fmt(e.amount)}
                </span>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-1 text-xs text-[var(--dim)]">
                {e.method}
                {e.reference ? ` · ${e.reference}` : ""}
                {e.note ? ` · ${e.note}` : ""}
                {e.hasScreenshot ? ` · 📷 ${t("dep.shotAttached")}` : ""} · {new Date(e.createdAt).toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text)]">{t("fin.running")}: <strong>{fmt(e.runningBalance)}</strong></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Seller dashboard --------------------------- */

type SellerTab = "home" | "products" | "orders" | "wallet" | "my";

function SellerView({
  user,
  onSignOut,
  initialTab,
  onTabChange,
  onUserUpdated,
  onGoAccount,
  onGoSupport,
}: {
  user: User;
  onSignOut: () => void;
  initialTab?: SellerTab;
  onTabChange?: (tab: SellerTab) => void;
  onUserUpdated?: (u: NonNullable<User>) => void;
  onGoAccount?: () => void;
  onGoSupport?: () => void;
}) {
  const { t, fmt, layout } = useUi();
  const queryClient = useQueryClient();
  const [tab, setTabState] = useState<SellerTab>(initialTab ?? "home");
  const setTab = (next: SellerTab) => {
    setTabState(next);
    onTabChange?.(next);
  };
  const [expanded, setExpanded] = useState(false);
  // Products tab shows ONLY the seller's own added products (with
  // Remove) — no add-catalog below it. Products are added from the
  // Shop, whose seller cards add directly to the seller's own store.
  // Seller Home carries no Products block of its own either.
  const isSeller = !!user && user.role === "seller";
  const verified = isSeller && user.verificationStatus === "approved";
  // While the application is pending/rejected, poll the fresh account state
  // so an Admin approval (or rejection) lands here without re-login.
  const sessionRefresh = useQuery({
    queryKey: ["my-session", user?.id],
    queryFn: () => api.refreshMySession({ userId: user!.id }),
    enabled: isSeller && !verified,
    refetchInterval: 15000,
  });
  useEffect(() => {
    const fresh = sessionRefresh.data?.user;
    if (fresh && user && fresh.verificationStatus !== user.verificationStatus) {
      onUserUpdated?.(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionRefresh.data]);
  const dash = useQuery({
    queryKey: ["seller-dashboard", user?.id],
    queryFn: () => api.sellerDashboard({ sellerId: user!.id }),
    enabled: verified,
  });
  const notifs = useQuery({
    queryKey: ["seller-notifications", user?.id],
    queryFn: () => api.listSellerNotifications({ sellerId: user!.id }),
    enabled: verified,
    refetchInterval: 10000,
  });
  const unreadCount = notifs.data?.unreadCount ?? 0;
  // Per-order "new" highlight: an order stays highlighted (NEW badge)
  // until the seller opens/views THAT order — opening the Orders tab
  // alone no longer clears anything.
  const newOrderIdSet = new Set(
    (notifs.data?.notifications ?? []).filter((n) => !n.isRead).map((n) => n.orderId),
  );
  const markOrderViewed = useMutation({
    mutationFn: (orderId: number) => api.markSellerOrderViewed({ sellerId: user!.id, orderId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller-notifications"] }),
  });
  // Formal Admin reminder notices (alert banner until the order is done).
  // Enabled for every seller account so a pending/rejected seller also sees
  // the Admin's decision notice (verified / rejected-with-reason) here.
  const notices = useQuery({
    queryKey: ["seller-notices", user?.id],
    queryFn: () => api.listSellerNotices({ sellerId: user!.id }),
    enabled: isSeller,
    refetchInterval: 15000,
  });
  const dismissNotice = useMutation({
    mutationFn: (noticeId: number) => api.dismissSellerNotice({ sellerId: user!.id, noticeId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller-notices"] }),
  });

  // Wallet figures for the Orders → Pending "Deliver Order" confirmation:
  // the SAME wallet query and the SAME sellerPayOrderFromWallet action
  // the Wallet page uses — one backend, reached from both places.
  const walletQ = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: () => api.getWallet({ sellerId: user!.id }),
    enabled: verified,
  });
  const [orderSection, setOrderSection] = useState<"pending" | "shipment" | "completed">("pending");
  const [deliverFor, setDeliverFor] = useState<number | null>(null);
  const [deliverMsg, setDeliverMsg] = useState<string | null>(null);
  const [deliverErr, setDeliverErr] = useState<string | null>(null);
  const deliverOrder = useMutation({
    mutationFn: (orderId: number) => api.sellerPayOrderFromWallet({ sellerId: user!.id, orderId }),
    onSuccess: (r, orderId) => {
      if (!r.ok) { setDeliverErr(r.error ?? "Payment failed."); return; }
      setDeliverFor(null);
      setDeliverErr(null);
      setDeliverMsg(`✓ Order #${orderId} — ${r.paidAmount > 0 ? `${t("wpay.paidWord")} ${fmt(r.paidAmount)} · ` : ""}${t("sord.shippedOk")} ${t("wpay.newBalance")}: ${fmt(r.newBalance)}`);
      setOrderSection("shipment");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["seller-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["seller-finance"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
    },
    onError: (e) => setDeliverErr(String(e)),
  });

  const remove = useMutation({
    mutationFn: (productId: number) =>
      api.removeFromMyStore({ sellerId: user!.id, productId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
    },
  });
  if (!user) {
    return (
      <EmptyState
        title={t("sd.signInT")}
        text={t("sd.signInD")}
        actionLabel={t("menu.account")}
        onAction={onGoAccount}
      />
    );
  }
  if (user.role !== "seller") {
    return (
      <EmptyState
        title={t("sd.signInT")}
        text={t("sd.onlySellers")}
        actionLabel={t("menu.becomeSeller")}
        onAction={onGoAccount}
      />
    );
  }
  if (!verified) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="font-display text-2xl font-bold text-[var(--text)]">
            {user.storeName ?? "My Store"}
          </h2>
          <VerificationBanner user={user} />
        </div>
        {(notices.data?.notices ?? []).map((n) => (
          <div
            key={n.id}
            className="rounded-2xl border-2 border-[var(--gold)] bg-[var(--amber-bg)] p-4"
          >
            <p className="font-display text-sm font-bold text-[var(--text)]">
              📣 {t("snotice.title")}
            </p>
            <p className="mt-1 text-sm text-[var(--text)]">{n.message}</p>
            <p className="mt-1 text-xs text-[var(--dim)]">
              {new Date(n.createdAt).toLocaleString()}
            </p>
            {n.orderId == null && (
              <button
                type="button"
                onClick={() => dismissNotice.mutate(n.id)}
                className="mt-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--text)]"
              >
                {t("snotice.dismiss")}
              </button>
            )}
          </div>
        ))}
        {onGoSupport && (
          <button
            type="button"
            onClick={onGoSupport}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)]"
          >
            💬 {t("verif.contactSupport")}
          </button>
        )}
      </div>
    );
  }
  if (dash.isPending)
    return <p className="py-10 text-center text-[var(--dim)]">{t("sd.loading")}</p>;
  const d = dash.data!;
  const inStore = new Set(d.myProducts.map((p) => p.id));

  const statusTiles = [
    { key: "pending", icon: "📦", label: t("sd.pendingShipment"), count: d.pendingShipment },
    { key: "transit", icon: "🚚", label: t("sd.inTransit"), count: d.inTransit },
    { key: "done", icon: "✅", label: t("sd.completed"), count: d.completed },
    { key: "pay", icon: "💳", label: t("sd.pendingPayment"), count: d.pendingPayment },
  ];
  const bigStats = [
    { label: t("sd.totalRevenue"), value: fmt(d.totalRevenue) },
    { label: t("sd.totalOrders"), value: String(d.totalOrders) },
    { label: t("sd.monthlyOrders"), value: String(d.monthlyItems) },
    { label: t("sd.totalProfit"), value: fmt(d.totalProfit) },
  ];
  const smallStats = [
    { label: t("sd.numProducts"), value: String(d.myProducts.length) },
    { label: t("sd.shopSales"), value: fmt(d.deliveredRevenue) },
    { label: t("sd.orderVolume"), value: String(d.itemsSold) },
    { label: t("sd.serviceRating"), value: t("sd.notRated") },
    { label: t("sd.logisticsRating"), value: t("sd.notRated") },
    { label: t("sd.overallRating"), value: t("sd.notRated") },
  ];
  // The seller section's own bottom menu: Home / Products / Orders /
  // Wallet ONLY. There is deliberately NO account entry here — Account
  // lives in the app's bottom navigation and the ☰ drawer, and the
  // profile/photo view itself stays reachable from there. (The "my"
  // tab id still exists for the set-temporary-password route only.)
  const tabs: Array<{ id: SellerTab; label: string; icon: string }> = [
    { id: "home", label: t("sd.tabHome"), icon: "🏠" },
    { id: "products", label: t("sd.tabProducts"), icon: "🛍️" },
    { id: "orders", label: t("sd.tabOrders"), icon: "🧾" },
    { id: "wallet", label: t("sd.tabWallet"), icon: "👛" },
  ];

  return (
    <div>
      {/* Compact merchant header: the store LOGO (uploaded at signup or
          changed from the profile) leads, with the seller's own profile
          photo as their avatar on the right. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <SellerMediaImage
          sellerId={user.id}
          kind="logo"
          hasFile={user.hasLogoFile}
          fallbackText={user.storeName ?? user.name}
          className="h-11 w-11 shrink-0 rounded-xl text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dim)]">
            {t("sd.merchant")}
          </p>
          <h2 className="flex items-center gap-2 font-display text-base font-bold leading-tight text-[var(--text)]">
            <span className="truncate">{user.storeName ?? "My Store"}</span>
            <VerifiedBadge />
          </h2>
          {user.storeDescription && (
            <p className="line-clamp-1 text-xs text-[var(--dim)]">{user.storeDescription}</p>
          )}
        </div>
        <SellerMediaImage
          sellerId={user.id}
          kind="photo"
          hasFile={user.hasPhotoFile}
          fallbackText={user.name}
          className="h-10 w-10 shrink-0 rounded-full text-sm"
        />
        {d.pendingShipment > 0 && (
          <span className="ml-auto inline-flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-[var(--alert)] px-2.5 py-1 text-[11px] font-bold text-white">
            ● {d.pendingShipment} {t("notif.pendingAlert")}
          </span>
        )}
      </div>

      {(notices.data?.notices ?? []).length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {(notices.data?.notices ?? []).map((n) => (
            <div key={n.id} role="alert" className="rounded-xl border-2 border-[var(--gold)] bg-[var(--amber-bg)] px-4 py-3 shadow-sm">
              <p className="flex flex-wrap items-center gap-2 font-display text-sm font-bold text-[var(--text)]">
                <span aria-hidden>📣</span> {t("snotice.title")}
                {n.orderId !== null && <span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-[11px] font-bold text-white">{t("snotice.orderWord")} #{n.orderId}</span>}
                <span className="ml-auto text-[11px] font-medium text-[var(--dim)]">{new Date(n.createdAt).toLocaleString()}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">{n.message}</p>
              {n.orderId !== null ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[var(--alert)]">⚠ {t("snotice.completeIt")}</span>
                  <button type="button" aria-label={`Complete order ${n.orderId} from Orders`} onClick={() => { setOrderSection("pending"); setTab("orders"); }} className={primaryBtn + " px-3 py-1.5 text-xs"}>{t("snotice.goWallet")}</button>
                </div>
              ) : (
                <button type="button" aria-label="Dismiss this notice" disabled={dismissNotice.isPending} onClick={() => dismissNotice.mutate(n.id)} className="mt-2 text-xs font-bold text-[var(--accent)]">{t("snotice.dismiss")} ✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "home" && (
        <>
          <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">
                {t("sd.shopData")}
              </h3>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="text-sm font-semibold text-[var(--accent)]"
              >
                {expanded ? t("sd.collapse") : t("sd.expand")} {expanded ? "▲" : "▼"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center min-[520px]:grid-cols-4">
              {statusTiles.map((tile) => {
                const isPending = tile.key === "pending" && tile.count > 0;
                return (
                <button
                  type="button"
                  key={tile.label}
                  onClick={() => {
                    if (tile.key === "pending") { setOrderSection("pending"); setTab("orders"); }
                    else if (tile.key === "transit") { setOrderSection("shipment"); setTab("orders"); }
                    else if (tile.key === "done") { setOrderSection("completed"); setTab("orders"); }
                    else if (tile.key === "pay") setTab("wallet");
                  }}
                  aria-label={`${tile.label}: ${tile.count}`}
                  className={isPending ? "relative rounded-xl border-2 border-[var(--alert)] bg-[var(--alert-bg)] px-1 py-2 shadow-[0_0_0_3px_rgba(220,38,38,0.15)]" : "rounded-xl border border-transparent px-1 py-2"}
                >
                  {isPending && <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-ping rounded-full bg-[var(--alert)]" aria-hidden />}
                  <div className="relative mx-auto w-fit text-2xl" aria-hidden>
                    {tile.icon}
                    {tile.count > 0 && (
                      <span className={`absolute -right-3 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-display text-[11px] font-bold text-white ${isPending ? "bg-[var(--alert)]" : "bg-[var(--accent)]"}`}>
                        {tile.count > 99 ? "99+" : tile.count}
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-[11px] leading-tight ${isPending ? "font-bold text-[var(--alert)]" : "font-medium text-[var(--dim)]"}`}>
                    {tile.label}
                  </p>
                  {isPending && <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--alert)]">{t("notif.live")}</p>}
                </button>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {bigStats.map((s) => (
                <div key={s.label} className="rounded-xl bg-[var(--accent)] px-3 py-3 text-center text-white shadow-sm">
                  <p className="font-display text-xl font-extrabold sm:text-2xl">{s.value}</p>
                  <p className="mt-0.5 text-xs text-white/85">{s.label}</p>
                </div>
              ))}
            </div>
            {expanded && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {smallStats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl bg-[var(--surface-alt)] px-3 py-3 text-center"
                  >
                    <p className="font-display text-base font-bold text-[var(--text)]">{s.value}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--dim)]">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Orders to Complete — pending orders FIRST, each with its
              Deliver action. One tap opens the Orders → Pending section
              with that order's wallet figures ready to confirm. */}
          {(() => {
            const homePending = d.orders.filter((o) => o.status === "Pending" || o.status === "Confirmed");
            const homeFin = new Map((walletQ.data?.financeOrders ?? []).map((f) => [f.orderId, f]));
            return (
              <section aria-label={t("seller.toComplete")} className={`mt-5 rounded-2xl border-2 bg-[var(--surface)] p-4 shadow-sm ${homePending.length > 0 ? "border-[var(--alert)]" : "border-[var(--border)]"}`}>
                <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-[var(--text)]">
                  📦 {t("seller.toComplete")}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${homePending.length > 0 ? "bg-[var(--alert)]" : "bg-[var(--dim)]"}`}>{t("sord.secPending")}: {homePending.length}</span>
                  {unreadCount > 0 && <span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-xs font-bold text-white">🔔 {unreadCount}</span>}
                </h3>
                <p className="mt-1 text-sm text-[var(--dim)]">{t("seller.toCompleteSub")}</p>
                {homePending.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-center text-sm text-[var(--dim)]">{t("sord.nonePending")}</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {homePending.slice(0, 5).map((o) => {
                      const fin = homeFin.get(o.id);
                      const isNew = newOrderIdSet.has(o.id);
                      return (
                        <div key={o.id} className={`flex flex-wrap items-center gap-2 rounded-xl border bg-[var(--surface-alt)] px-3 py-3 ${isNew ? "border-[var(--gold)] ring-2 ring-[var(--gold)]/60" : "border-[var(--border)]"}`}>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--text)]">Order #{o.id} · {fmt(fin?.orderAmount ?? o.total)}{isNew && <span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--gold-ink)] shadow">✦ {t("sord.newOrderBadge")}</span>}</p>
                            <p className="mt-0.5 text-xs text-[var(--dim)]">{t("sord.yourProfit")}: <strong className="text-[var(--accent)]">{fmt(fin?.profit ?? 0)}</strong></p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Deliver order ${o.id} by paying from wallet`}
                            onClick={() => { if (isNew) markOrderViewed.mutate(o.id); setOrderSection("pending"); setDeliverFor(o.id); setDeliverErr(null); setDeliverMsg(null); setTab("orders"); }}
                            className={goldBtn + " px-4 py-2.5 text-sm"}
                          >
                            🚚 {t("sord.deliverBtn")}
                          </button>
                        </div>
                      );
                    })}
                    {homePending.length > 5 && (
                      <button type="button" aria-label={t("seller.openOrders")} onClick={() => { setOrderSection("pending"); setTab("orders"); }} className="mt-1 text-sm font-bold text-[var(--accent)]">{t("seller.openOrders")} ({homePending.length}) →</button>
                    )}
                  </div>
                )}
              </section>
            );
          })()}

          {/* Wallet summary card — the balance at a glance; all wallet
              detail (deposit, withdraw, history) lives in the Wallet page. */}
          <section aria-label={t("seller.walletCardTitle")} className="mt-5 rounded-2xl bg-[var(--accent)] p-4 text-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">👛 {t("seller.walletCardTitle")} · {t("fin.total")}</p>
                <p className="mt-1 font-display text-2xl font-extrabold">{walletQ.isPending ? "…" : fmt(walletQ.data?.totalBalance ?? 0)}</p>
                <p className="mt-0.5 text-xs text-white/85">{t("w.balance")}: <strong>{walletQ.isPending ? "…" : fmt(walletQ.data?.availableBalance ?? 0)}</strong> · {t("fin.pendingCard")}: <strong>{walletQ.isPending ? "…" : fmt(walletQ.data?.pendingOrderHolds ?? 0)}</strong></p>
                <p className="text-[11px] text-white/70">{t("fin.totalSub")}</p>
              </div>
              <button type="button" aria-label={t("seller.goWallet")} onClick={() => setTab("wallet")} className="rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[var(--accent-strong)]">{t("seller.goWallet")}</button>
            </div>
          </section>
        </>
      )}

      {tab === "products" && (
        <>
          {/* This Products tab shows ONLY the seller's own added
              products, as an open list (product, price, profit, stock)
              with Remove on every row — and nothing else below it.
              Products are added from the Shop. */}
          <section aria-label={t("sd.myProducts")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">
                🛍️ {t("sd.myProducts")} ({d.myProducts.length})
              </h3>
            </div>
            {d.myProducts.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">{t("sd.emptyStore")}</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {d.myProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-nowrap"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage product={p} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">{p.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--dim)]">{p.category}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">
                        {t("shop.base")} {fmt(p.basePrice)} · {t("sd.buyerPrice")}{" "}
                        <strong className="text-[var(--text)]">{fmt(p.buyerPrice)}</strong> ·{" "}
                        {t("sd.profit")}{" "}
                        <strong className="text-[var(--accent)]">
                          {fmt(p.profitAmount)} ({p.profitPercent}%)
                        </strong>{" "}
                        · {t("shop.stock")}: <strong className="text-[var(--text)]">{p.stock}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${p.name} from my store`}
                      onClick={() => remove.mutate(p.id)}
                      disabled={remove.isPending}
                      className="min-h-10 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30"
                    >
                      {t("sd.remove")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* NO add-catalog below (owner's request): this Products tab
              shows ONLY the products this seller has added to their
              store, each with Remove. Products are added from the Shop
              (seller cards add directly to the seller's own store). */}
        </>
      )}

      {tab === "orders" && (() => {
        // Three clearly separated sections — an order lives in exactly
        // one and moves sections when its status changes. Nothing mixed.
        const pendingOrders = d.orders.filter((o) => o.status === "Pending" || o.status === "Confirmed");
        const shipmentOrders = d.orders.filter((o) => o.status === "Shipped");
        const completedOrders = d.orders.filter((o) => o.status === "Delivered");
        const sectionOrders = orderSection === "pending" ? pendingOrders : orderSection === "shipment" ? shipmentOrders : completedOrders;
        const finByOrder = new Map((walletQ.data?.financeOrders ?? []).map((f) => [f.orderId, f]));
        const walletBalance = walletQ.data?.availableBalance ?? 0;
        const walletPending = walletQ.data?.pendingOrderHolds ?? 0;
        const walletTotal = walletQ.data?.totalBalance ?? walletBalance + walletPending;
        const sectionTabs = [
          { id: "pending" as const, label: t("sord.secPending"), icon: "📦", count: pendingOrders.length },
          { id: "shipment" as const, label: t("sord.secShipment"), icon: "🚚", count: shipmentOrders.length },
          { id: "completed" as const, label: t("sord.secCompleted"), icon: "✅", count: completedOrders.length },
        ];
        return (
          <>
            <div className={orderSection === "pending" && pendingOrders.length > 0 ? "rounded-xl border-2 border-[var(--alert)] bg-[var(--alert-bg)] px-4 py-3" : ""}>
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">
                {t("sd.myOrders")} ({d.orders.length})
                {pendingOrders.length > 0 && (
                  <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-[var(--alert)] px-2.5 py-1 text-xs font-bold text-white">
                    ● {pendingOrders.length} {t("sd.pendingShipment")} — {t("notif.live")}
                  </span>
                )}
                {pendingOrders.some((o) => newOrderIdSet.has(o.id)) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold)] px-2.5 py-1 text-xs font-extrabold text-[var(--gold-ink)] shadow">
                    ✦ {t("sord.newOrderBadge")} ({pendingOrders.filter((o) => newOrderIdSet.has(o.id)).length})
                  </span>
                )}
              </h3>
              {orderSection === "pending" && pendingOrders.length > 0 && <p className="mt-1 text-sm font-semibold text-[var(--alert)]">{pendingOrders.length} {t("notif.pendingAlert")} — {t("sd.pendingShipment")}</p>}
            </div>

            {/* Section tabs: Pending / Shipment / Completed, each with its own count */}
            <div className="mt-3 flex gap-1.5" role="tablist" aria-label={t("sd.myOrders")}>
              {sectionTabs.map((st) => {
                const active = orderSection === st.id;
                const alertTab = st.id === "pending" && st.count > 0;
                const newInTab = st.id === "pending" ? pendingOrders.filter((o) => newOrderIdSet.has(o.id)).length : 0;
                return (
                  <button
                    key={st.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`${st.label}: ${st.count}${newInTab > 0 ? `, ${newInTab} new` : ""}`}
                    onClick={() => { setOrderSection(st.id); setDeliverFor(null); setDeliverErr(null); }}
                    className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center text-xs font-bold leading-tight min-[420px]:text-[13px] sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 sm:text-sm ${active ? (alertTab ? "bg-[var(--alert)] text-white" : "bg-[var(--accent)] text-white") : alertTab ? "border-2 border-[var(--alert)] bg-[var(--alert-bg)] text-[var(--alert)]" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
                  >
                    <span aria-hidden>{st.icon}</span> {st.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? "bg-white/25 text-white" : alertTab ? "bg-[var(--alert)] text-white" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>{st.count}</span>
                    {newInTab > 0 && <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-extrabold text-[var(--gold-ink)] shadow">NEW {newInTab}</span>}
                  </button>
                );
              })}
            </div>

            {deliverMsg && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{deliverMsg}</p>}

            <h4 className="mt-4 font-display text-base font-bold text-[var(--text)]">
              {orderSection === "pending" ? `📦 ${t("sord.secPending")}` : orderSection === "shipment" ? `🚚 ${t("sord.secShipment")}` : `✅ ${t("sord.secCompleted")}`} ({sectionOrders.length})
            </h4>
            {sectionOrders.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-center text-sm text-[var(--dim)]">{orderSection === "pending" ? t("sord.nonePending") : orderSection === "shipment" ? t("sord.noneShipment") : t("sord.noneCompleted")}</p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                {sectionOrders.map((o) => {
                  const isPendingShip = o.status === "Pending" || o.status === "Confirmed";
                  const isNew = isPendingShip && newOrderIdSet.has(o.id);
                  const isShipment = o.status === "Shipped";
                  const fin = finByOrder.get(o.id);
                  const payable = fin?.payableCost ?? 0;
                  const profit = fin?.profit ?? 0;
                  const orderAmount = fin?.orderAmount ?? o.total;
                  const short = payable > 0 && walletBalance < payable;
                  const confirming = deliverFor === o.id;
                  return (
                    <div
                      key={o.id}
                      onClick={isNew ? () => markOrderViewed.mutate(o.id) : undefined}
                      className={isNew ? "cursor-pointer rounded-xl ring-2 ring-[var(--gold)] ring-offset-1 shadow-[0_0_0_4px_rgba(217,119,6,0.18)]" : isPendingShip ? "rounded-xl ring-2 ring-[var(--alert)] ring-offset-1 shadow-[0_0_0_4px_rgba(220,38,38,0.12)]" : ""}
                    >
                      {isPendingShip && (
                        <p className="flex items-center gap-2 rounded-t-xl bg-[var(--alert)] px-3 py-1.5 text-xs font-bold text-white">
                          <span className="h-2 w-2 animate-ping rounded-full bg-white" aria-hidden /> 📦 {t("sd.pendingShipment")} — {t("notif.pendingAlert")}
                          {isNew && <span className="ml-auto rounded-full bg-[var(--gold)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--gold-ink)] shadow">✦ {t("sord.newOrderBadge")}</span>}
                        </p>
                      )}
                      {isShipment && (
                        <p className="flex items-center gap-2 rounded-t-xl bg-[var(--amber)] px-3 py-1.5 text-xs font-bold text-[#451a03]">
                          <span aria-hidden>⏳</span> {t("sord.waitingApproval")}
                        </p>
                      )}
                      <OrderCard order={o} hideItems codActor={{ role: "seller", id: user.id }} />
                      {orderSection === "pending" && (
                        <div className="rounded-b-xl border border-t-0 border-[var(--border)] bg-[var(--surface)] px-4 pb-4 pt-3">
                          {!confirming ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm text-[var(--dim)]">
                                {t("sord.walletBalance")}: <strong className="text-[var(--text)]">{walletQ.isPending ? "…" : fmt(walletBalance)}</strong>
                                {" · "}{t("sord.yourProfit")}: <strong className="text-[var(--accent)]">{fmt(profit)}</strong>
                              </p>
                              <button
                                type="button"
                                aria-label={`Deliver order ${o.id} by paying from wallet`}
                                onClick={() => { setDeliverFor(o.id); setDeliverErr(null); setDeliverMsg(null); }}
                                className={goldBtn + " ml-auto px-4 py-2 text-sm"}
                              >
                                🚚 {t("sord.deliverBtn")}
                              </button>
                            </div>
                          ) : (
                            <div role="group" aria-label={`${t("sord.deliverTitle")} — Order #${o.id}`} className="rounded-xl border-2 border-[var(--gold)]/60 bg-[var(--surface-alt)] p-3">
                              <p className="font-display text-sm font-bold text-[var(--text)]">🚚 {t("sord.deliverTitle")} — Order #{o.id}</p>
                              <dl className="mt-2 flex flex-col gap-1.5 text-sm">
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="text-[var(--dim)]">{t("sord.walletBalance")} ({t("w.balance")})</dt>
                                  <dd className="font-display font-bold text-[var(--text)]">{walletQ.isPending ? "…" : fmt(walletBalance)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="text-[var(--dim)]">{t("sord.orderAmountLine")}</dt>
                                  <dd className="font-display font-bold text-[var(--text)]">{fmt(orderAmount)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="text-[var(--dim)]">{t("sord.payFromWallet")}</dt>
                                  <dd className="font-display font-bold text-[var(--text)]">−{fmt(payable)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="text-[var(--dim)]">{t("sord.yourProfit")}</dt>
                                  <dd className="font-display font-bold text-[var(--accent)]">+{fmt(profit)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-1.5">
                                  <dt className="text-[var(--dim)]">{t("sord.afterShipAvailable")}</dt>
                                  <dd className="font-display font-bold text-[var(--text)]">{fmt(walletBalance)} − {fmt(payable)} = {fmt(walletBalance - payable)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="text-[var(--dim)]">{t("sord.afterShipPending")}</dt>
                                  <dd className="font-display font-bold text-[var(--text)]">{fmt(walletPending)} + {fmt(payable)} = {fmt(walletPending + payable)}</dd>
                                </div>
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="font-semibold text-[var(--text)]">{t("sord.afterShipTotal")}</dt>
                                  <dd className="font-display font-extrabold text-[var(--text)]">{fmt(walletTotal)}</dd>
                                </div>
                              </dl>
                              <p className="mt-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-xs leading-snug text-[var(--text)]">ℹ️ {t("sord.holdLine")}.</p>
                              <p className="mt-1.5 rounded-lg bg-[var(--surface)] px-3 py-2 text-xs leading-snug text-[var(--text)]">✅ {t("sord.onComplete")}</p>
                              {short && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">⚠ {t("sord.notEnough")}</p>}
                              {deliverErr && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">⚠ {deliverErr}</p>}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  aria-label={`Confirm pay from wallet and deliver order ${o.id}`}
                                  disabled={deliverOrder.isPending}
                                  onClick={() => deliverOrder.mutate(o.id)}
                                  className={goldBtn + " px-4 py-2 text-sm"}
                                >
                                  {deliverOrder.isPending ? t("common.loading") : `💳 ${t("sord.confirmDeliver")}`}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Cancel delivering order ${o.id}`}
                                  disabled={deliverOrder.isPending}
                                  onClick={() => { setDeliverFor(null); setDeliverErr(null); }}
                                  className={ghostBtn + " px-4 py-2 text-sm"}
                                >
                                  {t("adm.cancel")}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Order History — a permanent, chronological record of EVERY
                order this seller's store has received (newest first),
                Cancelled included. Unlike the three working sections
                above, nothing ever leaves this list: a completed order
                stays here as history. Seller-side only — the Wallet
                shows money, never order history. */}
            <section aria-label={t("sord.historyTitle")} className="mt-8 border-t-2 border-[var(--border)] pt-5">
              <h3 className="font-display text-lg font-bold text-[var(--text)]">
                📜 {t("sord.historyTitle")} ({d.orderHistory.length})
              </h3>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("sord.historySub")}</p>
              {d.orderHistory.length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-center text-sm text-[var(--dim)]">{t("sord.historyEmpty")}</p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {d.orderHistory.map((o) => {
                    const mine = o.items.filter((it) => inStore.has(it.productId));
                    const myAmount = mine.reduce((s, it) => s + it.buyerPrice * it.qty, 0);
                    const myProfit = mine.reduce((s, it) => s + it.profitAmount * it.qty, 0);
                    const cancelled = o.status === "Cancelled";
                    return (
                      <div key={o.id}>
                        <OrderCard order={o} hideItems codActor={{ role: "seller", id: user.id }} />
                        <p className="mt-1.5 flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
                          <span className="text-[var(--dim)]">
                            {t("sord.sellerShare")}: <strong className="text-[var(--text)]">{fmt(myAmount)}</strong>
                          </span>
                          {cancelled ? (
                            <span className="font-semibold text-[var(--dim)]">{t("sord.historyCancelled")}</span>
                          ) : (
                            <span className="text-[var(--dim)]">
                              {t("sord.yourProfit")}: <strong className="text-[var(--accent)]">{fmt(myProfit)}</strong>
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        );
      })()}

      {tab === "wallet" && (
        <div>
          <WalletPanel user={user} onGoSupport={onGoSupport} />
        </div>
      )}

      {tab === "my" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("sd.myProfile")}</h3>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("sa.fullName")}</dt>
              <dd className="font-medium text-[var(--text)]">{user.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("sa.email")}</dt>
              <dd className="font-medium text-[var(--text)]">{user.email ?? (user.phone ? fmtPhone(user.phone, user.country) : "—")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("sa.storeName")}</dt>
              <dd className="font-medium text-[var(--text)]">{user.storeName ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("acc.country")}</dt>
              <dd className="font-medium text-[var(--text)]">{user.country ?? t("acc.notSet")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("sd.photoFile")}</dt>
              <dd className="font-medium text-[var(--text)]">{user.photoFileName ?? t("sd.noFile")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("sd.logoFile")}</dt>
              <dd className="font-medium text-[var(--text)]">{user.storeLogoFileName ?? t("sd.noFile")}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--dim)]">{t("sd.verification")}</dt>
              <dd>
                <StatusBadge status={user.verificationStatus} />
              </dd>
            </div>
          </dl>
          <SellerMediaEditor user={user} onUpdated={onUserUpdated} />
          <button type="button" onClick={onSignOut} className={ghostBtn + " mt-4"}>
            {t("acc.signOut")}
          </button>
          <ChangeMyPasswordPanel userId={user.id} onDone={() => { if (user) onUserUpdated?.({ ...user, mustChangePassword: false }); }} />
        </div>
      )}

      {/* Seller bottom navigation (Home / Products / Orders / Wallet — no Account entry here by design) */}
      <nav
        aria-label="Seller dashboard navigation"
        className={`sticky z-30 mt-6 flex justify-around rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg ${layout === "menu" ? "bottom-3" : "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-24"}`}
      >
        {tabs.map((tb) => {
          const badge = tb.id === "orders" ? d.pendingShipment : tb.id === "wallet" ? 0 : 0;
          return (
          <button
            key={tb.id}
            type="button"
            aria-label={badge > 0 ? `${tb.label}, ${badge} pending shipment` : tb.label}
            aria-current={tab === tb.id ? "page" : undefined}
            onClick={() => setTab(tb.id)}
            className={`relative flex flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              tab === tb.id ? "text-[var(--accent)]" : badge > 0 ? "text-[var(--alert)]" : "text-[var(--dim)]"
            }`}
          >
            <span className="relative text-lg leading-none">{tb.icon}
              {badge > 0 && <span className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--alert)] px-0.5 text-[10px] font-bold text-white">{badge > 99 ? "99+" : badge}</span>}
            </span>
            {tb.label}
          </button>
          );
        })}
      </nav>
    </div>
  );
}

/* -------------------------------- Admin ---------------------------------- */

const ORDER_STATUSES = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Cancelled",
] as const;

type AdminSection = "overview" | "sellers" | "users" | "products" | "sellerProducts" | "external" | "profit" | "orders" | "wallet" | "support" | "theme" | "settings";
type DocKind = "photo" | "logo" | "docFront" | "docBack";

function SellerDocCard({ adminId, sellerId, kind, label, fileName, hasFile, contentType, size, onView }: {
  adminId: number; sellerId: number; kind: DocKind; label: string; fileName: string | null; hasFile: boolean; contentType: string | null; size: number | null;
  onView: (v: { sellerId: number; kind: DocKind; label: string }) => void;
}) {
  const { t } = useUi();
  const doc = useQuery({ queryKey: ["admin-doc", adminId, sellerId, kind], queryFn: () => api.adminGetDocumentUrl({ adminId, sellerId, kind }), enabled: hasFile });
  const url = doc.data?.url ?? null;
  const isImg = (contentType ?? doc.data?.contentType ?? "").startsWith("image/");
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--dim)]">{label}</p>
      {hasFile && isImg && url && <img src={url} alt={label} className="mt-2 h-24 w-full rounded-lg object-cover" />}
      <p className="mt-2 break-words text-sm font-medium text-[var(--text)]">{fileName ?? t("adm.noFile")}</p>
      {(contentType || size) && <p className="text-xs text-[var(--dim)]">{contentType ?? ""}{size ? ` · ${formatBytes(size)}` : ""}</p>}
      {hasFile ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" aria-label={`Open ${label}`} onClick={() => onView({ sellerId, kind, label })} className={primaryBtn + " px-3 py-1.5 text-xs"}>{t("adm.openView")}</button>
          {url && <a href={url} download={fileName ?? label} target="_blank" rel="noreferrer" className={ghostBtn + " px-3 py-1.5 text-xs"}>{t("adm.download")}</a>}
        </div>
      ) : fileName ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{t("adm.docOldNote")}</p>
      ) : (<p className="mt-1 text-xs text-[var(--dim)]">{t("adm.noFile")}</p>)}
    </div>
  );
}

// One customer's live-chat thread, embedded inside that customer's own
// Admin section (Seller Accounts detail / Users rows): the Admin reads and
// replies to this exact customer here, and replies land in the customer's
// Support live chat as usual. Opening the thread while the customer is
// waiting marks the chat activity seen. The whole conversation can be
// deleted (two-step, naming the customer); the customer can chat again
// afterwards.
function CustomerChatPanel({ adminId, userId, customerName }: { adminId: number; userId: number; customerName: string }) {
  const { t } = useUi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletedMsg, setDeletedMsg] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const chat = useQuery({ queryKey: ["chat-messages", userId], queryFn: () => api.listChatMessages({ userId }), refetchInterval: 5000 });
  const messages = chat.data?.messages ?? [];
  const lastMsg = messages[messages.length - 1];
  const markSeen = useMutation({
    mutationFn: () => api.adminMarkActivitySeen({ adminId, kind: "chat", refId: userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-activity"] }),
  });
  const seenForRef = useRef(0);
  useEffect(() => {
    if (lastMsg && lastMsg.sender === "customer" && seenForRef.current !== lastMsg.id) {
      seenForRef.current = lastMsg.id;
      markSeen.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMsg?.id]);
  // The panel mounts when the Admin opens this customer's Chat tab:
  // bring it directly into view (thread + input), keep the thread
  // scrolled to the latest message, and focus the reply input — the
  // Admin never has to scroll to find the conversation.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelFocusedRef = useRef(false);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  useEffect(() => {
    if (panelFocusedRef.current || chat.isPending) return;
    panelFocusedRef.current = true;
    const timer = window.setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      inputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.isPending]);
  const [pendingAtt, setPendingAtt] = useState<ChatAttachmentData | null>(null);
  const [attErr, setAttErr] = useState<string | null>(null);
  async function pickAttachment(f: File | null) {
    setAttErr(null);
    if (!f) return;
    const r = await readChatAttachment(f);
    if (!r.ok) { setAttErr(r.error); return; }
    setPendingAtt(r.att);
  }
  const send = useMutation({
    mutationFn: () => api.adminReplyChat({ adminId, userId, message: draft, ...(pendingAtt ? { attachment: pendingAtt } : {}) }),
    onSuccess: (r) => {
      if (!r.ok) { setAttErr(r.error ?? "The reply could not be sent. Please try again."); return; }
      setDraft(""); setPendingAtt(null); setAttErr(null);
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] }); queryClient.invalidateQueries({ queryKey: ["admin-chats"] }); queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
    },
    onError: (e) => setAttErr(String(e)),
  });
  const del = useMutation({
    mutationFn: () => api.adminDeleteChatThread({ adminId, userId }),
    onSuccess: (r) => {
      if (!r.ok) { setDeleteErr(r.error ?? "Failed."); return; }
      setConfirmingDelete(false);
      setDeletedMsg(t("chat.deletedOk"));
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-chats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
    },
    onError: (e) => setDeleteErr(String(e)),
  });
  return (
    <div ref={panelRef} className="mt-4 scroll-mt-[calc(var(--header-h,3.5rem)+1rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h4 className="flex flex-wrap items-center gap-2 font-display font-bold text-[var(--text)]">
        💬 {t("chat.withCustomer")} — {customerName}
        {lastMsg?.sender === "customer" && <span className="rounded-full bg-[var(--alert-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--alert)]">{t("chat.waiting")}</span>}
      </h4>
      {deletedMsg && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {deletedMsg}</p>}
      {messages.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--dim)]">{t("chat.empty")}</p>
      ) : (
        <div ref={listRef} className="mt-3 flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {messages.map((m) => (
            <ChatBubble key={m.id} m={m} requesterId={adminId} ownSender="admin" ownLabel={t("sup.admin")} otherLabel={customerName} />
          ))}
        </div>
      )}
      {attErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {attErr}</p>}
      <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim() || pendingAtt) send.mutate(); }}>
        <ChatAttachPicker pickerId={`admin-chat-attach-${userId}`} pending={pendingAtt} onPick={pickAttachment} onClear={() => setPendingAtt(null)} />
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("adm.replyPh")} className={inputCls + " min-w-0 flex-1"} aria-label={`Reply to ${customerName}`} />
        <button type="submit" aria-label={`Send reply to ${customerName}`} disabled={(!draft.trim() && !pendingAtt) || send.isPending} className={primaryBtn + " shrink-0"}>{t("adm.send")}</button>
      </form>
      {messages.length > 0 && !confirmingDelete && (
        <button type="button" aria-label={`Delete chat conversation with ${customerName}`} onClick={() => { setConfirmingDelete(true); setDeleteErr(null); setDeletedMsg(null); }} className="mt-3 text-sm font-bold text-rose-600">🗑 {t("chat.deleteBtn")}</button>
      )}
      {confirmingDelete && (
        <div className="mt-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 dark:bg-rose-950/20">
          <p className="text-sm font-bold text-rose-900 dark:text-rose-100">{t("chat.deleteQ")} {customerName}?</p>
          <p className="mt-0.5 text-xs text-rose-800 dark:text-rose-200">{t("chat.deleteNote")}</p>
          {deleteErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-700">⚠ {deleteErr}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" aria-label={`Confirm delete chat with ${customerName}`} disabled={del.isPending} onClick={() => del.mutate()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">{t("chat.confirmDelete")}</button>
            <button type="button" aria-label="Cancel delete chat" onClick={() => setConfirmingDelete(false)} className={ghostBtn + " px-3 py-1.5 text-sm"}>{t("adm.cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* One ON/OFF switch row (Language & Prices settings). The switch itself is
   a real button with role="switch"; a disabled row (English — always ON,
   or the last currency still ON) shows its reason instead of toggling. */
function SwitchRow({
  label,
  note,
  checked,
  onToggle,
  disabled,
  disabledNote,
  switchLabel,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  disabledNote?: string;
  switchLabel: string;
}) {
  const { t } = useUi();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--text)]">{label}</span>
        {note && <span className="block text-xs leading-snug text-[var(--dim)]">{note}</span>}
        {disabled && disabledNote && <span className="block text-xs leading-snug text-[var(--dim)]">{disabledNote}</span>}
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${checked ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
        {checked ? t("lp.on") : t("lp.off")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={switchLabel}
        disabled={disabled || !onToggle}
        onClick={onToggle}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-emerald-600" : "bg-[var(--dim)]"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

/* The payment screenshot attached to ONE prepaid order (Admin view).
   Same on-demand pattern as DepositScreenshotView: the button loads
   the image URL (getOrderPaymentProofUrl serves Admins only) and shows
   it inline with a download link, so the Pay First payment can be
   checked from the order itself. */
function OrderPaymentProofView({ orderId, adminId }: { orderId: number; adminId: number }) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["order-payment-proof", adminId, orderId],
    queryFn: () => api.getOrderPaymentProofUrl({ adminId, orderId }),
    enabled: open,
  });
  if (!open) {
    return (
      <button type="button" aria-label={`View payment proof for order ${orderId}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[var(--accent)]">
        🖼 {t("order.viewProof")}
      </button>
    );
  }
  const url = q.data?.url ?? null;
  const name = q.data?.fileName ?? t("co.payShotLabel");
  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      {q.isPending ? (
        <p className="text-sm text-[var(--dim)]">{t("common.loading")}</p>
      ) : url ? (
        <div className="flex flex-col gap-2">
          <img src={url} alt={name} className="max-h-64 w-auto max-w-full rounded-lg border border-[var(--border)] object-contain" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[var(--dim)]">📷 {name}{q.data?.size ? ` · ${formatBytes(q.data.size)}` : ""}</span>
            <a href={url} download={name} target="_blank" rel="noreferrer" aria-label={`${t("adm.download")}: ${name}`} className="font-bold text-[var(--accent)]">
              {t("adm.download")}
            </a>
            <button type="button" aria-label="Hide payment proof" onClick={() => setOpen(false)} className="font-bold text-[var(--dim)]">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--dim)]">{t("order.proofAttached")}</p>
      )}
    </div>
  );
}

/* The payment screenshot attached to ONE deposit request (Admin view).
   A "View Screenshot" button loads the image URL on demand
   (getDepositScreenshotUrl serves Admins only) and shows the image
   inline with a download link, so it can be checked before approving
   the deposit. */
function DepositScreenshotView({ txId, adminId }: { txId: number; adminId: number }) {
  const { t } = useUi();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["deposit-screenshot", adminId, txId],
    queryFn: () => api.getDepositScreenshotUrl({ adminId, txId }),
    enabled: open,
  });
  if (!open) {
    return (
      <button type="button" aria-label={`View payment screenshot for wallet request ${txId}`} onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[var(--accent)]">
        🖼 {t("dep.viewShot")}
      </button>
    );
  }
  const url = q.data?.url ?? null;
  const name = q.data?.fileName ?? t("dep.shotLabel");
  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      {q.isPending ? (
        <p className="text-sm text-[var(--dim)]">{t("common.loading")}</p>
      ) : url ? (
        <div className="flex flex-col gap-2">
          <img src={url} alt={name} className="max-h-64 w-auto max-w-full rounded-lg border border-[var(--border)] object-contain" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[var(--dim)]">📷 {name}{q.data?.size ? ` · ${formatBytes(q.data.size)}` : ""}</span>
            <a href={url} download={name} target="_blank" rel="noreferrer" aria-label={`${t("adm.download")}: ${name}`} className="font-bold text-[var(--accent)]">
              {t("adm.download")}
            </a>
            <button type="button" aria-label="Hide payment screenshot" onClick={() => setOpen(false)} className="font-bold text-[var(--dim)]">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--dim)]">{t("dep.shotAttached")}</p>
      )}
    </div>
  );
}

/* Pay & Withdraw confirmation for ONE pending withdrawal request. Shows
   the full breakdown before the Admin confirms: customer, requested
   amount, the payout destination the customer gave, the wallet balance
   before payment (available + this request's held amount), the amount to
   deduct, and the balance after. The optional payment reference (e.g.
   UPI transaction ID) is recorded on the request when paid. */
function PayWithdrawPanel({
  request,
  paymentRef,
  onPaymentRefChange,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  request: WalletRequest;
  paymentRef: string;
  onPaymentRefChange: (v: string) => void;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t, fmt } = useUi();
  const balanceBefore = request.sellerAvailableBalance + request.amount;
  const balanceAfter = request.sellerAvailableBalance;
  const rows: Array<[string, string, boolean?]> = [
    [t("wp.customer"), `${request.sellerName}${request.storeName ? ` · ${request.storeName}` : ""}`],
    [t("wp.requested"), fmt(request.amount), true],
    [t("wp.payoutTo"), `${request.method}${request.reference ? ` · ${request.reference}` : ""}${request.details ? ` · ${request.details}` : ""}`],
    [t("wp.currentBalance"), fmt(balanceBefore)],
    [t("wp.deduct"), `− ${fmt(request.amount)}`, true],
    [t("wp.afterBalance"), fmt(balanceAfter), true],
  ];
  return (
    <div className="mt-3 rounded-xl border-2 border-emerald-600/50 bg-emerald-50 p-3 dark:bg-emerald-950/20" role="group" aria-label={`${t("wp.payTitle")} #${request.id}`}>
      <p className="font-display text-sm font-bold text-[var(--text)]">💸 {t("wp.payTitle")} #{request.id}</p>
      <dl className="mt-2 flex flex-col gap-1.5 text-sm">
        {rows.map(([k, v, strong]) => (
          <div key={k} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="shrink-0 text-[var(--dim)]">{k}:</dt>
            <dd className={`min-w-0 break-words ${strong ? "font-display font-bold text-[var(--text)]" : "font-semibold text-[var(--text)]"}`}>{v}</dd>
          </div>
        ))}
      </dl>
      {request.method === "USDT (Crypto)" && (
        <p className="mt-2 text-sm text-[var(--text)]">
          {t("wp.usdtApprox")}: <strong className="font-display">USDT {(request.amount / 83).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          <span className="text-xs text-[var(--dim)]"> (₹83 = 1 USDT)</span>
        </p>
      )}
      <p className="mt-2 text-xs leading-snug text-[var(--dim)]">{t("wp.realMoneyNote")}</p>
      <div className="mt-3">
        <Field label={t("wp.payRef")}>
          <input value={paymentRef} onChange={(e) => onPaymentRefChange(e.target.value)} placeholder={t("wp.payRefPh")} className={inputCls} aria-label={`Payment reference for withdrawal request ${request.id}`} />
        </Field>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" aria-label={`Confirm pay and withdraw for request ${request.id}`} disabled={busy} onClick={onConfirm} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">✓ {t("wp.confirmPay")}</button>
        <button type="button" aria-label={`Cancel pay and withdraw for request ${request.id}`} disabled={busy} onClick={onCancel} className={ghostBtn + " px-3 py-2 text-sm"}>{t("adm.cancel")}</button>
      </div>
    </div>
  );
}

function AdminView({ user, settings, onUserUpdated }: { user: User; settings: ApiResponse<typeof api, "getSettings"> | undefined; onUserUpdated?: (u: NonNullable<User>) => void }) {
  const { t, fmt, currency, lang } = useUi();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<AdminSection>("overview");
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ sellerId: number; kind: DocKind; label: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; role: "seller" | "buyer"; title: string; detail: string } | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("Manual credit");
  const [creditErr, setCreditErr] = useState<string | null>(null);
  const [creditOk, setCreditOk] = useState<string | null>(null);
  // Pay & Withdraw (pending withdrawal requests) + Admin Direct Withdraw
  const [payTargetId, setPayTargetId] = useState<number | null>(null);
  const [payRef, setPayRef] = useState("");
  const [payErr, setPayErr] = useState<string | null>(null);
  const [payOk, setPayOk] = useState<string | null>(null);
  const [awAmount, setAwAmount] = useState("");
  const [awNote, setAwNote] = useState("");
  const [awReview, setAwReview] = useState(false);
  const [awErr, setAwErr] = useState<string | null>(null);
  const [awOk, setAwOk] = useState<string | null>(null);
  // Admin Accounts (Settings → Admin Accounts): Gmail / password / add admin
  const [gmailForm, setGmailForm] = useState({ newEmail: "", currentPassword: "" });
  const [gmailTouched, setGmailTouched] = useState(false);
  const [gmailServerErr, setGmailServerErr] = useState<string | null>(null);
  const [gmailOk, setGmailOk] = useState<string | null>(null);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwTouched, setPwTouched] = useState(false);
  const [pwServerErr, setPwServerErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [addAdminForm, setAddAdminForm] = useState({ name: "", email: "", password: "", confirmPassword: "", creatorPassword: "" });
  const [addAdminTouched, setAddAdminTouched] = useState(false);
  const [addAdminServerErr, setAddAdminServerErr] = useState<string | null>(null);
  const [addAdminOk, setAddAdminOk] = useState<string | null>(null);
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetForm, setResetForm] = useState({ newPassword: "", confirmPassword: "", actorPassword: "" });
  const [resetTouched, setResetTouched] = useState(false);
  const [resetServerErr, setResetServerErr] = useState<string | null>(null);
  const [resetOk, setResetOk] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: number; name: string; email: string } | null>(null);
  const [removePassword, setRemovePassword] = useState("");
  const [removeTouched, setRemoveTouched] = useState(false);
  const [removeServerErr, setRemoveServerErr] = useState<string | null>(null);
  const [removeOk, setRemoveOk] = useState<string | null>(null);
  // Bulk Profit % (Products section, top panel)
  type BulkSlabRow = { enabled: boolean; fromPrice: string; toPrice: string; minPercent: string; maxPercent: string };
  const [bulkScopeType, setBulkScopeType] = useState<"all" | "category" | "price_range">("all");
  const [bulkCategory, setBulkCategory] = useState("Electronics");
  const [bulkMinPrice, setBulkMinPrice] = useState("");
  const [bulkMaxPrice, setBulkMaxPrice] = useState("");
  const [bulkMode, setBulkMode] = useState<"fixed" | "random" | "slabs">("random");
  const [bulkFixed, setBulkFixed] = useState("20");
  const [bulkRandomMin, setBulkRandomMin] = useState("10");
  const [bulkRandomMax, setBulkRandomMax] = useState("15");
  const [bulkSlabs, setBulkSlabs] = useState<BulkSlabRow[]>([
    { enabled: true, fromPrice: "0", toPrice: "999", minPercent: "10", maxPercent: "15" },
    { enabled: true, fromPrice: "1000", toPrice: "4999", minPercent: "15", maxPercent: "25" },
    { enabled: true, fromPrice: "5000", toPrice: "", minPercent: "20", maxPercent: "30" },
    { enabled: false, fromPrice: "", toPrice: "", minPercent: "", maxPercent: "" },
  ]);
  const [bulkTouched, setBulkTouched] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<ApiResponse<typeof api, "previewBulkProfit"> | null>(null);
  const [bulkServerErr, setBulkServerErr] = useState<string | null>(null);
  const [bulkApplied, setBulkApplied] = useState<string | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);

  const overview = useQuery({ queryKey: ["admin-overview", user?.id], queryFn: () => api.adminOverview({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  const products = useQuery({ queryKey: ["products", { category: "All", search: "" }], queryFn: () => api.listProducts({ category: "All", search: "" }), enabled: !!user && user.role === "admin" });
  const applications = useQuery({ queryKey: ["seller-applications", user?.id], queryFn: () => api.listSellerApplications({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  const chatThreads = useQuery({ queryKey: ["admin-chats", user?.id], queryFn: () => api.adminChatThreads({ adminId: user!.id }), enabled: !!user && user.role === "admin", refetchInterval: 8000 });
  const walletRequests = useQuery({ queryKey: ["admin-wallet", user?.id], queryFn: () => api.adminWalletRequests({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  const adminAccounts = useQuery({ queryKey: ["admin-accounts", user?.id], queryFn: () => api.listAdminAccounts({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  const resetRequests = useQuery({ queryKey: ["password-reset-requests", user?.id], queryFn: () => api.listPasswordResetRequests({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  const [resetPwDraft, setResetPwDraft] = useState<Record<number, { newPassword: string; confirmPassword: string }>>({});
  const [resetOpenId, setResetOpenId] = useState<number | null>(null);
  const [resetReqErr, setResetReqErr] = useState<string | null>(null);
  const [directPwOpen, setDirectPwOpen] = useState<number | null>(null);
  const [directPwDraft, setDirectPwDraft] = useState<Record<number, { newPassword: string; confirmPassword: string }>>({});
  const [directPwResult, setDirectPwResult] = useState<{ userId: number; ok: boolean; text: string } | null>(null);
  const [showTypedPw, setShowTypedPw] = useState(false);
  const [resetReqOk, setResetReqOk] = useState<string | null>(null);
  const sellerFinance = useQuery({ queryKey: ["seller-finance", user?.id, selectedSellerId], queryFn: () => api.getSellerFinance({ actorId: user!.id, sellerId: selectedSellerId! }), enabled: !!user && user.role === "admin" && selectedSellerId !== null });
  // Seller detail: this seller's orders (status control + reminder notice)
  const sellerOrdersAdmin = useQuery({ queryKey: ["admin-seller-orders", user?.id, selectedSellerId], queryFn: () => api.adminGetSellerOrders({ adminId: user!.id, sellerId: selectedSellerId! }), enabled: !!user && user.role === "admin" && selectedSellerId !== null });
  // Customer detail pages (seller + buyer) show ONE tidy section at a
  // time via these tabs — Personal Details / Orders / Products / Wallet /
  // Chat — instead of one long scattered page.
  type SellerDetailTab = "personal" | "orders" | "products" | "wallet" | "chat";
  type BuyerDetailTab = "personal" | "orders" | "chat";
  const [sellerTab, setSellerTab] = useState<SellerDetailTab>("personal");
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [buyerTab, setBuyerTab] = useState<BuyerDetailTab>("personal");
  // Admin → Orders is grouped BY SHOP first: the section opens on the
  // registered sellers' shops (shop/store name first, one row per
  // shop) and only a click opens that shop's own orders, so with many
  // shops no order can be mixed up with another shop's. ordersShowAll
  // is the optional flat "view all orders" list; the default flow is
  // by-shop.
  const [ordersShopKey, setOrdersShopKey] = useState<string | null>(null);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersShowAll, setOrdersShowAll] = useState(false);
  // Seller detail → Orders → Quick Send: one quantity box + one Send
  // Order button per product row. No customer form at all.
  const [quickQty, setQuickQty] = useState<Record<number, string>>({});
  const [quickErr, setQuickErr] = useState<string | null>(null);
  const [quickOk, setQuickOk] = useState<string | null>(null);
  // Reminder notices (per order + one general notice per seller)
  const [noticeOpenOrderId, setNoticeOpenOrderId] = useState<number | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<Record<number, string>>({});
  const [noticeGeneral, setNoticeGeneral] = useState("");
  const [noticeResult, setNoticeResult] = useState<{ key: string; ok: boolean; text: string } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<{ sellerId: number; ok: boolean; text: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // One-click price refresh (Products section)
  const [priceResult, setPriceResult] = useState<ApiResponse<typeof api, "refreshCatalogPrices"> | null>(null);
  const [priceErr, setPriceErr] = useState<string | null>(null);
  const [bgenMode, setBgenMode] = useState<"add" | "target">("add");
  const [bgenValue, setBgenValue] = useState("");
  const [bgenResult, setBgenResult] = useState<ApiResponse<typeof api, "adminBulkGenerateProducts"> | null>(null);
  const [prodSourceFilter, setProdSourceFilter] = useState<"all" | "curated" | "bulk">("all");
  // Theme & Design drafts (saved to settings on Apply)
  const [schemeDraft, setSchemeDraft] = useState<string | null>(null);
  const [layoutDraft, setLayoutDraft] = useState<string | null>(null);
  const [designOk, setDesignOk] = useState<string | null>(null);
  const [designErr, setDesignErr] = useState<string | null>(null);
  const viewerDoc = useQuery({ queryKey: ["admin-doc-view", user?.id, viewer?.sellerId, viewer?.kind], queryFn: () => api.adminGetDocumentUrl({ adminId: user!.id, sellerId: viewer!.sellerId, kind: viewer!.kind }), enabled: !!viewer && !!user && user.role === "admin" });
  const bulkHistory = useQuery({ queryKey: ["bulk-profit-history", user?.id], queryFn: () => api.getBulkProfitHistory({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  // Seller Products list (every product sellers added to their stores)
  const sellerProductsList = useQuery({ queryKey: ["admin-seller-products", user?.id], queryFn: () => api.adminListSellerProducts({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  // External Products (Shop from Other Platforms): Admin add/edit/delete
  // + whole-section ON/OFF. Any real merchant URL can be pasted here —
  // including an Amazon product page; no Amazon API is needed.
  const extAdminList = useQuery({ queryKey: ["admin-external-products", user?.id], queryFn: () => api.adminListExternalProducts({ adminId: user!.id }), enabled: !!user && user.role === "admin" });
  const [extEditing, setExtEditing] = useState<ExternalProduct | null>(null);
  const [extShowForm, setExtShowForm] = useState(false);
  const [extForm, setExtForm] = useState({ name: "", brand: "", category: "Mobiles", priceInr: "", merchant: "", productUrl: "" });
  const [extErr, setExtErr] = useState<string | null>(null);
  const [extOk, setExtOk] = useState<string | null>(null);
  const [extDeleteId, setExtDeleteId] = useState<number | null>(null);
  const extUpsert = useMutation({
    mutationFn: () => api.adminUpsertExternalProduct({ adminId: user!.id, id: extEditing?.id ?? null, name: extForm.name, brand: extForm.brand, category: extForm.category, priceInr: parseInt(extForm.priceInr, 10) || 0, merchant: extForm.merchant, productUrl: extForm.productUrl }),
    onSuccess: (r) => {
      if (!r.ok) { setExtErr(r.error ?? "Could not save."); setExtOk(null); return; }
      setExtErr(null);
      setExtOk(extEditing ? "External product updated ✓" : "External product added ✓ — it now shows in Shop from Other Platforms.");
      setExtShowForm(false);
      setExtEditing(null);
      queryClient.invalidateQueries({ queryKey: ["admin-external-products"] });
      queryClient.invalidateQueries({ queryKey: ["external-products"] });
    },
    onError: (e) => setExtErr(String(e)),
  });
  const extDelete = useMutation({
    mutationFn: (productId: number) => api.adminDeleteExternalProduct({ adminId: user!.id, productId }),
    onSuccess: (r) => {
      if (!r.ok) { setExtErr(r.error ?? "Could not delete."); return; }
      setExtDeleteId(null);
      setExtOk("External product deleted ✓");
      queryClient.invalidateQueries({ queryKey: ["admin-external-products"] });
      queryClient.invalidateQueries({ queryKey: ["external-products"] });
    },
    onError: (e) => setExtErr(String(e)),
  });
  const extToggle = useMutation({
    mutationFn: (enabled: boolean) => api.setExternalProductsEnabled({ adminId: user!.id, enabled }),
    onSuccess: (r) => {
      if (!r.ok) { setExtErr(r.error ?? "Could not change the switch."); return; }
      setExtOk(r.enabled ? "External Products section is ON — visitors can see it." : "External Products section is OFF — visitors cannot see it. Products are kept.");
      queryClient.invalidateQueries({ queryKey: ["admin-external-products"] });
      queryClient.invalidateQueries({ queryKey: ["external-products"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => setExtErr(String(e)),
  });
  function extStartNew() { setExtEditing(null); setExtForm({ name: "", brand: "", category: "Mobiles", priceInr: "", merchant: "", productUrl: "" }); setExtErr(null); setExtOk(null); setExtShowForm(true); }
  function extStartEdit(p: ExternalProduct) { setExtEditing(p); setExtForm({ name: p.name, brand: p.brand, category: p.category, priceInr: String(p.priceInr), merchant: p.merchant, productUrl: p.productUrl }); setExtErr(null); setExtOk(null); setExtShowForm(true); }
  function extClientError(): string | null {
    const missing: string[] = [];
    if (!extForm.name.trim()) missing.push("Product Name");
    if (!extForm.brand.trim()) missing.push("Brand");
    if (!extForm.category.trim()) missing.push("Category");
    if (!extForm.merchant.trim()) missing.push("Merchant Name");
    if (!extForm.productUrl.trim()) missing.push("Product URL");
    if (missing.length > 0) return `Missing: ${missing.join(", ")} — please fill in ${missing.length === 1 ? "this field" : "these fields"} and save again.`;
    if (!(parseInt(extForm.priceInr, 10) > 0)) return "Price (INR) must be a positive number — please enter the price as listed on the merchant's site (more than ₹0).";
    const url = extForm.productUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) return "Product URL must start with http:// or https:// — please paste the full product link from the merchant's website.";
    return null;
  }
  const [spSearch, setSpSearch] = useState("");
  const [spSellerFilter, setSpSellerFilter] = useState("all");
  // New Activity (customer orders / chats / wallet / tickets / resets)
  const activity = useQuery({ queryKey: ["admin-activity", user?.id], queryFn: () => api.adminActivityFeed({ adminId: user!.id }), enabled: !!user && user.role === "admin", refetchInterval: 15000 });
  const [hideConfirmKey, setHideConfirmKey] = useState<string | null>(null);
  const [ticketDeleteId, setTicketDeleteId] = useState<number | null>(null);
  const [ticketDeleteMsg, setTicketDeleteMsg] = useState<string | null>(null);
  const [resetDeleteId, setResetDeleteId] = useState<number | null>(null);
  const [supportChatDeleteUser, setSupportChatDeleteUser] = useState<number | null>(null);

  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [pform, setPform] = useState({ name: "", category: "Electronics", description: "", basePrice: "", oldPrice: "", profitPercent: "20", stock: "50" });
  const [sform, setSform] = useState({ storeName: "", supportWhatsapp: "", supportEmail: "", defaultProfitPercent: "20" });
  // Language & Prices (Settings section): per-language / per-currency ON/OFF
  const [lpForm, setLpForm] = useState({ langHindiEnabled: true, langArabicEnabled: true, currencyInrEnabled: true, currencyUsdEnabled: true, currencyUsdtEnabled: true });
  const [lpServerErr, setLpServerErr] = useState<string | null>(null);
  const [lpOk, setLpOk] = useState<string | null>(null);
  // Payment Methods (Settings section): UPI / Bank / USDT ON/OFF
  const [pmForm, setPmForm] = useState({ upiEnabled: true, bankEnabled: true, usdtEnabled: true });
  const [pmServerErr, setPmServerErr] = useState<string | null>(null);
  const [pmOk, setPmOk] = useState<string | null>(null);
  // Deposit Settings (Settings section): USDT address + network + ON/OFF
  const [depForm, setDepForm] = useState({ usdtDepositAddress: "", depositNetwork: "BEP20 (BNB Smart Chain)", localDepositNote: "" });
  const [depTouched, setDepTouched] = useState(false);
  const [depServerErr, setDepServerErr] = useState<string | null>(null);
  const [depOk, setDepOk] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<number, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [openChatUser, setOpenChatUser] = useState<number | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatPendingAtt, setChatPendingAtt] = useState<ChatAttachmentData | null>(null);
  const [chatAttErr, setChatAttErr] = useState<string | null>(null);
  async function pickSupportAttachment(f: File | null) {
    setChatAttErr(null);
    if (!f) return;
    const r = await readChatAttachment(f);
    if (!r.ok) { setChatAttErr(r.error); return; }
    setChatPendingAtt(r.att);
  }
  const openChat = useQuery({ queryKey: ["chat-messages", openChatUser], queryFn: () => api.listChatMessages({ userId: openChatUser! }), enabled: openChatUser !== null, refetchInterval: 5000 });
  // Initialise the Settings forms from the saved settings ONCE per
  // Admin Panel visit. This must NOT re-run on every settings refetch:
  // saving one block (e.g. toggling Deposits OFF) invalidates the
  // settings query, and re-syncing then would silently wipe the
  // Admin's unsaved edits in the other blocks — the change they then
  // "saved" was the old value, so the platform never changed. The
  // AdminView remounts each time the Admin Panel is opened, so saved
  // values are still picked up fresh on the next visit.
  const formsInitRef = useRef(false);
  useEffect(() => { if (settings && !formsInitRef.current) { formsInitRef.current = true; setSform({ storeName: settings.storeName, supportWhatsapp: settings.supportWhatsapp, supportEmail: settings.supportEmail, defaultProfitPercent: String(settings.defaultProfitPercent) }); setDepForm({ usdtDepositAddress: settings.usdtDepositAddress ?? "", depositNetwork: settings.depositNetwork ?? "BEP20 (BNB Smart Chain)", localDepositNote: (settings.localDepositNote ?? "").trim() ? settings.localDepositNote : t("dep.local") }); setLpForm({ langHindiEnabled: settings.langHindiEnabled ?? true, langArabicEnabled: settings.langArabicEnabled ?? true, currencyInrEnabled: settings.currencyInrEnabled ?? true, currencyUsdEnabled: settings.currencyUsdEnabled ?? true, currencyUsdtEnabled: settings.currencyUsdtEnabled ?? true }); setPmForm({ upiEnabled: settings.paymentUpiEnabled ?? true, bankEnabled: settings.paymentBankEnabled ?? true, usdtEnabled: settings.paymentUsdtEnabled ?? true }); } }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidateAdmin = () => { queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); queryClient.invalidateQueries({ queryKey: ["seller-applications"] }); queryClient.invalidateQueries({ queryKey: ["admin-wallet"] }); queryClient.invalidateQueries({ queryKey: ["seller-finance"] }); queryClient.invalidateQueries({ queryKey: ["wallet"] }); };
  const upsert = useMutation({ mutationFn: () => api.adminUpsertProduct({ adminId: user!.id, id: editing?.id ?? null, name: pform.name, category: pform.category, description: pform.description, basePrice: parseInt(pform.basePrice, 10) || 0, oldPrice: pform.oldPrice ? parseInt(pform.oldPrice, 10) : null, profitPercent: parseInt(pform.profitPercent, 10) || 0, stock: parseInt(pform.stock, 10) || 0, imageAsset: editing?.imageAsset ?? null }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); setShowForm(false); setEditing(null); } });
  const delProduct = useMutation({ mutationFn: (productId: number) => api.adminDeleteProduct({ adminId: user!.id, productId }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }) });
  const markSeen = useMutation({ mutationFn: (a: { kind: string; refId: number }) => api.adminMarkActivitySeen({ adminId: user!.id, kind: a.kind, refId: a.refId }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-activity"] }) });
  const dismissActivity = useMutation({ mutationFn: (a: { kind: string; refId: number }) => api.adminDismissActivity({ adminId: user!.id, kind: a.kind, refId: a.refId }), onSuccess: () => { setHideConfirmKey(null); queryClient.invalidateQueries({ queryKey: ["admin-activity"] }); } });
  const deleteTicket = useMutation({ mutationFn: (ticketId: number) => api.adminDeleteTicket({ adminId: user!.id, ticketId }), onSuccess: (r) => { if (!r.ok) { setTicketDeleteMsg(r.error ?? "Failed."); return; } setTicketDeleteMsg(t("adm.ticketDeletedOk")); setTicketDeleteId(null); queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); queryClient.invalidateQueries({ queryKey: ["admin-activity"] }); }, onError: (e) => setTicketDeleteMsg(String(e)) });
  const deleteResetReq = useMutation({ mutationFn: (requestId: number) => api.adminDeletePasswordResetRequest({ adminId: user!.id, requestId }), onSuccess: (r) => { if (!r.ok) { setResetReqErr(r.error ?? "Failed."); return; } setResetReqOk(t("adm.resetDeletedOk")); setResetDeleteId(null); queryClient.invalidateQueries({ queryKey: ["password-reset-requests"] }); queryClient.invalidateQueries({ queryKey: ["admin-activity"] }); }, onError: (e) => setResetReqErr(String(e)) });
  const deleteChatThread = useMutation({ mutationFn: (uid: number) => api.adminDeleteChatThread({ adminId: user!.id, userId: uid }), onSuccess: (r) => { if (!r.ok) return; setSupportChatDeleteUser(null); setOpenChatUser(null); queryClient.invalidateQueries({ queryKey: ["chat-messages"] }); queryClient.invalidateQueries({ queryKey: ["admin-chats"] }); queryClient.invalidateQueries({ queryKey: ["admin-activity"] }); } });
  const setStatus = useMutation({ mutationFn: (args: { orderId: number; status: (typeof ORDER_STATUSES)[number] }) => api.updateOrderStatus({ adminId: user!.id, ...args }), onSuccess: (_r, args) => { queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); queryClient.invalidateQueries({ queryKey: ["admin-seller-orders"] }); queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] }); queryClient.invalidateQueries({ queryKey: ["buyer-orders"] }); queryClient.invalidateQueries({ queryKey: ["seller-finance"] }); queryClient.invalidateQueries({ queryKey: ["wallet"] }); markSeen.mutate({ kind: "order", refId: args.orderId }); } });
  // Shipment review: Approve completes a shipped order (seller is
  // notified); Return sends it back to the seller's Pending.
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const reviewShip = useMutation({
    mutationFn: (args: { orderId: number; decision: "approve" | "return" }) => api.adminReviewShippedOrder({ adminId: user!.id, ...args }),
    onSuccess: (r, args) => {
      if (!r.ok) { setReviewErr(r.error ?? "Failed."); return; }
      setReviewErr(null);
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-finance"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["seller-notices"] });
      markSeen.mutate({ kind: "order", refId: args.orderId });
    },
    onError: (e) => setReviewErr(String(e)),
  });
  // Payment verification gate (prepaid buyer orders): Verify releases
  // the order to the seller's normal flow; Reject cancels it, restores
  // stock and tells the buyer the written reason.
  const [payGateErr, setPayGateErr] = useState<string | null>(null);
  const [payRejectDraft, setPayRejectDraft] = useState<Record<number, string>>({});
  const reviewPayment = useMutation({
    mutationFn: (args: { orderId: number; decision: "verify" | "reject"; reason?: string }) => api.adminReviewOrderPayment({ adminId: user!.id, ...args }),
    onSuccess: (r, args) => {
      if (!r.ok) { setPayGateErr(r.error ?? "Failed."); return; }
      setPayGateErr(null);
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-orders"] });
      queryClient.invalidateQueries({ queryKey: ["seller-finance"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["seller-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
      markSeen.mutate({ kind: "order", refId: args.orderId });
    },
    onError: (e) => setPayGateErr(String(e)),
  });
  // The Verify / Reject panel for ONE order still behind the payment
  // gate. Used by the Admin Orders rows and the buyer detail's Orders
  // tab, so the gate works identically everywhere the order appears.
  const renderPaymentGate = (o: Order) => (
    <div className="mt-2 rounded-xl bg-[var(--amber-bg)] px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-bold text-[var(--text)]">💳 {t("paygate.title")}</p>
      <p className="mt-0.5 text-xs text-[var(--dim)]">{t("paygate.adminNote")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-label={`Verify payment for order ${o.id}`} disabled={reviewPayment.isPending} onClick={() => reviewPayment.mutate({ orderId: o.id, decision: "verify" })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">✓ {t("paygate.verifyBtn")}</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={payRejectDraft[o.id] ?? ""}
          onChange={(e) => setPayRejectDraft({ ...payRejectDraft, [o.id]: e.target.value })}
          placeholder={t("paygate.reasonPh")}
          aria-label={`Rejection reason for order ${o.id}`}
          className={inputCls + " min-w-0 flex-1"}
        />
        <button type="button" aria-label={`Reject payment for order ${o.id}`} disabled={reviewPayment.isPending || !(payRejectDraft[o.id] ?? "").trim()} onClick={() => reviewPayment.mutate({ orderId: o.id, decision: "reject", reason: (payRejectDraft[o.id] ?? "").trim() })} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">✕ {t("paygate.rejectBtn")}</button>
      </div>
      {payGateErr && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">⚠ {payGateErr}</p>}
    </div>
  );
  const refreshPrices = useMutation({
    mutationFn: () => api.refreshCatalogPrices({ adminId: user!.id }),
    onSuccess: (r) => {
      if (!r.ok) { setPriceErr(r.error ?? "Price refresh failed."); setPriceResult(null); return; }
      setPriceErr(null);
      setPriceResult(r);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e) => { setPriceErr(String(e)); setPriceResult(null); },
  });
  const bulkGen = useMutation({
    mutationFn: () => api.adminBulkGenerateProducts({ adminId: user!.id, mode: bgenMode, value: parseInt(bgenValue, 10) || 0 }),
    onSuccess: (r) => {
      setBgenResult(r);
      if (r.ok) {
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      }
    },
    onError: (e) => setBgenResult({ ok: false, error: String(e), added: 0, totalNow: products.data?.products.length ?? 0, perCategory: [] }),
  });
  const quickSend = useMutation({
    mutationFn: (args: { productId: number; qty: number }) => api.adminQuickSendSellerOrder({
      adminId: user!.id,
      sellerId: selectedSellerId!,
      productId: args.productId,
      qty: args.qty,
    }),
    onSuccess: (r) => {
      if (!r.ok) { setQuickErr(r.error ?? "Failed."); setQuickOk(null); return; }
      setQuickErr(null);
      setQuickOk(`${t("qs.sentOk")}${r.orderId} · ${fmt(r.total)}`);
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin-seller-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["seller-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["seller-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["seller-finance"] });
      queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
    },
    onError: (e) => setQuickErr(String(e)),
  });
  const sendNotice = useMutation({
    mutationFn: (args: { sellerId: number; orderId: number | null; message: string; key: string }) => api.adminSendSellerNotice({ adminId: user!.id, sellerId: args.sellerId, orderId: args.orderId, message: args.message }),
    onSuccess: (r, args) => {
      if (!r.ok) { setNoticeResult({ key: args.key, ok: false, text: r.error ?? "Failed." }); return; }
      setNoticeResult({ key: args.key, ok: true, text: t("notice.sentOk") });
      if (args.orderId !== null) { setNoticeOpenOrderId(null); setNoticeDraft({ ...noticeDraft, [args.orderId]: "" }); }
      else setNoticeGeneral("");
      queryClient.invalidateQueries({ queryKey: ["seller-notices"] });
    },
    onError: (e, args) => setNoticeResult({ key: args.key, ok: false, text: String(e) }),
  });
  const saveDesign = useMutation({
    mutationFn: () => api.updateStoreDesign({ adminId: user!.id, colorScheme: (schemeDraft ?? settings?.colorScheme ?? "navy") as "navy" | "emerald" | "royal" | "charcoal" | "teal", layoutDesign: (layoutDraft ?? settings?.layoutDesign ?? "classic") as "classic" | "menu" | "topsearch" }),
    onSuccess: (r) => {
      if (!r.ok) { setDesignErr(r.error ?? "Failed."); setDesignOk(null); return; }
      setDesignErr(null);
      setDesignOk(t("theme.savedOk"));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => { setDesignErr(String(e)); setDesignOk(null); },
  });
  const saveSettings = useMutation({ mutationFn: () => api.updateSettings({ userId: user!.id, storeName: sform.storeName, supportWhatsapp: sform.supportWhatsapp, supportEmail: sform.supportEmail, defaultProfitPercent: parseInt(sform.defaultProfitPercent, 10) || 20 }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }) });
  const saveDepositSettings = useMutation({
    // An untouched (or cleared) Local Deposit Note is saved as "" so the
    // seller deposit page falls back to the built-in default line in the
    // seller's own language; any edited wording is saved exactly as typed.
    mutationFn: () => {
      const note = depForm.localDepositNote.trim();
      const isDefault = note === t("dep.local") || note === "For a local deposit, please contact Customer Service to get the local account number or UPI ID.";
      return api.updateDepositSettings({ adminId: user!.id, usdtDepositAddress: depForm.usdtDepositAddress, depositNetwork: depForm.depositNetwork, localDepositNote: isDefault ? "" : note });
    },
    onSuccess: (r) => {
      if (!r.ok) { setDepServerErr(r.error ?? "Failed."); setDepOk(null); return; }
      setDepServerErr(null);
      setDepOk(t("dep.saved"));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => { setDepServerErr(String(e)); setDepOk(null); },
  });
  const saveLangPrices = useMutation({
    mutationFn: () => api.updateLanguagePriceSettings({ adminId: user!.id, ...lpForm }),
    onSuccess: (r) => {
      if (!r.ok) { setLpServerErr(r.error ?? "Failed."); setLpOk(null); return; }
      setLpServerErr(null);
      // Written proof of exactly what the save did: name the languages
      // and currencies visitors will now see in the pickers.
      const langs = [t("lp.english"), lpForm.langHindiEnabled ? t("lp.hindi") : null, lpForm.langArabicEnabled ? t("lp.arabic") : null].filter(Boolean).join(" · ");
      const curs = [lpForm.currencyInrEnabled ? "₹ INR" : null, lpForm.currencyUsdEnabled ? "$ USD" : null, lpForm.currencyUsdtEnabled ? "USDT" : null].filter(Boolean).join(" · ");
      setLpOk(`${t("lp.savedVisitors")} ${langs} — ${t("lp.pricesIn")} ${curs}`);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => { setLpServerErr(String(e)); setLpOk(null); },
  });
  const savePaymentMethods = useMutation({
    mutationFn: () => api.updatePaymentMethods({ adminId: user!.id, ...pmForm }),
    onSuccess: (r) => {
      if (!r.ok) { setPmServerErr(r.error ?? "Failed."); setPmOk(null); return; }
      setPmServerErr(null);
      setPmOk(t("pm.saved"));
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => { setPmServerErr(String(e)); setPmOk(null); },
  });
  const toggleDeposits = useMutation({
    mutationFn: (enabled: boolean) => api.setDepositsEnabled({ adminId: user!.id, enabled }),
    onSuccess: (r) => {
      if (!r.ok) { setDepServerErr(r.error ?? "Failed."); return; }
      setDepServerErr(null);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => setDepServerErr(String(e)),
  });
  const reply = useMutation({ mutationFn: (ticketId: number) => api.replyTicket({ adminId: user!.id, ticketId, reply: replyDraft[ticketId] ?? "", status: "Answered" }), onSuccess: (_r, ticketId) => { queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); markSeen.mutate({ kind: "ticket", refId: ticketId }); } });
  const review = useMutation({ mutationFn: (args: { sellerId: number; decision: "approved" | "rejected" }) => api.reviewSeller({ adminId: user!.id, ...args }), onSuccess: invalidateAdmin });
  const reviewDetail = useMutation({
    mutationFn: (args: { sellerId: number; decision: "approved" | "rejected"; reason?: string }) => api.reviewSeller({ adminId: user!.id, ...args }),
    onSuccess: (_res, args) => {
      invalidateAdmin();
      queryClient.invalidateQueries({ queryKey: ["seller-notices"] });
      setVerifyMsg({ sellerId: args.sellerId, ok: true, text: args.decision === "approved" ? t("adm.verifyOk") : t("adm.rejectOk") });
      setRejectReason("");
    },
    onError: (e) => setVerifyMsg({ sellerId: selectedSellerId ?? 0, ok: false, text: String((e as Error).message ?? e) }),
  });
  const reviewWallet = useMutation({ mutationFn: (args: { txId: number; decision: "approve" | "reject" }) => api.reviewWalletRequest({ adminId: user!.id, ...args }), onSuccess: (_r, args) => { invalidateAdmin(); markSeen.mutate({ kind: "wallet", refId: args.txId }); } });
  const sendChat = useMutation({ mutationFn: () => api.adminReplyChat({ adminId: user!.id, userId: openChatUser!, message: chatDraft, ...(chatPendingAtt ? { attachment: chatPendingAtt } : {}) }), onSuccess: (r) => { if (!r.ok) { setChatAttErr(r.error ?? "The reply could not be sent. Please try again."); return; } setChatDraft(""); setChatPendingAtt(null); setChatAttErr(null); queryClient.invalidateQueries({ queryKey: ["chat-messages"] }); queryClient.invalidateQueries({ queryKey: ["admin-chats"] }); }, onError: (e) => setChatAttErr(String(e)) });
  // Opening a customer's chat thread in Support marks that chat seen.
  useEffect(() => { if (openChatUser !== null) markSeen.mutate({ kind: "chat", refId: openChatUser }); }, [openChatUser]); // eslint-disable-line react-hooks/exhaustive-deps
  // Opening a chat thread in Admin → Support: once its messages have
  // loaded, bring the expanded thread directly into view (latest
  // messages at the bottom of the thread box) and focus the reply
  // input — never leave the Admin scrolled away from the conversation.
  const threadPanelRef = useRef<HTMLDivElement | null>(null);
  const threadListRef = useRef<HTMLDivElement | null>(null);
  const threadInputRef = useRef<HTMLInputElement | null>(null);
  const threadFocusedForRef = useRef<number | null>(null);
  useEffect(() => {
    const list = threadListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [openChat.data?.messages.length]);
  useEffect(() => {
    if (openChatUser === null) { threadFocusedForRef.current = null; return; }
    if (openChat.isPending) return;
    if (threadFocusedForRef.current === openChatUser) return;
    threadFocusedForRef.current = openChatUser;
    const timer = window.setTimeout(() => {
      threadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const list = threadListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
      threadInputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChatUser, openChat.isPending]);
  const credit = useMutation({ mutationFn: () => api.adminCreditSeller({ adminId: user!.id, sellerId: selectedSellerId!, amountInr: toInr(parseFloat(creditAmount) || 0, currency), note: creditNote || undefined }), onSuccess: (r) => { if (!r.ok) { setCreditErr(r.error ?? "Failed."); return; } setCreditOk(`${t("adm.addAmountOk")} ${fmt(r.newBalance)}`); setCreditErr(null); setCreditAmount(""); invalidateAdmin(); }, onError: (e) => setCreditErr(String(e)) });
  const payWithdraw = useMutation({
    mutationFn: (args: { txId: number; paymentReference?: string }) => api.adminPayWithdrawal({ adminId: user!.id, txId: args.txId, paymentReference: args.paymentReference || undefined }),
    onSuccess: (r, args) => {
      if (!r.ok) { setPayErr(r.error ?? "Payment failed."); return; }
      setPayErr(null);
      setPayOk(`${t("wp.paidOk")} ${fmt(r.newBalance)}`);
      setPayTargetId(null);
      setPayRef("");
      invalidateAdmin();
      queryClient.invalidateQueries({ queryKey: ["seller-notices"] });
      markSeen.mutate({ kind: "wallet", refId: args.txId });
    },
    onError: (e) => setPayErr(String(e)),
  });
  const adminWithdraw = useMutation({
    mutationFn: () => api.adminDirectWithdraw({ adminId: user!.id, sellerId: selectedSellerId!, amountInr: toInr(parseFloat(awAmount) || 0, currency), note: awNote || undefined }),
    onSuccess: (r) => {
      if (!r.ok) { setAwErr(r.error ?? "Withdrawal failed."); return; }
      setAwErr(null);
      setAwOk(`${t("wp.withdrawnOk")} ${fmt(r.newBalance)}`);
      setAwAmount("");
      setAwNote("");
      setAwReview(false);
      invalidateAdmin();
      queryClient.invalidateQueries({ queryKey: ["seller-notices"] });
    },
    onError: (e) => setAwErr(String(e)),
  });
  const deleteAccount = useMutation({ mutationFn: () => api.adminDeleteAccount({ adminId: user!.id, userId: deleteTarget!.id }), onSuccess: (r) => { if (!r.ok) { setDeleteMsg(r.error ?? "Delete failed."); return; } setDeleteMsg(r.role === "seller" ? t("del.doneSeller") : t("del.doneBuyer")); if (deleteTarget?.role === "seller" && selectedSellerId === deleteTarget.id) setSelectedSellerId(null); if (deleteTarget?.role === "buyer" && selectedBuyerId === deleteTarget.id) setSelectedBuyerId(null); setDeleteTarget(null); invalidateAdmin(); }, onError: (e) => setDeleteMsg(String(e)) });
  const invalidateAdminAccounts = () => { queryClient.invalidateQueries({ queryKey: ["admin-accounts"] }); queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); };
  type AdmErr = { key: string; label: string; msg: string };
  function depFormatWarning(address: string, network: string): string | null {
    const addr = address.trim();
    const net = network.trim().toUpperCase();
    if ((net.includes("BEP20") || net.includes("BSC") || net.includes("BNB")) && addr && !/^0x[0-9a-fA-F]{40}$/.test(addr)) return t("dep.warnBep20");
    if (net.includes("TRC20") && addr && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr)) return t("dep.warnTrc20");
    return null;
  }
  function depErrors(): AdmErr[] {
    const e: AdmErr[] = [];
    const addr = depForm.usdtDepositAddress.trim();
    if (!addr) e.push({ key: "usdtDepositAddress", label: t("dep.addressField"), msg: t("dep.val.addressMissing") });
    else if (!/^[A-Za-z0-9]{26,64}$/.test(addr)) e.push({ key: "usdtDepositAddress", label: t("dep.addressField"), msg: t("dep.val.addressWrong") });
    if (!depForm.depositNetwork.trim()) e.push({ key: "depositNetwork", label: t("dep.networkField"), msg: t("dep.val.networkMissing") });
    return e;
  }
  function gmailErrors(): AdmErr[] { const e: AdmErr[] = []; const em = gmailForm.newEmail.trim(); if (!em) e.push({ key: "newEmail", label: t("adm.newGmail"), msg: t("adm.val.newGmailMissing") }); else if (!isEmailOk(em)) e.push({ key: "newEmail", label: t("adm.newGmail"), msg: t("adm.val.newGmailWrong") }); if (!gmailForm.currentPassword) e.push({ key: "currentPassword", label: t("adm.currentPassword"), msg: t("adm.val.currentPwMissing") }); return e; }
  function pwErrors(): AdmErr[] { const e: AdmErr[] = []; if (!pwForm.currentPassword) e.push({ key: "currentPassword", label: t("adm.currentPassword"), msg: t("adm.val.currentPwMissing") }); if (!pwForm.newPassword) e.push({ key: "newPassword", label: t("adm.newPassword"), msg: t("adm.val.newPwMissing") }); else if (pwForm.newPassword.length < 4) e.push({ key: "newPassword", label: t("adm.newPassword"), msg: t("adm.val.newPwShort") }); if (pwForm.confirmPassword !== pwForm.newPassword) e.push({ key: "confirmPassword", label: t("adm.confirmPassword"), msg: t("adm.val.confirmMismatch") }); return e; }
  function addAdminErrors(): AdmErr[] { const e: AdmErr[] = []; if (addAdminForm.name.trim().length < 2) e.push({ key: "name", label: t("adm.newAdminName"), msg: t("adm.val.adminNameMissing") }); const em = addAdminForm.email.trim(); if (!em) e.push({ key: "email", label: t("adm.newAdminGmail"), msg: t("adm.val.adminGmailMissing") }); else if (!isEmailOk(em)) e.push({ key: "email", label: t("adm.newAdminGmail"), msg: t("adm.val.adminGmailWrong") }); if (!addAdminForm.password) e.push({ key: "password", label: t("adm.newAdminPassword"), msg: t("adm.val.adminPwMissing") }); else if (addAdminForm.password.length < 4) e.push({ key: "password", label: t("adm.newAdminPassword"), msg: t("adm.val.newPwShort") }); if (addAdminForm.confirmPassword !== addAdminForm.password) e.push({ key: "confirmPassword", label: t("adm.confirmAdminPassword"), msg: t("adm.val.confirmMismatch") }); if (!addAdminForm.creatorPassword) e.push({ key: "creatorPassword", label: t("adm.creatorPassword"), msg: t("adm.val.currentPwMissing") }); return e; }
  function resetErrors(): AdmErr[] { const e: AdmErr[] = []; if (!resetForm.newPassword) e.push({ key: "newPassword", label: t("adm.newPassword"), msg: t("adm.val.newPwMissing") }); else if (resetForm.newPassword.length < 4) e.push({ key: "newPassword", label: t("adm.newPassword"), msg: t("adm.val.newPwShort") }); if (resetForm.confirmPassword !== resetForm.newPassword) e.push({ key: "confirmPassword", label: t("adm.confirmPassword"), msg: t("adm.val.confirmMismatch") }); if (!resetForm.actorPassword) e.push({ key: "actorPassword", label: t("adm.yourPwAuthorize"), msg: t("adm.val.actorPwMissing") }); return e; }
  function bulkErrors(): AdmErr[] {
    const e: AdmErr[] = [];
    const parseN = (v: string) => { const n = parseInt(v, 10); return v.trim() === "" || Number.isNaN(n) ? null : n; };
    if (bulkScopeType === "category" && !bulkCategory) e.push({ key: "bulkCategory", label: t("bulk.category"), msg: t("bulk.val.categoryMissing") });
    if (bulkScopeType === "price_range") {
      const mn = parseN(bulkMinPrice); const mx = parseN(bulkMaxPrice);
      if (mn === null) e.push({ key: "bulkMinPrice", label: t("bulk.minPrice"), msg: t("bulk.val.priceMinMissing") });
      if (mx === null) e.push({ key: "bulkMaxPrice", label: t("bulk.maxPrice"), msg: t("bulk.val.priceMaxMissing") });
      if (mn !== null && mx !== null && mn > mx) e.push({ key: "bulkPriceOrder", label: `${t("bulk.minPrice")} / ${t("bulk.maxPrice")}`, msg: t("bulk.val.priceOrder") });
    }
    if (bulkMode === "fixed") {
      const v = parseN(bulkFixed);
      if (v === null) e.push({ key: "bulkFixed", label: t("bulk.fixedPct"), msg: t("bulk.val.fixedMissing") });
      else if (v < 0 || v > 100) e.push({ key: "bulkFixed", label: t("bulk.fixedPct"), msg: t("bulk.val.fixedRange") });
    }
    if (bulkMode === "random") {
      const mn = parseN(bulkRandomMin); const mx = parseN(bulkRandomMax);
      if (mn === null) e.push({ key: "bulkRandomMin", label: t("bulk.randomMin"), msg: t("bulk.val.randomMinMissing") });
      if (mx === null) e.push({ key: "bulkRandomMax", label: t("bulk.randomMax"), msg: t("bulk.val.randomMaxMissing") });
      if ((mn !== null && (mn < 0 || mn > 100)) || (mx !== null && (mx < 0 || mx > 100))) e.push({ key: "bulkRandomRange", label: `${t("bulk.randomMin")} / ${t("bulk.randomMax")}`, msg: t("bulk.val.randomRange") });
      if (mn !== null && mx !== null && mn > mx) e.push({ key: "bulkRandomOrder", label: `${t("bulk.randomMin")} / ${t("bulk.randomMax")}`, msg: t("bulk.val.randomOrder") });
    }
    if (bulkMode === "slabs") {
      const enabled = bulkSlabs.filter((s) => s.enabled);
      if (enabled.length === 0) e.push({ key: "bulkNoSlab", label: t("bulk.modeSlabs"), msg: t("bulk.val.noSlab") });
      bulkSlabs.forEach((s, idx) => {
        if (!s.enabled) return;
        const label = `${t("bulk.slab")} ${idx + 1}`;
        const from = parseN(s.fromPrice); const to = s.toPrice.trim() === "" ? null : parseN(s.toPrice);
        const mn = parseN(s.minPercent); const mx = parseN(s.maxPercent);
        if (from === null) e.push({ key: `slab${idx}From`, label: `${label} — ${t("bulk.slabFrom")}`, msg: t("bulk.val.slabFromMissing") });
        if (from !== null && to !== null && from > to) e.push({ key: `slab${idx}Order`, label, msg: t("bulk.val.slabOrder") });
        if (mn === null || mx === null) e.push({ key: `slab${idx}PctMissing`, label, msg: t("bulk.val.slabPctMissing") });
        else {
          if (mn < 0 || mn > 100 || mx < 0 || mx > 100) e.push({ key: `slab${idx}PctRange`, label, msg: t("bulk.val.slabPctRange") });
          if (mn > mx) e.push({ key: `slab${idx}PctOrder`, label, msg: t("bulk.val.slabPctOrder") });
        }
      });
    }
    return e;
  }
  function bulkPayload() {
    const parseN = (v: string) => { const n = parseInt(v, 10); return v.trim() === "" || Number.isNaN(n) ? null : n; };
    return {
      adminId: user!.id,
      scopeType: bulkScopeType,
      category: bulkScopeType === "category" ? bulkCategory : null,
      minPrice: bulkScopeType === "price_range" ? parseN(bulkMinPrice) : null,
      maxPrice: bulkScopeType === "price_range" ? parseN(bulkMaxPrice) : null,
      mode: bulkMode,
      fixedPercent: bulkMode === "fixed" ? parseN(bulkFixed) : null,
      randomMin: bulkMode === "random" ? parseN(bulkRandomMin) : null,
      randomMax: bulkMode === "random" ? parseN(bulkRandomMax) : null,
      slabs: bulkMode === "slabs" ? bulkSlabs.filter((s) => s.enabled).map((s) => ({ fromPrice: parseN(s.fromPrice) ?? 0, toPrice: s.toPrice.trim() === "" ? null : parseN(s.toPrice), minPercent: parseN(s.minPercent) ?? 0, maxPercent: parseN(s.maxPercent) ?? 0 })) : [],
    };
  }
  const previewBulk = useMutation({ mutationFn: () => api.previewBulkProfit(bulkPayload()), onSuccess: (r) => { if (!r.ok) { setBulkServerErr(r.error ?? "Preview failed."); setBulkPreview(null); return; } setBulkServerErr(null); setBulkPreview(r); setBulkConfirming(false); setBulkApplied(null); }, onError: (e) => setBulkServerErr(String(e)) });
  const applyBulk = useMutation({ mutationFn: () => api.applyBulkProfit(bulkPayload()), onSuccess: (r) => { if (!r.ok) { setBulkServerErr(r.error ?? "Apply failed."); return; } setBulkServerErr(null); setBulkApplied(`${t("bulk.appliedOk")} ${r.updatedCount} · ${r.summary}`); setBulkPreview(null); setBulkConfirming(false); setBulkTouched(false); queryClient.invalidateQueries({ queryKey: ["products"] }); queryClient.invalidateQueries({ queryKey: ["bulk-profit-history"] }); queryClient.invalidateQueries({ queryKey: ["admin-overview"] }); }, onError: (e) => setBulkServerErr(String(e)) });
  const changeGmail = useMutation({ mutationFn: () => api.adminChangeOwnEmail({ adminId: user!.id, newEmail: gmailForm.newEmail.trim(), currentPassword: gmailForm.currentPassword }), onSuccess: (r) => { if (!r.ok) { setGmailServerErr(r.error ?? "Failed."); setGmailOk(null); return; } setGmailServerErr(null); setGmailOk(`${t("adm.gmailChangedOk")} ${r.newEmail ?? ""}`); if (r.user && onUserUpdated) onUserUpdated(r.user); setGmailForm({ newEmail: "", currentPassword: "" }); setGmailTouched(false); invalidateAdminAccounts(); }, onError: (e) => setGmailServerErr(String(e)) });
  const changePw = useMutation({ mutationFn: () => api.adminChangeOwnPassword({ adminId: user!.id, currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }), onSuccess: (r) => { if (!r.ok) { setPwServerErr(r.error ?? "Failed."); setPwOk(null); return; } setPwServerErr(null); setPwOk(t("adm.passwordChangedOk")); setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); setPwTouched(false); }, onError: (e) => setPwServerErr(String(e)) });
  const createExtraAdmin = useMutation({ mutationFn: () => api.adminCreateAdditionalAdmin({ adminId: user!.id, creatorPassword: addAdminForm.creatorPassword, name: addAdminForm.name.trim(), email: addAdminForm.email.trim(), password: addAdminForm.password }), onSuccess: (r) => { if (!r.ok) { setAddAdminServerErr(r.error ?? "Failed."); setAddAdminOk(null); return; } setAddAdminServerErr(null); setAddAdminOk(`${t("adm.adminAddedOk")} ${r.user?.email ?? addAdminForm.email.trim()}`); setAddAdminForm({ name: "", email: "", password: "", confirmPassword: "", creatorPassword: "" }); setAddAdminTouched(false); invalidateAdminAccounts(); }, onError: (e) => setAddAdminServerErr(String(e)) });
  const resetAdminPw = useMutation({ mutationFn: () => api.adminResetAdminPassword({ adminId: user!.id, targetAdminId: resetTargetId!, actorPassword: resetForm.actorPassword, newPassword: resetForm.newPassword }), onSuccess: (r) => { const target = (adminAccounts.data?.admins ?? []).find((a) => a.id === resetTargetId); if (!r.ok) { setResetServerErr(r.error ?? "Failed."); setResetOk(null); return; } setResetServerErr(null); setResetOk(`${t("adm.resetPwOk")} ${target?.email ?? ""}`); setResetForm({ newPassword: "", confirmPassword: "", actorPassword: "" }); setResetTouched(false); setResetTargetId(null); invalidateAdminAccounts(); }, onError: (e) => setResetServerErr(String(e)) });
  const removeAdmin = useMutation({ mutationFn: () => api.adminRemoveAdmin({ adminId: user!.id, targetAdminId: removeTarget!.id, actorPassword: removePassword }), onSuccess: (r) => { if (!r.ok) { setRemoveServerErr(r.error ?? "Failed."); return; } setRemoveOk(`${t("adm.adminRemovedOk")} ${removeTarget?.email ?? ""}`); setRemoveServerErr(null); setRemoveTarget(null); setRemovePassword(""); setRemoveTouched(false); invalidateAdminAccounts(); }, onError: (e) => setRemoveServerErr(String(e)) });
  const completeReset = useMutation({ mutationFn: (args: { requestId: number; newPassword: string }) => api.adminCompletePasswordReset({ adminId: user!.id, requestId: args.requestId, newPassword: args.newPassword }), onSuccess: (r, args) => { const req = (resetRequests.data?.requests ?? []).find((x) => x.id === args.requestId); if (!r.ok) { setResetReqErr(r.error ?? "Failed."); setResetReqOk(null); return; } setResetReqErr(null); setResetReqOk(`${t("adm.resetDoneOk")} ${req?.email ?? req?.name ?? ""} — ${t("adm.resetTellClient")}`); setResetOpenId(null); queryClient.invalidateQueries({ queryKey: ["password-reset-requests"] }); markSeen.mutate({ kind: "reset", refId: args.requestId }); }, onError: (e) => setResetReqErr(String(e)) });
  const setUserPw = useMutation({
    mutationFn: (userId: number) => { const d = directPwDraft[userId] ?? { newPassword: "", confirmPassword: "" }; return api.adminSetUserPassword({ adminId: user!.id, userId, newPassword: d.newPassword, confirmPassword: d.confirmPassword }); },
    onSuccess: (r, userId) => { if (!r.ok) { setDirectPwResult({ userId, ok: false, text: r.error ?? "Failed." }); return; } setDirectPwResult({ userId, ok: true, text: `${t("adm.setPwOk")} ${r.accountName ?? ""} (${r.loginId ?? ""})` }); setDirectPwDraft({ ...directPwDraft, [userId]: { newPassword: "", confirmPassword: "" } }); invalidateAdmin(); },
    onError: (e) => setDirectPwResult({ userId: directPwOpen ?? 0, ok: false, text: String(e) }),
  });
  function renderSetUserPassword(target: { id: number; name: string }) {
    const d = directPwDraft[target.id] ?? { newPassword: "", confirmPassword: "" };
    const res = directPwResult?.userId === target.id ? directPwResult : null;
    return (
      <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <button type="button" aria-label={`Set a new password for ${target.name}`} aria-expanded={directPwOpen === target.id} onClick={() => setDirectPwOpen(directPwOpen === target.id ? null : target.id)} className="font-display text-sm font-bold text-[var(--accent)]">{t("adm.setPwOpen")}</button>
        {directPwOpen === target.id && (
          <form className="mt-3" onSubmit={(e) => { e.preventDefault(); if (!d.newPassword) { setDirectPwResult({ userId: target.id, ok: false, text: t("cp.val.newMissing") }); return; } if (d.newPassword.length < 4) { setDirectPwResult({ userId: target.id, ok: false, text: t("adm.val.newPwShort") }); return; } if (d.newPassword !== d.confirmPassword) { setDirectPwResult({ userId: target.id, ok: false, text: t("cp.val.mismatch") }); return; } setUserPw.mutate(target.id); }}>
            <h4 className="font-display font-bold text-[var(--text)]">🔑 {t("adm.setPwTitle")} — {target.name}</h4>
            <p className="mt-1 text-xs leading-snug text-[var(--dim)]">{t("adm.setPwSub")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("cp.new")}><span className="flex gap-1"><input type={showTypedPw ? "text" : "password"} value={d.newPassword} onChange={(e) => setDirectPwDraft({ ...directPwDraft, [target.id]: { ...d, newPassword: e.target.value } })} className={inputCls} aria-label={`New password for ${target.name}`} /><button type="button" aria-label="Show or hide the new password while typing" onClick={() => setShowTypedPw(!showTypedPw)} className="shrink-0 rounded-lg border border-[var(--border)] px-2.5">{showTypedPw ? "🙈" : "👁️"}</button></span></Field>
              <Field label={t("cp.confirm")}><input type={showTypedPw ? "text" : "password"} value={d.confirmPassword} onChange={(e) => setDirectPwDraft({ ...directPwDraft, [target.id]: { ...d, confirmPassword: e.target.value } })} className={inputCls} aria-label={`Confirm new password for ${target.name}`} /></Field>
            </div>
            {res && (res.ok ? <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">✓ {res.text}</p> : <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {res.text}</p>)}
            <button type="submit" disabled={setUserPw.isPending} className={primaryBtn + " mt-3"}>{t("adm.setPwBtn")}</button>
          </form>
        )}
        {directPwOpen !== target.id && res?.ok && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">✓ {res.text}</p>}
      </div>
    );
  }

  function renderBulkProfitPanel() {
    return (
      <>
            {/* Bulk Profit % panel — its own Profit % section */}
            <div className="mt-3 rounded-2xl border-2 border-[var(--accent)]/30 bg-[var(--surface)] p-4">
              <h4 className="font-display text-base font-bold text-[var(--text)]">📊 {t("bulk.title")}</h4>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("bulk.sub")}</p>
              {bulkLast ? (
                <div className="mt-3 rounded-xl bg-[var(--surface-alt)] px-3 py-2.5 text-sm">
                  <p className="font-display font-bold text-[var(--text)]">🕘 {t("bulk.lastChange")}</p>
                  <p className="mt-0.5 text-[var(--text)]">{new Date(bulkLast.createdAt).toLocaleString()} · {bulkLast.scopeLabel} · {bulkLast.modeLabel} · {bulkLast.affectedCount} {t("bulk.applyProducts")}</p>
                  <p className="text-xs text-[var(--dim)]">{bulkLast.detail}</p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--dim)]">{t("bulk.noHistory")}</p>
              )}
              {(bulkHistory.data?.history ?? []).length > 1 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">{t("bulk.historyAll")} ({(bulkHistory.data?.history ?? []).length})</summary>
                  <div className="mt-2 flex flex-col gap-1.5">{(bulkHistory.data?.history ?? []).map((h) => (<p key={h.id} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text)]">{new Date(h.createdAt).toLocaleString()} · {h.scopeLabel} · {h.modeLabel} · {h.affectedCount} {t("bulk.applyProducts")} — {h.detail}</p>))}</div>
                </details>
              )}
              <form className="mt-4" noValidate onSubmit={(e) => { e.preventDefault(); setBulkTouched(true); setBulkServerErr(null); setBulkApplied(null); if (bulkErrors().length > 0) { setBulkPreview(null); return; } previewBulk.mutate(); }}>
                {bulkTouched && bulkErrsNow.length > 0 && <ValidationSummary sectionLabel={t("bulk.title")} items={bulkErrsNow.map((e) => ({ label: e.label, msg: e.msg }))} />}
                <fieldset className="mt-3">
                  <legend className="font-display text-sm font-bold text-[var(--text)]">{t("bulk.scope")}</legend>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("bulk.scope")}>
                    {([["all", t("bulk.scopeAll")], ["category", t("bulk.scopeCategory")], ["price_range", t("bulk.scopePrice")]] as const).map(([v, lab]) => (
                      <button key={v} type="button" role="radio" aria-checked={bulkScopeType === v} aria-label={lab} onClick={() => { setBulkScopeType(v); setBulkPreview(null); setBulkConfirming(false); }} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${bulkScopeType === v ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}>{lab}</button>
                    ))}
                  </div>
                  {bulkScopeType === "category" && (
                    <div className="mt-3 max-w-sm">
                      <Field label={t("bulk.category")}>
                        <select value={bulkCategory} onChange={(e) => { setBulkCategory(e.target.value); setBulkPreview(null); }} className={errInputCls(!!bulkErrFor("bulkCategory"))} aria-label="Bulk category">{CATEGORIES.filter((c) => c !== "All").map((c) => (<option key={c} value={c}>{c}</option>))}</select>
                        <FieldError msg={bulkErrFor("bulkCategory")} />
                      </Field>
                    </div>
                  )}
                  {bulkScopeType === "price_range" && (
                    <div className="mt-3 grid max-w-lg gap-3 sm:grid-cols-2">
                      <Field label={t("bulk.minPrice")}><input type="number" min={0} value={bulkMinPrice} onChange={(e) => { setBulkMinPrice(e.target.value); setBulkPreview(null); }} placeholder="0" className={errInputCls(!!bulkErrFor("bulkMinPrice"))} aria-label="Bulk minimum base price in rupees" /><FieldError msg={bulkErrFor("bulkMinPrice")} /></Field>
                      <Field label={t("bulk.maxPrice")}><input type="number" min={0} value={bulkMaxPrice} onChange={(e) => { setBulkMaxPrice(e.target.value); setBulkPreview(null); }} placeholder="4999" className={errInputCls(!!bulkErrFor("bulkMaxPrice"))} aria-label="Bulk maximum base price in rupees" /><FieldError msg={bulkErrFor("bulkMaxPrice")} /></Field>
                      <FieldError msg={bulkErrFor("bulkPriceOrder")} />
                    </div>
                  )}
                </fieldset>
                <fieldset className="mt-4">
                  <legend className="font-display text-sm font-bold text-[var(--text)]">{t("bulk.mode")}</legend>
                  <div className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label={t("bulk.mode")}>
                    {([["fixed", t("bulk.modeFixed")], ["random", t("bulk.modeRandom")], ["slabs", t("bulk.modeSlabs")]] as const).map(([v, lab]) => (
                      <button key={v} type="button" role="radio" aria-checked={bulkMode === v} aria-label={lab} onClick={() => { setBulkMode(v); setBulkPreview(null); setBulkConfirming(false); }} className={`rounded-xl border px-3.5 py-2 text-left text-sm font-semibold ${bulkMode === v ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}>{bulkMode === v ? "● " : "○ "}{lab}</button>
                    ))}
                  </div>
                  {bulkMode === "fixed" && (
                    <div className="mt-3 max-w-xs">
                      <Field label={t("bulk.fixedPct")}><input type="number" min={0} max={100} value={bulkFixed} onChange={(e) => { setBulkFixed(e.target.value); setBulkPreview(null); }} className={errInputCls(!!bulkErrFor("bulkFixed"))} aria-label="Bulk fixed profit percent" /><FieldError msg={bulkErrFor("bulkFixed")} /></Field>
                    </div>
                  )}
                  {bulkMode === "random" && (
                    <div className="mt-3">
                      <div className="grid max-w-lg gap-3 sm:grid-cols-2">
                        <Field label={t("bulk.randomMin")}><input type="number" min={0} max={100} value={bulkRandomMin} onChange={(e) => { setBulkRandomMin(e.target.value); setBulkPreview(null); }} className={errInputCls(!!bulkErrFor("bulkRandomMin"))} aria-label="Bulk random minimum profit percent" /><FieldError msg={bulkErrFor("bulkRandomMin")} /></Field>
                        <Field label={t("bulk.randomMax")}><input type="number" min={0} max={100} value={bulkRandomMax} onChange={(e) => { setBulkRandomMax(e.target.value); setBulkPreview(null); }} className={errInputCls(!!bulkErrFor("bulkRandomMax"))} aria-label="Bulk random maximum profit percent" /><FieldError msg={bulkErrFor("bulkRandomMax")} /></Field>
                      </div>
                      <FieldError msg={bulkErrFor("bulkRandomRange")} /><FieldError msg={bulkErrFor("bulkRandomOrder")} />
                      <p className="mt-2 text-xs text-[var(--dim)]">{t("bulk.randomHint")}</p>
                    </div>
                  )}
                  {bulkMode === "slabs" && (
                    <div className="mt-3 flex flex-col gap-3">
                      <p className="text-xs text-[var(--dim)]">{t("bulk.slabHint")}</p>
                      <FieldError msg={bulkErrFor("bulkNoSlab")} />
                      {bulkSlabs.map((s, idx) => (
                        <div key={idx} className={`rounded-xl border p-3 ${s.enabled ? "border-[var(--border)] bg-[var(--surface)]" : "border-dashed border-[var(--border)] bg-[var(--surface-alt)] opacity-80"}`}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[var(--text)]">
                            <input type="checkbox" checked={s.enabled} onChange={(e) => { const next = bulkSlabs.slice(); next[idx] = { ...s, enabled: e.target.checked }; setBulkSlabs(next); setBulkPreview(null); }} aria-label={`Use slab ${idx + 1}`} />
                            {t("bulk.slab")} {idx + 1} — {t("bulk.slabEnable")}
                          </label>
                          {s.enabled && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-4">
                              <Field label={t("bulk.slabFrom")}><input type="number" min={0} value={s.fromPrice} onChange={(e) => { const next = bulkSlabs.slice(); next[idx] = { ...s, fromPrice: e.target.value }; setBulkSlabs(next); setBulkPreview(null); }} className={errInputCls(!!bulkErrFor(`slab${idx}From`))} aria-label={`Slab ${idx + 1} from price`} /><FieldError msg={bulkErrFor(`slab${idx}From`)} /></Field>
                              <Field label={t("bulk.slabTo")}><input type="number" min={0} value={s.toPrice} onChange={(e) => { const next = bulkSlabs.slice(); next[idx] = { ...s, toPrice: e.target.value }; setBulkSlabs(next); setBulkPreview(null); }} placeholder="∞" className={inputCls} aria-label={`Slab ${idx + 1} to price`} /></Field>
                              <Field label={t("bulk.slabMin")}><input type="number" min={0} max={100} value={s.minPercent} onChange={(e) => { const next = bulkSlabs.slice(); next[idx] = { ...s, minPercent: e.target.value }; setBulkSlabs(next); setBulkPreview(null); }} className={inputCls} aria-label={`Slab ${idx + 1} minimum profit percent`} /></Field>
                              <Field label={t("bulk.slabMax")}><input type="number" min={0} max={100} value={s.maxPercent} onChange={(e) => { const next = bulkSlabs.slice(); next[idx] = { ...s, maxPercent: e.target.value }; setBulkSlabs(next); setBulkPreview(null); }} className={inputCls} aria-label={`Slab ${idx + 1} maximum profit percent`} /></Field>
                              <div className="sm:col-span-4"><FieldError msg={bulkErrFor(`slab${idx}Order`)} /><FieldError msg={bulkErrFor(`slab${idx}PctMissing`)} /><FieldError msg={bulkErrFor(`slab${idx}PctRange`)} /><FieldError msg={bulkErrFor(`slab${idx}PctOrder`)} /></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
                {bulkServerErr && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">⚠ {bulkServerErr}</p>}
                {bulkApplied && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {bulkApplied}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="submit" disabled={previewBulk.isPending} className={primaryBtn}>{previewBulk.isPending ? t("bulk.previewing") : `👁 ${t("bulk.previewBtn")}`}</button>
                </div>
              </form>
              {bulkPreview && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3.5">
                  <h5 className="font-display font-bold text-[var(--text)]">{t("bulk.previewTitle")}</h5>
                  <p className="mt-1 text-sm text-[var(--text)]"><strong>{bulkPreview.count}</strong> {t("bulk.previewCount")}</p>
                  <p className="mt-0.5 break-words text-xs text-[var(--dim)]">{bulkPreview.summary}</p>
                  {bulkMode === "random" || bulkMode === "slabs" ? <p className="mt-1 text-xs text-[var(--dim)]">Random % are freshly drawn on Apply, so final values stay inside the same range but may differ slightly from this preview sample.</p> : null}
                  {bulkPreview.count === 0 ? (
                    <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {t("bulk.previewNone")}</p>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-col gap-2">
                        {bulkPreview.samples.map((sm) => (
                          <div key={sm.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                            <p className="line-clamp-1 font-semibold text-[var(--text)]">{sm.name}</p>
                            <p className="mt-0.5 text-xs text-[var(--dim)]">{sm.category} · {t("bulk.basePrice")} {fmt(sm.basePrice)}</p>
                            <p className="mt-1 text-sm text-[var(--text)]">{t("sd.profit")}: <strong>{sm.oldPercent}% → {sm.newPercent}%</strong> · {t("bulk.buyerPrice")}: <strong>{fmt(sm.oldBuyerPrice)} → {fmt(sm.newBuyerPrice)}</strong></p>
                          </div>
                        ))}
                      </div>
                      {!bulkConfirming ? (
                        <button type="button" aria-label={`${t("bulk.applyBtn")} ${bulkPreview.count} ${t("bulk.applyProducts")}`} onClick={() => setBulkConfirming(true)} className={goldBtn + " mt-3 w-full sm:w-auto"}>{t("bulk.applyBtn")} {bulkPreview.count} {t("bulk.applyProducts")}</button>
                      ) : (
                        <div className="mt-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-3 dark:bg-amber-950/30">
                          <p className="text-sm font-bold text-amber-900 dark:text-amber-100">Apply this bulk change to {bulkPreview.count} products? This updates shop prices and seller profit at once. Past orders will not change.</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" aria-label={`Confirm apply bulk profit to ${bulkPreview.count} products`} disabled={applyBulk.isPending} onClick={() => applyBulk.mutate()} className="rounded-lg bg-[var(--accent)] px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50">{applyBulk.isPending ? t("bulk.applying") : `${t("bulk.applyBtn")} ${bulkPreview.count} ${t("bulk.applyProducts")}`}</button>
                            <button type="button" aria-label="Cancel bulk apply" onClick={() => setBulkConfirming(false)} className={ghostBtn + " px-3 py-2 text-sm"}>{t("adm.cancel")}</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
      </>
    );
  }

  // --- Seller detail → Orders tab: Quick Send Order ---
  // A compact list of THIS seller's own added products. Each row is just
  // product name + price, a quantity box and a Send Order button — one
  // click sends the order straight to this seller (no customer form).
  function renderSellerQuickSend(seller: SellerApplication) {
    const myPicks = (sellerProductsList.data?.rows ?? []).filter((r) => r.sellerId === seller.id);
    return (
      <section aria-label={t("qs.title")} className="mt-5 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
        <h4 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-[var(--text)]">
          📨 {t("qs.title")} <NewBadge id="seller-send-order" />
        </h4>
        <p className="mt-1 text-sm text-[var(--dim)]">{t("qs.sub")}</p>
        {quickErr && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">⚠ {quickErr}</p>}
        {quickOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {quickOk}</p>}
        {myPicks.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--dim)]">{t("qs.noProducts")}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {myPicks.map((r) => {
              const qtyRaw = quickQty[r.productId] ?? "1";
              const qtyN = parseInt(qtyRaw, 10);
              const qtyValid = !Number.isNaN(qtyN) && qtyN >= 1 && qtyN <= 99;
              const sending = quickSend.isPending && quickSend.variables?.productId === r.productId;
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="line-clamp-1 text-sm font-semibold text-[var(--text)]">{r.productName}</p>
                    <p className="text-xs text-[var(--dim)]">{fmt(r.sellingPrice)} · {t("qs.stock")}: {r.stock}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--dim)]">
                    {t("qs.qty")}
                    <input
                      type="number" min={1} max={99} value={qtyRaw}
                      onChange={(e) => setQuickQty({ ...quickQty, [r.productId]: e.target.value })}
                      className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm font-bold text-[var(--text)]"
                      aria-label={`Quantity for ${r.productName}`}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Send order of ${r.productName} to ${seller.storeName ?? seller.name}`}
                    disabled={!qtyValid || quickSend.isPending}
                    onClick={() => { setQuickErr(null); setQuickOk(null); quickSend.mutate({ productId: r.productId, qty: qtyN }); }}
                    className={goldBtn + " px-3 py-2 text-xs"}
                  >
                    {sending ? t("qs.sending") : `📨 ${t("qs.sendBtn")}`}
                  </button>
                  {!qtyValid && qtyRaw.trim() !== "" && <p className="w-full text-xs font-semibold text-rose-600">⚠ {t("so.val.qty")}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  // --- Seller detail: this seller's orders, status buttons, notices ---
  function renderSellerOrdersAdmin(seller: SellerApplication) {
    const orders = sellerOrdersAdmin.data?.orders ?? [];
    const statusBtn = (o: (typeof orders)[number], target: (typeof ORDER_STATUSES)[number], label: string) => (
      <button
        key={target}
        type="button"
        aria-label={`Mark order ${o.id} as ${target}`}
        aria-pressed={o.status === target}
        disabled={setStatus.isPending || o.status === target}
        onClick={() => setStatus.mutate({ orderId: o.id, status: target })}
        className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${o.status === target ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
      >
        {o.status === target ? "● " : ""}{label}
      </button>
    );
    return (
      <section aria-label={t("sord.title")} className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h4 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-[var(--text)]">🧾 {t("sord.title")} ({orders.length}) <NewBadge id="seller-orders-admin" /></h4>
        <p className="mt-1 text-sm text-[var(--dim)]">{t("sord.sub")}</p>
        {sellerOrdersAdmin.isPending ? (
          <p className="mt-2 text-sm text-[var(--dim)]">{t("common.loading")}</p>
        ) : orders.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--dim)]">{t("sord.none")}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {orders.map((o) => {
              const pending = o.status === "Pending" || o.status === "Confirmed";
              const nkey = `order-${o.id}`;
              const res = noticeResult?.key === nkey ? noticeResult : null;
              const draft = noticeDraft[o.id] ?? "";
              return (
                <div key={o.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <strong className="text-[var(--text)]">Order #{o.id}</strong>
                    <StatusBadge status={o.status} />
                    {o.paidFromWallet && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{t("sord.paidFromWallet")}</span>}
                    <span className="ml-auto text-xs text-[var(--dim)]">{new Date(o.createdAt).toLocaleString()}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-[var(--text)]">
                    {o.items.map((it) => (
                      <li key={it.productId} className="flex justify-between gap-2"><span>{it.productName} × {it.qty}</span><span className="font-medium">{fmt(it.buyerPrice * it.qty)}</span></li>
                    ))}
                  </ul>
                  <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--dim)]">
                    {o.customerName} · {o.city}{o.state ? `, ${o.state}` : ""}{o.pinCode ? ` — ${o.pinCode}` : ""} · {o.paymentMethod} · {t("so.total")}: <strong className="text-[var(--text)]">{fmt(o.total)}</strong>
                  </p>
                  <p className="mt-1 text-xs text-[var(--dim)]">
                    {t("sord.sellerShare")}: <strong className="text-[var(--text)]">{fmt(o.sellerAmount)}</strong> · {t("fin.profit")}: <strong className="text-[var(--accent)]">{fmt(o.sellerProfit)}</strong> · {t("sord.payable")}: <strong className="text-[var(--text)]">{fmt(o.payableCost)}</strong>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`Order ${o.id} status`}>
                    <span className="text-xs font-semibold text-[var(--dim)]">{t("adm.statusWord")}:</span>
                    {statusBtn(o, "Pending", `📦 ${t("sord.markPending")}`)}
                    {statusBtn(o, "Shipped", `🚚 ${t("sord.markShipped")}`)}
                    {statusBtn(o, "Delivered", `✅ ${t("sord.markCompleted")}`)}
                    {o.status !== "Cancelled" && (
                      <button type="button" aria-label={`Cancel order ${o.id}`} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ orderId: o.id, status: "Cancelled" })} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-600 disabled:opacity-50">✕ {trStatus(lang, "Cancelled")}</button>
                    )}
                  </div>
                  {o.status === "Shipped" && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--amber-bg)] px-3 py-2.5">
                      <span className="text-xs font-bold text-[var(--text)]">⏳ {t("sord.waitingApproval")}</span>
                      <button type="button" aria-label={`Approve shipment and complete order ${o.id}`} disabled={reviewShip.isPending} onClick={() => reviewShip.mutate({ orderId: o.id, decision: "approve" })} className={goldBtn + " px-3 py-1.5 text-xs"}>✅ {t("sord.approveBtn")}</button>
                      <button type="button" aria-label={`Return order ${o.id} to pending`} disabled={reviewShip.isPending} onClick={() => reviewShip.mutate({ orderId: o.id, decision: "return" })} className={ghostBtn + " px-3 py-1.5 text-xs"}>↩ {t("sord.returnPending")}</button>
                      {reviewErr && <p role="alert" className="w-full text-xs font-semibold text-rose-600">⚠ {reviewErr}</p>}
                    </div>
                  )}
                  {pending && (
                    <div className="mt-3 rounded-xl bg-[var(--amber-bg)] px-3 py-2.5">
                      {noticeOpenOrderId !== o.id ? (
                        <button type="button" aria-label={`Send reminder notice for order ${o.id}`} onClick={() => { setNoticeOpenOrderId(o.id); setNoticeResult(null); }} className="text-sm font-bold text-[var(--accent)]">📣 {t("notice.title")} →</button>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-[var(--text)]">📣 {t("notice.title")} — Order #{o.id}</p>
                          <p className="mt-0.5 text-xs text-[var(--dim)]">{t("notice.sub")}</p>
                          <p className="mt-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">{t("notice.defaultOrder")} <strong>(Order #{o.id})</strong></p>
                          <textarea value={draft} onChange={(e) => setNoticeDraft({ ...noticeDraft, [o.id]: e.target.value })} rows={2} placeholder={t("notice.customPh")} className={inputCls + " mt-2"} aria-label={`Custom note for the order ${o.id} reminder`} />
                          {res && (res.ok
                            ? <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {res.text}</p>
                            : <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {res.text}</p>)}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" aria-label={`Send reminder notice for order ${o.id} now`} disabled={sendNotice.isPending} onClick={() => { const custom = draft.trim(); const message = `${t("notice.defaultOrder")} (Order #${o.id})${custom ? `\n\n${custom}` : ""}`; sendNotice.mutate({ sellerId: seller.id, orderId: o.id, message, key: nkey }); }} className={primaryBtn + " px-3 py-2 text-xs"}>{sendNotice.isPending ? t("notice.sending") : t("notice.send")}</button>
                            <button type="button" aria-label="Close reminder notice form" onClick={() => setNoticeOpenOrderId(null)} className={ghostBtn + " px-3 py-2 text-xs"}>{t("adm.cancel")}</button>
                          </div>
                        </div>
                      )}
                      {noticeOpenOrderId !== o.id && res?.ok && <p role="status" className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">✓ {res.text}</p>}
                      {noticeOpenOrderId !== o.id && res && !res.ok && <p role="alert" className="mt-1 text-sm font-semibold text-rose-600">⚠ {res.text}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {/* General notice to this seller (not tied to one order) */}
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
          <p className="font-display text-sm font-bold text-[var(--text)]">📣 {t("notice.generalTitle")}</p>
          <textarea value={noticeGeneral} onChange={(e) => setNoticeGeneral(e.target.value)} rows={2} placeholder={t("notice.generalPh")} className={inputCls + " mt-2"} aria-label="General notice message for this seller" />
          {noticeResult?.key === "general" && (noticeResult.ok
            ? <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {noticeResult.text}</p>
            : <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {noticeResult.text}</p>)}
          <button type="button" aria-label="Send general notice to this seller" disabled={sendNotice.isPending || noticeGeneral.trim().length < 5} onClick={() => sendNotice.mutate({ sellerId: seller.id, orderId: null, message: noticeGeneral.trim(), key: "general" })} className={primaryBtn + " mt-2 px-3 py-2 text-xs"}>{sendNotice.isPending ? t("notice.sending") : t("notice.send")}</button>
          {noticeGeneral.trim().length > 0 && noticeGeneral.trim().length < 5 && <p className="mt-1 text-xs font-semibold text-rose-600">{t("notice.tooShort")}</p>}
        </div>
      </section>
    );
  }

  // --- Seller detail: full wallet statement (same figures as the
  // seller's own Wallet — one shared computation) ---
  function renderWalletStatement() {
    const f = sellerFinance.data;
    if (!f) return <p className="mt-2 text-sm text-[var(--dim)]">{t("common.loading")}</p>;
    const uses = f.ledger.filter((e) => e.direction === "debit" && (e.status === "completed" || e.status === "paid" || (e.kind === "order_payment_held" && e.status === "pending")));
    return (
      <section aria-label={t("stmt.title")} className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h4 className="font-display font-bold text-[var(--text)]">🧾 {t("stmt.title")}</h4>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[var(--surface-alt)] p-3 text-center">
            <p className="font-display text-base font-extrabold text-[var(--text)] sm:text-lg">{fmt(f.totalCreditsCompleted)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--dim)]">{t("stmt.totalCredited")}</p>
            <p className="text-[10px] leading-tight text-[var(--dim)]">{t("stmt.creditBreakdown")}</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-alt)] p-3 text-center">
            <p className="font-display text-base font-extrabold text-[var(--text)] sm:text-lg">−{fmt(f.usedAmount)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--dim)]">{t("stmt.totalUsed")}</p>
            <p className="text-[10px] leading-tight text-[var(--dim)]">{t("w.typeWithdraw")}: {fmt(f.usedAmount - f.totalOrderPayments)} · {t("w.typeOrderPayment")}: {fmt(f.totalOrderPayments)}</p>
          </div>
          <div className="rounded-xl bg-[var(--accent)] p-3 text-center text-white">
            <p className="font-display text-base font-extrabold sm:text-lg">{fmt(f.availableBalance)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-white/85">{t("stmt.remaining")}</p>
            <p className="text-[10px] leading-tight text-white/70">{fmt(f.totalCreditsCompleted)} − {fmt(f.usedAmount)}{f.pendingWithdrawal > 0 ? ` − ${fmt(f.pendingWithdrawal)} ${t("fin.pendingWithdraw")}` : ""}</p>
          </div>
        </div>
        {/* Total Withdrawn / Total Deposited — the same shared figures
            the seller's own Wallet shows (paid-out withdrawals only,
            including direct Admin Withdrawals; credited deposits only,
            including direct Customer Service Credits), with both lists. */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[var(--surface-alt)] p-3 text-center">
            <p className="font-display text-base font-extrabold text-[var(--text)] sm:text-lg">{fmt(f.totalWithdrawn)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--dim)]">⬆️ {t("w.withdrawn")}</p>
            <p className="text-[10px] leading-tight text-[var(--dim)]">{t("fin.withdrawnSub")}</p>
          </div>
          <div className="rounded-xl bg-[var(--surface-alt)] p-3 text-center">
            <p className="font-display text-base font-extrabold text-[var(--text)] sm:text-lg">{fmt(f.totalDeposited)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[var(--dim)]">⬇️ {t("w.deposited")}</p>
            <p className="text-[10px] leading-tight text-[var(--dim)]">{t("fin.depositedSub")}</p>
          </div>
        </div>
        <h5 className="mt-4 font-display text-sm font-bold text-[var(--text)]">{t("fin.withdrawalsList")} ({f.withdrawals.length})</h5>
        {f.withdrawals.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">{t("fin.noWithdrawals")}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {f.withdrawals.map((wd) => (
              <div key={wd.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{t("fin.paidBadge")}</span>
                <span className="min-w-0 text-[var(--text)]">{wd.kind === "admin_withdraw" ? t("fin.adminWithdrawal") : wd.method}{wd.paymentReference ? ` · ${wd.paymentReference}` : ""}{wd.note ? ` · ${wd.note}` : ""}</span>
                <span className="ml-auto font-display font-bold text-[var(--text)]">−{fmt(wd.amount)}</span>
                <span className="w-full text-[11px] text-[var(--dim)]">{new Date(wd.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <h5 className="mt-4 font-display text-sm font-bold text-[var(--text)]">{t("fin.depositsList")} ({f.deposits.length})</h5>
        {f.deposits.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">{t("fin.noDeposits")}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {f.deposits.map((dp) => (
              <div key={dp.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span className="min-w-0 text-[var(--text)]">{dp.kind === "admin_credit" ? t("fin.adminCredit") : dp.method}{dp.kind !== "admin_credit" && dp.reference ? ` · ${dp.reference}` : ""}{dp.kind === "admin_credit" && dp.note ? ` · ${dp.note}` : ""}</span>
                <span className="ml-auto font-display font-bold text-[var(--text)]">+{fmt(dp.amount)}</span>
                <span className="w-full text-[11px] text-[var(--dim)]">{new Date(dp.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
        <h5 className="mt-4 font-display text-sm font-bold text-[var(--text)]">{t("stmt.usedBreakdown")} ({uses.length})</h5>
        {uses.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--dim)]">{t("stmt.noUse")}</p>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            {uses.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span aria-hidden>{e.kind === "order_payment_held" || e.kind === "order_payment" ? "🧾" : "⬆️"}</span>
                <strong className="text-[var(--text)]">{kindLabel(e.kind)}</strong>
                <span className="text-xs text-[var(--dim)]">{e.reference}{e.method ? ` · ${e.method}` : ""}{e.note ? ` · ${e.note}` : ""}</span>
                <span className="ml-auto font-display font-bold text-[var(--text)]">−{fmt(e.amount)}</span>
                <span className="w-full text-[11px] text-[var(--dim)] sm:w-auto">{new Date(e.createdAt).toLocaleString()} · {t("fin.running")}: {fmt(e.runningBalance)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[var(--dim)]">{t("fin.total")}: <strong>{fmt(f.totalBalance)}</strong> · {t("stmt.pendingNote")}: {fmt(f.totalPending)} · {t("fin.requestsAwaiting")}: {t("fin.pendingDeposit")} {fmt(f.pendingDeposit)} · {t("fin.pendingWithdraw")} {fmt(f.pendingWithdrawal)}</p>
      </section>
    );
  }

  // --- Products section: one-click price refresh card ---
  function renderPriceRefreshCard() {
    const last = settings?.lastPriceSyncAt ? new Date(settings.lastPriceSyncAt) : null;
    return (
      <section aria-label={t("price.title")} className="mt-3 rounded-2xl border-2 border-[var(--accent)]/30 bg-[var(--surface)] p-4">
        <h4 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-[var(--text)]">💲 {t("price.title")} <NewBadge id="price-refresh" /></h4>
        <p className="mt-1 text-sm text-[var(--dim)]">{t("price.sub")}</p>
        <p className="mt-2 text-xs text-[var(--dim)]">
          {t("price.last")}: {last ? <strong className="text-[var(--text)]">{last.toLocaleString()}</strong> : t("price.never")}
          {settings?.lastPriceSyncNote ? <span> · {settings.lastPriceSyncNote}</span> : null}
        </p>
        {priceErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {priceErr}</p>}
        {priceResult && (
          <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-bold">✓ {priceResult.changed} {t("price.changedWord")} · {priceResult.checked} {t("price.checkedWord")}{priceResult.syncedAt ? ` · ${new Date(priceResult.syncedAt).toLocaleString()}` : ""}</p>
            {priceResult.examples.length > 0 && (
              <>
                <p className="mt-1.5 font-semibold">{t("price.examples")}:</p>
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {priceResult.examples.map((ex) => (
                    <li key={ex.name} className="text-[13px]"><span className="line-clamp-1">{ex.name}</span> {fmt(ex.oldBuyerPrice)} → <strong>{fmt(ex.newBuyerPrice)}</strong></li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <button type="button" aria-label={t("price.title")} disabled={refreshPrices.isPending} onClick={() => { setPriceResult(null); setPriceErr(null); refreshPrices.mutate(); }} className={goldBtn + " mt-3"}>
          {refreshPrices.isPending ? t("price.refreshing") : t("price.btn")}
        </button>
      </section>
    );
  }

  // --- Products section: bulk auto-add / expand catalog card ---
  function renderBulkGenerateCard() {
    const total = products.data?.products.length ?? 0;
    const val = parseInt(bgenValue, 10) || 0;
    const valid = val >= 1 && (bgenMode === "add" ? true : val > total);
    return (
      <section aria-label={t("bgen.title")} className="mt-3 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
        <h4 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-[var(--text)]">🧺 {t("bgen.title")} <NewBadge id="bulk-generate" /></h4>
        <p className="mt-1 text-sm text-[var(--dim)]">{t("bgen.sub")}</p>
        <p className="mt-2 text-sm text-[var(--text)]">{t("bgen.currentTotal")}: <strong className="font-display">{total}</strong></p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("bgen.title")}>
          {(["add", "target"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={bgenMode === m} aria-label={t(m === "add" ? "bgen.modeAdd" : "bgen.modeTarget")} onClick={() => { setBgenMode(m); setBgenResult(null); }} className={`rounded-full border px-3.5 py-2 text-sm font-bold ${bgenMode === m ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border)]"}`}>
              {bgenMode === m ? "● " : "○ "}{t(m === "add" ? "bgen.modeAdd" : "bgen.modeTarget")}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-44">
            <Field label={bgenMode === "add" ? t("bgen.modeAdd") : t("bgen.modeTarget")}>
              <input type="number" min={1} value={bgenValue} onChange={(e) => { setBgenValue(e.target.value); setBgenResult(null); }} placeholder={t(bgenMode === "add" ? "bgen.addPh" : "bgen.targetPh")} className={inputCls} aria-label={bgenMode === "add" ? t("bgen.modeAdd") : t("bgen.modeTarget")} />
            </Field>
          </div>
          <button type="button" aria-label={t("bgen.btn")} disabled={!valid || bulkGen.isPending} onClick={() => bulkGen.mutate()} className={goldBtn}>
            {bulkGen.isPending ? t("bgen.adding") : t("bgen.btn")}
          </button>
        </div>
        {bgenResult && !bgenResult.ok && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {bgenResult.error}</p>}
        {bgenResult && bgenResult.ok && (
          <div role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-bold">✓ {bgenResult.added} {t("bgen.done")} · {t("bgen.totalNow")} {bgenResult.totalNow}</p>
            {bgenResult.perCategory.length > 0 && <p className="mt-1 text-[13px]">{bgenResult.perCategory.map((c) => `${c.category}: ${c.added}`).join(" · ")}</p>}
          </div>
        )}
      </section>
    );
  }

  // --- Theme & Design section ---
  function renderThemeDesign() {
    const scheme = schemeDraft ?? settings?.colorScheme ?? "navy";
    const layoutD = layoutDraft ?? settings?.layoutDesign ?? "classic";
    const schemes: Array<{ id: string; label: StrKey; pal: { accent: string; strong: string; soft: string; gold: string; bg: string } }> = [
      { id: "navy", label: "theme.scheme.navy", pal: { accent: "#1a365d", strong: "#122847", soft: "#e8eef6", gold: "#d97706", bg: "#f6f7f9" } },
      { id: "emerald", label: "theme.scheme.emerald", pal: { accent: "#047857", strong: "#065f46", soft: "#d1fae5", gold: "#b45309", bg: "#f4f8f5" } },
      { id: "royal", label: "theme.scheme.royal", pal: { accent: "#6d28d9", strong: "#5b21b6", soft: "#ede9fe", gold: "#d97706", bg: "#f7f5fc" } },
      { id: "charcoal", label: "theme.scheme.charcoal", pal: { accent: "#1f2937", strong: "#030712", soft: "#e5e7eb", gold: "#dc2626", bg: "#f7f7f8" } },
      { id: "teal", label: "theme.scheme.teal", pal: { accent: "#0f766e", strong: "#115e59", soft: "#ccfbf1", gold: "#ea580c", bg: "#f3f8f7" } },
    ];
    const layouts: Array<{ id: string; label: StrKey; desc: StrKey }> = [
      { id: "classic", label: "theme.layout.classic", desc: "theme.layout.classicD" },
      { id: "menu", label: "theme.layout.menu", desc: "theme.layout.menuD" },
      { id: "topsearch", label: "theme.layout.topsearch", desc: "theme.layout.topsearchD" },
    ];
    const dirty = scheme !== (settings?.colorScheme ?? "navy") || layoutD !== (settings?.layoutDesign ?? "classic");
    return (
      <div>
        <section aria-label={t("theme.title")} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h4 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-[var(--text)]">🎨 {t("theme.title")} <NewBadge id="theme-design" /></h4>
          <p className="mt-1 text-sm text-[var(--dim)]">{t("theme.sub")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label={t("theme.title")}>
            {schemes.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={scheme === s.id} aria-label={t(s.label)} onClick={() => { setSchemeDraft(s.id); setDesignOk(null); }} className={`overflow-hidden rounded-xl border text-left ${scheme === s.id ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}>
                {/* Mini storefront preview in the scheme's own palette */}
                <span aria-hidden className="block p-2" style={{ backgroundColor: s.pal.bg }}>
                  <span className="flex items-center gap-1 rounded-md px-1.5 py-1" style={{ backgroundColor: s.pal.accent }}>
                    <span className="h-1.5 w-6 rounded-full bg-white/90" />
                    <span className="ml-auto h-1.5 w-3 rounded-full" style={{ backgroundColor: s.pal.gold }} />
                  </span>
                  <span className="mt-1.5 block rounded-md bg-white p-1.5 shadow-sm">
                    <span className="block h-5 rounded" style={{ backgroundColor: s.pal.soft }} />
                    <span className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold" style={{ color: s.pal.strong }}>₹999</span>
                      <span className="rounded px-1 py-px text-[8px] font-bold text-white" style={{ backgroundColor: s.pal.gold }}>-20%</span>
                    </span>
                    <span className="mt-1 block rounded py-0.5 text-center text-[8px] font-bold text-white" style={{ backgroundColor: s.pal.accent }}>Add to Cart</span>
                  </span>
                </span>
                <span className={`block px-2 py-1.5 text-xs font-bold ${scheme === s.id ? "bg-[var(--accent-soft)] text-[var(--text)]" : "bg-[var(--surface)] text-[var(--text)]"}`}>{scheme === s.id ? "● " : "○ "}{t(s.label)}</span>
              </button>
            ))}
          </div>
        </section>
        <section aria-label={t("theme.layoutTitle")} className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h4 className="font-display text-base font-bold text-[var(--text)]">🖥️ {t("theme.layoutTitle")}</h4>
          <p className="mt-1 text-sm text-[var(--dim)]">{t("theme.layoutSub")}</p>
          <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label={t("theme.layoutTitle")}>
            {layouts.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={layoutD === l.id} aria-label={t(l.label)} onClick={() => { setLayoutDraft(l.id); setDesignOk(null); }} className={`rounded-xl border px-4 py-3 text-left ${layoutD === l.id ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                <span className="flex items-start gap-3">
                  {/* Mini wireframe of the layout */}
                  <span aria-hidden className="mt-0.5 block w-16 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg)]">
                    {l.id === "classic" && (<>
                      <span className="block h-2.5 bg-[var(--accent)]" />
                      <span className="block h-6" />
                      <span className="flex justify-around border-t border-[var(--border)] bg-[var(--surface)] py-0.5"><span className="h-1 w-1 rounded-full bg-[var(--accent)]" /><span className="h-1 w-1 rounded-full bg-[var(--dim)]" /><span className="h-1 w-1 rounded-full bg-[var(--dim)]" /><span className="h-1 w-1 rounded-full bg-[var(--dim)]" /></span>
                    </>)}
                    {l.id === "menu" && (<>
                      <span className="flex items-center gap-1 bg-[var(--accent)] px-1 py-0.5"><span className="text-[7px] leading-none text-white">☰</span><span className="h-1.5 flex-1 rounded-full bg-white/85" /></span>
                      <span className="block h-8" />
                    </>)}
                    {l.id === "topsearch" && (<>
                      <span className="block h-1.5 bg-[var(--accent)]" />
                      <span className="block px-1 py-0.5"><span className="block h-2 rounded-full border border-[var(--dim)] bg-[var(--surface)]" /></span>
                      <span className="block h-4" />
                      <span className="flex justify-around border-t border-[var(--border)] bg-[var(--surface)] py-0.5"><span className="h-1 w-1 rounded-full bg-[var(--accent)]" /><span className="h-1 w-1 rounded-full bg-[var(--dim)]" /><span className="h-1 w-1 rounded-full bg-[var(--dim)]" /><span className="h-1 w-1 rounded-full bg-[var(--dim)]" /></span>
                    </>)}
                  </span>
                  <span>
                    <span className="font-display text-sm font-bold text-[var(--text)]">{layoutD === l.id ? "● " : "○ "}{t(l.label)}</span>
                    <span className="mt-0.5 block text-sm text-[var(--dim)]">{t(l.desc)}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          {designErr && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">⚠ {designErr}</p>}
          {designOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {designOk}</p>}
          <button type="button" aria-label="Apply theme and design to the whole store" disabled={!dirty || saveDesign.isPending} onClick={() => saveDesign.mutate()} className={goldBtn + " mt-4"}>
            {saveDesign.isPending ? t("theme.applying") : `✓ ${t("adm.saveSettings")}`}
          </button>
        </section>
      </div>
    );
  }

  function renderResetRequests(filterRole: string | null, titleKey: "adm.resetRequests") {
    const all = resetRequests.data?.requests ?? [];
    const list = filterRole ? all.filter((r) => r.accountRole === filterRole) : all;
    const canManage = resetRequests.data?.viewerCanManageOthers ?? false;
    return (
      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h4 className="flex flex-wrap items-center gap-2 font-display font-bold text-[var(--text)]">🔑 {t(titleKey)} ({list.filter((r) => r.status === "pending").length} pending)
          {list.filter((r) => r.status === "pending").length > 0 && <span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-[11px] font-bold text-white">{list.filter((r) => r.status === "pending").length}</span>}
        </h4>
        <p className="mt-1 text-xs leading-snug text-[var(--dim)]">{t("adm.resetRequestsSub")}</p>
        {resetReqOk && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {resetReqOk}</p>}
        {resetReqErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {resetReqErr}</p>}
        {list.length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noResetRequests")}</p> : (
          <div className="mt-3 flex flex-col gap-2">
            {list.map((r) => {
              const blocked = r.accountRole === "admin" && !canManage;
              const draft = resetPwDraft[r.id] ?? { newPassword: "", confirmPassword: "" };
              return (
                <div key={r.id} onClick={() => { if (newResetIdSet.has(r.id)) markSeen.mutate({ kind: "reset", refId: r.id }); }} className={`rounded-xl border bg-[var(--surface)] px-3 py-2.5 text-sm ${newResetIdSet.has(r.id) ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/60" : "border-[var(--border)]"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[var(--text)]">{r.name}</strong>
                    <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold capitalize">{r.accountRole}</span>
                    <StatusBadge status={r.status === "pending" ? "pending" : "completed"} />
                    {newResetIdSet.has(r.id) && <NewBadge />}
                    <span className="ml-auto text-xs text-[var(--dim)]">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--dim)]">{r.email ?? ""}{r.phone ? ` · ${fmtPhone(r.phone, null)}` : ""}</p>
                  {(r.storeNameEntered || r.accountStoreName) && <p className="mt-0.5 text-xs text-[var(--dim)]">{t("adm.storeEntered")}: <strong className="text-[var(--text)]">{r.storeNameEntered || "—"}</strong> · {t("adm.storeOnRecord")}: <strong className="text-[var(--text)]">{r.accountStoreName ?? "—"}</strong></p>}
                  {r.status === "pending" && (blocked ? (
                    <p className="mt-2 rounded-lg bg-[var(--surface-alt)] px-2 py-1.5 text-xs text-[var(--dim)]">You do not have permission to do this.</p>
                  ) : resetOpenId === r.id ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Field label={t("cp.new")}><span className="flex gap-1"><input type={showTypedPw ? "text" : "password"} value={draft.newPassword} onChange={(e) => setResetPwDraft({ ...resetPwDraft, [r.id]: { ...draft, newPassword: e.target.value } })} className={inputCls} aria-label={`New password for ${r.name}`} /><button type="button" aria-label="Show or hide the new password while typing" onClick={() => setShowTypedPw(!showTypedPw)} className="shrink-0 rounded-lg border border-[var(--border)] px-2.5">{showTypedPw ? "🙈" : "👁️"}</button></span></Field>
                      <Field label={t("cp.confirm")}><input type="password" value={draft.confirmPassword} onChange={(e) => setResetPwDraft({ ...resetPwDraft, [r.id]: { ...draft, confirmPassword: e.target.value } })} className={inputCls} aria-label={`Confirm new password for ${r.name}`} /></Field>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <button type="button" aria-label={`Complete password reset for ${r.name}`} disabled={completeReset.isPending} onClick={() => { if (!draft.newPassword || draft.newPassword.length < 4) { setResetReqErr(t("adm.val.newPwShort")); return; } if (draft.confirmPassword !== draft.newPassword) { setResetReqErr(t("adm.val.confirmMismatch")); return; } setResetReqErr(null); completeReset.mutate({ requestId: r.id, newPassword: draft.newPassword }); }} className={primaryBtn + " px-3 py-1.5 text-xs"}>{t("adm.resetPwAction")}</button>
                        <button type="button" aria-label={`Cancel password reset for ${r.name}`} onClick={() => setResetOpenId(null)} className={ghostBtn + " px-3 py-1.5 text-xs"}>{t("adm.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" aria-label={`Reset password for ${r.name}`} onClick={() => { setResetOpenId(r.id); setResetReqErr(null); setResetReqOk(null); }} className={primaryBtn + " mt-2 px-3 py-1.5 text-xs"}>🔑 {t("adm.resetPwAction")}</button>
                  ))}
                  {resetDeleteId === r.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-rose-700">{t("adm.deleteResetQ")}</span>
                      <button type="button" aria-label={`Confirm delete reset request for ${r.name}`} disabled={deleteResetReq.isPending} onClick={() => deleteResetReq.mutate(r.id)} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">{t("adm.confirmDelete")}</button>
                      <button type="button" aria-label={`Cancel delete reset request for ${r.name}`} onClick={() => setResetDeleteId(null)} className="text-xs font-semibold text-[var(--dim)]">{t("adm.cancel")}</button>
                    </div>
                  ) : (
                    <button type="button" aria-label={`Delete reset request record for ${r.name}`} onClick={() => { setResetDeleteId(r.id); setResetReqErr(null); setResetReqOk(null); }} className="mt-2 block text-xs font-bold text-rose-600">🗑 {t("adm.deleteReset")}</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!user) return <EmptyState title={t("adm.signInT")} text={t("adm.signInD")} />;
  if (user.role !== "admin") return <EmptyState title={t("adm.title")} text={t("adm.onlyAdmin")} />;
  if (overview.isPending) return <p className="py-10 text-center text-[var(--dim)]">{t("adm.loading")}</p>;
  const ov = overview.data!;
  const apps = applications.data?.applications ?? [];
  const pendingSellerCount = apps.filter((a) => a.verificationStatus === "pending").length;
  const selectedSeller = apps.find((a) => a.id === selectedSellerId) ?? null;
  const selectedSellerPicks = (sellerProductsList.data?.rows ?? []).filter((r) => r.sellerId === selectedSellerId);
  const selectedBuyer = ov.users.find((u) => u.id === selectedBuyerId && u.role === "buyer") ?? null;
  const selectedBuyerOrders = selectedBuyer ? ov.orders.filter((o) => o.buyerId === selectedBuyer.id) : [];
  const buyersCount = ov.users.filter((u) => u.role === "buyer").length;
  const sellersCount = ov.users.filter((u) => u.role === "seller").length;
  // Order totals by status — computed from the same real orders list the
  // Admin Orders section shows, so the counts always match the records
  // and update the moment any status changes.
  const ordCounts = {
    total: ov.orders.length,
    completed: ov.orders.filter((o) => o.status === "Delivered").length,
    pending: ov.orders.filter((o) => o.status === "Pending" || o.status === "Confirmed").length,
    shipped: ov.orders.filter((o) => o.status === "Shipped").length,
    cancelled: ov.orders.filter((o) => o.status === "Cancelled").length,
  };
  const sellerInfoByOrder = new Map((ov.orderSellerInfo ?? []).map((x) => [x.orderId, x]));
  const deletedByOrder = new Map((ov.orderDeletedInfo ?? []).map((x) => [x.orderId, x]));
  const buyerStatById = new Map((ov.buyerStats ?? []).map((x) => [x.userId, x]));
  const actCounts = activity.data?.counts ?? { orders: 0, chats: 0, wallet: 0, tickets: 0, resets: 0, total: 0 };
  const newOrderIdSet = new Set(activity.data?.newOrderIds ?? []);
  const newWalletIdSet = new Set(activity.data?.newWalletIds ?? []);
  const newTicketIdSet = new Set(activity.data?.newTicketIds ?? []);
  const newResetIdSet = new Set(activity.data?.newResetIds ?? []);
  const awaitingChat = new Set((chatThreads.data?.threads ?? []).filter((x) => x.awaitingReply).map((x) => x.userId));
  // --- Admin → Orders, grouped by SHOP (seller store) --------------------
  // The primary list is the store's REGISTERED SELLERS: one row per
  // shop, shop/store name first. Every order belongs to exactly ONE
  // shop — its primary seller, resolved on the server (orderSellerInfo
  // primarySellerId) — so the per-shop counts always add up to the
  // global counts above and an order can never appear under two shops
  // or under a nameless group. Admin-sent orders are no exception:
  // they sit under the shop they were sent to, and the order itself
  // keeps its settled "Order by Customer" label. Orders with no
  // seller on record at all collect under one clearly labelled
  // "Unassigned orders" row — never a blank group. Shops with no
  // orders yet still get a row ("No orders yet") and sort last.
  type OrdersShopGroup = {
    key: string;
    sellerId: number;
    shopName: string;
    sellerName: string;
    loginId: string;
    contact: string;
    isDeleted: boolean;
    isUnassigned: boolean;
    orders: Order[];
    total: number;
    pending: number;
    shipment: number;
    completed: number;
    cancelled: number;
    latestAt: string | null;
    newCount: number;
  };
  const orderShopKey = (o: Order): string => {
    const pid = sellerInfoByOrder.get(o.id)?.primarySellerId ?? 0;
    return pid > 0 ? `shop-${pid}` : "unassigned";
  };
  const ordersByShop: OrdersShopGroup[] = (() => {
    const map = new Map<string, OrdersShopGroup>();
    const blank = (): Omit<OrdersShopGroup, "key" | "sellerId" | "shopName" | "sellerName" | "loginId" | "contact" | "isDeleted" | "isUnassigned"> => ({ orders: [], total: 0, pending: 0, shipment: 0, completed: 0, cancelled: 0, latestAt: null, newCount: 0 });
    // One row per registered seller, even before they have any order.
    for (const u of ov.users) {
      if (u.role !== "seller") continue;
      map.set(`shop-${u.id}`, {
        key: `shop-${u.id}`,
        sellerId: u.id,
        shopName: u.storeName?.trim() || u.name,
        sellerName: u.name,
        loginId: u.email ?? (u.phone ? fmtPhone(u.phone, u.country) : `Seller #${u.id}`),
        contact: [u.email ?? null, u.phone ? fmtPhone(u.phone, u.country) : null].filter(Boolean).join(" · "),
        isDeleted: false,
        isUnassigned: false,
        ...blank(),
      });
    }
    for (const o of ov.orders) {
      const key = orderShopKey(o);
      let g = map.get(key);
      if (!g) {
        if (key === "unassigned") {
          g = { key, sellerId: 0, shopName: t("aord.unassignedTitle"), sellerName: "", loginId: "", contact: "", isDeleted: false, isUnassigned: true, ...blank() };
        } else {
          // A shop that only survives in the order's snapshot (the
          // seller account was deleted) — named from that snapshot.
          const info = sellerInfoByOrder.get(o.id);
          const pid = info?.primarySellerId ?? 0;
          g = {
            key,
            sellerId: pid,
            shopName: info?.primaryStoreName?.trim() || info?.primarySellerName || `Seller #${pid}`,
            sellerName: info?.primarySellerName ?? "",
            loginId: info?.primaryLoginId || `Seller #${pid}`,
            contact: info?.primaryContact ?? "",
            isDeleted: info?.primaryDeleted ?? false,
            isUnassigned: false,
            ...blank(),
          };
        }
        map.set(key, g);
      }
      g.orders.push(o);
      g.total += 1;
      if (o.status === "Pending" || o.status === "Confirmed") g.pending += 1;
      else if (o.status === "Shipped") g.shipment += 1;
      else if (o.status === "Delivered") g.completed += 1;
      else if (o.status === "Cancelled") g.cancelled += 1;
      if (!g.latestAt || o.createdAt > g.latestAt) g.latestAt = o.createdAt;
      if (newOrderIdSet.has(o.id)) g.newCount += 1;
    }
    // Shops with Shipment orders waiting for approval first, then by
    // latest order date; shops with no orders yet sort last.
    return [...map.values()].sort((a, b) => {
      const aHas = a.total > 0 ? 1 : 0;
      const bHas = b.total > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (aHas === 0) return a.shopName.localeCompare(b.shopName);
      const ship = (b.shipment > 0 ? 1 : 0) - (a.shipment > 0 ? 1 : 0);
      if (ship !== 0) return ship;
      return (b.latestAt ?? "").localeCompare(a.latestAt ?? "");
    });
  })();
  const ordersSearchQ = ordersSearch.trim().toLowerCase();
  const filteredShopGroups = ordersSearchQ
    ? ordersByShop.filter((g) => g.shopName.toLowerCase().includes(ordersSearchQ) || g.sellerName.toLowerCase().includes(ordersSearchQ) || g.loginId.toLowerCase().includes(ordersSearchQ))
    : ordersByShop;
  const selectedShopGroup = ordersShopKey ? ordersByShop.find((g) => g.key === ordersShopKey) ?? null : null;
  // ONE renderer for an Admin order row (card + fulfilling seller + status
  // control + Shipment Approve / Return). The by-shop view and the
  // flat "view all" list both use it, so the actions and the data are
  // literally the same — an Approve here lands everywhere at once. In
  // the by-shop view the BUYER's name is shown explicitly on the row.
  const renderAdminOrderRow = (o: Order, opts?: { showBuyer?: boolean }) => {
    const info = sellerInfoByOrder.get(o.id);
    const delInfo = deletedByOrder.get(o.id);
    const pend = o.status === "Pending" || o.status === "Confirmed";
    const isNewOrder = newOrderIdSet.has(o.id);
    return (
      <div key={o.id} onClick={() => { if (isNewOrder) markSeen.mutate({ kind: "order", refId: o.id }); }} className={pend ? "rounded-xl ring-2 ring-[var(--alert)]" : isNewOrder ? "rounded-xl ring-2 ring-[var(--gold)]" : ""}>
        {o.paymentStatus === "pending" ? (
          <p className="rounded-t-xl bg-[var(--gold)] px-3 py-1.5 text-xs font-bold text-white">💳 {t("paygate.title")} — {t("paygate.under")}</p>
        ) : pend && <p className="rounded-t-xl bg-[var(--alert)] px-3 py-1.5 text-xs font-bold text-white">● {t("sd.pendingShipment")} — {t("notif.pendingAlert")}</p>}
        {isNewOrder && <p className="flex items-center gap-2 px-1 pt-1.5"><NewBadge /><span className="text-xs font-bold text-[var(--text)]">{t("act.title")}</span></p>}
        <OrderCard order={o} codActor={{ role: "admin", id: user.id }} />
        {o.hasPaymentProof && <div className="px-1 pt-1.5"><OrderPaymentProofView orderId={o.id} adminId={user.id} /></div>}
        {opts?.showBuyer && <p className="px-1 pt-1 text-xs text-[var(--dim)]">{t("aord.buyerWord")}: <strong className="text-[var(--text)]">{o.customerName}</strong>{o.phone ? ` · ${o.phone}` : ""}</p>}
        <p className="px-1 pt-1 text-xs text-[var(--dim)]">Seller: {info?.sellerNames ?? "Main Store"}{info ? ` · ${t("fin.profit")}: ${fmt(info.profit)}` : ""}{delInfo?.sellerDeleted ? ` · ⚠ ${t("del.sellerNote")}` : ""}{delInfo?.buyerDeleted ? ` · ⚠ ${t("del.buyerNote")}` : ""}</p>
        {o.paymentStatus === "pending" ? (
          <div className="px-1 pb-1">{renderPaymentGate(o)}</div>
        ) : (
          <div className="mt-1 flex items-center gap-2 px-1"><label htmlFor={`status-${o.id}`} className="text-xs font-medium text-[var(--dim)]">{t("adm.statusWord")}</label><select id={`status-${o.id}`} value={o.status} aria-label={`Change status of order ${o.id}`} onChange={(e) => setStatus.mutate({ orderId: o.id, status: e.target.value as (typeof ORDER_STATUSES)[number] })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm">{ORDER_STATUSES.map((s) => (<option key={s}>{s}</option>))}</select></div>
        )}
        {o.status === "Shipped" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1 pb-1">
            <span className="rounded-full bg-[var(--amber-bg)] px-2 py-1 text-[11px] font-bold text-[var(--text)]">⏳ {t("sord.waitingApproval")}</span>
            <button type="button" aria-label={`Approve shipment and complete order ${o.id}`} disabled={reviewShip.isPending} onClick={(e) => { e.stopPropagation(); reviewShip.mutate({ orderId: o.id, decision: "approve" }); }} className={goldBtn + " px-3 py-1.5 text-xs"}>✅ {t("sord.approveBtn")}</button>
            <button type="button" aria-label={`Return order ${o.id} to pending`} disabled={reviewShip.isPending} onClick={(e) => { e.stopPropagation(); reviewShip.mutate({ orderId: o.id, decision: "return" }); }} className={ghostBtn + " px-3 py-1.5 text-xs"}>↩ {t("sord.returnPending")}</button>
          </div>
        )}
      </div>
    );
  };
  type ActEvent = ApiResponse<typeof api, "adminActivityFeed">["events"][number];
  function openActivity(ev: ActEvent) {
    markSeen.mutate({ kind: ev.kind, refId: ev.refId });
    if (ev.kind === "order") {
      // Open the Orders section on THAT order's shop, not the old
      // flat mix — the order is right there in its shop's own list.
      const ord = ov.orders.find((o) => o.id === ev.refId);
      if (ord) { setOrdersShopKey(orderShopKey(ord)); setOrdersShowAll(false); }
      setSection("orders");
    }
    else if (ev.kind === "wallet") setSection("wallet");
    else if (ev.kind === "ticket") setSection("support");
    else if (ev.kind === "reset") setSection(ev.customerRole === "seller" ? "sellers" : ev.customerRole === "buyer" ? "users" : "support");
    else if (ev.kind === "chat") {
      if (ev.customerRole === "seller" && ev.userId !== null) { setSection("sellers"); setSelectedSellerId(ev.userId); setSellerTab("chat"); }
      else if (ev.userId !== null) { setSection("users"); setSelectedBuyerId(ev.userId); setBuyerTab("chat"); }
    }
  }
  const spRows = sellerProductsList.data?.rows ?? [];
  const spSellerOptions = [...new Map(spRows.map((r) => [r.sellerId, r])).values()];
  const spFiltered = spRows.filter((r) => {
    if (spSellerFilter !== "all" && r.sellerId !== parseInt(spSellerFilter, 10)) return false;
    const q = spSearch.trim().toLowerCase();
    if (!q) return true;
    return r.productName.toLowerCase().includes(q) || r.sellerName.toLowerCase().includes(q) || (r.storeName ?? "").toLowerCase().includes(q);
  });
  const sections: Array<{ id: AdminSection; label: string; badge?: number; isNew?: boolean; alert?: number }> = [
    { id: "overview", label: t("adm.sec.overview"), alert: actCounts.total },
    { id: "sellers", label: t("adm.sec.sellers"), badge: apps.length + ((resetRequests.data?.requests ?? []).filter((r) => r.status === "pending" && r.accountRole === "seller").length), alert: pendingSellerCount },
    { id: "users", label: t("adm.sec.users"), badge: ov.users.length + ((resetRequests.data?.requests ?? []).filter((r) => r.status === "pending" && r.accountRole === "buyer").length) },
    { id: "products", label: t("adm.sec.products"), badge: products.data?.products.length ?? ov.totalProducts },
    { id: "sellerProducts", label: t("adm.sec.sellerProducts"), badge: spRows.length, isNew: true },
    { id: "external", label: t("adm.sec.external"), badge: extAdminList.data?.products.length ?? 0, isNew: true },
    { id: "profit", label: t("adm.sec.profit"), isNew: true },
    { id: "orders", label: t("adm.sec.orders"), badge: ov.orders.length, isNew: true, alert: actCounts.orders },
    { id: "wallet", label: t("adm.sec.wallet"), badge: (walletRequests.data?.requests ?? []).filter((r) => r.status === "pending").length, alert: actCounts.wallet },
    { id: "support", label: t("adm.sec.support"), badge: ov.pendingSupport + (chatThreads.data?.threads.filter((x) => x.awaitingReply).length ?? 0) + ((resetRequests.data?.requests ?? []).filter((r) => r.status === "pending").length), alert: actCounts.chats + actCounts.tickets + actCounts.resets },
    { id: "theme", label: t("adm.sec.theme"), isNew: true },
    { id: "settings", label: t("adm.sec.settings"), isNew: true },
  ];
  function startEdit(pr: Product) { setEditing(pr); setPform({ name: pr.name, category: pr.category, description: pr.description, basePrice: String(pr.basePrice), oldPrice: pr.oldPrice ? String(pr.oldPrice) : "", profitPercent: String(pr.profitPercent), stock: String(pr.stock) }); setShowForm(true); }
  function startNew() { setEditing(null); setPform({ name: "", category: "Electronics", description: "", basePrice: "", oldPrice: "", profitPercent: String(settings?.defaultProfitPercent ?? 20), stock: "50" }); setShowForm(true); }
  const finForApp = (a: SellerApplication) => ({ availableBalance: a.walletBalance, totalBalance: a.totalBalance, pendingOrderHolds: a.pendingOrderHolds, usedAmount: a.usedAmount, pendingWithdrawal: a.pendingWithdrawal, pendingDeposit: a.pendingDeposit, pendingOrderEarnings: a.pendingOrderEarnings, totalPending: a.totalPending, totalOrderValue: a.totalOrderValue, orderCount: a.orderCount, totalDeposited: a.totalDeposited, totalWithdrawn: a.totalWithdrawn, totalAdminCredit: a.totalAdminCredit, earningsCleared: a.earnings });
  const bulkErrsNow = bulkTouched ? bulkErrors() : [];
  const bulkErrFor = (key: string) => bulkErrsNow.find((e) => e.key === key)?.msg;
  const bulkLast = (bulkHistory.data?.history ?? [])[0] ?? null;

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-[var(--text)]">{t("adm.title")} — {settings?.storeName ?? "sheinstore"}</h2>
      {deleteMsg && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{deleteMsg}</p>}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <nav aria-label={t("adm.title")} className="scrollbar-none flex shrink-0 gap-1.5 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:w-56 lg:flex-col lg:overflow-visible">
          {sections.map((s) => (
            <button key={s.id} type="button" aria-label={s.label} aria-current={section === s.id ? "page" : undefined} onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold ${section === s.id ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}>
              <span className="flex-1">{s.label}</span>
              {s.isNew && <NewBadge id={`sec-nav-${s.id}`} />}
              {s.alert !== undefined && s.alert > 0 && <span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-[11px] font-bold text-white">{s.alert}</span>}
              {s.badge !== undefined && s.badge > 0 && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${section === s.id ? "bg-white text-[var(--accent)]" : "bg-[var(--surface-alt)] text-[var(--dim)]"}`}>{s.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {section === "overview" && (<div>
            <div className="rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">
                🔔 {t("act.title")}
                {actCounts.total > 0 && <span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-xs font-bold text-white">{actCounts.total} {t("act.newCount")}</span>}
                <NewBadge />
              </h3>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("act.sub")}</p>
              {activity.isPending ? (
                <p className="mt-2 text-sm text-[var(--dim)]">{t("common.loading")}</p>
              ) : (activity.data?.events ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-[var(--dim)]">{t("act.none")}</p>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  {(activity.data?.events ?? []).map((ev) => {
                    const icon = ev.kind === "order" ? "🛒" : ev.kind === "chat" ? "💬" : ev.kind === "wallet" ? "👛" : ev.kind === "ticket" ? "🎫" : "🔑";
                    const what = ev.kind === "order" ? t("act.placedOrder") : ev.kind === "chat" ? t("act.sentChat") : ev.kind === "wallet" ? t("act.walletReq") : ev.kind === "ticket" ? t("act.openedTicket") : t("act.askedReset");
                    const hkey = `${ev.kind}:${ev.refId}`;
                    return (
                      <div key={hkey} className={`rounded-xl border px-3 py-2.5 ${ev.isNew ? "border-[var(--gold)] bg-[var(--amber-bg)] ring-1 ring-[var(--gold)]/50" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span aria-hidden>{icon}</span>
                          <strong className="text-[var(--text)]">{ev.customerName}</strong>
                          {ev.storeName && <span className="text-xs font-semibold text-[var(--dim)]">· {ev.storeName}</span>}
                          <span className="text-[var(--dim)]">{what}</span>
                          {ev.isNew && <NewBadge />}
                          <span className="ml-auto text-xs text-[var(--dim)]">{new Date(ev.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-0.5 break-words text-xs text-[var(--dim)]">{ev.loginId} · {ev.detail}{ev.amount !== null ? ` · ${fmt(ev.amount)}` : ""} · {ev.status}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <button type="button" aria-label={`Open activity for ${ev.customerName}`} onClick={() => openActivity(ev)} className={primaryBtn + " px-3 py-1 text-xs"}>{t("act.open")}</button>
                          {hideConfirmKey === hkey ? (
                            <>
                              <span className="text-xs font-semibold text-[var(--text)]">{t("act.hideQ")}</span>
                              <button type="button" aria-label="Confirm hide this activity entry" disabled={dismissActivity.isPending} onClick={() => dismissActivity.mutate({ kind: ev.kind, refId: ev.refId })} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">{t("act.confirmHide")}</button>
                              <button type="button" aria-label="Cancel hide activity entry" onClick={() => setHideConfirmKey(null)} className="text-xs font-semibold text-[var(--dim)]">{t("adm.cancel")}</button>
                            </>
                          ) : (
                            <button type="button" aria-label={`Hide activity entry for ${ev.customerName}`} onClick={() => setHideConfirmKey(hkey)} className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--dim)]">{t("act.hide")}</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-xs leading-snug text-[var(--dim)]">{t("act.noDeleteNote")}</p>
            </div>
            <h3 className="mt-6 font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.overview")}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: t("adm.sellers"), value: String(sellersCount), go: "sellers" as AdminSection },
                { label: t("adm.buyers"), value: String(buyersCount), go: "users" as AdminSection },
                { label: t("adm.products"), value: String(ov.totalProducts), go: "products" as AdminSection },
                { label: t("adm.totalOrders"), value: String(ordCounts.total), go: "orders" as AdminSection },
                { label: t("adm.completedOrders"), value: String(ordCounts.completed), go: "orders" as AdminSection },
                { label: t("adm.pendingOrders"), value: String(ordCounts.pending), go: "orders" as AdminSection },
                { label: t("adm.shippedOrders"), value: String(ordCounts.shipped), go: "orders" as AdminSection },
                { label: t("adm.revenue"), value: fmt(ov.totalRevenue), go: "orders" as AdminSection },
                { label: t("adm.profitPool"), value: fmt(ov.totalProfitPool), go: "orders" as AdminSection },
                { label: t("fin.available") + " (all sellers)", value: fmt(ov.totalWalletBalance), go: "wallet" as AdminSection },
                { label: t("fin.pending") + " (all sellers)", value: fmt(ov.totalPendingAmount), go: "wallet" as AdminSection },
                { label: t("fin.used") + " (all sellers)", value: fmt(ov.totalUsedAmount), go: "wallet" as AdminSection },
                { label: t("adm.walletRequests"), value: String(ov.pendingWalletRequests), go: "wallet" as AdminSection },
                { label: t("adm.tickets") + " (open)", value: String(ov.pendingSupport), go: "support" as AdminSection },
              ].map((s) => (<button key={s.label} type="button" aria-label={`${s.label}: ${s.value}`} onClick={() => setSection(s.go)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center"><p className="font-display text-lg font-extrabold text-[var(--text)]">{s.value}</p><p className="mt-0.5 text-xs text-[var(--dim)]">{s.label} →</p></button>))}
            </div>
            <h4 className="mt-6 font-display font-bold text-[var(--text)]">{t("adm.recentActivity")}</h4>
            {(ov.recentNotifications ?? []).length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noOrders")}</p> : <div className="mt-2 flex flex-col gap-2">{(ov.recentNotifications ?? []).map((n) => (<div key={n.id} className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"><span aria-hidden>🔔</span><strong>{n.sellerName}</strong><span className="text-[var(--dim)]">Order #{n.orderId} · {n.productName} · {fmt(n.amount)}</span><span className="ml-auto text-xs text-[var(--dim)]">{new Date(n.createdAt).toLocaleString()}</span></div>))}</div>}
          </div>)}

          {section === "sellers" && (<div>
            {!selectedSeller ? (<>
              <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.sellers")} ({apps.length}){pendingSellerCount > 0 && <span className="ml-2 rounded-full bg-[var(--gold)] px-2 py-0.5 align-middle text-xs font-bold text-[var(--gold-ink)]">⏳ {pendingSellerCount} {t("adm.pendingCount")}</span>}</h3>
              {renderResetRequests("seller", "adm.resetRequests")}
              {apps.length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noApplications")}</p> : <div className="mt-3 flex flex-col gap-3">{apps.map((a) => (<div key={a.id} className={`rounded-xl border bg-[var(--surface)] p-4 ${a.verificationStatus === "pending" ? "border-2 border-[var(--gold)] shadow-[0_0_0_3px_var(--amber-bg)]" : "border-[var(--border)]"}`}>
                <div className="flex flex-wrap items-center gap-2"><AdminSellerLogo adminId={user.id} sellerId={a.id} hasFile={a.hasLogoFile} fallbackText={a.storeName ?? a.name} /><div className="min-w-0"><strong className="text-[var(--text)]">{a.storeName ?? a.name}</strong><p className="text-xs text-[var(--dim)]">{a.name} · {a.email ?? ""}{a.phone ? ` · ${fmtPhone(a.phone, a.country)}` : ""} · {a.city ?? ""}{a.state ? `, ${a.state}` : ""}</p></div>{a.verificationStatus === "approved" ? <VerifiedBadge /> : <StatusBadge status={a.verificationStatus} />}{a.verificationStatus === "pending" && <span className="rounded-full bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]">⏳ {t("verif.pendingBadge")}</span>}{awaitingChat.has(a.id) && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--alert-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--alert)]">💬 {t("chat.waiting")}<NewBadge /></span>}<span className="ml-auto text-xs text-[var(--dim)]">{t("adm.joined")}: {new Date(a.createdAt).toLocaleDateString()}</span></div>
                <div className="mt-3"><FinanceSummary finance={finForApp(a)} compact /></div>
                <p className="mt-2 text-xs text-[var(--dim)]">{t("adm.productsInStore")}: {a.productCount} · {t("adm.orders")}: {a.orderCount} · {t("adm.totalSales")}: {fmt(a.totalSales)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" aria-label={`View seller ${a.name}`} onClick={() => { setSelectedSellerId(a.id); setSellerTab("personal"); setCreditOk(null); setCreditErr(null); setQuickQty({}); setQuickErr(null); setQuickOk(null); setNoticeResult(null); setNoticeOpenOrderId(null); setNoticeGeneral(""); setVerifyMsg(null); setRejectReason(""); }} className={primaryBtn + " px-3 py-2 text-xs"}>{t("adm.viewSeller")}</button>
                  {a.verificationStatus === "pending" && <><button type="button" aria-label={`Approve seller ${a.name}`} disabled={review.isPending} onClick={() => review.mutate({ sellerId: a.id, decision: "approved" })} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">✓ {t("adm.approve")}</button><button type="button" aria-label={`Reject seller ${a.name}`} disabled={review.isPending} onClick={() => review.mutate({ sellerId: a.id, decision: "rejected" })} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">✕ {t("adm.reject")}</button></>}
                  <button type="button" aria-label={`Delete seller account ${a.name}`} onClick={() => setDeleteTarget({ id: a.id, role: "seller", title: a.name, detail: `${a.storeName ?? ""} · ${a.email ?? ""} · ${a.phone ? `${fmtPhone(a.phone, a.country)}` : ""}` })} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600">🗑 {t("del.sellerBtn")}</button>
                </div>
              </div>))}</div>}
            </>) : (<>
              <button type="button" onClick={() => setSelectedSellerId(null)} className={ghostBtn + " px-3 py-2 text-xs"}>{t("adm.backToSellers")}</button>
              {/* Summary header — tidy labelled rows: every field on its own
                  line in a clean grid that wraps without overlapping, on
                  phone and desktop alike. Details live in the tabs below. */}
              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start gap-3">
                  <AdminSellerLogo adminId={user.id} sellerId={selectedSeller.id} hasFile={selectedSeller.hasLogoFile} fallbackText={selectedSeller.storeName ?? selectedSeller.name} />
                  <div className="min-w-0 flex-1">
                    <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold leading-snug text-[var(--text)]">{selectedSeller.storeName ?? selectedSeller.name}{selectedSeller.verificationStatus === "approved" && <VerifiedBadge />}</h3>
                    <p className="mt-0.5 break-words text-sm font-medium text-[var(--text)]">{selectedSeller.name}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 border-t border-[var(--border)] pt-3 min-[520px]:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("adm.loginId")}</dt>
                    <dd className="mt-0.5 break-all text-sm font-semibold text-[var(--text)]">{selectedSeller.email ?? (selectedSeller.phone ? `${fmtPhone(selectedSeller.phone, selectedSeller.country)}` : "—")}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("sa.phone")}</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--text)]">{selectedSeller.phone ? `${fmtPhone(selectedSeller.phone, selectedSeller.country)}` : "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("adm.joined")}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-[var(--text)]">{new Date(selectedSeller.createdAt).toLocaleDateString()}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("sd.verification")}</dt>
                    <dd className="mt-1"><StatusBadge status={selectedSeller.verificationStatus} /></dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("adm.walletBalance")}</dt>
                    <dd className="mt-0.5 font-display text-base font-extrabold text-[var(--text)]">{fmt(selectedSeller.walletBalance)}</dd>
                  </div>
                </dl>
              </div>
              {/* Section tabs — only ONE section's content shows at a time */}
              <div className="scrollbar-none mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={selectedSeller.storeName ?? selectedSeller.name}>
                {([
                  { id: "personal", label: t("tab.personal") },
                  { id: "orders", label: `${t("tab.orders")} (${(sellerOrdersAdmin.data?.orders ?? []).length})` },
                  { id: "products", label: `${t("tab.products")} (${selectedSellerPicks.length})` },
                  { id: "wallet", label: t("tab.wallet") },
                  { id: "chat", label: t("tab.chat") },
                ] as Array<{ id: SellerDetailTab; label: string }>).map((tb) => (
                  <button key={tb.id} type="button" role="tab" aria-selected={sellerTab === tb.id} aria-label={tb.label} onClick={() => setSellerTab(tb.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${sellerTab === tb.id ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}>
                    {tb.label}
                    {tb.id === "orders" && (sellerOrdersAdmin.data?.orders ?? []).some((o) => o.status === "Pending") && <span className="rounded-full bg-[var(--alert)] px-1.5 py-0.5 text-[10px] font-bold text-white">{(sellerOrdersAdmin.data?.orders ?? []).filter((o) => o.status === "Pending").length}</span>}
                    {tb.id === "chat" && awaitingChat.has(selectedSeller.id) && <span className="rounded-full bg-[var(--alert)] px-1.5 py-0.5 text-[10px] font-bold text-white">●</span>}
                  </button>
                ))}
              </div>
              {sellerTab === "personal" && (<div role="tabpanel">
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><h4 className="font-display font-bold">{t("sa.step1")}</h4><dl className="mt-2 flex flex-col gap-1 text-sm">{[[t("acc.country"), selectedSeller.country ?? t("acc.notSet")], [t("sa.phone"), selectedSeller.phone], [t("sa.dob"), selectedSeller.dateOfBirth], [t("sa.address"), selectedSeller.address], [t("sa.city"), selectedSeller.city], [t("sa.state"), selectedSeller.state], [t("sa.pin"), selectedSeller.pinCode]].filter(([, v]) => v).map(([k, v]) => (<div key={k} className="flex gap-2"><dt className="shrink-0 text-[var(--dim)]">{k}:</dt><dd className="break-words">{v}</dd></div>))}</dl></div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><h4 className="font-display font-bold">{t("sa.step2")}</h4><dl className="mt-2 flex flex-col gap-1 text-sm">{[[t("sa.storeDesc"), selectedSeller.storeDescription], [t("sa.storeAddress"), selectedSeller.storeAddress], [t("sa.businessType"), selectedSeller.businessType], [t("sa.gst"), selectedSeller.gstNumber], [t("sa.docType"), selectedSeller.docType], [t("sa.docNumber"), selectedSeller.docNumber]].filter(([, v]) => v).map(([k, v]) => (<div key={k} className="flex gap-2"><dt className="shrink-0 text-[var(--dim)]">{k}:</dt><dd className="break-words">{v}</dd></div>))}</dl></div>
              </div>
              <h4 className="mt-5 font-display font-bold text-[var(--text)]">{t("adm.documents")}</h4>
              <p className="mt-1 text-xs text-[var(--dim)]">{t("adm.docSecureNote")}</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <SellerDocCard adminId={user.id} sellerId={selectedSeller.id} kind="photo" label={t("sd.photoFile")} fileName={selectedSeller.photoFileName} hasFile={selectedSeller.hasPhotoFile} contentType={selectedSeller.photoContentType} size={selectedSeller.photoSize} onView={setViewer} />
                <SellerDocCard adminId={user.id} sellerId={selectedSeller.id} kind="logo" label={t("sd.logoFile")} fileName={selectedSeller.storeLogoFileName} hasFile={selectedSeller.hasLogoFile} contentType={selectedSeller.logoContentType} size={selectedSeller.logoSize} onView={setViewer} />
                <SellerDocCard adminId={user.id} sellerId={selectedSeller.id} kind="docFront" label={t("sa.docFront")} fileName={selectedSeller.docFrontFileName} hasFile={selectedSeller.hasDocFrontFile} contentType={selectedSeller.docFrontContentType} size={selectedSeller.docFrontSize} onView={setViewer} />
                <SellerDocCard adminId={user.id} sellerId={selectedSeller.id} kind="docBack" label={t("sa.docBack")} fileName={selectedSeller.docBackFileName} hasFile={selectedSeller.hasDocBackFile} contentType={selectedSeller.docBackContentType} size={selectedSeller.docBackSize} onView={setViewer} />
              </div>
              <div className={`mt-5 rounded-xl border-2 p-4 ${selectedSeller.verificationStatus === "pending" ? "border-[var(--gold)] bg-[var(--amber-bg)]" : selectedSeller.verificationStatus === "approved" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-rose-400 bg-rose-50 dark:bg-rose-950/30"}`}>
                <h4 className="font-display font-bold text-[var(--text)]">🛡 {t("adm.verifyTitle")}</h4>
                {selectedSeller.verificationStatus === "approved" ? (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--text)]">{t("adm.nowVerified")} <VerifiedBadge /></p>
                ) : selectedSeller.verificationStatus === "rejected" ? (
                  <>
                    <p className="mt-1 text-sm text-[var(--text)]">{t("adm.rejectedState")}</p>
                    <button type="button" aria-label={`Approve seller ${selectedSeller.name} now`} disabled={reviewDetail.isPending} onClick={() => reviewDetail.mutate({ sellerId: selectedSeller.id, decision: "approved" })} className="mt-3 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{t("adm.verifyBtn")}</button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-[var(--text)]">{t("adm.verifySub")}</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button type="button" aria-label={`Verify and approve seller ${selectedSeller.name}`} disabled={reviewDetail.isPending} onClick={() => reviewDetail.mutate({ sellerId: selectedSeller.id, decision: "approved" })} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{t("adm.verifyBtn")}</button>
                      <button type="button" aria-label={`Reject seller ${selectedSeller.name}`} disabled={reviewDetail.isPending} onClick={() => reviewDetail.mutate({ sellerId: selectedSeller.id, decision: "rejected", reason: rejectReason.trim() || undefined })} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{t("adm.rejectBtn")}</button>
                    </div>
                    <textarea aria-label={t("adm.rejectReasonPh")} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder={t("adm.rejectReasonPh")} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
                  </>
                )}
                {verifyMsg && verifyMsg.sellerId === selectedSeller.id && <p role="status" className={`mt-2 text-sm font-semibold ${verifyMsg.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}`}>{verifyMsg.text}</p>}
              </div>
                            {renderSetUserPassword({ id: selectedSeller.id, name: selectedSeller.name })}
              <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:bg-rose-950/20">
                <button type="button" aria-label={`Delete seller account ${selectedSeller.name}`} onClick={() => setDeleteTarget({ id: selectedSeller.id, role: "seller", title: selectedSeller.name, detail: `${selectedSeller.storeName ?? ""} · ${selectedSeller.email ?? ""} · ${selectedSeller.phone ? `${fmtPhone(selectedSeller.phone, selectedSeller.country)}` : ""}` })} className="rounded-lg bg-rose-600 px-4 py-2 font-display text-sm font-bold text-white">🗑 {t("del.sellerBtn")}</button>
              </div>
              </div>)}
              {sellerTab === "orders" && (<div role="tabpanel">
              {renderSellerQuickSend(selectedSeller)}
              {renderSellerOrdersAdmin(selectedSeller)}
              </div>)}
              {sellerTab === "products" && (<div role="tabpanel">
                <h4 className="mt-4 font-display font-bold text-[var(--text)]">{t("tab.products")} — {selectedSeller.storeName ?? selectedSeller.name} ({selectedSellerPicks.length})</h4>
                {selectedSellerPicks.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">{t("qs.noProducts")}</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {selectedSellerPicks.map((r) => (
                      <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <strong className="text-sm text-[var(--text)]">{r.productName}</strong>
                          <span className="text-xs text-[var(--dim)]">{r.category}</span>
                          <span className="ml-auto font-display text-sm font-bold text-[var(--text)]">{fmt(r.sellingPrice)}</span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--dim)]">{t("sp.base")}: {fmt(r.basePrice)} · {t("sp.profitPct")}: <strong className="text-[var(--accent)]">{r.profitPercent}%</strong> (+{fmt(r.profitAmount)}) · {t("qs.stock")}: {r.stock} · {t("sp.addedOn")}: {new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>)}
              {sellerTab === "wallet" && (<div role="tabpanel">
              <h4 className="mt-5 font-display font-bold text-[var(--text)]">{t("adm.walletBalance")}: {fmt(selectedSeller.walletBalance)}</h4>
              <div className="mt-2"><FinanceSummary finance={finForApp(selectedSeller)} /></div>
              {renderWalletStatement()}
              {sellerFinance.data ? <FinanceOrdersLedger finance={sellerFinance.data} /> : <p className="mt-2 text-sm text-[var(--dim)]">{t("common.loading")}</p>}
              <form className="mt-5 rounded-xl border-2 border-[var(--accent)]/25 bg-[var(--surface)] p-4" onSubmit={(e) => { e.preventDefault(); setCreditOk(null); const amt = parseFloat(creditAmount) || 0; if (!(amt > 0)) { setCreditErr("Amount must be more than zero — please enter a valid amount."); return; } setCreditErr(null); credit.mutate(); }}>
                <h4 className="font-display font-bold text-[var(--text)]">💰 {t("adm.addAmount")}</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={`${t("w.amount")} (${currency})`}><input type="number" min={0} step="any" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className={inputCls} aria-label="Amount to add to seller wallet" /></Field>
                  <Field label={t("adm.addAmountNote")}><input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} className={inputCls} aria-label="Reason for adding amount" /></Field>
                </div>
                {creditErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {creditErr}</p>}
                {creditOk && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">✓ {creditOk}</p>}
                <button type="submit" disabled={credit.isPending} className={primaryBtn + " mt-3"}>{t("adm.addAmountBtn")}</button>
              </form>
              <form className="mt-4 rounded-xl border-2 border-rose-400/40 bg-[var(--surface)] p-4" onSubmit={(e) => { e.preventDefault(); setAwOk(null); const amt = toInr(parseFloat(awAmount) || 0, currency); if (!(amt > 0)) { setAwErr("Amount must be more than zero — please enter the amount to withdraw."); setAwReview(false); return; } if (!awNote.trim()) { setAwErr("Please write a short note / reason for this withdrawal — the customer sees it in the notice."); setAwReview(false); return; } const bal = sellerFinance.data?.availableBalance ?? selectedSeller.walletBalance; if (amt > bal) { setAwErr(`Not enough wallet balance for this withdrawal: it needs ${fmt(amt)} but the available balance is ${fmt(bal)}.`); setAwReview(false); return; } setAwErr(null); setAwReview(true); }}>
                <h4 className="font-display font-bold text-[var(--text)]">🏦 {t("wp.adminWithdraw")}</h4>
                <p className="mt-1 text-xs leading-snug text-[var(--dim)]">{t("wp.adminWithdrawSub")}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={`${t("w.amount")} (${currency})`}><input type="number" min={0} step="any" value={awAmount} onChange={(e) => { setAwAmount(e.target.value); setAwReview(false); }} className={inputCls} aria-label="Amount to withdraw from seller wallet" /></Field>
                  <Field label={t("wp.noteReason")}><input value={awNote} onChange={(e) => { setAwNote(e.target.value); setAwReview(false); }} className={inputCls} aria-label="Reason for admin withdrawal" /></Field>
                </div>
                {awErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {awErr}</p>}
                {awOk && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">✓ {awOk}</p>}
                {!awReview ? (
                  <button type="submit" disabled={adminWithdraw.isPending} className="mt-3 rounded-lg bg-rose-600 px-4 py-2 font-display text-sm font-bold text-white disabled:opacity-50">{t("wp.reviewWithdraw")}</button>
                ) : (
                  <div className="mt-3 rounded-xl border-2 border-rose-400/50 bg-rose-50 p-3 dark:bg-rose-950/20" role="group" aria-label={t("wp.adminWithdraw")}>
                    <dl className="flex flex-col gap-1.5 text-sm">
                      <div className="flex flex-wrap gap-x-2"><dt className="text-[var(--dim)]">{t("wp.customer")}:</dt><dd className="font-semibold text-[var(--text)]">{selectedSeller.name}{selectedSeller.storeName ? ` · ${selectedSeller.storeName}` : ""}</dd></div>
                      <div className="flex flex-wrap gap-x-2"><dt className="text-[var(--dim)]">{t("fin.available")}:</dt><dd className="font-display font-bold text-[var(--text)]">{fmt(sellerFinance.data?.availableBalance ?? selectedSeller.walletBalance)}</dd></div>
                      <div className="flex flex-wrap gap-x-2"><dt className="text-[var(--dim)]">{t("wp.deduct")}:</dt><dd className="font-display font-bold text-[var(--text)]">− {fmt(toInr(parseFloat(awAmount) || 0, currency))}</dd></div>
                      <div className="flex flex-wrap gap-x-2"><dt className="text-[var(--dim)]">{t("wp.afterBalance")}:</dt><dd className="font-display font-bold text-[var(--text)]">{fmt((sellerFinance.data?.availableBalance ?? selectedSeller.walletBalance) - toInr(parseFloat(awAmount) || 0, currency))}</dd></div>
                      <div className="flex flex-wrap gap-x-2"><dt className="text-[var(--dim)]">{t("wp.noteReason")}:</dt><dd className="font-semibold text-[var(--text)]">{awNote}</dd></div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" aria-label="Confirm admin withdrawal from seller wallet" disabled={adminWithdraw.isPending} onClick={() => adminWithdraw.mutate()} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">✓ {t("wp.confirmWithdraw")}</button>
                      <button type="button" aria-label="Cancel admin withdrawal" disabled={adminWithdraw.isPending} onClick={() => setAwReview(false)} className={ghostBtn + " px-3 py-2 text-sm"}>{t("adm.cancel")}</button>
                    </div>
                  </div>
                )}
              </form>
                <h4 className="mt-5 font-display font-bold text-[var(--text)]">{t("adm.walletRequests")} ({(walletRequests.data?.requests ?? []).filter((r) => r.sellerId === selectedSeller.id && r.status === "pending").length} pending)</h4>
                {payOk && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">✓ {payOk}</p>}
                {(walletRequests.data?.requests ?? []).filter((r) => r.sellerId === selectedSeller.id).length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noWalletRequests")}</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {(walletRequests.data?.requests ?? []).filter((r) => r.sellerId === selectedSeller.id).map((r) => (
                      <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span aria-hidden>{r.type === "deposit" ? "⬇️" : r.type === "admin_credit" ? "💰" : "⬆️"}</span>
                          <strong className="text-[var(--text)]">{r.type === "deposit" ? t("w.typeDeposit") : r.type === "admin_credit" ? t("w.typeAdminCredit") : r.type === "admin_withdraw" ? t("wp.typeAdminWithdrawRow") : t("w.typeWithdraw")} · {fmt(r.amount)}</strong>
                          <StatusBadge status={r.status} />
                          <span className="ml-auto text-xs text-[var(--dim)]">{new Date(r.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--dim)]">{r.method}{r.reference ? ` · ${r.reference}` : ""}{r.details ? ` · ${r.details}` : ""}{r.note ? ` · ${r.note}` : ""}{r.hasScreenshot ? ` · 📷 ${t("dep.shotAttached")}` : ""}</p>
                        {r.hasScreenshot && <div className="mt-1.5"><DepositScreenshotView txId={r.id} adminId={user.id} /></div>}
                        {r.status === "paid" && (
                          <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">✓ {t("status.paid")}{r.paidAt ? ` · ${t("wp.paidOn")}: ${new Date(r.paidAt).toLocaleString()}` : ""}{r.paymentReference ? ` · ${t("wp.paymentRefWord")}: ${r.paymentReference}` : ""}</p>
                        )}
                        {r.status === "pending" && r.type === "withdraw" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" aria-label={`Pay and withdraw wallet request ${r.id}`} disabled={payWithdraw.isPending} onClick={() => { setPayTargetId(payTargetId === r.id ? null : r.id); setPayErr(null); setPayOk(null); setPayRef(""); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">💸 {t("wp.payBtn")}</button>
                            <button type="button" aria-label={`Reject wallet request ${r.id}`} disabled={reviewWallet.isPending} onClick={() => reviewWallet.mutate({ txId: r.id, decision: "reject" })} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">✕ {t("adm.reject")}</button>
                          </div>
                        )}
                        {r.status === "pending" && r.type !== "withdraw" && (
                          <div className="mt-2 flex gap-2">
                            <button type="button" aria-label={`Approve wallet request ${r.id}`} disabled={reviewWallet.isPending} onClick={() => reviewWallet.mutate({ txId: r.id, decision: "approve" })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">✓ {t("adm.approve")}</button>
                            <button type="button" aria-label={`Reject wallet request ${r.id}`} disabled={reviewWallet.isPending} onClick={() => reviewWallet.mutate({ txId: r.id, decision: "reject" })} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">✕ {t("adm.reject")}</button>
                          </div>
                        )}
                        {payTargetId === r.id && r.status === "pending" && r.type === "withdraw" && (
                          <PayWithdrawPanel request={r} paymentRef={payRef} onPaymentRefChange={setPayRef} busy={payWithdraw.isPending} error={payErr} onConfirm={() => payWithdraw.mutate({ txId: r.id, paymentReference: payRef })} onCancel={() => { setPayTargetId(null); setPayErr(null); }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>)}
              {sellerTab === "chat" && (<div role="tabpanel">
                            <CustomerChatPanel adminId={user.id} userId={selectedSeller.id} customerName={selectedSeller.storeName ?? selectedSeller.name} />
              </div>)}
            </>)}
          </div>)}

          {section === "users" && (<div>
            {selectedBuyer ? (<>
              <button type="button" onClick={() => setSelectedBuyerId(null)} className={ghostBtn + " px-3 py-2 text-xs"}>{t("adm.backToUsers")}</button>
              {/* Summary header — tidy labelled rows in a clean grid,
                  nothing crammed onto one line. Details live in the tabs. */}
              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-display text-lg font-extrabold text-[var(--accent)]">{selectedBuyer.name.charAt(0).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-bold leading-snug text-[var(--text)]">{selectedBuyer.name}</h3>
                    <p className="mt-0.5 text-sm text-[var(--dim)]">{t("adm.sec.users")}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 border-t border-[var(--border)] pt-3 min-[520px]:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("adm.loginId")}</dt>
                    <dd className="mt-0.5 break-all text-sm font-semibold text-[var(--text)]">{selectedBuyer.email ?? (selectedBuyer.phone ? `${fmtPhone(selectedBuyer.phone, selectedBuyer.country)}` : "—")}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("sa.phone")}</dt>
                    <dd className="mt-0.5 break-words text-sm font-semibold text-[var(--text)]">{selectedBuyer.phone ? `${fmtPhone(selectedBuyer.phone, selectedBuyer.country)}` : "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("adm.buyerOrders")}</dt>
                    <dd className="mt-0.5 font-display text-base font-extrabold text-[var(--text)]">{buyerStatById.get(selectedBuyer.id)?.orderCount ?? 0}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--dim)]">{t("adm.buyerSpent")}</dt>
                    <dd className="mt-0.5 font-display text-base font-extrabold text-[var(--text)]">{fmt(buyerStatById.get(selectedBuyer.id)?.totalSpent ?? 0)}</dd>
                  </div>
                </dl>
              </div>
              {/* Section tabs — only ONE section's content shows at a time */}
              <div className="scrollbar-none mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={selectedBuyer.name}>
                {([
                  { id: "personal", label: t("tab.personal") },
                  { id: "orders", label: `${t("tab.orders")} (${selectedBuyerOrders.length})` },
                  { id: "chat", label: t("tab.chat") },
                ] as Array<{ id: BuyerDetailTab; label: string }>).map((tb) => (
                  <button key={tb.id} type="button" role="tab" aria-selected={buyerTab === tb.id} aria-label={tb.label} onClick={() => setBuyerTab(tb.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${buyerTab === tb.id ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}>
                    {tb.label}
                    {tb.id === "chat" && awaitingChat.has(selectedBuyer.id) && <span className="rounded-full bg-[var(--alert)] px-1.5 py-0.5 text-[10px] font-bold text-white">●</span>}
                  </button>
                ))}
              </div>
              {buyerTab === "personal" && (<div role="tabpanel">
                <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <h4 className="font-display font-bold text-[var(--text)]">{t("tab.personal")}</h4>
                  <dl className="mt-2 flex flex-col gap-1 text-sm">
                    {[[t("sa.fullName"), selectedBuyer.name], [t("acc.country"), selectedBuyer.country ?? t("acc.notSet")], [t("adm.loginId"), selectedBuyer.email ?? (selectedBuyer.phone ? `${fmtPhone(selectedBuyer.phone, selectedBuyer.country)}` : null)], [t("sa.phone"), selectedBuyer.phone ? `${fmtPhone(selectedBuyer.phone, selectedBuyer.country)}` : null], ["Gmail", selectedBuyer.email]].filter(([, v]) => v).map(([k, v]) => (<div key={k} className="flex gap-2"><dt className="shrink-0 text-[var(--dim)]">{k}:</dt><dd className="break-words">{v}</dd></div>))}
                  </dl>
                </div>
                {renderSetUserPassword({ id: selectedBuyer.id, name: selectedBuyer.name })}
                <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:bg-rose-950/20">
                  <button type="button" aria-label={`Delete buyer account ${selectedBuyer.name}`} onClick={() => setDeleteTarget({ id: selectedBuyer.id, role: "buyer", title: selectedBuyer.name, detail: `${selectedBuyer.email ?? ""} · ${selectedBuyer.phone ? `${fmtPhone(selectedBuyer.phone, selectedBuyer.country)}` : ""}` })} className="rounded-lg bg-rose-600 px-4 py-2 font-display text-sm font-bold text-white">🗑 {t("del.buyerBtn")}</button>
                </div>
              </div>)}
              {buyerTab === "orders" && (<div role="tabpanel">
                <h4 className="mt-4 font-display font-bold text-[var(--text)]">{t("buyer.ordersHead")} ({selectedBuyerOrders.length})</h4>
                {selectedBuyerOrders.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--dim)]">{t("buyer.noOrders")}</p>
                ) : (
                  <div className="mt-2 flex flex-col gap-3">
                    {selectedBuyerOrders.map((o) => (
                      <div key={o.id}>
                        <OrderCard order={o} codActor={{ role: "admin", id: user.id }} />
                        {o.hasPaymentProof && <div className="px-1 pt-1.5"><OrderPaymentProofView orderId={o.id} adminId={user.id} /></div>}
                        {o.paymentStatus === "pending" ? (
                          <div className="px-1">{renderPaymentGate(o)}</div>
                        ) : (
                          <div className="mt-1 flex items-center gap-2 px-1">
                            <label htmlFor={`buyer-status-${o.id}`} className="text-xs font-medium text-[var(--dim)]">{t("adm.statusWord")}</label>
                            <select id={`buyer-status-${o.id}`} value={o.status} aria-label={`Change status of order ${o.id}`} onChange={(e) => setStatus.mutate({ orderId: o.id, status: e.target.value as (typeof ORDER_STATUSES)[number] })} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm">{ORDER_STATUSES.map((s) => (<option key={s}>{s}</option>))}</select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>)}
              {buyerTab === "chat" && (<div role="tabpanel">
                <CustomerChatPanel adminId={user.id} userId={selectedBuyer.id} customerName={selectedBuyer.name} />
              </div>)}
            </>) : (<>
            <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.users")} ({ov.users.length})</h3>
            {renderResetRequests("buyer", "adm.resetRequests")}
            <div className="mt-3 flex flex-col gap-2">{ov.users.map((u) => { const st = buyerStatById.get(u.id); return (<div key={u.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2"><strong className="text-[var(--text)]">{u.name}</strong><span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold capitalize">{u.role}</span>{u.role === "seller" && <StatusBadge status={u.verificationStatus} />}{awaitingChat.has(u.id) && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--alert-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--alert)]">💬 {t("chat.waiting")}<NewBadge /></span>}<span className="ml-auto text-xs text-[var(--dim)]">{u.email ?? ""}{u.phone ? ` · ${fmtPhone(u.phone, u.country)}` : ""}</span></div>
              {u.storeName && <p className="mt-1 text-xs text-[var(--dim)]">{t("acc.storeWord")}: {u.storeName}</p>}
              {u.role === "buyer" && <p className="mt-1 text-xs text-[var(--dim)]">{t("adm.buyerOrders")}: {st?.orderCount ?? 0} · {t("adm.buyerSpent")}: {fmt(st?.totalSpent ?? 0)}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {u.role === "buyer" && <button type="button" aria-label={`View buyer ${u.name}`} onClick={() => { setSelectedBuyerId(u.id); setBuyerTab("personal"); }} className={primaryBtn + " px-3 py-1.5 text-xs"}>{t("adm.viewBuyer")}</button>}
                {u.role === "buyer" && <button type="button" aria-label={`Open chat with ${u.name}`} onClick={() => { setSelectedBuyerId(u.id); setBuyerTab("chat"); }} className={ghostBtn + " px-3 py-1.5 text-xs"}>💬 {t("chat.openBtn")}{awaitingChat.has(u.id) ? " ●" : ""}</button>}
                {u.role === "seller" && <button type="button" aria-label={`Open chat with ${u.name}`} onClick={() => { setSection("sellers"); setSelectedSellerId(u.id); setSellerTab("chat"); }} className={ghostBtn + " px-3 py-1.5 text-xs"}>💬 {t("chat.openBtn")}{awaitingChat.has(u.id) ? " ●" : ""}</button>}
                {u.role === "seller" && <button type="button" aria-label={`Open seller ${u.name}`} onClick={() => { setSection("sellers"); setSelectedSellerId(u.id); setSellerTab("personal"); setQuickQty({}); setQuickErr(null); setQuickOk(null); setNoticeResult(null); setNoticeOpenOrderId(null); }} className={primaryBtn + " px-3 py-1.5 text-xs"}>{t("adm.viewSeller")}</button>}
                {u.role === "buyer" && <button type="button" aria-label={`Delete buyer account ${u.name}`} onClick={() => setDeleteTarget({ id: u.id, role: "buyer", title: u.name, detail: `${u.email ?? ""} · ${u.phone ? `${fmtPhone(u.phone, u.country)}` : ""}` })} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-600">🗑 {t("del.buyerBtn")}</button>}
                {u.role === "seller" && <button type="button" aria-label={`Delete seller account ${u.name}`} onClick={() => { const a = apps.find((x) => x.id === u.id); setDeleteTarget({ id: u.id, role: "seller", title: u.name, detail: `${a?.storeName ?? u.storeName ?? ""} · ${u.email ?? ""} · ${u.phone ? `${fmtPhone(u.phone, u.country)}` : ""}` }); }} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-600">🗑 {t("del.sellerBtn")}</button>}
              </div>
            </div>); })}</div>
            </>)}
          </div>)}

          {section === "products" && (<div>
            <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold text-[var(--text)]">{t("adm.products")} ({products.data?.products.length ?? 0})</h3><button type="button" onClick={startNew} className={primaryBtn}>{t("adm.addProduct")}</button></div>
            {renderPriceRefreshCard()}
            {renderBulkGenerateCard()}
            {/* Bulk Profit % lives in its own Profit % section now */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--amber-bg)] px-4 py-3">
              <span aria-hidden className="text-xl">📊</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-sm font-bold text-[var(--text)]">{t("bulk.title")} <NewBadge id="bulk-card" /></p>
                <p className="mt-0.5 text-xs text-[var(--dim)]">{t("bulk.movedNote")}</p>
              </div>
              <button type="button" onClick={() => setSection("profit")} aria-label={t("bulk.openSection")} className={primaryBtn + " px-3 py-2 text-xs"}>{t("bulk.openSection")}</button>
            </div>
            {showForm && (<form className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); upsert.mutate(); }}>
              <Field label={t("adm.pName")}><input required value={pform.name} onChange={(e) => setPform({ ...pform, name: e.target.value })} className={inputCls} aria-label="Product name" /></Field>
              <Field label={t("adm.pCategory")}><select value={pform.category} onChange={(e) => setPform({ ...pform, category: e.target.value })} className={inputCls} aria-label="Product category">{CATEGORIES.filter((c) => c !== "All").map((c) => (<option key={c}>{c}</option>))}</select></Field>
              <div className="sm:col-span-2"><Field label={t("adm.pDesc")}><textarea value={pform.description} onChange={(e) => setPform({ ...pform, description: e.target.value })} rows={2} className={inputCls} aria-label="Product description" /></Field></div>
              <Field label={t("adm.pBase")}><input required type="number" min={1} value={pform.basePrice} onChange={(e) => setPform({ ...pform, basePrice: e.target.value })} className={inputCls} aria-label="Base price in rupees" /></Field>
              <Field label={t("adm.pOld")}><input type="number" min={0} value={pform.oldPrice} onChange={(e) => setPform({ ...pform, oldPrice: e.target.value })} className={inputCls} aria-label="Old price in rupees" /></Field>
              <Field label={t("adm.pProfit")}><input required type="number" min={0} max={200} value={pform.profitPercent} onChange={(e) => setPform({ ...pform, profitPercent: e.target.value })} className={inputCls} aria-label="Profit percent" /></Field>
              <Field label={t("adm.pStock")}><input required type="number" min={0} value={pform.stock} onChange={(e) => setPform({ ...pform, stock: e.target.value })} className={inputCls} aria-label="Stock quantity" /></Field>
              {pform.basePrice && <p className="text-sm text-[var(--dim)] sm:col-span-2">{t("adm.preview")} {fmt(parseInt(pform.basePrice, 10) || 0)} + {fmt(Math.round(((parseInt(pform.basePrice, 10) || 0) * (parseInt(pform.profitPercent, 10) || 0)) / 100))} = {t("adm.buyerPriceEq")} <strong className="text-[var(--text)]">{fmt((parseInt(pform.basePrice, 10) || 0) + Math.round(((parseInt(pform.basePrice, 10) || 0) * (parseInt(pform.profitPercent, 10) || 0)) / 100))}</strong></p>}
              <div className="flex gap-2 sm:col-span-2"><button type="submit" disabled={upsert.isPending} className={primaryBtn}>{editing ? t("adm.saveChanges") : t("adm.addProduct")}</button><button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className={ghostBtn}>{t("adm.cancel")}</button></div>
              {upsert.error && <p className="text-sm text-rose-600 sm:col-span-2">{String(upsert.error)}</p>}
            </form>)}
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("bgen.srcAll")}>
              {(["all", "curated", "bulk"] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={prodSourceFilter === f} aria-label={t(f === "all" ? "bgen.srcAll" : f === "curated" ? "bgen.srcCurated" : "bgen.srcBulk")} onClick={() => setProdSourceFilter(f)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${prodSourceFilter === f ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]" : "border-[var(--border)]"}`}>
                  {t(f === "all" ? "bgen.srcAll" : f === "curated" ? "bgen.srcCurated" : "bgen.srcBulk")} ({f === "all" ? (products.data?.products.length ?? 0) : (products.data?.products ?? []).filter((p) => (p.source ?? "curated") === f).length})
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2">{(products.data?.products ?? []).filter((pr) => prodSourceFilter === "all" || (pr.source ?? "curated") === prodSourceFilter).map((pr) => (<div key={pr.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"><ProductImage product={pr} /></div><div className="min-w-[9rem] flex-1"><p className="line-clamp-2 text-sm font-semibold text-[var(--text)] sm:line-clamp-1">{pr.name}{pr.source === "bulk" && <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 align-middle text-[10px] font-bold text-[var(--accent-strong)]">{t("bgen.badge")}</span>}</p><p className="text-xs text-[var(--dim)]">{pr.category} · {t("shop.base")} {fmt(pr.basePrice)} · {fmt(pr.buyerPrice)} · {t("sd.profit")} {pr.profitPercent}% · {t("shop.stock")} {pr.stock}</p></div><button type="button" aria-label={`Edit ${pr.name}`} onClick={() => startEdit(pr)} className="px-2 py-2 text-sm font-semibold text-[var(--accent)]">{t("adm.edit")}</button>{confirmDeleteId === pr.id ? <><button type="button" aria-label={`Confirm delete ${pr.name}`} onClick={() => { delProduct.mutate(pr.id); setConfirmDeleteId(null); }} className="rounded-md bg-rose-600 px-2 py-2 text-sm font-semibold text-white">{t("adm.confirmQ")}</button><button type="button" aria-label={`Cancel delete ${pr.name}`} onClick={() => setConfirmDeleteId(null)} className="px-2 py-2 text-sm font-semibold text-[var(--dim)]">{t("adm.cancel")}</button></> : <button type="button" aria-label={`Delete ${pr.name}`} onClick={() => setConfirmDeleteId(pr.id)} className="px-2 py-2 text-sm font-semibold text-rose-600">{t("adm.delete")}</button>}</div>))}</div>
          </div>)}

          {section === "external" && (<div>
            <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">🌐 {t("adm.sec.external")} ({extAdminList.data?.products.length ?? 0}) <NewBadge id="sec-external" /></h3>
            <p className="mt-1 max-w-2xl text-sm leading-snug text-[var(--dim)]">Products shown in the store's “Shop from Other Platforms” section. They are sold on the merchant's own website — visitors click through and buy there, never on sheinstore. Paste any real product URL here, including an Amazon product page — no Amazon API is needed. Prices are as listed on the merchant's site; the visitor sees the final price there.</p>
            <div className="mt-3">
              <SwitchRow label="External Products section" note="ON: visitors see “Shop from Other Platforms” on the home page and in the menu. OFF: the section is hidden from visitors entirely (products are kept)." checked={extAdminList.data?.enabled ?? true} onToggle={() => extToggle.mutate(!(extAdminList.data?.enabled ?? true))} switchLabel="Toggle External Products section on or off" />
            </div>
            {extErr && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">⚠ {extErr}</p>}
            {extOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {extOk}</p>}
            {!extShowForm && (
              <button type="button" aria-label="Add a new external product" onClick={extStartNew} className={primaryBtn + " mt-4"}>+ Add External Product</button>
            )}
            {extShowForm && (
              <form className="mt-4 rounded-2xl border-2 border-[var(--accent)]/30 bg-[var(--surface)] p-4" onSubmit={(e) => { e.preventDefault(); const err = extClientError(); if (err) { setExtErr(err); setExtOk(null); return; } setExtErr(null); extUpsert.mutate(); }}>
                <h4 className="font-display font-bold text-[var(--text)]">{extEditing ? `Edit — ${extEditing.name}` : "Add External Product"}</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Product Name"><input value={extForm.name} onChange={(e) => setExtForm({ ...extForm, name: e.target.value })} className={inputCls} aria-label="External product name" placeholder="e.g. Sony WH-1000XM5 Wireless Headphones" /></Field>
                  <Field label="Brand"><input value={extForm.brand} onChange={(e) => setExtForm({ ...extForm, brand: e.target.value })} className={inputCls} aria-label="External product brand" placeholder="e.g. Sony" /></Field>
                  <Field label="Category"><input value={extForm.category} onChange={(e) => setExtForm({ ...extForm, category: e.target.value })} className={inputCls} aria-label="External product category" placeholder="Mobiles / Audio / Fashion / Beauty" list="ext-category-list" /><datalist id="ext-category-list"><option value="Mobiles" /><option value="Audio" /><option value="Fashion" /><option value="Beauty" /><option value="Electronics" /><option value="Home & Kitchen" /></datalist></Field>
                  <Field label="Price (INR ₹)"><input type="number" min={0} step={1} value={extForm.priceInr} onChange={(e) => setExtForm({ ...extForm, priceInr: e.target.value })} className={inputCls} aria-label="External product price in INR" placeholder="e.g. 6990" /></Field>
                  <Field label="Merchant Name"><input value={extForm.merchant} onChange={(e) => setExtForm({ ...extForm, merchant: e.target.value })} className={inputCls} aria-label="External product merchant name" placeholder="e.g. Amazon, Flipkart, Myntra" /></Field>
                  <Field label="Product URL"><input value={extForm.productUrl} onChange={(e) => setExtForm({ ...extForm, productUrl: e.target.value })} className={inputCls} aria-label="External product URL" placeholder="https://…" /></Field>
                </div>
                <p className="mt-2 text-xs leading-snug text-[var(--dim)]">The button on the visitor's card reads “View on {'{Merchant}'} ↗” and opens this URL in a new tab. Paste the merchant's real product page — for Amazon, open the product on amazon.in and copy its address.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="submit" disabled={extUpsert.isPending} className={primaryBtn}>{extEditing ? "Save Changes" : "Add Product"}</button>
                  <button type="button" aria-label="Cancel editing external product" onClick={() => { setExtShowForm(false); setExtEditing(null); }} className={ghostBtn}>{t("adm.cancel")}</button>
                </div>
              </form>
            )}
            {extAdminList.isPending ? (
              <p className="mt-4 text-sm text-[var(--dim)]">{t("common.loading")}</p>
            ) : (extAdminList.data?.products ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-[var(--dim)]">No external products yet — add the first one above.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {(extAdminList.data?.products ?? []).map((p) => {
                  let host = p.productUrl;
                  try { host = new URL(p.productUrl).hostname; } catch { /* keep raw */ }
                  return (
                    <div key={p.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <strong className="text-sm text-[var(--text)]">{p.name}</strong>
                        <span className="text-xs text-[var(--dim)]">{p.category}</span>
                        <span className="ml-auto font-display text-sm font-bold text-[var(--text)]">{fmt(p.priceInr)}</span>
                      </div>
                      <p className="mt-1 break-words text-xs text-[var(--dim)]">Brand: {p.brand} · Merchant: <strong className="text-[var(--text)]">{p.merchant}</strong> · {host}</p>
                      <p className="mt-0.5 break-all text-xs text-[var(--accent)]">{p.productUrl}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={p.productUrl} target="_blank" rel="noreferrer" aria-label={`Open ${p.name} on ${p.merchant}`} className={ghostBtn + " px-3 py-1.5 text-xs"}>Open link ↗</a>
                        <button type="button" aria-label={`Edit external product ${p.name}`} onClick={() => extStartEdit(p)} className="text-sm font-semibold text-[var(--accent)]">{t("adm.edit")}</button>
                        {extDeleteId === p.id ? (
                          <>
                            <button type="button" aria-label={`Confirm delete external product ${p.name}`} disabled={extDelete.isPending} onClick={() => extDelete.mutate(p.id)} className="rounded-md bg-rose-600 px-2 py-1 text-sm font-semibold text-white disabled:opacity-50">{t("adm.confirmQ")}</button>
                            <button type="button" aria-label={`Cancel delete external product ${p.name}`} onClick={() => setExtDeleteId(null)} className="text-sm font-semibold text-[var(--dim)]">{t("adm.cancel")}</button>
                          </>
                        ) : (
                          <button type="button" aria-label={`Delete external product ${p.name}`} onClick={() => setExtDeleteId(p.id)} className="text-sm font-semibold text-rose-600">{t("adm.delete")}</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>)}

          {section === "sellerProducts" && (<div>
            <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.sellerProducts")} ({spRows.length}) <NewBadge id="sec-seller-products" /></h3>
            <p className="mt-1 text-sm text-[var(--dim)]">{t("sp.sub")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("sp.product")}><input value={spSearch} onChange={(e) => setSpSearch(e.target.value)} placeholder={t("sp.searchPh")} className={inputCls} aria-label="Search seller products by product, seller or store" /></Field>
              <Field label={t("sp.seller")}>
                <select value={spSellerFilter} onChange={(e) => setSpSellerFilter(e.target.value)} className={inputCls} aria-label="Filter seller products by seller or store">
                  <option value="all">{t("sp.allSellers")}</option>
                  {spSellerOptions.map((r) => (<option key={r.sellerId} value={r.sellerId}>{r.storeName ?? r.sellerName} ({r.sellerName})</option>))}
                </select>
              </Field>
            </div>
            <p className="mt-3 text-sm font-semibold text-[var(--text)]">{spFiltered.length} {t("sp.items")}</p>
            {spRows.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">{t("sp.empty")}</p>
            ) : spFiltered.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">{t("sp.noMatch")}</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                {spFiltered.map((r) => (
                  <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <strong className="text-sm text-[var(--text)]">{r.productName}</strong>
                      <span className="text-xs text-[var(--dim)]">{r.category}</span>
                      <span className="ml-auto font-display text-sm font-bold text-[var(--text)]">{fmt(r.sellingPrice)}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--dim)]">
                      {t("sp.store")}: <strong className="text-[var(--text)]">{r.storeName ?? "—"}</strong> · {t("sp.seller")}: {r.sellerName} · {t("sp.base")}: {fmt(r.basePrice)} · {t("sp.profitPct")}: <strong className="text-[var(--accent)]">{r.profitPercent}%</strong> (+{fmt(r.profitAmount)}) · {t("sp.addedOn")}: {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>)}

          {section === "profit" && (<div>
            <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.profit")} — {t("bulk.title")} <NewBadge id="sec-profit" /></h3>
            {renderBulkProfitPanel()}
          </div>)}

          {section === "orders" && (<div>
            <h3 className="mt-6 font-display text-lg font-bold text-[var(--text)]">{t("adm.orders")} ({ov.orders.length}){actCounts.orders > 0 && <span className="ml-2 rounded-full bg-[var(--alert)] px-2 py-0.5 text-xs font-bold text-white">{actCounts.orders} {t("act.newCount")}</span>}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 min-[560px]:grid-cols-4" role="group" aria-label={t("adm.orders")}>
              {[
                { label: t("adm.totalOrders"), value: ordCounts.total, alert: false },
                { label: t("adm.completedOrders"), value: ordCounts.completed, alert: false },
                { label: t("adm.pendingOrders"), value: ordCounts.pending, alert: ordCounts.pending > 0 },
                { label: t("adm.shippedOrders"), value: ordCounts.shipped, alert: false },
              ].map((c) => (
                <div key={c.label} className={`rounded-xl border p-3 text-center ${c.alert ? "border-[var(--alert)] bg-[var(--alert-bg)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                  <p className="font-display text-xl font-extrabold text-[var(--text)]">{c.value}</p>
                  <p className={`mt-0.5 text-xs font-semibold ${c.alert ? "text-[var(--alert)]" : "text-[var(--dim)]"}`}>{c.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-snug text-[var(--dim)]">{t("act.noDeleteNote")}</p>
            {reviewErr && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">⚠ {reviewErr}</p>}
            {ordersByShop.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noOrders")}</p>
            ) : selectedShopGroup && !ordersShowAll ? (
              <div className="mt-3">
                <button type="button" aria-label={t("aord.backToShops")} onClick={() => setOrdersShopKey(null)} className={ghostBtn + " px-3 py-2 text-xs"}>{t("aord.backToShops")}</button>
                {/* Compact shop header — whose orders these are: shop
                    name first, then the seller and their Login ID */}
                <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-display text-lg font-extrabold text-[var(--accent)]">{selectedShopGroup.shopName.charAt(0).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <h4 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold leading-snug text-[var(--text)]">{selectedShopGroup.shopName}{selectedShopGroup.newCount > 0 && <span className="inline-flex items-center gap-1"><NewBadge /><span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--gold-ink)]">{selectedShopGroup.newCount} {t("act.newCount")}</span></span>}{selectedShopGroup.isDeleted && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{t("aord.deletedCustomer")}</span>}</h4>
                      {selectedShopGroup.isUnassigned ? (
                        <p className="mt-1 text-sm leading-snug text-[var(--dim)]">{t("aord.unassignedNote")}</p>
                      ) : (
                        <>
                          {selectedShopGroup.sellerName && <p className="mt-0.5 break-words text-sm font-medium text-[var(--text)]">{selectedShopGroup.sellerName}</p>}
                          <p className="mt-0.5 break-all text-sm text-[var(--dim)]">{t("adm.loginId")}: <strong className="text-[var(--text)]">{selectedShopGroup.loginId}</strong></p>
                          {selectedShopGroup.contact && <p className="break-words text-sm text-[var(--dim)]">{selectedShopGroup.contact}</p>}
                        </>
                      )}
                      {selectedShopGroup.latestAt && <p className="mt-1 text-xs text-[var(--dim)]">{t("aord.latestOrder")}: {new Date(selectedShopGroup.latestAt).toLocaleString()}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={selectedShopGroup.shopName}>
                    <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">{t("adm.totalOrders")}: {selectedShopGroup.total}</span>
                    <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">📦 {t("sord.secPending")}: {selectedShopGroup.pending}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedShopGroup.shipment > 0 ? "bg-[var(--amber-bg)] text-[var(--text)] ring-1 ring-[var(--gold)]" : "bg-[var(--surface-alt)] text-[var(--text)]"}`}>🚚 {t("sord.secShipment")}: {selectedShopGroup.shipment}</span>
                    <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold text-[var(--text)]">✅ {t("sord.secCompleted")}: {selectedShopGroup.completed}</span>
                    {selectedShopGroup.cancelled > 0 && <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-bold text-[var(--dim)]">✕ {trStatus(lang, "Cancelled")}: {selectedShopGroup.cancelled}</span>}
                  </div>
                </div>
                {/* ONLY this shop's orders, split into the three
                    working sections (+ Cancelled when present, so no
                    order ever disappears from the Admin's view) */}
                {selectedShopGroup.total === 0 ? (
                  <p className="mt-4 text-sm text-[var(--dim)]">{t("aord.noOrdersYet")}</p>
                ) : ([
                  { id: "pending", icon: "📦", label: t("sord.secPending"), list: selectedShopGroup.orders.filter((o) => o.status === "Pending" || o.status === "Confirmed") },
                  { id: "shipment", icon: "🚚", label: t("sord.secShipment"), list: selectedShopGroup.orders.filter((o) => o.status === "Shipped") },
                  { id: "completed", icon: "✅", label: t("sord.secCompleted"), list: selectedShopGroup.orders.filter((o) => o.status === "Delivered") },
                  ...(selectedShopGroup.cancelled > 0 ? [{ id: "cancelled", icon: "✕", label: trStatus(lang, "Cancelled"), list: selectedShopGroup.orders.filter((o) => o.status === "Cancelled") }] : []),
                ] as Array<{ id: string; icon: string; label: string; list: Order[] }>).map((sec) => (
                  <div key={sec.id} className="mt-5">
                    <h4 className="font-display font-bold text-[var(--text)]">{sec.icon} {sec.label} ({sec.list.length}){sec.id === "shipment" && sec.list.length > 0 && <span className="ml-2 rounded-full bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)]">⏳ {t("sord.waitingApproval")}</span>}</h4>
                    {sec.list.length === 0 ? (
                      <p className="mt-2 text-sm text-[var(--dim)]">{t("sord.sectionEmpty")}</p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-3">{sec.list.map((o) => renderAdminOrderRow(o, { showBuyer: true }))}</div>
                    )}
                  </div>
                ))}
                <button type="button" aria-label={t("aord.viewAll")} onClick={() => setOrdersShowAll(true)} className="mt-5 text-sm font-bold text-[var(--accent)]">{t("aord.viewAll")} ({ov.orders.length}) →</button>
              </div>
            ) : ordersShowAll ? (
              <div className="mt-3">
                <button type="button" aria-label={t("aord.backToShops")} onClick={() => setOrdersShowAll(false)} className={ghostBtn + " px-3 py-2 text-xs"}>{t("aord.backToShops")}</button>
                <h4 className="mt-3 font-display font-bold text-[var(--text)]">{t("aord.allOrdersTitle")} ({ov.orders.length})</h4>
                <div className="mt-3 flex flex-col gap-3">{ov.orders.map((o) => renderAdminOrderRow(o))}</div>
              </div>
            ) : (
              <div className="mt-3">
                <h4 className="font-display font-bold text-[var(--text)]">{t("aord.shopsTitle")} ({ordersByShop.length})</h4>
                <p className="mt-1 text-sm leading-snug text-[var(--dim)]">{t("aord.shopsSub")}</p>
                <div className="mt-3">
                  <Field label={t("aord.searchShopsLabel")}>
                    <input value={ordersSearch} onChange={(e) => setOrdersSearch(e.target.value)} placeholder={t("aord.searchShopsPh")} className={inputCls} aria-label={t("aord.searchShopsLabel")} />
                  </Field>
                </div>
                {filteredShopGroups.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--dim)]">{t("aord.noShopMatch")}</p>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    {filteredShopGroups.map((g) => (
                      <button key={g.key} type="button" aria-label={`${t("aord.viewOrders")} — ${g.shopName}`} onClick={() => { setOrdersShopKey(g.key); setOrdersShowAll(false); for (const o of g.orders) if (newOrderIdSet.has(o.id)) markSeen.mutate({ kind: "order", refId: o.id }); }} className={`w-full rounded-xl border bg-[var(--surface)] p-3 text-left ${g.newCount > 0 ? "border-[var(--gold)] bg-[var(--amber-bg)] ring-2 ring-[var(--gold)]/60" : g.shipment > 0 ? "border-[var(--gold)]/60" : "border-[var(--border)]"}`}>
                        <span className="flex items-start gap-3">
                          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-display text-base font-extrabold text-[var(--accent)]">{g.shopName.charAt(0).toUpperCase()}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <strong className="font-display text-base text-[var(--text)]">{g.shopName}</strong>
                              {g.newCount > 0 && <span className="inline-flex items-center gap-1"><NewBadge /><span className="rounded-full bg-[var(--gold)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--gold-ink)]">{g.newCount} {t("act.newCount")}</span></span>}
                              {g.isDeleted && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{t("aord.deletedCustomer")}</span>}
                              {g.shipment > 0 && <span className="rounded-full bg-[var(--amber-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)]">⏳ {g.shipment} {t("sord.waitingApproval")}</span>}
                              {g.total === 0 && <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--dim)]">{t("aord.noOrdersYet")}</span>}
                            </span>
                            {g.isUnassigned ? (
                              <span className="mt-0.5 block text-xs leading-snug text-[var(--dim)]">{t("aord.unassignedNote")}</span>
                            ) : (
                              <>
                                {g.sellerName && <span className="mt-0.5 block break-words text-xs font-medium text-[var(--text)]">{g.sellerName}</span>}
                                <span className="mt-0.5 block break-all text-xs text-[var(--dim)]">{t("adm.loginId")}: {g.loginId}{g.contact ? ` · ${g.contact}` : ""}</span>
                              </>
                            )}
                            {g.total > 0 && (
                              <span className="mt-1.5 flex flex-wrap gap-1.5">
                                <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)]">{t("adm.totalOrders")}: {g.total}</span>
                                <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)]">📦 {t("sord.secPending")}: {g.pending}</span>
                                <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)]">🚚 {t("sord.secShipment")}: {g.shipment}</span>
                                <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--text)]">✅ {t("sord.secCompleted")}: {g.completed}</span>
                              </span>
                            )}
                            {g.latestAt && <span className="mt-1 block text-xs text-[var(--dim)]">{t("aord.latestOrder")}: {new Date(g.latestAt).toLocaleString()}</span>}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-[var(--accent)]"><span className="hidden min-[430px]:inline">{t("aord.viewOrders")} </span>→</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" aria-label={t("aord.viewAll")} onClick={() => setOrdersShowAll(true)} className="mt-4 text-sm font-bold text-[var(--accent)]">{t("aord.viewAll")} ({ov.orders.length}) →</button>
              </div>
            )}
          </div>)}

          {section === "wallet" && (<div>
            <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.wallet")}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center"><p className="font-display text-base font-extrabold min-[400px]:text-lg">{fmt(ov.totalWalletBalance)}</p><p className="text-xs text-[var(--dim)]">{t("fin.available")} (all)</p></div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center"><p className="font-display text-base font-extrabold min-[400px]:text-lg">{fmt(ov.totalPendingAmount)}</p><p className="text-xs text-[var(--dim)]">{t("fin.pending")} (all)</p></div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center"><p className="font-display text-base font-extrabold min-[400px]:text-lg">{fmt(ov.totalUsedAmount)}</p><p className="text-xs text-[var(--dim)]">{t("fin.used")} (all)</p></div>
            </div>
            <div className="mt-4 flex flex-col gap-3">{apps.map((a) => (<button key={a.id} type="button" aria-label={`Open wallet details for ${a.name}`} onClick={() => { setSection("sellers"); setSelectedSellerId(a.id); setSellerTab("wallet"); }} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left"><span className="flex items-center gap-2"><AdminSellerLogo adminId={user.id} sellerId={a.id} hasFile={a.hasLogoFile} fallbackText={a.storeName ?? a.name} /><span><strong>{a.storeName ?? a.name}</strong><span className="ml-2 text-xs text-[var(--dim)]">{a.name}</span></span></span><div className="mt-2"><FinanceSummary finance={finForApp(a)} compact /></div></button>))}</div>
            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="min-w-0 flex-1 text-sm text-[var(--dim)]">💠 {t("dep.manageLink")}</p>
              <button type="button" onClick={() => setSection("settings")} aria-label="Open Deposit Settings in Settings" className={primaryBtn + " px-3 py-2 text-[13px]"}>{t("dep.openSettings")}</button>
            </div>
            <h4 className="mt-6 font-display font-bold text-[var(--text)]">{t("adm.walletRequests")} ({(walletRequests.data?.requests ?? []).filter((r) => r.status === "pending").length} pending)</h4>
            <p className="mt-1 text-xs leading-snug text-[var(--dim)]">{t("act.noDeleteNote")}</p>
            {payOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">✓ {payOk}</p>}
            {(walletRequests.data?.requests ?? []).length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noWalletRequests")}</p> : <div className="mt-3 flex flex-col gap-2">{(walletRequests.data?.requests ?? []).map((r) => (<div key={r.id} onClick={() => { if (newWalletIdSet.has(r.id)) markSeen.mutate({ kind: "wallet", refId: r.id }); }} className={`rounded-xl border bg-[var(--surface)] p-3 ${newWalletIdSet.has(r.id) ? "border-[var(--gold)] ring-2 ring-[var(--gold)]/60" : "border-[var(--border)]"}`}><div className="flex flex-wrap items-center gap-2"><span aria-hidden>{r.type === "deposit" ? "⬇️" : r.type === "admin_credit" ? "💰" : r.type === "admin_withdraw" ? "🏦" : "⬆️"}</span><strong>{r.type === "deposit" ? t("w.typeDeposit") : r.type === "admin_credit" ? t("w.typeAdminCredit") : r.type === "admin_withdraw" ? t("wp.typeAdminWithdrawRow") : t("w.typeWithdraw")} · {fmt(r.amount)}</strong><StatusBadge status={r.status} />{newWalletIdSet.has(r.id) && <NewBadge />}<span className="ml-auto text-xs text-[var(--dim)]">{new Date(r.createdAt).toLocaleString()}</span></div><p className="mt-1 text-sm text-[var(--dim)]">{r.sellerName}{r.storeName ? ` · ${r.storeName}` : ""} · {r.method}{r.reference ? ` · ${r.reference}` : ""}{r.details ? ` · ${r.details}` : ""}{r.note ? ` · ${r.note}` : ""}{r.hasScreenshot ? ` · 📷 ${t("dep.shotAttached")}` : ""}</p>{r.hasScreenshot && <div className="mt-1.5"><DepositScreenshotView txId={r.id} adminId={user.id} /></div>}{r.status === "paid" && <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">✓ {t("status.paid")}{r.paidAt ? ` · ${t("wp.paidOn")}: ${new Date(r.paidAt).toLocaleString()}` : ""}{r.paymentReference ? ` · ${t("wp.paymentRefWord")}: ${r.paymentReference}` : ""}</p>}{r.status === "pending" && r.type === "withdraw" && <div className="mt-2 flex flex-wrap gap-2"><button type="button" aria-label={`Pay and withdraw wallet request ${r.id}`} disabled={payWithdraw.isPending} onClick={(e) => { e.stopPropagation(); setPayTargetId(payTargetId === r.id ? null : r.id); setPayErr(null); setPayOk(null); setPayRef(""); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">💸 {t("wp.payBtn")}</button><button type="button" aria-label={`Reject wallet request ${r.id}`} disabled={reviewWallet.isPending} onClick={(e) => { e.stopPropagation(); reviewWallet.mutate({ txId: r.id, decision: "reject" }); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">✕ {t("adm.reject")}</button></div>}{r.status === "pending" && r.type !== "withdraw" && <div className="mt-2 flex gap-2"><button type="button" aria-label={`Approve wallet request ${r.id}`} disabled={reviewWallet.isPending} onClick={(e) => { e.stopPropagation(); reviewWallet.mutate({ txId: r.id, decision: "approve" }); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">✓ {t("adm.approve")}</button><button type="button" aria-label={`Reject wallet request ${r.id}`} disabled={reviewWallet.isPending} onClick={(e) => { e.stopPropagation(); reviewWallet.mutate({ txId: r.id, decision: "reject" }); }} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">✕ {t("adm.reject")}</button></div>}{payTargetId === r.id && r.status === "pending" && r.type === "withdraw" && <div onClick={(e) => e.stopPropagation()}><PayWithdrawPanel request={r} paymentRef={payRef} onPaymentRefChange={setPayRef} busy={payWithdraw.isPending} error={payErr} onConfirm={() => payWithdraw.mutate({ txId: r.id, paymentReference: payRef })} onCancel={() => { setPayTargetId(null); setPayErr(null); }} /></div>}</div>))}</div>}
          </div>)}

          {section === "support" && (<div>
            <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.support")}</h3>
            <p className="mt-1 text-sm text-[var(--dim)]">{t("adm.supportSettings")}</p>
            {renderResetRequests(null, "adm.resetRequests")}
            <h4 className="mt-4 font-display font-bold">{t("adm.liveChats")} ({chatThreads.data?.threads.length ?? 0})</h4>
            {(chatThreads.data?.threads ?? []).length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noChats")}</p> : <div className="mt-2 flex flex-col gap-2">{(chatThreads.data?.threads ?? []).map((th) => (<div key={th.userId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <button type="button" aria-label={`Open chat with ${th.customerName}`} aria-expanded={openChatUser === th.userId} onClick={() => { setOpenChatUser(openChatUser === th.userId ? null : th.userId); setChatPendingAtt(null); setChatAttErr(null); }} className="flex w-full flex-wrap items-center gap-2 text-left"><strong>{th.customerName}</strong><span className="text-xs text-[var(--dim)]">{th.customerEmail}</span>{th.awaitingReply && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{t("adm.awaiting")}</span>}<span className="ml-auto max-w-56 truncate text-xs text-[var(--dim)]">{th.lastMessage}</span></button>
              {openChatUser === th.userId && (<div ref={threadPanelRef} className="mt-3 scroll-mt-[calc(var(--header-h,3.5rem)+1rem)] border-t border-[var(--border)] pt-3"><div ref={threadListRef} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">{(openChat.data?.messages ?? []).map((m: ChatMessage) => (<ChatBubble key={m.id} m={m} requesterId={user.id} ownSender="admin" ownLabel={t("sup.admin")} otherLabel={th.customerName} />))}</div>
              {chatAttErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {chatAttErr}</p>}
              <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (chatDraft.trim() || chatPendingAtt) sendChat.mutate(); }}><ChatAttachPicker pickerId={`support-chat-attach-${th.userId}`} pending={chatPendingAtt} onPick={pickSupportAttachment} onClear={() => setChatPendingAtt(null)} /><input ref={threadInputRef} value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} placeholder={t("adm.replyPh")} className={inputCls + " min-w-0 flex-1"} aria-label={`Reply to ${th.customerName}`} /><button type="submit" aria-label={`Send reply to ${th.customerName}`} disabled={(!chatDraft.trim() && !chatPendingAtt) || sendChat.isPending} className={primaryBtn + " shrink-0"}>{t("adm.send")}</button></form>
              {supportChatDeleteUser === th.userId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-2 dark:bg-rose-950/20">
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-100">{t("chat.deleteQ")} {th.customerName}?</span>
                  <span className="w-full text-[11px] text-rose-800 dark:text-rose-200">{t("chat.deleteNote")}</span>
                  <button type="button" aria-label={`Confirm delete chat with ${th.customerName}`} disabled={deleteChatThread.isPending} onClick={() => deleteChatThread.mutate(th.userId)} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">{t("chat.confirmDelete")}</button>
                  <button type="button" aria-label="Cancel delete chat" onClick={() => setSupportChatDeleteUser(null)} className="text-xs font-semibold text-[var(--dim)]">{t("adm.cancel")}</button>
                </div>
              ) : (
                <button type="button" aria-label={`Delete chat conversation with ${th.customerName}`} onClick={() => setSupportChatDeleteUser(th.userId)} className="mt-2 text-xs font-bold text-rose-600">🗑 {t("chat.deleteBtn")}</button>
              )}
              </div>)}
            </div>))}</div>}
            <h4 className="mt-6 font-display font-bold">{t("adm.tickets")} ({ov.tickets.length})</h4>
            {ticketDeleteMsg && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {ticketDeleteMsg}</p>}
            {ov.tickets.length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noTickets")}</p> : <div className="mt-2 flex flex-col gap-3">{ov.tickets.map((tk) => (<div key={tk.id} onClick={() => { if (newTicketIdSet.has(tk.id)) markSeen.mutate({ kind: "ticket", refId: tk.id }); }} className={`rounded-xl border bg-[var(--surface)] p-4 ${newTicketIdSet.has(tk.id) ? "border-[var(--gold)] ring-2 ring-[var(--gold)]/60" : "border-[var(--border)]"}`}><div className="flex flex-wrap items-center gap-2"><strong>{tk.subject}</strong><StatusBadge status={tk.status} />{newTicketIdSet.has(tk.id) && <NewBadge />}<span className="ml-auto text-xs text-[var(--dim)]">{tk.name} · {tk.email}</span></div><p className="mt-1 text-sm text-[var(--dim)]">{tk.message}</p>{tk.reply && <p className="mt-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm"><strong>{t("adm.replyWord")}</strong> {tk.reply}</p>}<div className="mt-2 flex gap-2"><input value={replyDraft[tk.id] ?? ""} onChange={(e) => setReplyDraft({ ...replyDraft, [tk.id]: e.target.value })} placeholder={t("adm.replyPh")} className={inputCls + " min-w-0 flex-1"} aria-label={`Reply to ticket ${tk.id}`} /><button type="button" aria-label={`Send reply to ticket ${tk.id}`} disabled={!(replyDraft[tk.id] ?? "").trim() || reply.isPending} onClick={() => reply.mutate(tk.id)} className={primaryBtn + " shrink-0"}>{t("adm.send")}</button></div>
            {ticketDeleteId === tk.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-rose-700">{t("adm.deleteTicketQ")} — “{tk.subject}” ({tk.name})</span>
                <button type="button" aria-label={`Confirm delete ticket ${tk.id}`} disabled={deleteTicket.isPending} onClick={() => deleteTicket.mutate(tk.id)} className="rounded-md bg-rose-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-50">{t("adm.confirmDelete")}</button>
                <button type="button" aria-label={`Cancel delete ticket ${tk.id}`} onClick={() => setTicketDeleteId(null)} className="text-xs font-semibold text-[var(--dim)]">{t("adm.cancel")}</button>
              </div>
            ) : (
              <button type="button" aria-label={`Delete ticket ${tk.id}`} onClick={() => { setTicketDeleteId(tk.id); setTicketDeleteMsg(null); }} className="mt-2 text-xs font-bold text-rose-600">🗑 {t("adm.deleteTicket")}</button>
            )}
            </div>))}</div>}
          </div>)}

          {section === "theme" && (<div>
            <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">{t("adm.sec.theme")} <NewBadge id="sec-theme" /></h3>
            <div className="mt-3">{renderThemeDesign()}</div>
          </div>)}

          {section === "settings" && (<div>
            <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("adm.settings")}</h3>
            <form className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); saveSettings.mutate(); }}>
              <Field label={t("adm.storeName")}><input required value={sform.storeName} onChange={(e) => setSform({ ...sform, storeName: e.target.value })} className={inputCls} aria-label="Store name" /></Field>
              <Field label={t("adm.defaultProfit")}><input type="number" min={0} max={200} value={sform.defaultProfitPercent} onChange={(e) => setSform({ ...sform, defaultProfitPercent: e.target.value })} className={inputCls} aria-label="Default profit percent" /></Field>
              <Field label={t("adm.waNumber")}><input value={sform.supportWhatsapp} onChange={(e) => setSform({ ...sform, supportWhatsapp: e.target.value })} placeholder="+92 3XX XXXXXXX / +91 98XXX XXXXX" className={inputCls} aria-label="Support WhatsApp number" /></Field>
              <Field label={t("adm.supportEmail")}><input value={sform.supportEmail} onChange={(e) => setSform({ ...sform, supportEmail: e.target.value })} placeholder="support@example.com" className={inputCls} aria-label="Support email" /></Field>
              <div className="sm:col-span-2"><button type="submit" disabled={saveSettings.isPending} className={primaryBtn}>{saveSettings.isSuccess ? t("adm.saved") : t("adm.saveSettings")}</button></div>
            </form>
            <p className="mt-3 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-xs text-[var(--dim)]">{t("adm.platformLinks")} · {t("links.note")}</p>
            {/* Settings -> Deposit Settings: USDT deposit address + network
             + Local Deposit Note + the Deposit Account ON/OFF switch.
             Everything saved here is what the seller Wallet → Deposit
             page reads; the preview below renders the same card sellers
             see, from the values currently in the form. */}
            <div className="mt-6 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">💠 {t("dep.adminTitle")} <NewBadge id="deposit-settings" /></h3>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("dep.adminSub")}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2.5">
                <span className="text-sm font-bold text-[var(--text)]">{t("dep.account")}:</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${(settings?.depositsEnabled ?? true) ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>{(settings?.depositsEnabled ?? true) ? t("dep.on") : t("dep.offLabel")}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings?.depositsEnabled ?? true}
                  aria-label="Deposit Account ON or OFF"
                  disabled={toggleDeposits.isPending}
                  onClick={() => toggleDeposits.mutate(!(settings?.depositsEnabled ?? true))}
                  className={`relative ml-auto h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50 ${(settings?.depositsEnabled ?? true) ? "bg-emerald-600" : "bg-[var(--dim)]"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${(settings?.depositsEnabled ?? true) ? "left-7" : "left-1"}`} />
                </button>
              </div>
              <form className="mt-4 flex flex-col gap-3" noValidate onSubmit={(e) => { e.preventDefault(); setDepTouched(true); setDepServerErr(null); setDepOk(null); if (depErrors().length > 0) return; saveDepositSettings.mutate(); }}>
                {depTouched && depErrors().length > 0 && <ValidationSummary sectionLabel={t("dep.adminTitle")} items={depErrors().map((e) => ({ label: e.label, msg: e.msg }))} />}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("dep.addressField")}>
                    <input value={depForm.usdtDepositAddress} onChange={(e) => setDepForm({ ...depForm, usdtDepositAddress: e.target.value })} placeholder="0x…" className={errInputCls(!!(depTouched && depErrors().find((x) => x.key === "usdtDepositAddress")))} aria-label="USDT Deposit Address" />
                    <FieldError msg={depTouched ? depErrors().find((x) => x.key === "usdtDepositAddress")?.msg : undefined} />
                  </Field>
                  <Field label={t("dep.networkField")}>
                    <input value={depForm.depositNetwork} onChange={(e) => setDepForm({ ...depForm, depositNetwork: e.target.value })} placeholder="BEP20 (BNB Smart Chain)" className={errInputCls(!!(depTouched && depErrors().find((x) => x.key === "depositNetwork")))} aria-label="Deposit network" />
                    <FieldError msg={depTouched ? depErrors().find((x) => x.key === "depositNetwork")?.msg : undefined} />
                  </Field>
                </div>
                <Field label={t("dep.localNoteField")}>
                  <textarea value={depForm.localDepositNote} onChange={(e) => setDepForm({ ...depForm, localDepositNote: e.target.value })} rows={3} maxLength={1000} className={inputCls} aria-label="Local Deposit Note" />
                  <span className="mt-1 block text-xs leading-snug text-[var(--dim)]">{t("dep.localNoteHint")}</span>
                </Field>
                {depFormatWarning(depForm.usdtDepositAddress, depForm.depositNetwork) && <p role="status" className="rounded-lg bg-[var(--amber-bg)] px-3 py-2 text-sm font-semibold text-[var(--text)]">⚠ {depFormatWarning(depForm.usdtDepositAddress, depForm.depositNetwork)}</p>}
                {depServerErr && <p role="alert" className="text-sm font-semibold text-rose-600">⚠ {depServerErr}</p>}
                {depOk && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {depOk}</p>}
                <div><button type="submit" disabled={saveDepositSettings.isPending} className={primaryBtn}>{t("dep.save")}</button></div>
              </form>
              <h4 className="mt-5 font-display font-bold text-[var(--text)]">{t("dep.preview")}</h4>
              <div className="mt-2 flex flex-col gap-3">
                <DepositAddressCard address={depForm.usdtDepositAddress} network={depForm.depositNetwork} />
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-sm font-medium text-[var(--text)]">{depForm.localDepositNote.trim() ? depForm.localDepositNote : t("dep.local")}</p>
                  <span className={ghostBtn + " mt-2 inline-block px-3 py-2 text-[13px]"}>💬 {t("dep.contact")}</span>
                </div>
              </div>
            </div>
            {/* Settings -> Language & Prices: per-language and
             per-currency ON/OFF switches. Visitor pickers (header + ☰
             drawer) show only what is ON; a switched-off selection
             falls back automatically (language → English, currency →
             INR or the first currency still ON). English is always ON,
             and the last currency still ON cannot be switched off. */}
            <div className="mt-6 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">🌐 {t("lp.title")} <NewBadge id="language-prices" /></h3>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("lp.sub")}</p>
              <h4 className="mt-4 font-display font-bold text-[var(--text)]">{t("lp.languages")}</h4>
              <div className="mt-2 flex flex-col gap-2">
                <SwitchRow label={t("lp.english")} note={t("lp.alwaysOnNote")} checked disabled disabledNote={t("lp.alwaysOn")} switchLabel="English language (always ON)" />
                <SwitchRow label={t("lp.hindi")} checked={lpForm.langHindiEnabled} onToggle={() => { setLpForm({ ...lpForm, langHindiEnabled: !lpForm.langHindiEnabled }); setLpOk(null); }} switchLabel="Hindi language ON or OFF" />
                <SwitchRow label={t("lp.arabic")} checked={lpForm.langArabicEnabled} onToggle={() => { setLpForm({ ...lpForm, langArabicEnabled: !lpForm.langArabicEnabled }); setLpOk(null); }} switchLabel="Arabic language ON or OFF" />
              </div>
              <h4 className="mt-5 font-display font-bold text-[var(--text)]">{t("lp.currencies")}</h4>
              <div className="mt-2 flex flex-col gap-2">
                {(() => {
                  const onCount = [lpForm.currencyInrEnabled, lpForm.currencyUsdEnabled, lpForm.currencyUsdtEnabled].filter(Boolean).length;
                  return (
                    <>
                      <SwitchRow label={t("lp.inr")} checked={lpForm.currencyInrEnabled} disabled={lpForm.currencyInrEnabled && onCount === 1} disabledNote={lpForm.currencyInrEnabled && onCount === 1 ? t("lp.lastCurrency") : undefined} onToggle={() => { setLpForm({ ...lpForm, currencyInrEnabled: !lpForm.currencyInrEnabled }); setLpOk(null); }} switchLabel="INR prices ON or OFF" />
                      <SwitchRow label={t("lp.usd")} checked={lpForm.currencyUsdEnabled} disabled={lpForm.currencyUsdEnabled && onCount === 1} disabledNote={lpForm.currencyUsdEnabled && onCount === 1 ? t("lp.lastCurrency") : undefined} onToggle={() => { setLpForm({ ...lpForm, currencyUsdEnabled: !lpForm.currencyUsdEnabled }); setLpOk(null); }} switchLabel="USD prices ON or OFF" />
                      <SwitchRow label={t("lp.usdt")} note={t("lp.usdtNote")} checked={lpForm.currencyUsdtEnabled} disabled={lpForm.currencyUsdtEnabled && onCount === 1} disabledNote={lpForm.currencyUsdtEnabled && onCount === 1 ? t("lp.lastCurrency") : undefined} onToggle={() => { setLpForm({ ...lpForm, currencyUsdtEnabled: !lpForm.currencyUsdtEnabled }); setLpOk(null); }} switchLabel="USDT prices ON or OFF" />
                    </>
                  );
                })()}
              </div>
              {lpServerErr && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">⚠ {lpServerErr}</p>}
              {lpOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {lpOk}</p>}
              <div className="mt-3"><button type="button" disabled={saveLangPrices.isPending} onClick={() => { setLpServerErr(null); setLpOk(null); saveLangPrices.mutate(); }} className={primaryBtn}>{t("lp.save")}</button></div>
            </div>
            {/* Settings -> Payment Methods: per-method ON/OFF switches
             for UPI, Bank Account and USDT. An OFF method is hidden
             from the seller deposit/withdraw pickers (and refused
             server-side); USDT OFF also hides the Deposit Address
             card/QR. Existing requests and balances are untouched. */}
            <div className="mt-6 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">💳 {t("pm.title")} <NewBadge id="payment-methods" /></h3>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("pm.sub")}</p>
              <div className="mt-3 flex flex-col gap-2">
                <SwitchRow label={t("pm.upi")} checked={pmForm.upiEnabled} onToggle={() => { setPmForm({ ...pmForm, upiEnabled: !pmForm.upiEnabled }); setPmOk(null); }} switchLabel="UPI payment method ON or OFF" />
                <SwitchRow label={t("pm.bank")} checked={pmForm.bankEnabled} onToggle={() => { setPmForm({ ...pmForm, bankEnabled: !pmForm.bankEnabled }); setPmOk(null); }} switchLabel="Bank Account payment method ON or OFF" />
                <SwitchRow label={t("pm.usdt")} note={t("pm.usdtNote")} checked={pmForm.usdtEnabled} onToggle={() => { setPmForm({ ...pmForm, usdtEnabled: !pmForm.usdtEnabled }); setPmOk(null); }} switchLabel="USDT payment method ON or OFF" />
              </div>
              {pmServerErr && <p role="alert" className="mt-3 text-sm font-semibold text-rose-600">⚠ {pmServerErr}</p>}
              {pmOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {pmOk}</p>}
              <div className="mt-3"><button type="button" disabled={savePaymentMethods.isPending} onClick={() => { setPmServerErr(null); setPmOk(null); savePaymentMethods.mutate(); }} className={primaryBtn}>{t("pm.save")}</button></div>
            </div>
            {/* Settings -> Admin Accounts: plain list (name + Gmail + date
             only, never any password), change own Gmail, change own
             password, add another admin. Extra reset/remove controls
             appear only when the signed-in account may manage others —
             with no special heading or label naming that role. */}
            <div className="mt-6 rounded-2xl border-2 border-[var(--gold)]/60 bg-[var(--surface)] p-4">
              <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-[var(--text)]">⚙️ {t("adm.adminAccounts")} <NewBadge id="admin-accounts" /></h3>
              <p className="mt-1 text-sm text-[var(--dim)]">{t("adm.adminAccountsSub")}</p>
              {removeOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {removeOk}</p>}
              {resetOk && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {resetOk}</p>}
              <h4 className="mt-4 font-display font-bold text-[var(--text)]">{t("adm.adminList")} ({(adminAccounts.data?.admins ?? []).length})</h4>
              {(adminAccounts.data?.admins ?? []).length === 0 ? <p className="mt-2 text-sm text-[var(--dim)]">{t("adm.noAdmins")}</p> : (
                <div className="mt-2 flex flex-col gap-2">
                  {(adminAccounts.data?.admins ?? []).map((a) => {
                    const isSelf = a.id === user.id;
                    const canManage = (adminAccounts.data?.viewerCanManageOthers ?? false) && !isSelf && !a.isProtected;
                    const rdraft = resetTargetId === a.id ? resetForm : { newPassword: "", confirmPassword: "", actorPassword: "" };
                    return (
                      <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-[var(--text)]">{a.name}</strong>
                          <span className="rounded-full bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-semibold">{t("adm.adminRole")}</span>
                          {isSelf && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-xs font-bold text-white">{t("adm.youBadge")}</span>}
                          <span className="ml-auto text-xs text-[var(--dim)]">{t("adm.joined")}: {new Date(a.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--dim)]">{a.email ?? ""}{a.createdByEmail ? ` · ${t("adm.createdBy")}: ${a.createdByEmail}` : ""}</p>
                        {canManage && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" aria-label={`Reset password for admin ${a.email ?? a.name}`} onClick={() => { setResetTargetId(resetTargetId === a.id ? null : a.id); setResetForm({ newPassword: "", confirmPassword: "", actorPassword: "" }); setResetTouched(false); setResetServerErr(null); setResetOk(null); }} className={ghostBtn + " px-3 py-1.5 text-xs"}>🔑 {t("adm.resetPwFor")}</button>
                            <button type="button" aria-label={`Remove admin ${a.email ?? a.name}`} onClick={() => { setRemoveTarget({ id: a.id, name: a.name, email: a.email ?? "" }); setRemovePassword(""); setRemoveTouched(false); setRemoveServerErr(null); setRemoveOk(null); }} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-600">🗑 {t("adm.removeAdminBtn")}</button>
                          </div>
                        )}
                        {canManage && resetTargetId === a.id && (
                          <form className="mt-3 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 sm:grid-cols-3" noValidate onSubmit={(e) => { e.preventDefault(); setResetTouched(true); setResetServerErr(null); if (resetErrors().length > 0) return; resetAdminPw.mutate(); }}>
                            <p className="text-xs text-[var(--dim)] sm:col-span-3">{t("adm.resetPwSub")} — {a.email ?? a.name}</p>
                            {resetTouched && resetErrors().length > 0 && <div className="sm:col-span-3"><ValidationSummary sectionLabel={t("adm.resetPwFor")} items={resetErrors().map((e) => ({ label: e.label, msg: e.msg }))} /></div>}
                            <Field label={t("adm.newPassword")}><input type="password" value={rdraft.newPassword} onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })} className={errInputCls(!!(resetTouched && resetErrors().find((x) => x.key === "newPassword")))} aria-label={`New password for admin ${a.email ?? a.name}`} /><FieldError msg={resetTouched ? resetErrors().find((x) => x.key === "newPassword")?.msg : undefined} /></Field>
                            <Field label={t("adm.confirmPassword")}><input type="password" value={rdraft.confirmPassword} onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })} className={errInputCls(!!(resetTouched && resetErrors().find((x) => x.key === "confirmPassword")))} aria-label="Confirm new password for this admin" /><FieldError msg={resetTouched ? resetErrors().find((x) => x.key === "confirmPassword")?.msg : undefined} /></Field>
                            <Field label={t("adm.yourPwAuthorize")}><input type="password" value={rdraft.actorPassword} onChange={(e) => setResetForm({ ...resetForm, actorPassword: e.target.value })} className={errInputCls(!!(resetTouched && resetErrors().find((x) => x.key === "actorPassword")))} aria-label="Your current password to authorize the reset" /><FieldError msg={resetTouched ? resetErrors().find((x) => x.key === "actorPassword")?.msg : undefined} /></Field>
                            {resetServerErr && <p role="alert" className="text-sm font-semibold text-rose-600 sm:col-span-3">⚠ {resetServerErr}</p>}
                            <div className="flex gap-2 sm:col-span-3"><button type="submit" disabled={resetAdminPw.isPending} className={primaryBtn + " px-3 py-2 text-xs"}>{t("adm.resetPwBtn")}</button><button type="button" onClick={() => setResetTargetId(null)} className={ghostBtn + " px-3 py-2 text-xs"}>{t("adm.cancel")}</button></div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <form className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" noValidate onSubmit={(e) => { e.preventDefault(); setGmailTouched(true); setGmailServerErr(null); if (gmailErrors().length > 0) return; changeGmail.mutate(); }}>
                  <div><h4 className="font-display font-bold text-[var(--text)]">✉️ {t("adm.changeGmail")}</h4><p className="mt-0.5 text-xs text-[var(--dim)]">{t("adm.changeGmailSub")}</p></div>
                  {gmailTouched && gmailErrors().length > 0 && <ValidationSummary sectionLabel={t("adm.changeGmail")} items={gmailErrors().map((e) => ({ label: e.label, msg: e.msg }))} />}
                  <Field label={t("adm.currentGmail")}><input value={user.email ?? ""} readOnly className={inputCls + " opacity-70"} aria-label="Your current Gmail" /></Field>
                  <Field label={t("adm.newGmail")}><input type="email" value={gmailForm.newEmail} onChange={(e) => setGmailForm({ ...gmailForm, newEmail: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!(gmailTouched && gmailErrors().find((x) => x.key === "newEmail")))} aria-label="New Gmail" /><FieldError msg={gmailTouched ? gmailErrors().find((x) => x.key === "newEmail")?.msg : undefined} /></Field>
                  <Field label={t("adm.currentPassword")}><input type="password" value={gmailForm.currentPassword} onChange={(e) => setGmailForm({ ...gmailForm, currentPassword: e.target.value })} className={errInputCls(!!(gmailTouched && gmailErrors().find((x) => x.key === "currentPassword")))} aria-label="Your current password to change Gmail" /><FieldError msg={gmailTouched ? gmailErrors().find((x) => x.key === "currentPassword")?.msg : undefined} /></Field>
                  {gmailServerErr && <p role="alert" className="text-sm font-semibold text-rose-600">⚠ {gmailServerErr}</p>}
                  {gmailOk && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {gmailOk}</p>}
                  <button type="submit" disabled={changeGmail.isPending} className={primaryBtn + " self-start"}>{t("adm.changeGmailBtn")}</button>
                </form>

                <form className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" noValidate onSubmit={(e) => { e.preventDefault(); setPwTouched(true); setPwServerErr(null); if (pwErrors().length > 0) return; changePw.mutate(); }}>
                  <div><h4 className="font-display font-bold text-[var(--text)]">🔑 {t("adm.changePassword")}</h4><p className="mt-0.5 text-xs text-[var(--dim)]">{t("adm.changePasswordSub")}</p></div>
                  {pwTouched && pwErrors().length > 0 && <ValidationSummary sectionLabel={t("adm.changePassword")} items={pwErrors().map((e) => ({ label: e.label, msg: e.msg }))} />}
                  <Field label={t("adm.currentPassword")}><input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} className={errInputCls(!!(pwTouched && pwErrors().find((x) => x.key === "currentPassword")))} aria-label="Your current password" /><FieldError msg={pwTouched ? pwErrors().find((x) => x.key === "currentPassword")?.msg : undefined} /></Field>
                  <Field label={t("adm.newPassword")}><input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className={errInputCls(!!(pwTouched && pwErrors().find((x) => x.key === "newPassword")))} aria-label="Your new password" /><FieldError msg={pwTouched ? pwErrors().find((x) => x.key === "newPassword")?.msg : undefined} /></Field>
                  <Field label={t("adm.confirmPassword")}><input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className={errInputCls(!!(pwTouched && pwErrors().find((x) => x.key === "confirmPassword")))} aria-label="Confirm your new password" /><FieldError msg={pwTouched ? pwErrors().find((x) => x.key === "confirmPassword")?.msg : undefined} /></Field>
                  {pwServerErr && <p role="alert" className="text-sm font-semibold text-rose-600">⚠ {pwServerErr}</p>}
                  {pwOk && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {pwOk}</p>}
                  <button type="submit" disabled={changePw.isPending} className={primaryBtn + " self-start"}>{t("adm.changePasswordBtn")}</button>
                </form>
              </div>

              <form className="mt-4 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4" noValidate onSubmit={(e) => { e.preventDefault(); setAddAdminTouched(true); setAddAdminServerErr(null); if (addAdminErrors().length > 0) return; createExtraAdmin.mutate(); }}>
                <div><h4 className="font-display font-bold text-[var(--text)]">➕ {t("adm.addAdmin")}</h4><p className="mt-0.5 text-xs text-[var(--dim)]">{t("adm.addAdminSub")}</p></div>
                {addAdminTouched && addAdminErrors().length > 0 && <ValidationSummary sectionLabel={t("adm.addAdmin")} items={addAdminErrors().map((e) => ({ label: e.label, msg: e.msg }))} />}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("adm.newAdminName")}><input value={addAdminForm.name} onChange={(e) => setAddAdminForm({ ...addAdminForm, name: e.target.value })} className={errInputCls(!!(addAdminTouched && addAdminErrors().find((x) => x.key === "name")))} aria-label="New admin name" /><FieldError msg={addAdminTouched ? addAdminErrors().find((x) => x.key === "name")?.msg : undefined} /></Field>
                  <Field label={t("adm.newAdminGmail")}><input type="email" value={addAdminForm.email} onChange={(e) => setAddAdminForm({ ...addAdminForm, email: e.target.value })} placeholder="name@gmail.com" className={errInputCls(!!(addAdminTouched && addAdminErrors().find((x) => x.key === "email")))} aria-label="New admin Gmail" /><FieldError msg={addAdminTouched ? addAdminErrors().find((x) => x.key === "email")?.msg : undefined} /></Field>
                  <Field label={t("adm.newAdminPassword")}><input type="password" value={addAdminForm.password} onChange={(e) => setAddAdminForm({ ...addAdminForm, password: e.target.value })} className={errInputCls(!!(addAdminTouched && addAdminErrors().find((x) => x.key === "password")))} aria-label="New admin password" /><FieldError msg={addAdminTouched ? addAdminErrors().find((x) => x.key === "password")?.msg : undefined} /></Field>
                  <Field label={t("adm.confirmAdminPassword")}><input type="password" value={addAdminForm.confirmPassword} onChange={(e) => setAddAdminForm({ ...addAdminForm, confirmPassword: e.target.value })} className={errInputCls(!!(addAdminTouched && addAdminErrors().find((x) => x.key === "confirmPassword")))} aria-label="Confirm new admin password" /><FieldError msg={addAdminTouched ? addAdminErrors().find((x) => x.key === "confirmPassword")?.msg : undefined} /></Field>
                  <Field label={t("adm.creatorPassword")}><input type="password" value={addAdminForm.creatorPassword} onChange={(e) => setAddAdminForm({ ...addAdminForm, creatorPassword: e.target.value })} className={errInputCls(!!(addAdminTouched && addAdminErrors().find((x) => x.key === "creatorPassword")))} aria-label="Your current password to create the admin" /><FieldError msg={addAdminTouched ? addAdminErrors().find((x) => x.key === "creatorPassword")?.msg : undefined} /></Field>
                </div>
                {addAdminServerErr && <p role="alert" className="text-sm font-semibold text-rose-600">⚠ {addAdminServerErr}</p>}
                {addAdminOk && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">✓ {addAdminOk}</p>}
                <button type="submit" disabled={createExtraAdmin.isPending} className={primaryBtn + " self-start"}>{t("adm.addAdminBtn")}</button>
              </form>
            </div>
          </div>)}
        </div>
      </div>

      {viewer && (<div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-3" role="dialog" aria-modal="true" aria-label={viewer.label}>
        <div className="my-6 w-full max-w-3xl rounded-2xl bg-[var(--surface)] p-4 shadow-2xl">
          <div className="flex items-center gap-2"><strong className="flex-1 font-display text-[var(--text)]">{viewer.label}</strong>
            {viewerDoc.data?.url && <a href={viewerDoc.data.url} download={viewerDoc.data.fileName ?? viewer.label} target="_blank" rel="noreferrer" className={ghostBtn + " px-3 py-1.5 text-xs"}>{t("adm.download")}</a>}
            <button type="button" aria-label={t("menu.close")} onClick={() => setViewer(null)} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5">✕</button></div>
          <p className="mt-1 text-xs text-[var(--dim)]">{viewerDoc.data?.fileName ?? ""}{viewerDoc.data?.contentType ? ` · ${viewerDoc.data.contentType}` : ""}{viewerDoc.data?.size ? ` · ${formatBytes(viewerDoc.data.size)}` : ""}</p>
          <div className="mt-3">
            {viewerDoc.isPending && <p className="py-8 text-center text-[var(--dim)]">{t("common.loading")}</p>}
            {viewerDoc.data && !viewerDoc.data.hasFile && <p className="py-8 text-center text-sm text-[var(--dim)]">{t("adm.docOldNote")}</p>}
            {viewerDoc.data?.hasFile && viewerDoc.data.url && viewerDoc.data.contentType === "application/pdf" && (<PdfViewer src={viewerDoc.data.url} ariaLabel={viewer.label} labels={{ loading: t("common.loading"), loadError: "This PDF couldn’t be loaded.", pageError: "This PDF page couldn’t be rendered.", previousPage: "Previous", nextPage: "Next", pageIndicator: (pg, tot) => `Page ${pg} of ${tot}`, navigationAriaLabel: `${viewer.label} pages`, pageAriaLabel: (pg) => `${viewer.label}, page ${pg}` }} />)}
            {viewerDoc.data?.hasFile && viewerDoc.data.url && (viewerDoc.data.contentType ?? "").startsWith("image/") && <img src={viewerDoc.data.url} alt={viewer.label} className="max-h-[70vh] w-full rounded-lg object-contain" />}
            {viewerDoc.data?.hasFile && viewerDoc.data.url && viewerDoc.data.contentType !== "application/pdf" && !(viewerDoc.data.contentType ?? "").startsWith("image/") && <p className="py-8 text-center text-sm font-semibold">{t("adm.unsupportedFile")}</p>}
          </div>
        </div>
      </div>)}

      {removeTarget && (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={t("adm.removeAdminTitle")}>
        <div className="w-full max-w-md rounded-2xl border-2 border-rose-400 bg-[var(--surface)] p-5 shadow-2xl">
          <h3 className="font-display text-lg font-bold text-rose-600">⚠ {t("adm.removeAdminTitle")}</h3>
          <p className="mt-2 text-sm font-bold text-[var(--text)]">{removeTarget.name}</p>
          <p className="text-sm text-[var(--dim)]">{removeTarget.email}</p>
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{t("adm.removeAdminWhat")}</p>
          <div className="mt-3">
            <Field label={t("adm.yourPwAuthorize")}><input type="password" value={removePassword} onChange={(e) => setRemovePassword(e.target.value)} className={errInputCls(!!(removeTouched && !removePassword))} aria-label="Your current password to remove this admin" /><FieldError msg={removeTouched && !removePassword ? t("adm.val.actorPwMissing") : undefined} /></Field>
          </div>
          {removeServerErr && <p role="alert" className="mt-2 text-sm font-semibold text-rose-600">⚠ {removeServerErr}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" aria-label={t("adm.removeAdminConfirm")} disabled={removeAdmin.isPending} onClick={() => { setRemoveTouched(true); if (!removePassword) return; removeAdmin.mutate(); }} className="rounded-lg bg-rose-600 px-4 py-2.5 font-display text-sm font-bold text-white disabled:opacity-50">{t("adm.removeAdminConfirm")}</button>
            <button type="button" aria-label={t("del.cancel")} onClick={() => setRemoveTarget(null)} className={ghostBtn}>{t("del.cancel")}</button>
          </div>
        </div>
      </div>)}

      {deleteTarget && (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={deleteTarget.role === "seller" ? t("del.titleSeller") : t("del.titleBuyer")}>
        <div className="w-full max-w-md rounded-2xl border-2 border-rose-400 bg-[var(--surface)] p-5 shadow-2xl">
          <h3 className="font-display text-lg font-bold text-rose-600">⚠ {deleteTarget.role === "seller" ? t("del.titleSeller") : t("del.titleBuyer")}</h3>
          <p className="mt-2 text-sm font-bold text-[var(--text)]">{deleteTarget.title}</p>
          <p className="text-sm text-[var(--dim)]">{deleteTarget.detail}</p>
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{deleteTarget.role === "seller" ? t("del.sellerWhat") : t("del.buyerWhat")}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" aria-label={t("del.confirmBtn")} disabled={deleteAccount.isPending} onClick={() => deleteAccount.mutate()} className="rounded-lg bg-rose-600 px-4 py-2.5 font-display text-sm font-bold text-white disabled:opacity-50">{t("del.confirmBtn")}</button>
            <button type="button" aria-label={t("del.cancel")} onClick={() => setDeleteTarget(null)} className={ghostBtn}>{t("del.cancel")}</button>
          </div>
        </div>
      </div>)}
    </div>
  );
}


/* -------------------------------- Support --------------------------------- */

const FAQS: Record<Lang, Array<{ q: string; a: string }>> = {
  en: [
    {
      q: "How do I place an order?",
      a: "Create a buyer account (choose your country first — the phone and postal code follow your country), add a product to the cart, then at checkout enter your name, mobile number and full address with your postal code and place the order. At the payment step you choose: Pay on Delivery, or Pay First and then delivery.",
    },
    {
      q: "How many days does delivery take?",
      a: "Delivery time depends on your location. You can follow your order in My Orders — it moves from Pending to Shipment and then to Delivered. If anything is needed from you, Customer Service will message you in Live Chat.",
    },
    {
      q: "How do I become a seller, and how do I earn profit?",
      a: "From the Account page choose Register → Seller and complete the 3-step application: personal details, store details and one ID document (Aadhaar Card, Ration Card, PAN Card, Voter ID, Passport or National ID Card). Your application then goes to Customer Service for verification — once Customer Service verifies your account, you can add products from the main store to your store and start selling; every product shows its profit %. When a buyer orders it, the profit is yours. You can register and sign in with your mobile number or your Gmail — the other one is optional.",
    },
    {
      q: "When and how do I get my profit / wallet money?",
      a: "Profit from completed (delivered) orders is credited to your seller Wallet. From the Wallet in your Seller Dashboard you can request a withdrawal to your UPI ID or bank account — Customer Service approves it and pays you outside the website. Deposits into the wallet also need Customer Service approval.",
    },
    {
      q: "Can a product be returned or exchanged?",
      a: "If a product arrives damaged or wrong, contact us within 7 days through live chat, a support ticket or WhatsApp — the team will guide you through exchange / refund.",
    },
    {
      q: "Which payment methods are accepted?",
      a: "At checkout you choose how to pay: Pay on Delivery (cash when your order arrives), or Pay First with UPI, Bank Account or USDT — for Pay First, type your transaction reference or attach a screenshot of your payment as proof, and your order is delivered after that.",
    },
  ],
  hi: [
    {
      q: "ऑर्डर कैसे करूँ?",
      a: "खरीदार खाता बनाएँ (पहले अपना देश चुनें — फ़ोन नंबर और डाक कोड आपके देश के हिसाब से होगा), प्रोडक्ट कार्ट में डालें, फिर चेकआउट पर नाम, मोबाइल नंबर और डाक कोड के साथ पूरा पता लिखकर ऑर्डर करें। भुगतान चरण में चुनें: डिलीवरी पर भुगतान, या पहले भुगतान और फिर डिलीवरी।",
    },
    {
      q: "डिलीवरी में कितने दिन लगते हैं?",
      a: "डिलीवरी का समय आपकी जगह पर निर्भर करता है। आप अपना ऑर्डर मेरे ऑर्डर में देख सकते हैं — यह Pending से Shipment और फिर Delivered होता है। आपसे कुछ चाहिए होगा तो ग्राहक सेवा लाइव चैट में संदेश भेजेगी।",
    },
    {
      q: "विक्रेता कैसे बनूँ और मुनाफ़ा कैसे मिलेगा?",
      a: "खाता पेज से रजिस्टर → विक्रेता चुनें और 3 चरणों वाला आवेदन पूरा करें: व्यक्तिगत जानकारी, दुकान की जानकारी और एक पहचान दस्तावेज़ (आधार कार्ड, राशन कार्ड, पैन कार्ड, वोटर आईडी, पासपोर्ट या राष्ट्रीय पहचान पत्र)। फिर आपका आवेदन सत्यापन के लिए ग्राहक सेवा के पास जाता है — ग्राहक सेवा के सत्यापित करते ही आप मुख्य स्टोर से प्रोडक्ट अपनी दुकान में जोड़कर बिक्री शुरू कर सकते हैं — हर प्रोडक्ट पर मुनाफ़ा % लिखा होता है। खरीदार ऑर्डर करेगा तो मुनाफ़ा आपका होगा। रजिस्टर और साइन इन मोबाइल नंबर या Gmail से हो सकता है — दूसरा वैकल्पिक है।",
    },
    {
      q: "मुनाफ़ा / वॉलेट का पैसा कब और कैसे मिलेगा?",
      a: "पूर्ण (डिलीवर) ऑर्डर का मुनाफ़ा आपके विक्रेता वॉलेट में जुड़ता है। विक्रेता डैशबोर्ड के वॉलेट से आप अपनी UPI आईडी या बैंक खाते में निकासी का अनुरोध कर सकते हैं — ग्राहक सेवा मंज़ूरी देकर वेबसाइट के बाहर भुगतान करती है। वॉलेट में जमा के लिए भी ग्राहक सेवा की मंज़ूरी चाहिए।",
    },
    {
      q: "क्या प्रोडक्ट वापस / बदला जा सकता है?",
      a: "प्रोडक्ट खराब या गलत आए तो 7 दिन के अंदर लाइव चैट, सहायता टिकट या WhatsApp से संपर्क करें — टीम एक्सचेंज / रिफंड की प्रक्रिया बताएगी।",
    },
    {
      q: "भुगतान के कौन से तरीके हैं?",
      a: "चेकआउट पर आप चुनते हैं कि भुगतान कैसे होगा: डिलीवरी पर भुगतान (ऑर्डर आने पर नकद), या UPI, बैंक खाते या USDT से पहले भुगतान — पहले भुगतान के लिए अपने भुगतान की reference ID लिखें या स्क्रीनशॉट लगाएँ, उसके बाद आपका ऑर्डर डिलीवर होगा।",
    },
  ],
  ar: [
    {
      q: "كيف أقدّم طلبًا؟",
      a: "أنشئ حساب مشترٍ (اختر دولتك أولاً — رقم الهاتف والرمز البريدي يتبعان دولتك)، أضف منتجًا إلى السلة، ثم عند إتمام الشراء أدخل اسمك ورقم هاتفك المحمول وعنوانك الكامل مع الرمز البريدي وقدّم الطلب. في خطوة الدفع تختار: الدفع عند الاستلام، أو الدفع أولاً ثم التوصيل.",
    },
    {
      q: "كم يومًا يستغرق التوصيل؟",
      a: "يعتمد وقت التوصيل على موقعك. يمكنك متابعة طلبك في طلباتي — ينتقل من قيد الانتظار إلى الشحن ثم إلى تم التوصيل. إذا احتجنا منك شيئًا، ستراسلك خدمة العملاء في الدردشة المباشرة.",
    },
    {
      q: "كيف أصبح بائعًا، وكيف أربح الربح؟",
      a: "من صفحة الحساب اختر التسجيل ← بائع وأكمل الطلب المكوّن من 3 خطوات: البيانات الشخصية وبيانات المتجر ووثيقة هوية واحدة (بطاقة Aadhaar أو بطاقة التموين أو بطاقة PAN أو بطاقة الناخب أو جواز السفر أو بطاقة الهوية الوطنية). ثم يذهب طلبك إلى خدمة العملاء للتحقق — بمجرد أن تتحقق خدمة العملاء من حسابك، يمكنك إضافة منتجات من المتجر الرئيسي إلى متجرك وبدء البيع؛ يعرض كل منتج نسبة ربحه. عندما يطلبه مشترٍ، يكون الربح لك. يمكنك التسجيل وتسجيل الدخول برقم هاتفك المحمول أو Gmail — الآخر اختياري.",
    },
    {
      q: "متى وكيف أحصل على ربحي / أموال محفظتي؟",
      a: "يُضاف ربح الطلبات المكتملة (التي تم توصيلها) إلى محفظة البائع الخاصة بك. من المحفظة في لوحة تحكم البائع يمكنك طلب سحب إلى معرّف UPI أو حسابك البنكي — توافق خدمة العملاء وتدفع لك خارج الموقع. تحتاج الإيداعات في المحفظة أيضًا إلى موافقة خدمة العملاء.",
    },
    {
      q: "هل يمكن إرجاع منتج أو استبداله؟",
      a: "إذا وصل منتج تالفًا أو خاطئًا، تواصل معنا خلال 7 أيام عبر الدردشة المباشرة أو تذكرة دعم أو WhatsApp — سيرشدك الفريق خلال الاستبدال / الاسترداد.",
    },
    {
      q: "ما طرق الدفع المقبولة؟",
      a: "عند إتمام الشراء تختار طريقة الدفع: الدفع عند الاستلام (نقدًا عند وصول طلبك)، أو الدفع أولاً عبر UPI أو الحساب البنكي أو USDT — للدفع أولاً اكتب رقم مرجع المعاملة أو أرفق لقطة شاشة لدفعتك كإثبات، ويتم توصيل طلبك بعد ذلك.",
    },
  ],
};

/* ------------------------- Chat attachments ------------------------- */

type ChatAttachmentData = { fileName: string; contentType: string; dataBase64: string };

const CHAT_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const CHAT_FILE_MAX = 3 * 1024 * 1024;

// Reads + validates a picked chat file (images JPG/PNG, PDF; max 3 MB).
// Returns a written error for anything else — same style as the other
// uploads in the app.
async function readChatAttachment(
  file: File,
): Promise<{ ok: true; att: ChatAttachmentData } | { ok: false; error: string }> {
  if (!CHAT_FILE_TYPES.includes(file.type)) {
    return { ok: false, error: "Only JPG, PNG or PDF files can be attached in chat. Please choose an image or a PDF document." };
  }
  if (file.size > CHAT_FILE_MAX) {
    return { ok: false, error: "File is too large — maximum 3 MB. Please choose a smaller photo or document." };
  }
  if (file.size === 0) return { ok: false, error: "The selected file is empty." };
  const enc = await fileToBase64(file);
  return { ok: true, att: { fileName: file.name, contentType: enc.mimeType || file.type, dataBase64: enc.dataBase64 } };
}

// Reads + validates a deposit payment screenshot: JPG/PNG images only,
// max 3 MB (the same limit the server enforces in requestDeposit).
async function readDepositScreenshot(
  file: File,
): Promise<{ ok: true; att: ChatAttachmentData } | { ok: false; error: string }> {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    return { ok: false, error: "Only JPG or PNG images can be attached as a payment screenshot. Please choose an image file (JPG or PNG)." };
  }
  if (file.size > CHAT_FILE_MAX) {
    return { ok: false, error: "Screenshot is too large — maximum 3 MB. Please choose a smaller image." };
  }
  if (file.size === 0) return { ok: false, error: "The selected screenshot file is empty." };
  const enc = await fileToBase64(file);
  return { ok: true, att: { fileName: file.name, contentType: enc.mimeType || file.type, dataBase64: enc.dataBase64 } };
}

// The 📎 picker + pending-file chip shown next to a chat message input.
function ChatAttachPicker({
  pending,
  onPick,
  onClear,
  pickerId,
}: {
  pending: ChatAttachmentData | null;
  onPick: (f: File | null) => void;
  onClear: () => void;
  pickerId: string;
}) {
  const { t } = useUi();
  return (
    <>
      <input
        id={pickerId}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        aria-label={t("sup.attach")}
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <label
        htmlFor={pickerId}
        aria-label={t("sup.attach")}
        title={t("sup.attach")}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-lg"
      >
        📎
      </label>
      {pending && (
        <span className="flex min-w-0 max-w-44 items-center gap-1 rounded-lg bg-[var(--surface-alt)] px-2 py-1 text-xs font-semibold text-[var(--text)]">
          <span className="truncate">📎 {pending.fileName}</span>
          <button type="button" aria-label={t("sup.removeAttachment")} onClick={onClear} className="shrink-0 px-1 font-bold text-rose-600">
            ✕
          </button>
        </span>
      )}
    </>
  );
}

// One message's attachment inside the thread: images show as a tappable
// thumbnail (tap = full-size view), PDFs as a document chip that opens
// in the viewer or downloads. The file URL is fetched per message from
// getChatAttachmentUrl, which only serves the thread owner / an Admin.
function ChatAttachmentView({ m, requesterId }: { m: ChatMessage; requesterId: number }) {
  const { t } = useUi();
  const [viewing, setViewing] = useState(false);
  const att = useQuery({
    queryKey: ["chat-attachment", requesterId, m.id],
    queryFn: () => api.getChatAttachmentUrl({ requesterId, messageId: m.id }),
    enabled: m.hasAttachment && requesterId > 0,
  });
  if (!m.hasAttachment) return null;
  const url = att.data?.url ?? null;
  const name = att.data?.fileName ?? m.attachmentFileName ?? t("sup.attachment");
  const ct = att.data?.contentType ?? m.attachmentContentType ?? "";
  const size = att.data?.size ?? m.attachmentSize;
  const isImage = ct.startsWith("image/");
  const isPdf = ct === "application/pdf";
  return (
    <div className="mt-1.5">
      {isImage && url ? (
        <button type="button" aria-label={`${t("adm.openView")}: ${name}`} onClick={() => setViewing(true)} className="block overflow-hidden rounded-lg">
          <img src={url} alt={name} className="max-h-44 w-auto max-w-full rounded-lg object-cover" />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-[var(--text)]">
          <span className="text-base">{isPdf ? "📄" : "📎"}</span>
          <span className="min-w-0 max-w-48 truncate text-xs font-bold">{name}</span>
          {size ? <span className="text-[10px] text-[var(--dim)]">{formatBytes(size)}</span> : null}
          {url && (
            <>
              <button type="button" aria-label={`${t("adm.openView")}: ${name}`} onClick={() => setViewing(true)} className="text-xs font-bold text-[var(--accent)]">
                {t("adm.openView")}
              </button>
              <a href={url} download={name} target="_blank" rel="noreferrer" aria-label={`${t("adm.download")}: ${name}`} className="text-xs font-bold text-[var(--accent)]">
                {t("adm.download")}
              </a>
            </>
          )}
        </div>
      )}
      {isImage && url && <p className="mt-0.5 text-[10px] opacity-70">📎 {name}</p>}
      {viewing && url && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={name}>
          <div className="my-6 w-full max-w-3xl rounded-2xl bg-[var(--surface)] p-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <strong className="min-w-0 flex-1 truncate font-display text-[var(--text)]">{name}</strong>
              <a href={url} download={name} target="_blank" rel="noreferrer" className={ghostBtn + " px-3 py-1.5 text-xs"}>
                {t("adm.download")}
              </a>
              <button type="button" aria-label={t("menu.close")} onClick={() => setViewing(false)} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[var(--text)]">
                ✕
              </button>
            </div>
            <div className="mt-3">
              {isPdf ? (
                <PdfViewer
                  src={url}
                  ariaLabel={name}
                  labels={{
                    loading: t("common.loading"),
                    loadError: "This PDF couldn’t be loaded.",
                    pageError: "This PDF page couldn’t be rendered.",
                    previousPage: "Previous",
                    nextPage: "Next",
                    pageIndicator: (pg, tot) => `Page ${pg} of ${tot}`,
                    navigationAriaLabel: `${name} pages`,
                    pageAriaLabel: (pg) => `${name}, page ${pg}`,
                  }}
                />
              ) : isImage ? (
                <img src={url} alt={name} className="max-h-[75vh] w-full rounded-lg object-contain" />
              ) : (
                <p className="py-8 text-center text-sm font-semibold text-[var(--text)]">{t("adm.unsupportedFile")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// One chat bubble (customer or Admin side) with its text, attachment and
// timestamp — shared by the customer chat view and both Admin threads.
function ChatBubble({
  m,
  requesterId,
  ownSender,
  ownLabel,
  otherLabel,
}: {
  m: ChatMessage;
  requesterId: number;
  ownSender: "customer" | "admin";
  ownLabel: string;
  otherLabel: string;
}) {
  const own = m.sender === ownSender;
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
        own ? "self-end bg-[var(--accent)] text-white" : "self-start border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
      }`}
    >
      {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
      <ChatAttachmentView m={m} requesterId={requesterId} />
      <p className={`mt-0.5 text-[10px] ${own ? "text-white/70" : "text-[var(--dim)]"}`}>
        {own ? ownLabel : otherLabel} · {new Date(m.createdAt).toLocaleString()}
      </p>
    </div>
  );
}

// The dedicated chat view: opening Live Chat replaces the Support page
// with this screen (Back returns to Support). The layout is fixed —
// header on top, the message list in its OWN scrollable area in the
// middle, and the input row pinned at the bottom — so a long history
// never stretches the page or scrolls the input away. The view opens on
// the latest message, follows new messages while the user is at the
// bottom, and shows a "jump to latest" button when they scroll up.
function LiveChat({
  user,
  onNeedAuth,
  focusSignal,
  onBack,
}: {
  user: User;
  onNeedAuth: () => void;
  focusSignal?: number;
  onBack: () => void;
}) {
  const { t } = useUi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [pendingAtt, setPendingAtt] = useState<ChatAttachmentData | null>(null);
  const [attErr, setAttErr] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stickRef = useRef(true);
  const chat = useQuery({
    queryKey: ["chat-messages", user?.id],
    queryFn: () => api.listChatMessages({ userId: user!.id }),
    enabled: !!user && user.role !== "admin",
    refetchInterval: 5000,
  });
  const send = useMutation({
    mutationFn: () =>
      api.sendChatMessage({
        userId: user!.id,
        message: draft,
        ...(pendingAtt ? { attachment: pendingAtt } : {}),
      }),
    onSuccess: (r) => {
      if (!r.ok) {
        setSendErr(r.error ?? "The message could not be sent. Please try again.");
        return;
      }
      setSendErr(null);
      setDraft("");
      setPendingAtt(null);
      stickRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
    onError: (e) => setSendErr(String(e)),
  });
  const messages = chat.data?.messages ?? [];

  const scrollToLatest = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  // Follow new messages only while the user is at (or near) the bottom;
  // when they have scrolled up to read history, leave them there and
  // offer the jump-to-latest button instead.
  useEffect(() => {
    if (stickRef.current) scrollToLatest();
    else if (messages.length > 0) setShowJump(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Arriving here from ANY chat entry point (the App bumps focusSignal
  // on every one): once the thread has loaded, land on the latest
  // message and focus the input — the chat opens ready to use.
  const focusedForRef = useRef(-1);
  useEffect(() => {
    if (!user || user.role === "admin") return;
    if (chat.isPending) return; // wait for the async thread load
    const signal = focusSignal ?? 0;
    if (focusedForRef.current === signal) return;
    focusedForRef.current = signal;
    const timer = window.setTimeout(() => {
      stickRef.current = true;
      scrollToLatest();
      inputRef.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal, chat.isPending, user?.id, user?.role]);

  async function pickAttachment(f: File | null) {
    setAttErr(null);
    if (!f) return;
    const r = await readChatAttachment(f);
    if (!r.ok) {
      setAttErr(r.error);
      return;
    }
    setPendingAtt(r.att);
  }

  return (
    <section
      aria-label={t("sup.liveTitle")}
      className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
      style={{ height: "calc(100dvh - var(--header-h, 3.5rem) - 8.5rem)", minHeight: "24rem" }}
    >
      <div className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onBack} aria-label={t("sup.backToSupport")} className={ghostBtn + " shrink-0 px-3 py-1.5 text-[13px]"}>
          {t("sup.backToSupport")}
        </button>
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold leading-tight text-[var(--text)]">{t("sup.liveTitle")}</h3>
          <p className="text-xs leading-snug text-[var(--dim)]">{t("sup.liveSub")}</p>
        </div>
      </div>
      {!user || user.role === "admin" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-[var(--dim)]">{t("sup.liveSignIn")}</p>
          {!user && (
            <button type="button" onClick={onNeedAuth} className={primaryBtn + " mt-2"}>
              {t("header.signIn")}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              className="flex h-full flex-col gap-2 overflow-y-auto bg-[var(--bg)] p-3"
              aria-label="Live chat messages"
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                stickRef.current = nearBottom;
                setShowJump(!nearBottom);
              }}
            >
              {chat.isPending ? (
                <p className="py-4 text-center text-sm text-[var(--dim)]">{t("common.loading")}</p>
              ) : messages.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--dim)]">{t("sup.chatEmpty")}</p>
              ) : (
                messages.map((m: ChatMessage) => (
                  <ChatBubble key={m.id} m={m} requesterId={user.id} ownSender="customer" ownLabel={t("sup.you")} otherLabel={t("sup.admin")} />
                ))
              )}
            </div>
            {showJump && messages.length > 0 && (
              <button
                type="button"
                aria-label={t("sup.jumpLatest")}
                onClick={() => {
                  stickRef.current = true;
                  setShowJump(false);
                  scrollToLatest();
                }}
                className="absolute bottom-3 right-3 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white shadow-lg"
              >
                {t("sup.jumpLatest")}
              </button>
            )}
          </div>
          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4">
            <p className="mb-1.5 text-[11px] leading-snug text-[var(--dim)]">📎 {t("sup.attachHint")}</p>
            {attErr && (
              <p role="alert" className="mb-1.5 text-sm font-semibold text-rose-600">
                ⚠ {attErr}
              </p>
            )}
            {sendErr && (
              <p role="alert" className="mb-1.5 text-sm font-semibold text-rose-600">
                ⚠ {sendErr}
              </p>
            )}
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim() || pendingAtt) send.mutate();
              }}
            >
              <ChatAttachPicker pickerId="live-chat-attach" pending={pendingAtt} onPick={pickAttachment} onClear={() => setPendingAtt(null)} />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t("sup.chatPh")}
                className={inputCls + " min-w-0 flex-1"}
                aria-label="Type a message to Customer Service"
              />
              <button
                type="submit"
                aria-label="Send chat message"
                disabled={(!draft.trim() && !pendingAtt) || send.isPending}
                className={primaryBtn + " shrink-0"}
              >
                {t("sup.send")}
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}

function SupportView({
  user,
  settings,
  onNeedAuth,
  focusSignal,
  startInChat,
}: {
  user: User;
  settings: ApiResponse<typeof api, "getSettings"> | undefined;
  onNeedAuth: () => void;
  focusSignal?: number;
  startInChat?: boolean;
}) {
  const { t, lang } = useUi();
  const queryClient = useQueryClient();
  // Landing rule (owner's choice): arriving through the general
  // Support / Customer Service entry shows the Customer Support
  // OVERVIEW first — Live Chat card, WhatsApp, Email, FAQ and ticket —
  // so all services are visible. The dedicated chat view opens only
  // from the overview's "Open Chat" button, or directly when the entry
  // point's explicit purpose is the chat itself (startInChat: Forgot
  // Password "Open Live Chat", deposit / verification contact buttons).
  // Back inside the chat returns here, to the full Support page.
  const [chatOpen, setChatOpen] = useState(!!startInChat);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const myTickets = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: () => api.listMyTickets({ userId: user!.id }),
    enabled: !!user,
  });
  const create = useMutation({
    mutationFn: () =>
      api.createTicket({
        userId: user?.id ?? null,
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message,
      }),
    onSuccess: () => {
      setSent(true);
      setForm({ ...form, subject: "", message: "" });
      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  const whatsappDigits = (settings?.supportWhatsapp ?? "").replace(/[^0-9]/g, "");
  const whatsappIntl = whatsappDigits.startsWith("0")
    ? `91${whatsappDigits.slice(1)}`
    : whatsappDigits.length === 10
      ? `91${whatsappDigits}`
      : whatsappDigits;

  if (chatOpen) {
    return <LiveChat user={user} onNeedAuth={onNeedAuth} focusSignal={focusSignal} onBack={() => setChatOpen(false)} />;
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-[var(--text)]">{t("sup.title")}</h2>
      <p className="mt-1 text-sm text-[var(--dim)]">{t("sup.sub")}</p>

      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <h3 className="font-display text-lg font-bold text-[var(--text)]">{t("sup.liveTitle")}</h3>
        <p className="mt-1 text-sm text-[var(--dim)]">{t("sup.liveSub")}</p>
        <button type="button" onClick={() => setChatOpen(true)} aria-label={t("sup.openChat")} className={primaryBtn + " mt-3"}>
          💬 {t("sup.openChat")}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-display font-bold text-[var(--text)]">{t("sup.whatsappT")}</h3>
          {settings?.supportWhatsapp ? (
            <>
              <p className="mt-1 text-sm text-[var(--dim)]">{settings.supportWhatsapp}</p>
              <a
                href={`https://wa.me/${whatsappIntl}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-lg bg-[#25d366] px-4 py-2.5 font-display text-sm font-bold text-white"
              >
                {t("sup.whatsappBtn")}
              </a>
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--dim)]">{t("sup.whatsappSoon")}</p>
          )}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="font-display font-bold text-[var(--text)]">{t("sup.emailT")}</h3>
          {settings?.supportEmail ? (
            <p className="mt-1 text-sm text-[var(--dim)]">
              <a className="break-all font-semibold text-[var(--accent)]" href={`mailto:${settings.supportEmail}`}>
                {settings.supportEmail}
              </a>
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--dim)]">{t("sup.emailSoon")}</p>
          )}
          <p className="mt-2 text-xs text-[var(--dim)]">{t("sup.timings")}</p>
        </div>
      </div>

      <h3 className="mt-7 font-display text-lg font-bold text-[var(--text)]">{t("sup.faqT")}</h3>
      <div className="mt-3 flex flex-col gap-2">
        {FAQS[lang].map((f) => (
          <details
            key={f.q}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <summary className="cursor-pointer font-semibold text-[var(--text)]">{f.q}</summary>
            <p className="mt-2 text-sm text-[var(--dim)]">{f.a}</p>
          </details>
        ))}
      </div>

      <h3 className="mt-7 font-display text-lg font-bold text-[var(--text)]">{t("sup.ticketT")}</h3>
      {sent && (
        <p role="status" className="mt-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm font-medium text-[var(--text)]">
          {t("sup.ticketSent")}
          {user ? t("sup.ticketSentIn") : "."}
        </p>
      )}
      <form
        className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(false);
          create.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("sup.yourName")}>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} aria-label="Your name for ticket" />
          </Field>
          <Field label={t("acc.email")}>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} aria-label="Your email for ticket" />
          </Field>
        </div>
        <Field label={t("sup.subject")}>
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t("sup.subjectPh")} className={inputCls} aria-label="Ticket subject" />
        </Field>
        <Field label={t("sup.message")}>
          <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={inputCls} aria-label="Ticket message" />
        </Field>
        {create.error && <p className="text-sm text-rose-600">{String(create.error)}</p>}
        <button type="submit" disabled={create.isPending} className={primaryBtn + " self-start"}>
          {create.isPending ? t("sup.sending") : t("sup.submitTicket")}
        </button>
      </form>

      {user && (
        <>
          <h3 className="mt-7 font-display text-lg font-bold text-[var(--text)]">{t("sup.myTickets")}</h3>
          {(myTickets.data?.tickets ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-[var(--dim)]">{t("sup.noTickets")}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {(myTickets.data?.tickets ?? []).map((tk: Ticket) => (
                <div key={tk.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[var(--text)]">{tk.subject}</strong>
                    <StatusBadge status={tk.status} />
                    <span className="ml-auto text-xs text-[var(--dim)]">
                      {new Date(tk.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--dim)]">{tk.message}</p>
                  {tk.reply && (
                    <p className="mt-2 rounded-lg bg-[var(--surface-alt)] px-3 py-2 text-sm text-[var(--text)]">
                      <strong>{t("sup.teamReply")}</strong> {tk.reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------------------------- App ----------------------------------- */

export function App() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("shop");
  // Bumped ONLY by goSupportChat() — the entry points whose explicit
  // purpose is opening the chat itself (Forgot Password "Open Live
  // Chat", the deposit-page and verification "Contact Customer Service"
  // buttons). LiveChat watches it and, once the thread has loaded,
  // scrolls itself into view and focuses the message input.
  const [chatFocusSignal, setChatFocusSignal] = useState(0);
  // Support landing intent: the general Support / Customer Service
  // entry (bottom nav, drawer, footer) opens the Customer Support
  // OVERVIEW first (all services visible); only explicit chat buttons
  // start inside the chat. supportVisit remounts SupportView on every
  // entry so the landing intent is always honoured.
  const [supportVisit, setSupportVisit] = useState(0);
  const [supportStartInChat, setSupportStartInChat] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Slim auto-shrinking header: `headerMini` collapses the bar while the
  // user scrolls down and restores it on scroll-up; `headerH` is the
  // measured header height so sticky bars below offset exactly.
  const [headerMini, setHeaderMini] = useState(false);
  const [headerH, setHeaderH] = useState(44);
  const headerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 140 && y - lastY > 6) setHeaderMini(true);
        else if (lastY - y > 6 || y < 60) setHeaderMini(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const h = Math.round(el.offsetHeight);
      setHeaderH(h);
      // Shared with CSS (chat scroll margins, the notification panel's
      // mobile position) so they track the header's real height at
      // every width — the header wraps taller on small phones.
      document.documentElement.style.setProperty("--header-h", `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [shopCategory, setShopCategory] = useState("All");
  const [sellerTab, setSellerTab] = useState<SellerTab>("home");
  const [sellerKey, setSellerKey] = useState(0);
  const [user, setUser] = useState<User>(() => loadSession());
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof localStorage === "undefined") return "en";
    const saved = localStorage.getItem(LANG_KEY);
    return saved === "hi" || saved === "ar" ? saved : "en";
  });
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof localStorage === "undefined") return "INR";
    const saved = localStorage.getItem(CURRENCY_KEY);
    return saved === "USD" || saved === "USDT" ? saved : "INR";
  });
  const [theme, setTheme] = useState<ThemeMode>(() =>
    typeof localStorage !== "undefined" && localStorage.getItem(THEME_KEY) === "dark"
      ? "dark"
      : "light",
  );

  // Apply the saved theme choice to the whole app (shop, dashboards,
  // wallet, support, admin, forms) via the CSS variables in theme.css.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings({}),
  });
  // Admin-controlled settings (language/currency switches, deposit
  // address + ON/OFF, theme & design, store contacts) must reach the
  // visitor side without a hard refresh: re-read them every time the
  // app returns to a visitor-facing view (leaving the Admin Panel,
  // opening the shop / seller / support / account), so a change the
  // Admin just saved is what the visitor side renders.
  const refetchSettings = settings.refetch;
  useEffect(() => {
    if (view !== "admin") void refetchSettings();
  }, [view, refetchSettings]);
  const storeName = settings.data?.storeName ?? "sheinstore";
  // Admin-chosen store design (settings): colour scheme recolours the
  // whole store for everyone; layout design rearranges the chrome.
  const colorScheme = settings.data?.colorScheme ?? "navy";
  const layoutDesign = settings.data?.layoutDesign ?? "classic";
  useEffect(() => {
    document.documentElement.dataset.scheme = colorScheme;
  }, [colorScheme]);
  // Every navigation (and the first load) starts at the top of the page.
  // As a single-page app, view switches used to keep the previous scroll
  // position, so a newly opened view could start halfway down the page.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, [view, sellerTab]);
  const [shopSearch, setShopSearch] = useState("");

  // Language & Prices switches (Admin → Settings): pickers show only
  // what is ON. English is always ON. If the visitor's selected language
  // / currency has been switched OFF by the Admin, the effective value
  // falls back automatically — language to English, currency to INR or
  // the first currency still ON — with no error anywhere.
  const enabledLangs = useMemo<Lang[]>(() => {
    const list: Lang[] = ["en"];
    if (settings.data?.langHindiEnabled ?? true) list.push("hi");
    if (settings.data?.langArabicEnabled ?? true) list.push("ar");
    return list;
  }, [settings.data]);
  const enabledCurrencies = useMemo<Currency[]>(() => {
    const list: Currency[] = [];
    if (settings.data?.currencyInrEnabled ?? true) list.push("INR");
    if (settings.data?.currencyUsdEnabled ?? true) list.push("USD");
    if (settings.data?.currencyUsdtEnabled ?? true) list.push("USDT");
    // Server refuses an all-OFF set, but never render a currency-less app.
    return list.length > 0 ? list : ["INR"];
  }, [settings.data]);
  const effectiveLang: Lang = enabledLangs.includes(lang) ? lang : "en";
  const effectiveCurrency: Currency = enabledCurrencies.includes(currency)
    ? currency
    : (enabledCurrencies[0] ?? "INR");

  // Arabic reads right-to-left: flip the whole page direction with the
  // language, and back again for English/Hindi.
  useEffect(() => {
    document.documentElement.dir = effectiveLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = effectiveLang;
  }, [effectiveLang]);

  const ui = useMemo<Ui>(
    () => ({
      lang: effectiveLang,
      currency: effectiveCurrency,
      enabledLangs,
      enabledCurrencies,
      t: (key) => tr(effectiveLang, key),
      fmt: (n) => formatMoney(n, effectiveCurrency),
      headerH,
      layout: layoutDesign,
    }),
    [effectiveLang, effectiveCurrency, enabledLangs, enabledCurrencies, headerH, layoutDesign],
  );

  const seed = useMutation({
    mutationFn: () => api.seedCatalog({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
  const indiaSync = useMutation({
    mutationFn: () => api.ensureIndiaCatalog({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
  const hashUpgrade = useMutation({ mutationFn: () => api.ensurePasswordHashes({}) });
  const extSeed = useMutation({
    mutationFn: () => api.seedExternalProducts({}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["external-products"] }),
  });
  const seededOnce = useRef(false);
  useEffect(() => {
    if (!seededOnce.current) {
      seededOnce.current = true;
      seed.mutate();
      indiaSync.mutate();
      hashUpgrade.mutate();
      extSeed.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cart = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: () => api.getCart({ buyerId: user!.id }),
    enabled: !!user && user.role === "buyer",
  });
  const cartCount = cart.data?.items.reduce((s, it) => s + it.qty, 0) ?? 0;

  const sellerNotifs = useQuery({
    queryKey: ["seller-notifications", user?.id],
    queryFn: () => api.listSellerNotifications({ sellerId: user!.id }),
    enabled: !!user && user.role === "seller",
    refetchInterval: 10000,
  });
  const sellerUnread = sellerNotifs.data?.unreadCount ?? 0;
  const markSellerSeen = useMutation({
    mutationFn: () => api.markSellerNotificationsSeen({ sellerId: user!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller-notifications"] }),
  });

  // Bottom / desktop navigation: NO Cart and NO Orders here — Cart lives
  // only in the ☰ hamburger drawer, and Orders moved into the drawer too.
  // The Products tab (the seller's Add-to-My-Store section) takes Orders'
  // place in this bar; buyers/visitors get the Become-a-Seller shell there.
  type NavItem = {
    key: string;
    label: string;
    icon: ReactNode;
    view?: View;
    sellerTab?: SellerTab;
    isNew?: boolean;
  };
  // Seller navigation order (owner's settled choice): Shop first,
  // then Products, then Wallet / Seller / Support / Account — the
  // same order buyers/visitors see. Shop is where sellers browse the
  // catalog and add products to their own store; the Products tab
  // shows only the seller's added products, with Remove.
    const navIconCls = "h-5 w-5 shrink-0";
  const iconShop = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></svg>);
  const iconProducts = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>);
  const iconWallet = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M16 15h2" /></svg>);
  const iconStore = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><path d="M4 8 5.5 3h13L20 8" /><path d="M4 8v12h16V8" /><path d="M9 20v-5h6v5" /></svg>);
  const iconChat = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.6 0-3.1-.4-4.4-1.2L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8 11.5h8" /><path d="M8 8.5h5" /></svg>);
  const iconUser = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>);
  const iconGear = (<svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={navIconCls}><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" /></svg>);
const NAV: NavItem[] =
    user?.role === "seller"
      ? [
          { key: "shop", view: "shop", label: ui.t("nav.shop"), icon: iconShop },
          { key: "products", sellerTab: "products", label: ui.t("nav.products"), icon: iconProducts, isNew: true },
          { key: "wallet", sellerTab: "wallet", label: ui.t("nav.wallet"), icon: iconWallet },
          { key: "seller", sellerTab: "home", label: ui.t("nav.seller"), icon: iconStore },
          { key: "support", view: "support", label: ui.t("nav.support"), icon: iconChat },
          { key: "account", view: "account", label: ui.t("nav.account"), icon: iconUser },
        ]
      : [
          { key: "shop", view: "shop", label: ui.t("nav.shop"), icon: iconShop },
          { key: "products", sellerTab: "products", label: ui.t("nav.products"), icon: iconProducts, isNew: true },
          { key: "wallet", sellerTab: "wallet", label: ui.t("nav.wallet"), icon: iconWallet },
          { key: "seller", sellerTab: "home", label: ui.t("nav.seller"), icon: iconStore },
          { key: "support", view: "support", label: ui.t("nav.support"), icon: iconChat },
          { key: "account", view: "account", label: ui.t("nav.account"), icon: iconUser },
        ];
  // General Support / Customer Service entry: land on the Customer
  // Support overview page first — Live Chat card, WhatsApp, Email,
  // FAQ and ticket — so every service is visible. The chat itself
  // opens only from the overview's "Open Chat" button.
  function goSupport() {
    setSupportStartInChat(false);
    setSupportVisit((v) => v + 1);
    setView("support");
    setDrawerOpen(false);
  }
  // Explicit chat entry points (a button whose purpose IS the chat):
  // these still open the dedicated chat view directly.
  function goSupportChat() {
    setSupportStartInChat(true);
    setChatFocusSignal((n) => n + 1);
    setSupportVisit((v) => v + 1);
    setView("support");
    setDrawerOpen(false);
  }
  function navGo(n: NavItem) {
    if (n.sellerTab) goSellerTab(n.sellerTab);
    else if (n.view === "support") goSupport();
    else if (n.view) setView(n.view);
  }
  function navCurrent(n: NavItem): boolean {
    if (n.sellerTab) return view === "seller" && sellerTab === n.sellerTab;
    return view === n.view;
  }

  function handleAuth(u: NonNullable<User>) {
    setUser(u);
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    queryClient.invalidateQueries();
    if (u.role === "seller") { setSellerTab("home"); setSellerKey((k) => k + 1); setView("seller"); }
    else if (u.role === "admin") setView("admin");
    else setView("shop");
  }
  function handleUserUpdated(u: NonNullable<User>) {
    setUser(u);
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
    queryClient.invalidateQueries();
  }
  function handleSignOut() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    queryClient.invalidateQueries();
    setView("shop");
  }
  function changeLang(l: Lang) {
    setLang(l);
    localStorage.setItem(LANG_KEY, l);
  }
  function changeCurrency(c: Currency) {
    setCurrency(c);
    localStorage.setItem(CURRENCY_KEY, c);
  }
  function changeTheme(next: ThemeMode) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function goShopCategory(c: string) {
    setShopCategory(c);
    setView("shop");
    setDrawerOpen(false);
  }
  function goSellerTab(tab: SellerTab) {
    setSellerTab(tab);
    setSellerKey((k) => k + 1);
    setView("seller");
    setDrawerOpen(false);
  }
  function goView(v: View) {
    if (v === "support") { goSupport(); return; }
    setView(v);
    setDrawerOpen(false);
  }

  return (
    <UiContext.Provider value={ui}>
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
        <header ref={headerRef} className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_16px_rgba(15,23,42,0.10)] pt-safe">
          <div className={`mx-auto flex max-w-6xl flex-wrap items-center gap-x-1.5 px-3 transition-all duration-300 sm:px-4 ${headerMini ? "gap-y-0 py-0.5" : "gap-y-0.5 py-0.5"}`}>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label={ui.t("menu.open")}
              aria-expanded={drawerOpen}
              className={`rounded-full bg-[var(--surface-alt)] px-2.5 leading-none text-[var(--text)] transition-all duration-300 ${headerMini ? "min-h-8 py-0.5 text-[13px]" : "min-h-9 py-0.5 text-[15px]"}`}
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => (user?.role === "seller" ? goSellerTab("home") : setView("shop"))}
              aria-label={`${storeName} home`}
              className={`min-w-0 max-w-[34vw] truncate text-left font-display font-extrabold tracking-tight text-[var(--accent)] transition-all duration-300 ${headerMini ? "text-sm" : "text-lg"}`}
            >
              {storeName}
              <span className="text-[var(--gold)]">.</span>
            </button>
            <span className={headerMini ? "hidden" : "hidden text-xs font-medium text-[var(--dim)] lg:block"}>
              {ui.t("header.tagline")}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <div
                className="flex overflow-hidden rounded-full bg-[var(--surface-alt)] p-0.5"
                role="group"
                aria-label={ui.t("header.currency")}
              >
                {/* Only currencies the Admin has switched ON are shown. */}
                {enabledCurrencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c === "INR" ? "Show prices in Indian Rupees" : c === "USD" ? "Show prices in US Dollars" : "Show prices in USDT"}
                    aria-pressed={effectiveCurrency === c}
                    onClick={() => changeCurrency(c)}
                    className={`rounded-full px-2 text-[10px] font-bold transition-all duration-300 ${headerMini ? "min-h-7 py-0" : "min-h-8 py-0.5"} ${effectiveCurrency === c ? "bg-[var(--accent)] text-white" : "text-[var(--dim)]"}`}
                  >
                    {c === "INR" ? "₹ INR" : c === "USD" ? "$ USD" : "USDT"}
                  </button>
                ))}
              </div>
              <div
                className="flex overflow-hidden rounded-full bg-[var(--surface-alt)] p-0.5"
                role="group"
                aria-label={ui.t("header.language")}
              >
                {/* Only languages the Admin has switched ON are shown;
                    English is always ON. */}
                {enabledLangs.map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-label={l === "en" ? "Switch language to English" : l === "hi" ? "Switch language to Hindi" : "Switch language to Arabic"}
                    aria-pressed={effectiveLang === l}
                    onClick={() => changeLang(l)}
                    className={`rounded-full px-2 text-[10px] font-bold transition-all duration-300 ${headerMini ? "min-h-7 py-0" : "min-h-8 py-0.5"} ${effectiveLang === l ? "bg-[var(--accent)] text-white" : "text-[var(--dim)]"}`}
                  >
                    {l === "en" ? "EN" : l === "hi" ? "हिंदी" : "عربي"}
                  </button>
                ))}
              </div>
              {user?.role === "seller" && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { const next = !notifOpen; setNotifOpen(next); if (next && sellerUnread > 0) { /* keep unread until panel viewed */ } }}
                    aria-label={`${ui.t("notif.bell")}${sellerUnread > 0 ? `, ${sellerUnread} unread` : ""}`}
                    aria-expanded={notifOpen}
                    className={`relative rounded-full bg-[var(--surface-alt)] px-2.5 leading-none transition-all duration-300 ${headerMini ? "min-h-8 py-0.5 text-[13px]" : "min-h-9 py-0.5 text-[15px]"}`}
                  >
                    🔔
                    {sellerUnread > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-[var(--alert)] px-1 font-display text-[11px] font-bold text-white">
                        {sellerUnread > 99 ? "99+" : sellerUnread}
                      </span>
                    )}
                  </button>
                  {notifOpen && (
                    <div className="fixed inset-x-3 top-[calc(var(--header-h,3.5rem)+8px)] z-50 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:rtl:left-0 sm:rtl:right-auto" role="dialog" aria-label={ui.t("notif.title")}>
                      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-white">
                        <span aria-hidden>🔔</span>
                        <strong className="flex-1 font-display text-sm">{ui.t("notif.title")}{sellerUnread > 0 ? ` (${sellerUnread})` : ""}</strong>
                        <button type="button" aria-label={ui.t("menu.close")} onClick={() => setNotifOpen(false)} className="rounded px-1.5 py-0.5 text-white/90">✕</button>
                      </div>
                      <div className="max-h-80 overflow-y-auto p-2">
                        {(sellerNotifs.data?.notifications ?? []).length === 0 ? (
                          <p className="px-2 py-4 text-center text-sm text-[var(--dim)]">{ui.t("notif.empty")}</p>
                        ) : (
                          (sellerNotifs.data?.notifications ?? []).map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => { setNotifOpen(false); goSellerTab("orders"); }}
                              aria-label={`Open order ${n.orderId}`}
                              className={`mb-1 flex w-full gap-2 rounded-lg px-3 py-2 text-left ${!n.isRead ? "border border-[var(--alert)] bg-[var(--alert-bg)]" : "hover:bg-[var(--surface-alt)]"}`}
                            >
                              <span aria-hidden className="text-lg">📦</span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-[var(--text)]">{ui.t("notif.newOrder")} — {ui.t("notif.orderWord")} #{n.orderId}</span>
                                <span className="block truncate text-xs text-[var(--dim)]">{n.productName} · {ui.fmt(n.amount)}</span>
                                <span className="block text-[11px] text-[var(--dim)]">{new Date(n.createdAt).toLocaleString()}</span>
                              </span>
                              {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--alert)]" aria-hidden />}
                            </button>
                          ))
                        )}
                      </div>
                      {sellerUnread > 0 && (
                        <button type="button" onClick={() => markSellerSeen.mutate()} className="w-full border-t border-[var(--border)] px-3 py-2 text-center text-sm font-bold text-[var(--accent)]">
                          {ui.t("notif.markSeen")}
                        </button>
                      )}
                      <button type="button" onClick={() => { setNotifOpen(false); goSellerTab("orders"); }} className="w-full bg-[var(--accent)] px-3 py-2 text-center text-sm font-bold text-white">
                        {ui.t("sd.tabOrders")} →
                      </button>
                    </div>
                  )}
                </div>
              )}
              {user?.role === "buyer" && (
                <button
                  type="button"
                  onClick={() => setView("cart")}
                  aria-label={`${ui.t("cart.title")}${cartCount > 0 ? ` (${cartCount})` : ""}`}
                  aria-current={view === "cart" ? "page" : undefined}
                  className={`relative rounded-full bg-[var(--surface-alt)] px-2.5 leading-none transition-all duration-300 ${headerMini ? "min-h-8 py-0.5 text-[13px]" : "min-h-9 py-0.5 text-[15px]"}`}
                >
                  🛒
                  {cartCount > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--gold)] px-1 font-display text-[11px] font-bold text-[var(--gold-ink)]">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}
                aria-label={theme === "dark" ? ui.t("theme.toLight") : ui.t("theme.toDark")}
                aria-pressed={theme === "dark"}
                title={theme === "dark" ? ui.t("theme.light") : ui.t("theme.dark")}
                className={`rounded-full bg-[var(--surface-alt)] px-2.5 font-semibold text-[var(--text)] transition-all duration-300 ${headerMini ? "min-h-8 py-0.5 text-[11px]" : "min-h-9 py-0.5 text-xs"}`}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              {user ? (
                <button
                  type="button"
                  onClick={() => setView("account")}
                  aria-label="My account"
                  className={`max-w-[26vw] truncate rounded-lg bg-[var(--accent)] px-2 font-semibold text-white transition-all duration-300 ${headerMini ? "min-h-8 py-0.5 text-[11px]" : "min-h-9 py-0.5 text-xs"}`}
                >
                  {user.name.split(" ")[0]}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setView("account")}
                  aria-label="Sign in or register"
                  className={`rounded-lg bg-[var(--accent)] px-2 font-semibold text-white transition-all duration-300 ${headerMini ? "min-h-8 py-0.5 text-[11px]" : "min-h-9 py-0.5 text-xs"}`}
                >
                  {ui.t("header.signIn")}
                </button>
              )}
            </div>
          </div>
          {/* Layout designs 2 & 3 put the product Search in the top
              header itself: Design 2 (Menu) as a compact row under the
              brand row, Design 3 (Top Search) as a big full-width row.
              It drives the same shop search and jumps to the shop. */}
          {(layoutDesign === "menu" || layoutDesign === "topsearch") && (
            <div className={`border-t border-[var(--border)] px-3 transition-all duration-300 sm:px-4 ${layoutDesign === "topsearch" ? "py-2" : "py-1"}`}>
              <div className="mx-auto max-w-6xl">
                <label className="block">
                  <span className="sr-only">Search products</span>
                  <input
                    type="search"
                    value={shopSearch}
                    onChange={(e) => { setShopSearch(e.target.value); if (view !== "shop") setView("shop"); }}
                    placeholder={ui.t("shop.headerSearchPh")}
                    aria-label="Search products from the header"
                    className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] outline-none focus:border-[var(--accent)] ${layoutDesign === "topsearch" ? "px-4 py-2.5 text-base shadow-sm" : "px-3 py-1 text-sm"}`}
                  />
                </label>
              </div>
            </div>
          )}
        </header>

        {/* Hamburger side drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={ui.t("menu.title")}>
            <button
              type="button"
              aria-label={ui.t("menu.close")}
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 h-full w-full bg-black/50"
            />
            <aside className="absolute inset-y-0 left-0 flex w-[84vw] max-w-xs flex-col overflow-y-auto bg-[var(--surface)] pb-safe shadow-2xl rtl:left-auto rtl:right-0">
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 pt-safe">
                <span className="font-display text-lg font-extrabold text-[var(--accent)]">
                  {storeName}
                  <span className="text-[var(--gold)]">.</span>
                </span>
                <span className="text-sm font-semibold text-[var(--dim)]">{ui.t("menu.title")}</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label={ui.t("menu.close")}
                  className="ml-auto rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-base leading-none text-[var(--text)]"
                >
                  ✕
                </button>
              </div>
              <nav aria-label={ui.t("menu.title")} className="flex flex-col gap-1 px-3 py-3 text-[var(--text)]">
                <button type="button" onClick={() => (user?.role === "seller" ? goSellerTab("home") : goShopCategory("All"))} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                  🏠 {ui.t("menu.home")}
                </button>
                {user?.role === "seller" && sellerUnread > 0 && (
                  <button type="button" onClick={() => goSellerTab("orders")} className="flex items-center gap-2 rounded-xl border border-[var(--alert)] bg-[var(--alert-bg)] px-3 py-2.5 text-left font-bold text-[var(--text)]">
                    <span aria-hidden>🔔</span><span className="flex-1 text-sm">{ui.t("notif.newOrder")} ({sellerUnread})</span><span className="rounded-full bg-[var(--alert)] px-2 py-0.5 text-[10px] font-bold text-white">{ui.t("notif.live")}</span>
                  </button>
                )}
                {/* Sellers get Shop first, then Products — the same
                    order as the bottom navigation, one entry each (no
                    duplicates). Shop adds products to the seller's
                    store; the Products tab shows only the seller's
                    added products, with Remove. */}
                {user?.role === "seller" ? (
                  <>
                    <button type="button" aria-label={ui.t("nav.shop")} onClick={() => goShopCategory("All")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                      🛍️ {ui.t("nav.shop")}
                    </button>
                    <button type="button" aria-label={ui.t("nav.products")} onClick={() => goSellerTab("products")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                      🛍️ {ui.t("nav.products")}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => goShopCategory("All")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                    🛍️ {ui.t("menu.allProducts")}
                  </button>
                )}
                {/* External products are hidden from visitors (owner's
                    request): no drawer entry, and the section no longer
                    renders on the shop page. Data + Admin management are
                    kept so it can be restored later. */}
                {user?.role !== "seller" && (
                  <>
                    <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                      {ui.t("menu.categories")}
                    </p>
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Category ${c}`}
                        onClick={() => goShopCategory(c)}
                        className={`rounded-lg px-3 py-2 text-left font-medium hover:bg-[var(--surface-alt)] ${shopCategory === c && view === "shop" ? "text-[var(--accent)]" : ""}`}
                      >
                        {trCategory(effectiveLang, c)}
                      </button>
                    ))}
                  </>
                )}
                <div className="my-2 border-t border-[var(--border)]" />
                <button
                  type="button"
                  onClick={() => goView("cart")}
                  aria-label={`Cart, ${cartCount} items`}
                  className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]"
                >
                  🛒 {ui.t("menu.cart")}
                  {cartCount > 0 && (
                    <span className="ml-1 text-sm font-medium text-[var(--dim)]">({cartCount})</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => (user?.role === "seller" ? goSellerTab("orders") : goView("orders"))}
                  aria-label={user?.role === "seller" ? ui.t("sd.tabOrders") : ui.t("menu.orders")}
                  className="flex items-center gap-2 rounded-lg bg-[var(--accent-soft)] px-3 py-2.5 text-left font-semibold ring-1 ring-[var(--accent)]/40 hover:bg-[var(--surface-alt)]"
                >
                  <span aria-hidden>📦</span>
                  <span className="flex-1">{user?.role === "seller" ? ui.t("sd.tabOrders") : ui.t("menu.orders")}</span>
                  <NewBadge id="drawer-orders" />
                </button>
                {user?.role === "seller" ? (
                  <button type="button" onClick={() => goSellerTab("home")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                    🏪 {ui.t("menu.sellerDash")}
                  </button>
                ) : (
                  <button type="button" onClick={() => goView("account")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                    🏪 {ui.t("menu.becomeSeller")}
                  </button>
                )}
                <button type="button" onClick={() => goSellerTab("wallet")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                  👛 {ui.t("menu.wallet")}
                </button>
                <button type="button" onClick={() => goView("support")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                  💬 {ui.t("menu.support")}
                </button>
                <button type="button" onClick={() => goView("account")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                  👤 {user ? user.name : ui.t("menu.account")}
                </button>
                {user?.role === "admin" && (
                  <button type="button" onClick={() => goView("admin")} className="rounded-lg px-3 py-2.5 text-left font-semibold hover:bg-[var(--surface-alt)]">
                    ⚙️ {ui.t("menu.admin")}
                  </button>
                )}
                <div className="my-2 border-t border-[var(--border)]" />
                <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                  {ui.t("menu.language")}
                </p>
                <div className="flex flex-wrap gap-2 px-3 pb-2" role="group" aria-label={ui.t("menu.language")}>
                  {/* Only languages the Admin has switched ON are shown. */}
                  {enabledLangs.map((l) => (
                    <button
                      key={l}
                      type="button"
                      aria-label={l === "en" ? "Switch language to English" : l === "hi" ? "Switch language to Hindi" : "Switch language to Arabic"}
                      aria-pressed={effectiveLang === l}
                      onClick={() => changeLang(l)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${effectiveLang === l ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text)]"}`}
                    >
                      {l === "en" ? "EN — English" : l === "hi" ? "हिंदी" : "العربية"}
                    </button>
                  ))}
                </div>
                <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                  {ui.t("menu.currency")}
                </p>
                <div className="flex flex-wrap gap-2 px-3 pb-2" role="group" aria-label={ui.t("menu.currency")}>
                  {/* Only currencies the Admin has switched ON are shown. */}
                  {enabledCurrencies.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c === "INR" ? "Show prices in Indian Rupees" : c === "USD" ? "Show prices in US Dollars" : "Show prices in USDT"}
                      aria-pressed={effectiveCurrency === c}
                      onClick={() => changeCurrency(c)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${effectiveCurrency === c ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text)]"}`}
                    >
                      {c === "INR" ? "₹ INR" : c === "USD" ? "$ USD" : "USDT"}
                    </button>
                  ))}
                </div>
                <p className="px-3 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-[var(--dim)]">
                  {ui.t("menu.theme")}
                </p>
                <div className="flex gap-2 px-3 pb-4" role="group" aria-label={ui.t("menu.theme")}>
                  <button
                    type="button"
                    aria-label={ui.t("theme.toLight")}
                    aria-pressed={theme === "light"}
                    onClick={() => changeTheme("light")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${theme === "light" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text)]"}`}
                  >
                    ☀️ {ui.t("theme.light")}
                  </button>
                  <button
                    type="button"
                    aria-label={ui.t("theme.toDark")}
                    aria-pressed={theme === "dark"}
                    onClick={() => changeTheme("dark")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold ${theme === "dark" ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text)]"}`}
                  >
                    🌙 {ui.t("theme.dark")}
                  </button>
                </div>
              </nav>
            </aside>
          </div>
        )}

        <main className={`mx-auto max-w-6xl px-3 pt-3 min-[400px]:px-4 ${layoutDesign === "menu" ? "pb-10" : "pb-28 sm:pb-24"}`}>
          {user && user.mustChangePassword && user.role !== "admin" && (
            <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-amber-400 bg-[var(--amber-bg)] px-4 py-3">
              <p className="min-w-0 flex-1 text-sm font-bold text-[var(--text)]">🔑 {ui.t("cp.tempNotice")}</p>
              <button type="button" onClick={() => (user.role === "seller" ? goSellerTab("my") : setView("account"))} className={primaryBtn + " px-3 py-2 text-[13px]"}>{ui.t("cp.tempBtn")}</button>
            </div>
          )}
          {view === "shop" && (
            <ShopView
              user={user}
              onNeedAuth={() => setView("account")}
              onGoSeller={() => goSellerTab("home")}
              onGoCart={() => setView("cart")}
              cartCount={cartCount}
              category={shopCategory}
              onCategoryChange={setShopCategory}
              search={shopSearch}
              onSearchChange={setShopSearch}
            />
          )}
          {view === "external" && <ExternalProductsPage />}
          {view === "cart" && (
            <CartView
              user={user}
              onCheckout={() => setView("checkout")}
              onShop={() => setView("shop")}
            />
          )}
          {view === "checkout" && (
            <CheckoutView user={user} onDone={() => setView("orders")} onCart={() => setView("cart")} />
          )}
          {view === "orders" && <OrdersView user={user} />}
          {view === "account" && (
            <AccountView
              user={user}
              onAuth={handleAuth}
              onSignOut={handleSignOut}
              onGoSeller={() => goSellerTab("home")}
              onGoAdmin={() => setView("admin")}
              onGoSupport={goSupportChat}
              onUserUpdated={handleUserUpdated}
            />
          )}
          {view === "seller" && (
            <SellerView
              key={sellerKey}
              user={user}
              onSignOut={handleSignOut}
              initialTab={sellerTab}
              onTabChange={(tab) => setSellerTab(tab)}
              onUserUpdated={handleUserUpdated}
              onGoAccount={() => setView("account")}
              onGoSupport={goSupportChat}
            />
          )}
          {view === "admin" && <AdminView user={user} settings={settings.data} onUserUpdated={handleUserUpdated} />}
          {view === "support" && (
            <SupportView key={supportVisit} user={user} settings={settings.data} onNeedAuth={() => setView("account")} focusSignal={chatFocusSignal} startInChat={supportStartInChat} />
          )}
        </main>

        <footer className={`mx-auto max-w-6xl px-3 min-[400px]:px-4 ${layoutDesign === "menu" ? "pb-8" : "pb-28 sm:pb-20"}`}>
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 text-sm text-[var(--dim)] sm:flex-row sm:items-center">
            <p>
              <strong className="font-display text-[var(--accent)]">{storeName}</strong>{" "}
              {ui.t("foot.text")}
            </p>
            <button
              type="button"
              onClick={goSupport}
              className="font-semibold text-[var(--accent)] sm:ml-auto"
            >
              {ui.t("foot.support")}
            </button>
          </div>
        </footer>

        {layoutDesign !== "menu" && (
        <nav
          aria-label="Main navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] shadow-[0_-6px_20px_rgba(15,23,42,0.08)] pb-safe sm:hidden"
        >
          <div className={`grid ${NAV.length === 5 ? "grid-cols-5" : "grid-cols-6"}`}>
            {NAV.map((n) => (
              <button
                key={n.key}
                type="button"
                aria-label={n.label}
                aria-current={navCurrent(n) ? "page" : undefined}
                onClick={() => navGo(n)}
                className={`relative flex min-h-[4rem] flex-col items-center justify-center gap-1 pb-2 pt-2.5 text-[10px] font-medium leading-tight tracking-wide ${
                  navCurrent(n) ? "text-[var(--accent)]" : "text-[var(--dim)]"
                }`}
              >
                {navCurrent(n) && <span aria-hidden className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-full bg-[var(--accent)]" />}
                {n.isNew && <NewBadge id="nav-products" className="absolute right-0.5 top-0.5" />}
                <span className="flex leading-none">{n.icon}</span>
                <span className="max-w-full truncate px-0.5">{n.label}</span>
              </button>
            ))}
          </div>
        </nav>

        )}
        {layoutDesign !== "menu" && (
        <nav
          aria-label="Desktop navigation"
          className="scrollbar-none fixed bottom-5 left-1/2 z-40 hidden max-w-[calc(100vw-1.5rem)] -translate-x-1/2 gap-1 overflow-x-auto rounded-full border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.12)] sm:flex"
        >
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              aria-label={n.label}
              aria-current={navCurrent(n) ? "page" : undefined}
              onClick={() => navGo(n)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold lg:px-4 ${
                navCurrent(n) ? "bg-[var(--accent)] text-white" : "text-[var(--dim)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              {n.icon} {n.label}
              {n.isNew && <NewBadge id="nav-products" />}
            </button>
          ))}
          {user?.role === "admin" && (
            <button
              type="button"
              aria-label="Admin"
              aria-current={view === "admin" ? "page" : undefined}
              onClick={() => setView("admin")}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold lg:px-4 ${
                view === "admin" ? "bg-[var(--accent)] text-white" : "text-[var(--dim)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              {iconGear} {ui.t("nav.admin")}
            </button>
          )}
        </nav>
        )}
      </div>
    </UiContext.Provider>
  );
}
