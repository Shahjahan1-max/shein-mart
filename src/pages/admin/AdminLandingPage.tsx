import { useState, useEffect, useRef, useCallback } from "react";
import AdminLayout from "./AdminLayout";
import {
  genLPId,
  LandingPageSettings,
  LPNavLink,
  LPButton,
  LPMarketplaceCard,
  LPSupportCard,
  LPFooterGroup,
  LPFooterLink,
  LPSocialLink,
  LPStat,
  LPTrustBadge,
  LPReview,
} from "../../data/landingPageData";
import { DEFAULT_LANDING_PAGE } from "../../data/landingPageData";
import { saveLandingPageSettings, publishLandingPageSettings, useLandingPageSettings } from "../../hooks/useLandingPageSettings";
import { uploadAssetFile } from "../../hooks/useApi";
import { ctaPresetFor, resolveCtaBanner } from "../../lib/ctaVariants";
import { CtaBanner } from "../../components/CtaBanner";
import { useAdmin } from "../../contexts/AdminContext";
import {
  Save, Plus, Trash2, Upload, ArrowUp, ArrowDown, Eye,
  Globe, Navigation, LayoutGrid, HeadphonesIcon, AlignJustify,
  CheckCircle, X, ExternalLink, Image, Download, FileJson,
  Star, Link2, Type, MessageCircle, Shield, Send, AlertCircle, Megaphone,
} from "lucide-react";

type Tab = "hero" | "nav" | "cards" | "support" | "footer" | "reviews" | "cta" | "visibility";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "hero",       label: "Hero",           icon: Star },
  { key: "nav",        label: "Navigation",     icon: Navigation },
  { key: "cards",      label: "Platform Cards", icon: LayoutGrid },
  { key: "support",    label: "Support",        icon: HeadphonesIcon },
  { key: "footer",     label: "Footer",         icon: AlignJustify },
  { key: "reviews",    label: "Reviews",        icon: MessageCircle },
  { key: "cta",        label: "CTA Banner",     icon: Megaphone },
  { key: "visibility", label: "Visibility",     icon: Eye },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none flex-shrink-0 ${
        checked ? "bg-purple-600" : "bg-gray-600"
      }`}
    >
      <span
        className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Field({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
      {children}
      {note && <p className="text-xs text-slate-600 dark:text-gray-400">{note}</p>}
    </div>
  );
}

function Input({
  value, onChange, placeholder, className = "",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors ${className}`}
    />
  );
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500 transition-colors"
    />
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-800/40">
        <Icon className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 ${className}`}>{children}</div>;
}

function IconBtn({
  onClick, title, danger = false, children,
}: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
        danger
          ? "text-slate-600 dark:text-gray-400 hover:text-red-400 hover:bg-red-900/20"
          : "text-gray-500 hover:text-slate-900 dark:text-white hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function SaveBar({ onSave, onPublish, saved, published, saving, publishing }: {
  onSave: () => void;
  onPublish: () => void;
  saved: boolean;
  published: boolean;
  saving?: boolean;
  publishing?: boolean;
}) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4 flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
          saved
            ? "bg-green-600 text-white"
            : "bg-gray-700 hover:bg-gray-600 text-slate-900 dark:text-white"
        }`}
      >
        {saved ? <><CheckCircle className="w-4 h-4" /> Draft Saved!</> : saving ? <><Save className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Draft</>}
      </button>
      <button
        type="button"
        onClick={onPublish}
        disabled={publishing}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
          published
            ? "bg-green-600 text-white"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {published ? <><CheckCircle className="w-4 h-4" /> Published!</> : publishing ? <><Send className="w-4 h-4 animate-spin" /> Publishing…</> : <><Send className="w-4 h-4" /> Publish</>}
      </button>
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function AdminLandingPage({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { data: firebaseSettings } = useLandingPageSettings();
  const { admin } = useAdmin();
  const [settings, setSettings] = useState<LandingPageSettings>(DEFAULT_LANDING_PAGE);
  const [tab, setTab] = useState<Tab>("hero");
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [bgPreview, setBgPreview] = useState<string>(settings.hero.backgroundImage);
  const [jsonError, setJsonError] = useState("");
  const bgInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    setSettings(firebaseSettings);
    setBgPreview(firebaseSettings.hero.backgroundImage);
  }, [firebaseSettings]);

  const save = useCallback(() => {
    setSaving(true);
    saveLandingPageSettings(
      { ...settings, hero: { ...settings.hero, backgroundImage: bgPreview } },
      admin?.username,
    )
      .then(() => {
        setSaved(true);
        showToast("Draft saved successfully.");
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(() => showToast("Failed to save draft.", "error"))
      .finally(() => setSaving(false));
  }, [settings, bgPreview, admin]);

  const publish = useCallback(() => {
    setPublishing(true);
    publishLandingPageSettings(
      { ...settings, hero: { ...settings.hero, backgroundImage: bgPreview } },
      admin?.username,
    )
      .then(() => {
        setPublished(true);
        showToast("Changes published! Users will see updates immediately.");
        setTimeout(() => setPublished(false), 2000);
      })
      .catch(() => showToast("Failed to publish changes.", "error"))
      .finally(() => setPublishing(false));
  }, [settings, bgPreview, admin]);

  const set = (path: keyof LandingPageSettings, value: unknown) =>
    setSettings(s => ({ ...s, [path]: value }));

  const setHero = (key: string, value: unknown) =>
    setSettings(s => ({ ...s, hero: { ...s.hero, [key]: value } }));

  const setSupport = (key: string, value: unknown) =>
    setSettings(s => ({ ...s, support: { ...s.support, [key]: value } }));

  const setFooter = (key: string, value: unknown) =>
    setSettings(s => ({ ...s, footer: { ...s.footer, [key]: value } }));

  const setVisibility = (key: string, value: boolean) =>
    setSettings(s => ({ ...s, visibility: { ...s.visibility, [key]: value } }));

  const setCta = (key: string, value: unknown) =>
    setSettings(s => ({ ...s, cta: { ...s.cta, [key]: value } }));

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("File is too large. Please use an image under 1.5 MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      alert("Only JPEG, PNG, WebP, GIF, or SVG files are allowed.");
      return;
    }
    try {
      const asset = await uploadAssetFile(file, "landing-page/hero");
      setBgPreview(asset.url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload hero image.");
    } finally {
      e.target.value = "";
    }
  }

  function handleJsonImport(e: React.ChangeEvent<HTMLInputElement>) {
    setJsonError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(raw)) { setJsonError("JSON must be an array."); return; }
        const cards: LPMarketplaceCard[] = raw.map((item: Record<string, unknown>, i: number) => {
          if (!item.name || typeof item.name !== "string") throw new Error(`Item ${i + 1} missing required field "name".`);
          return {
            id: (item.id as string) || genLPId(),
            name: item.name as string,
            url: (item.url as string) || "#",
            tagline: (item.tagline as string) || "",
            badge: (item.badge as string) || "",
            stats: (item.stats as string) || "",
            active: item.active !== false,
          };
        });
        set("marketplaceCards", cards);
        setJsonError("");
      } catch (err: unknown) {
        setJsonError(err instanceof Error ? err.message : "Invalid JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleJsonExport() {
    const blob = new Blob([JSON.stringify(settings.marketplaceCards, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "platform-cards.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const content = (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-2xl shadow-xl border ${
          toast.type === "error"
            ? "bg-gray-800 border-red-700/60 text-red-400"
            : "bg-gray-800 border-green-700/60 text-green-400"
        }`}>
          {toast.type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}
      <div className="max-w-4xl mx-auto pb-24">
        <div className="mb-6">
          <h2 className="text-slate-900 dark:text-white font-bold text-lg">Landing Page Control</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-0.5">Manage all public landing page content. Changes are saved and reflected immediately.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                  tab === t.key
                    ? "bg-purple-600 text-white"
                    : "text-gray-400 hover:text-slate-900 dark:text-white hover:bg-gray-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ─── HERO TAB ─── */}
        {tab === "hero" && (
          <div className="space-y-4">
            <SectionCard title="Hero Text" icon={Type}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Badge Text">
                  <Input value={settings.hero.badge} onChange={v => setHero("badge", v)} placeholder="Discover deals from…" />
                </Field>
                <Field label="Title Line 1">
                  <Input value={settings.hero.title} onChange={v => setHero("title", v)} placeholder="Your Global" />
                </Field>
                <Field label="Title Highlight (gradient)">
                  <Input value={settings.hero.titleHighlight} onChange={v => setHero("titleHighlight", v)} placeholder="Deal Discovery" />
                </Field>
                <Field label="Title Line 3">
                  <Input value={settings.hero.titleSuffix} onChange={v => setHero("titleSuffix", v)} placeholder="Platform" />
                </Field>
              </div>
              <Field label="Subtitle">
                <Textarea value={settings.hero.subtitle} onChange={v => setHero("subtitle", v)} rows={3} />
              </Field>
            </SectionCard>

            <SectionCard title="Background Image / GIF" icon={Image}>
              {bgPreview ? (
                <div className="space-y-3">
                  <div className="relative w-full h-36 rounded-lg overflow-hidden border border-gray-700">
                    <img src={bgPreview} alt="Background preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-slate-900 dark:text-white text-xs font-semibold">Preview</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBgPreview("")}
                    className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm transition-colors"
                  >
                    <X className="w-4 h-4" /> Remove Background
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => bgInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
                >
                  <Upload className="w-8 h-8 text-slate-600 dark:text-gray-400 mx-auto mb-2" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">Click to upload image or GIF</p>
                  <p className="text-gray-600 text-xs mt-1">JPEG, PNG, WebP, GIF, SVG · Max 1.5 MB</p>
                </div>
              )}
              <input ref={bgInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" className="hidden" onChange={handleBgUpload} />
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-slate-700 dark:text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors"
              >
                <Upload className="w-4 h-4" /> {bgPreview ? "Replace File" : "Upload File"}
              </button>
            </SectionCard>

            <SectionCard title="Stats Cards (right side)" icon={LayoutGrid}>
              <div className="space-y-2">
                {settings.hero.stats.map((stat, i) => (
                  <Row key={stat.id}>
                    <Input value={stat.value} onChange={v => setSettings(s => ({ ...s, hero: { ...s.hero, stats: s.hero.stats.map((st, j) => j === i ? { ...st, value: v } : st) } }))} placeholder="500K+" className="w-28 flex-shrink-0" />
                    <Input value={stat.label} onChange={v => setSettings(s => ({ ...s, hero: { ...s.hero, stats: s.hero.stats.map((st, j) => j === i ? { ...st, label: v } : st) } }))} placeholder="Label" />
                    <IconBtn title="Move Up" onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, stats: move(s.hero.stats, i, i - 1) } }))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Move Down" onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, stats: move(s.hero.stats, i, i + 1) } }))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Remove" danger onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, stats: s.hero.stats.filter((_, j) => j !== i) } }))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </Row>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, stats: [...s.hero.stats, { id: genLPId(), label: "New Stat", value: "0" } as LPStat] } }))}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Stat
              </button>
            </SectionCard>

            <SectionCard title="Hero Buttons" icon={Link2}>
              <div className="space-y-2">
                {settings.heroButtons.map((btn, i) => (
                  <Row key={btn.id} className="flex-wrap">
                    <Toggle checked={btn.active} onChange={v => set("heroButtons", settings.heroButtons.map((b, j) => j === i ? { ...b, active: v } : b))} />
                    <Input value={btn.label} onChange={v => set("heroButtons", settings.heroButtons.map((b, j) => j === i ? { ...b, label: v } : b))} placeholder="Label" />
                    <Input value={btn.link} onChange={v => set("heroButtons", settings.heroButtons.map((b, j) => j === i ? { ...b, link: v } : b))} placeholder="Link / URL" />
                    <select
                      value={btn.variant}
                      onChange={e => set("heroButtons", settings.heroButtons.map((b, j) => j === i ? { ...b, variant: e.target.value as "primary" | "secondary" } : b))}
                      className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-900 dark:text-white font-medium text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-purple-500 flex-shrink-0"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                    </select>
                    <IconBtn title="Move Up" onClick={() => set("heroButtons", move(settings.heroButtons, i, i - 1))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Move Down" onClick={() => set("heroButtons", move(settings.heroButtons, i, i + 1))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Remove" danger onClick={() => set("heroButtons", settings.heroButtons.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </Row>
                ))}
              </div>
              <button
                type="button"
                onClick={() => set("heroButtons", [...settings.heroButtons, { id: genLPId(), label: "New Button", link: "#", active: true, variant: "secondary" } as LPButton])}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Button
              </button>
            </SectionCard>

            <SectionCard title="Trust Badges" icon={Shield}>
              <p className="text-slate-600 dark:text-gray-400 text-xs">These appear below the hero buttons as trust signals (e.g. "Verified Listings").</p>
              <div className="space-y-2">
                {settings.hero.trustBadges.map((badge, i) => (
                  <Row key={badge.id}>
                    <Toggle checked={badge.active} onChange={v => setSettings(s => ({ ...s, hero: { ...s.hero, trustBadges: s.hero.trustBadges.map((b, j) => j === i ? { ...b, active: v } : b) } }))} />
                    <Input value={badge.text} onChange={v => setSettings(s => ({ ...s, hero: { ...s.hero, trustBadges: s.hero.trustBadges.map((b, j) => j === i ? { ...b, text: v } : b) } }))} placeholder="Badge text" />
                    <IconBtn title="Move Up" onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, trustBadges: move(s.hero.trustBadges, i, i - 1) } }))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Move Down" onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, trustBadges: move(s.hero.trustBadges, i, i + 1) } }))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Remove" danger onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, trustBadges: s.hero.trustBadges.filter((_, j) => j !== i) } }))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </Row>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, hero: { ...s.hero, trustBadges: [...s.hero.trustBadges, { id: genLPId(), text: "New Badge", active: true } as LPTrustBadge] } }))}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Badge
              </button>
            </SectionCard>

            <SectionCard title="Shopper Social Proof" icon={Type}>
              <p className="text-slate-600 dark:text-gray-400 text-xs">The panel shown on the right side of the hero ("50,000+ shoppers discovering deals today"). Leave count blank to hide.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Shopper Count">
                  <Input value={settings.hero.shopperCount} onChange={v => setHero("shopperCount", v)} placeholder="50,000+" />
                </Field>
                <Field label="Subtext">
                  <Input value={settings.hero.shopperText} onChange={v => setHero("shopperText", v)} placeholder="discovering deals today" />
                </Field>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ─── NAVIGATION TAB ─── */}
        {tab === "nav" && (
          <div className="space-y-4">
            <SectionCard title="Header Navigation Links" icon={Globe}>
              <p className="text-slate-600 dark:text-gray-400 text-xs">These links appear in the top navigation bar of the landing page.</p>
              <div className="space-y-2">
                {settings.navLinks.map((link, i) => (
                  <Row key={link.id} className="flex-wrap">
                    <Toggle checked={link.active} onChange={v => set("navLinks", settings.navLinks.map((l, j) => j === i ? { ...l, active: v } : l))} />
                    <Input value={link.label} onChange={v => set("navLinks", settings.navLinks.map((l, j) => j === i ? { ...l, label: v } : l))} placeholder="Label" />
                    <Input value={link.href} onChange={v => set("navLinks", settings.navLinks.map((l, j) => j === i ? { ...l, href: v } : l))} placeholder="URL or #anchor" />
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-slate-600 dark:text-gray-400 text-xs whitespace-nowrap">External</span>
                      <Toggle checked={link.external} onChange={v => set("navLinks", settings.navLinks.map((l, j) => j === i ? { ...l, external: v } : l))} />
                    </div>
                    <IconBtn title="Move Up" onClick={() => set("navLinks", move(settings.navLinks, i, i - 1))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Move Down" onClick={() => set("navLinks", move(settings.navLinks, i, i + 1))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                    <IconBtn title="Remove" danger onClick={() => set("navLinks", settings.navLinks.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </Row>
                ))}
              </div>
              <button
                type="button"
                onClick={() => set("navLinks", [...settings.navLinks, { id: genLPId(), label: "New Link", href: "#", external: false, active: true } as LPNavLink])}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Nav Link
              </button>
            </SectionCard>
          </div>
        )}

        {/* ─── PLATFORM CARDS TAB ─── */}
        {tab === "cards" && (
          <div className="space-y-4">
            <SectionCard title="Section Header" icon={Type}>
              <Field label="Section Title">
                <Input
                  value={settings.marketplaceSection.title}
                  onChange={v => setSettings(s => ({ ...s, marketplaceSection: { ...s.marketplaceSection, title: v } }))}
                  placeholder="Shop on Top Marketplaces"
                />
              </Field>
              <Field label="Section Subtitle">
                <Input
                  value={settings.marketplaceSection.subtitle}
                  onChange={v => setSettings(s => ({ ...s, marketplaceSection: { ...s.marketplaceSection, subtitle: v } }))}
                  placeholder="Discover millions of products…"
                />
              </Field>
            </SectionCard>

            <SectionCard title="Platform Cards" icon={LayoutGrid}>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => jsonInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded-lg transition-colors"
                >
                  <FileJson className="w-4 h-4" /> Import JSON
                </button>
                <button
                  type="button"
                  onClick={handleJsonExport}
                  className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-slate-900 dark:text-white text-xs px-3 py-2 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" /> Export JSON
                </button>
                <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleJsonImport} />
              </div>
              {jsonError && (
                <div className="flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2.5 text-red-400 text-sm">
                  <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{jsonError}</span>
                </div>
              )}
              <p className="text-slate-600 dark:text-gray-400 text-xs">
                JSON format: <code className="text-purple-400">[{"{"}"id","name","url","tagline","badge","stats","active":{"}"}]</code>
              </p>
              <div className="space-y-3">
                {settings.marketplaceCards.map((card, i) => (
                  <div key={card.id} className="border border-gray-700 rounded-xl p-3 space-y-2">
                    <Row>
                      <Toggle checked={card.active} onChange={v => set("marketplaceCards", settings.marketplaceCards.map((c, j) => j === i ? { ...c, active: v } : c))} />
                      <span className="text-slate-900 dark:text-white text-sm font-semibold flex-1">{card.name || "Untitled"}</span>
                      <IconBtn title="Move Up" onClick={() => set("marketplaceCards", move(settings.marketplaceCards, i, i - 1))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn title="Move Down" onClick={() => set("marketplaceCards", move(settings.marketplaceCards, i, i + 1))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn title="Remove" danger onClick={() => set("marketplaceCards", settings.marketplaceCards.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </Row>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Platform Name">
                        <Input value={card.name} onChange={v => set("marketplaceCards", settings.marketplaceCards.map((c, j) => j === i ? { ...c, name: v } : c))} placeholder="Amazon" />
                      </Field>
                      <Field label="Website URL">
                        <Input value={card.url} onChange={v => set("marketplaceCards", settings.marketplaceCards.map((c, j) => j === i ? { ...c, url: v } : c))} placeholder="https://…" />
                      </Field>
                      <Field label="Tagline">
                        <Input value={card.tagline} onChange={v => set("marketplaceCards", settings.marketplaceCards.map((c, j) => j === i ? { ...c, tagline: v } : c))} placeholder="World's Largest Retailer" />
                      </Field>
                      <Field label="Badge Text">
                        <Input value={card.badge} onChange={v => set("marketplaceCards", settings.marketplaceCards.map((c, j) => j === i ? { ...c, badge: v } : c))} placeholder="Prime eligible" />
                      </Field>
                      <Field label="Stats Text">
                        <Input value={card.stats} onChange={v => set("marketplaceCards", settings.marketplaceCards.map((c, j) => j === i ? { ...c, stats: v } : c))} placeholder="350M+ products" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => set("marketplaceCards", [...settings.marketplaceCards, { id: genLPId(), name: "New Platform", url: "https://", tagline: "", badge: "", stats: "", active: true } as LPMarketplaceCard])}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Platform Card
              </button>
            </SectionCard>
          </div>
        )}

        {/* ─── SUPPORT TAB ─── */}
        {tab === "support" && (
          <div className="space-y-4">
            <SectionCard title="Support Section" icon={HeadphonesIcon}>
              <Row>
                <span className="text-slate-900 dark:text-white text-sm font-medium flex-1">Show Support Section</span>
                <Toggle checked={settings.support.active} onChange={v => setSupport("active", v)} />
              </Row>
              <Field label="Section Title">
                <Input value={settings.support.title} onChange={v => setSupport("title", v)} placeholder="We're Here to Help" />
              </Field>
              <Field label="Description">
                <Textarea value={settings.support.description} onChange={v => setSupport("description", v)} rows={3} />
              </Field>
            </SectionCard>

            <SectionCard title="Support Cards" icon={HeadphonesIcon}>
              <div className="space-y-3">
                {settings.support.cards.map((card, i) => (
                  <div key={card.id} className="border border-gray-700 rounded-xl p-3 space-y-2">
                    <Row>
                      <Toggle checked={card.active} onChange={v => setSettings(s => ({ ...s, support: { ...s.support, cards: s.support.cards.map((c, j) => j === i ? { ...c, active: v } : c) } }))} />
                      <span className="text-slate-900 dark:text-white text-sm font-semibold flex-1">{card.label || "Untitled"}</span>
                      <IconBtn title="Move Up" onClick={() => setSettings(s => ({ ...s, support: { ...s.support, cards: move(s.support.cards, i, i - 1) } }))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn title="Move Down" onClick={() => setSettings(s => ({ ...s, support: { ...s.support, cards: move(s.support.cards, i, i + 1) } }))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn title="Remove" danger onClick={() => setSettings(s => ({ ...s, support: { ...s.support, cards: s.support.cards.filter((_, j) => j !== i) } }))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </Row>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Label">
                        <Input value={card.label} onChange={v => setSettings(s => ({ ...s, support: { ...s.support, cards: s.support.cards.map((c, j) => j === i ? { ...c, label: v } : c) } }))} placeholder="Telegram Support" />
                      </Field>
                      <Field label="Link / URL">
                        <Input value={card.href} onChange={v => setSettings(s => ({ ...s, support: { ...s.support, cards: s.support.cards.map((c, j) => j === i ? { ...c, href: v } : c) } }))} placeholder="https://t.me/…" />
                      </Field>
                      <Field label="Description">
                        <Input value={card.desc} onChange={v => setSettings(s => ({ ...s, support: { ...s.support, cards: s.support.cards.map((c, j) => j === i ? { ...c, desc: v } : c) } }))} placeholder="Chat with our team…" />
                      </Field>
                      <Field label="CTA Button Text">
                        <Input value={card.cta} onChange={v => setSettings(s => ({ ...s, support: { ...s.support, cards: s.support.cards.map((c, j) => j === i ? { ...c, cta: v } : c) } }))} placeholder="Chat on Telegram" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, support: { ...s.support, cards: [...s.support.cards, { id: genLPId(), label: "New Card", desc: "", href: "#", cta: "Learn More", active: true } as LPSupportCard] } }))}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Support Card
              </button>
            </SectionCard>
          </div>
        )}

        {/* ─── FOOTER TAB ─── */}
        {tab === "footer" && (
          <div className="space-y-4">
            <SectionCard title="Footer General" icon={AlignJustify}>
              <Row>
                <span className="text-slate-900 dark:text-white text-sm font-medium flex-1">Show Footer</span>
                <Toggle checked={settings.footer.active} onChange={v => setFooter("active", v)} />
              </Row>
              <Field label="Footer Description">
                <Textarea value={settings.footer.description} onChange={v => setFooter("description", v)} rows={2} />
              </Field>
              <Field label="Copyright Text" note="Use {year} for the current year.">
                <Input value={settings.footer.copyright} onChange={v => setFooter("copyright", v)} placeholder="© {year} DealX Stocks…" />
              </Field>
            </SectionCard>

            <SectionCard title="Footer Link Groups" icon={Link2}>
              <div className="space-y-4">
                {settings.footer.groups.map((group, gi) => (
                  <div key={group.id} className="border border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 border-b border-gray-700">
                      <Input
                        value={group.title}
                        onChange={v => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.map((g, j) => j === gi ? { ...g, title: v } : g) } }))}
                        placeholder="Group Title"
                        className="flex-1"
                      />
                      <IconBtn title="Remove Group" danger onClick={() => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.filter((_, j) => j !== gi) } }))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </div>
                    <div className="p-3 space-y-2">
                      {group.links.map((link, li) => (
                        <Row key={link.id} className="flex-wrap">
                          <Toggle checked={link.active} onChange={v => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.map((g, j) => j === gi ? { ...g, links: g.links.map((l, k) => k === li ? { ...l, active: v } : l) } : g) } }))} />
                          <Input value={link.label} onChange={v => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.map((g, j) => j === gi ? { ...g, links: g.links.map((l, k) => k === li ? { ...l, label: v } : l) } : g) } }))} placeholder="Label" />
                          <Input value={link.href} onChange={v => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.map((g, j) => j === gi ? { ...g, links: g.links.map((l, k) => k === li ? { ...l, href: v } : l) } : g) } }))} placeholder="URL / #anchor" />
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-slate-600 dark:text-gray-400 text-xs">Ext</span>
                            <Toggle checked={link.external} onChange={v => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.map((g, j) => j === gi ? { ...g, links: g.links.map((l, k) => k === li ? { ...l, external: v } : l) } : g) } }))} />
                          </div>
                          <IconBtn title="Remove" danger onClick={() => setSettings(s => ({ ...s, footer: { ...s.footer, groups: s.footer.groups.map((g, j) => j === gi ? { ...g, links: g.links.filter((_, k) => k !== li) } : g) } }))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                        </Row>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSettings(s => ({
                          ...s,
                          footer: {
                            ...s.footer,
                            groups: s.footer.groups.map((g, j) =>
                              j === gi ? { ...g, links: [...g.links, { id: genLPId(), label: "New Link", href: "#", external: false, active: true } as LPFooterLink] } : g
                            ),
                          },
                        }))}
                        className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-xs transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, footer: { ...s.footer, groups: [...s.footer.groups, { id: genLPId(), title: "New Group", links: [] } as LPFooterGroup] } }))}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Link Group
              </button>
            </SectionCard>

            <SectionCard title="Social Links" icon={ExternalLink}>
              <p className="text-slate-600 dark:text-gray-400 text-xs">Recognized platforms: twitter, facebook, instagram, youtube, telegram</p>
              <div className="space-y-2">
                {settings.footer.socials.map((s, i) => (
                  <Row key={s.id} className="flex-wrap">
                    <Toggle checked={s.active} onChange={v => setFooter("socials", settings.footer.socials.map((sl, j) => j === i ? { ...sl, active: v } : sl))} />
                    <Input value={s.platform} onChange={v => setFooter("socials", settings.footer.socials.map((sl, j) => j === i ? { ...sl, platform: v } : sl))} placeholder="twitter" className="w-28 flex-shrink-0" />
                    <Input value={s.href} onChange={v => setFooter("socials", settings.footer.socials.map((sl, j) => j === i ? { ...sl, href: v } : sl))} placeholder="https://…" />
                    <IconBtn title="Remove" danger onClick={() => setFooter("socials", settings.footer.socials.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                  </Row>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFooter("socials", [...settings.footer.socials, { id: genLPId(), platform: "twitter", href: "#", active: true } as LPSocialLink])}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Social Link
              </button>
            </SectionCard>
          </div>
        )}

        {/* ─── REVIEWS TAB ─── */}
        {tab === "reviews" && (
          <div className="space-y-4">
            <SectionCard title="Shopper Reviews Ticker" icon={MessageCircle}>
              <p className="text-slate-600 dark:text-gray-400 text-xs">
                These reviews scroll across the landing page. Toggle visibility in the Visibility tab. Each review needs a name, location, rating, initials (avatar), and review text.
              </p>
              <div className="space-y-3">
                {settings.reviews.map((review, i) => (
                  <div key={review.id} className="border border-gray-700 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border-b border-gray-700">
                      <Toggle
                        checked={review.active}
                        onChange={v => setSettings(s => ({ ...s, reviews: s.reviews.map((r, j) => j === i ? { ...r, active: v } : r) }))}
                      />
                      <span className="text-slate-900 dark:text-white text-xs font-semibold flex-1 truncate">{review.name || "Unnamed"} · {review.location || "—"}</span>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} className={`w-3 h-3 cursor-pointer transition-colors ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}`}
                            onClick={() => setSettings(st => ({ ...st, reviews: st.reviews.map((r, j) => j === i ? { ...r, rating: s } : r) }))} />
                        ))}
                      </div>
                      <IconBtn title="Move Up" onClick={() => setSettings(s => ({ ...s, reviews: move(s.reviews, i, i - 1) }))}><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn title="Move Down" onClick={() => setSettings(s => ({ ...s, reviews: move(s.reviews, i, i + 1) }))}><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn title="Remove" danger onClick={() => setSettings(s => ({ ...s, reviews: s.reviews.filter((_, j) => j !== i) }))}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </div>
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Field label="Name">
                        <Input value={review.name} onChange={v => setSettings(s => ({ ...s, reviews: s.reviews.map((r, j) => j === i ? { ...r, name: v } : r) }))} placeholder="Sarah M." />
                      </Field>
                      <Field label="Location">
                        <Input value={review.location} onChange={v => setSettings(s => ({ ...s, reviews: s.reviews.map((r, j) => j === i ? { ...r, location: v } : r) }))} placeholder="New York, USA" />
                      </Field>
                      <Field label="Avatar Initials">
                        <Input value={review.avatar} onChange={v => setSettings(s => ({ ...s, reviews: s.reviews.map((r, j) => j === i ? { ...r, avatar: v.slice(0, 3).toUpperCase() } : r) }))} placeholder="SM" className="w-20" />
                      </Field>
                      <Field label="Review Text">
                        <Textarea value={review.text} onChange={v => setSettings(s => ({ ...s, reviews: s.reviews.map((r, j) => j === i ? { ...r, text: v } : r) }))} rows={2} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => ({ ...s, reviews: [...s.reviews, { id: genLPId(), name: "New Reviewer", location: "City, Country", rating: 5, text: "Great platform!", avatar: "NR", active: true } as LPReview] }))}
                className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Review
              </button>
            </SectionCard>
          </div>
        )}

        {/* ─── CTA BANNER TAB ─── */}
        {tab === "cta" && (
          <div className="space-y-4">
            <SectionCard title="CTA Banner — A/B Variant" icon={Megaphone}>
              <p className="text-slate-600 dark:text-gray-400 text-sm">
                Choose which conversion banner shows on the homepage. Switching variant loads its preset copy — you can then fine-tune it.
              </p>
              <Row className="gap-3">
                {(["a", "b"] as const).map(variant => (
                  <button
                    key={variant}
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, cta: ctaPresetFor(variant) }))}
                    className={`flex-1 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      settings.cta.variant === variant
                        ? "border-purple-500 bg-purple-600/20 text-purple-300"
                        : "border-gray-700 bg-gray-800 text-slate-500 dark:text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    Variant {variant.toUpperCase()} — {variant === "a" ? "Earn First" : "Consultation First"}
                  </button>
                ))}
              </Row>
            </SectionCard>

            <SectionCard title="CTA Banner Content" icon={Type}>
              <Field label="Title">
                <Input value={settings.cta.title} onChange={v => setCta("title", v)} placeholder="Headline shown above the button" />
              </Field>
              <Field label="Subtitle">
                <Textarea value={settings.cta.subtitle} onChange={v => setCta("subtitle", v)} rows={2} />
              </Field>
              <Row className="gap-3">
                <div className="flex-1 space-y-1.5">
                  <Field label="Primary Button Label">
                    <Input value={settings.cta.primaryLabel} onChange={v => setCta("primaryLabel", v)} />
                  </Field>
                  <Field label="Primary Button Link">
                    <Input value={settings.cta.primaryHref} onChange={v => setCta("primaryHref", v)} placeholder="/register" />
                  </Field>
                </div>
                <div className="flex-1 space-y-1.5">
                  <Field label="Secondary Button Label">
                    <Input value={settings.cta.secondaryLabel} onChange={v => setCta("secondaryLabel", v)} />
                  </Field>
                  <Field label="Secondary Button Link">
                    <Input value={settings.cta.secondaryHref} onChange={v => setCta("secondaryHref", v)} placeholder="/deals" />
                  </Field>
                </div>
              </Row>
            </SectionCard>

            <SectionCard title="Live Preview" icon={Eye}>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40 overflow-hidden">
                <CtaBanner {...resolveCtaBanner(settings.cta)} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ─── VISIBILITY TAB ─── */}
        {tab === "visibility" && (
          <div className="space-y-4">
            <SectionCard title="Section Visibility" icon={Eye}>
              <p className="text-slate-600 dark:text-gray-400 text-sm">Toggle which sections appear on the public landing page.</p>
              {[
                { key: "showHero",             label: "Hero Section",          desc: "The main banner with title, subtitle, and stats" },
                { key: "showMarketplaceCards",  label: "Platform Cards Section",desc: "Amazon, Alibaba, AliExpress cards" },
                { key: "showCategoryDiscovery", label: "Category Discovery",    desc: "Browse-by-category grid on the homepage" },
                { key: "showDeals",             label: "Deals Rail",            desc: "Today's best deals section on the homepage" },
                { key: "showTrust",             label: "Trust Section",         desc: "Why-shop-with-us trust badges and stats" },
                { key: "showFaq",               label: "FAQ Section",           desc: "Frequently asked questions accordion" },
                { key: "showReviews",           label: "Reviews Ticker",        desc: "Scrolling shopper reviews strip" },
                { key: "showTestimonials",      label: "Testimonials Grid",     desc: "Star-rated social proof quotes grid" },
                { key: "showCaseStudies",       label: "Case Studies Strip",    desc: "Documented growth results with metrics" },
                { key: "showCtaBanner",         label: "Conversion CTA Banner", desc: "Purple call-to-action banner above the footer" },
                { key: "showSupport",           label: "Support Section",       desc: "The 'We're Here to Help' block" },
                { key: "showFooter",            label: "Footer",                desc: "Bottom site footer with links and socials" },
                { key: "showComingSoon",        label: "Coming Soon Banner",    desc: "'More products coming soon' block below product grid" },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3.5 border-b border-gray-800 last:border-0 gap-4">
                  <div>
                    <p className="text-slate-900 dark:text-white text-sm font-medium">{item.label}</p>
                    <p className="text-slate-600 dark:text-gray-400 text-xs mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle
                    checked={!!settings.visibility[item.key as keyof typeof settings.visibility]}
                    onChange={v => setVisibility(item.key, v)}
                  />
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Coming Soon Banner Text" icon={Type}>
              <p className="text-slate-600 dark:text-gray-400 text-xs">Editable content for the 'coming soon' block shown below the product grid.</p>
              <Field label="Title">
                <Input
                  value={settings.comingSoon.title}
                  onChange={v => setSettings(s => ({ ...s, comingSoon: { ...s.comingSoon, title: v } }))}
                  placeholder="More products coming soon"
                />
              </Field>
              <Field label="Description">
                <Textarea
                  value={settings.comingSoon.description}
                  onChange={v => setSettings(s => ({ ...s, comingSoon: { ...s.comingSoon, description: v } }))}
                  rows={2}
                />
              </Field>
            </SectionCard>
          </div>
        )}

        <SaveBar onSave={save} onPublish={publish} saved={saved} published={published} saving={saving} publishing={publishing} />
      </div>
    </>
  );

  if (isEmbedded) return content;
  return <AdminLayout title="Landing Page">{content}</AdminLayout>;
}
