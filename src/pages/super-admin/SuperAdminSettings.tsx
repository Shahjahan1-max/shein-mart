import React, { useState, useRef, useEffect } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import {
  DEFAULT_SETTINGS, PlatformSettings, WalletConfig, ContactChannel,
} from "../../data/adminData";
import {
  Save, Globe, DollarSign, Shield, Link, Gift, Eye, EyeOff,
  Wallet, Plus, Trash2, Upload, Building2, Layout, Image, MessageCircle, Mail, Zap, Tag, Loader2, Monitor,
  AlertTriangle, Wrench, Palette, Check, KeyRound, Send, CheckCircle, AlertCircle, Settings as SettingsIcon,
} from "lucide-react";
import { Atom } from "../../components/Atom";
import { useAdminSettingsDraft, saveSettings, publishSettings, uploadAssetFile } from "../../hooks/useApi";
import { useAdGroupsCatalog } from "../../hooks/useCatalogs";
import { useAdmin } from "../../contexts/AdminContext";
import { api, ApiError } from "../../lib/apiClient";
import { fileToSettingsImageDataUrl, normalizeExternalImageUrl } from "../../lib/imageUrl";

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none ${checked ? "bg-purple-600" : "bg-gray-700"}`}>
      <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-gray-800 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 dark:text-white text-sm font-medium">{label}</p>
        {description && <p className="text-slate-600 dark:text-gray-400 text-xs mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-purple-400" />
      <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
    </div>
  );
}

function generateWalletId(): string {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface BandSwapAction {
  minKey: keyof PlatformSettings;
  maxKey: keyof PlatformSettings;
}

interface BandIssue {
  type: "overlap" | "gap" | "internal";
  pair: "amazon-alibaba" | "alibaba-aliexpress" | "alibaba-internal";
  message: string;
  suggestion: string;
  swapAction?: BandSwapAction;
}

function validateBands(s: PlatformSettings): BandIssue[] {
  const issues: BandIssue[] = [];
  const amazonMax     = s.amazonBandMax     ?? 499;
  const alibabaMin    = s.alibabaBandMin    ?? 500;
  const alibabaMax    = s.alibabaBandMax    ?? 899;
  const aliexpressMin = s.aliexpressBandMin ?? 900;

  if (alibabaMin > alibabaMax) {
    issues.push({
      type: "internal", pair: "alibaba-internal",
      message: `Alibaba min ($${alibabaMin}) exceeds its max ($${alibabaMax}) — band matches nobody.`,
      suggestion: `Swap Alibaba min and max, or set Alibaba max to at least $${alibabaMin}.`,
      swapAction: { minKey: "alibabaBandMin", maxKey: "alibabaBandMax" },
    });
  }

  if (alibabaMin <= amazonMax) {
    issues.push({
      type: "overlap", pair: "amazon-alibaba",
      message: `Amazon max ($${amazonMax}) overlaps Alibaba min ($${alibabaMin}).`,
      suggestion: `Set Alibaba min to $${amazonMax + 1}, or Amazon max to $${alibabaMin - 1}.`,
    });
  } else if (alibabaMin > amazonMax + 1) {
    issues.push({
      type: "gap", pair: "amazon-alibaba",
      message: `Gap: $${amazonMax + 1}–$${alibabaMin - 1} falls outside every platform.`,
      suggestion: `Set Alibaba min to $${amazonMax + 1}, or Amazon max to $${alibabaMin - 1}.`,
    });
  }

  if (aliexpressMin <= alibabaMax) {
    issues.push({
      type: "overlap", pair: "alibaba-aliexpress",
      message: `Alibaba max ($${alibabaMax}) overlaps AliExpress min ($${aliexpressMin}).`,
      suggestion: `Set AliExpress min to $${alibabaMax + 1}, or Alibaba max to $${aliexpressMin - 1}.`,
    });
  } else if (aliexpressMin > alibabaMax + 1) {
    issues.push({
      type: "gap", pair: "alibaba-aliexpress",
      message: `Gap: $${alibabaMax + 1}–$${aliexpressMin - 1} falls outside every platform.`,
      suggestion: `Set AliExpress min to $${alibabaMax + 1}, or Alibaba max to $${aliexpressMin - 1}.`,
    });
  }

  return issues;
}

const PANEL_THEMES = [
  { id: "default", label: "Default", accent: "#7C3AED", lightBg: "#F5F3FF" },
  { id: "ocean",   label: "Ocean",   accent: "#2563EB", lightBg: "#EFF6FF" },
  { id: "forest",  label: "Forest",  accent: "#059669", lightBg: "#ECFDF5" },
  { id: "sunset",  label: "Sunset",  accent: "#D97706", lightBg: "#FFFBEB" },
  { id: "ruby",    label: "Ruby",    accent: "#E11D48", lightBg: "#FFF1F2" },
] as const;

const PLATFORM_LOGO_IDS = ["amazon", "alibaba", "aliexpress"] as const;
type PlatformLogoId = typeof PLATFORM_LOGO_IDS[number];

const PLATFORM_LABELS: Record<PlatformLogoId, string> = {
  amazon: "Amazon",
  alibaba: "Alibaba",
  aliexpress: "AliExpress",
};

export default function SuperAdminSettings() {
  const { admin, updateAdminSession } = useAdmin();
  const { data: apiSettings } = useAdminSettingsDraft<PlatformSettings>();
  const { data: adCatalog } = useAdGroupsCatalog();
  const adGroups = adCatalog.groups ?? [];

  const [settings, setSettings] = useState<PlatformSettings>(() => {
    return apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [settingsToast, setSettingsToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);

  useEffect(() => {
    if (apiSettings) {
      setSettings(prev => ({ ...DEFAULT_SETTINGS, ...apiSettings }));
    }
  }, [apiSettings]);

  function showSettingsToast(msg: string, type: "success" | "error" = "success") {
    setSettingsToast({ msg, type });
    setTimeout(() => setSettingsToast(null), 3000);
  }

  // Password change state
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwShowCurrent, setPwShowCurrent] = useState(false);
  const [pwShowNew, setPwShowNew] = useState(false);
  const [pwShowConfirm, setPwShowConfirm] = useState(false);

  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWallet, setNewWallet] = useState<Omit<WalletConfig, "id">>({
    label: "", network: "TRC20", address: "",
  });

  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<Omit<ContactChannel, "id">>({
    platform: "Telegram", title: "", link: "", enabled: true,
  });

  const companyLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);
  const platformLogoRefs = useRef<Record<PlatformLogoId, HTMLInputElement | null>>({
    amazon: null, alibaba: null, aliexpress: null,
  });
  const [platformLogos, setPlatformLogos] = useState<Record<PlatformLogoId, string>>({
    amazon: settings.platformLogos?.amazon ?? "",
    alibaba: settings.platformLogos?.alibaba ?? "",
    aliexpress: settings.platformLogos?.aliexpress ?? "",
  });

  useEffect(() => {
    if (apiSettings) {
      const logos = apiSettings.platformLogos ?? {};
      setPlatformLogos({
        amazon: logos.amazon ?? "",
        alibaba: logos.alibaba ?? "",
        aliexpress: logos.aliexpress ?? "",
      });
    }
  }, [apiSettings]);

  function update<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  async function handleMaintenanceToggle(v: boolean) {
    const updated = { ...settings, maintenanceMode: v };
    setSettings(updated);
    try {
      await publishSettings(updated, admin?.username);
      setMaintenanceSaved(true);
      setTimeout(() => setMaintenanceSaved(false), 2000);
      showSettingsToast(v ? "Maintenance Mode enabled live." : "Maintenance Mode disabled — platform online.", "success");
    } catch (err) {
      console.error("Failed to update Maintenance Mode:", err);
      showSettingsToast("Failed to update Maintenance Mode.", "error");
    }
  }

  async function handleFirebaseAlertToggle(v: boolean) {
    const updated = { ...settings, firebaseAlertEnabled: v };
    setSettings(updated);
    try {
      await publishSettings(updated, admin?.username);
      showSettingsToast(
        v ? "Firebase Alert Banner enabled — visible on all pages." : "Firebase Alert Banner disabled — removed from all pages.",
        "success"
      );
    } catch (err) {
      console.error("Failed to update Firebase Alert Banner:", err);
      showSettingsToast("Failed to update Firebase Alert Banner.", "error");
    }
  }

  const bandIssues = validateBands(settings);
  const hasBandIssues = bandIssues.length > 0;

  function swapBandPair(key1: keyof PlatformSettings, key2: keyof PlatformSettings) {
    setSettings(prev => ({
      ...prev,
      [key1]: prev[key2] as number,
      [key2]: prev[key1] as number,
    }));
  }

  function autoFixBands() {
    const amazonMax = settings.amazonBandMax ?? 499;
    let alibabaMin = settings.alibabaBandMin ?? 500;
    let alibabaMax = settings.alibabaBandMax ?? 899;
    if (alibabaMin > alibabaMax) [alibabaMin, alibabaMax] = [alibabaMax, alibabaMin];
    const newAlibabaMin = amazonMax + 1;
    const newAlibabaMax = Math.max(alibabaMax, newAlibabaMin);
    const newAliexpressMin = newAlibabaMax + 1;
    setSettings(prev => ({
      ...prev,
      alibabaBandMin:    newAlibabaMin,
      alibabaBandMax:    newAlibabaMax,
      aliexpressBandMin: newAliexpressMin,
    }));
  }

  async function handleSave() {
    if (hasBandIssues) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const settingsRecord = settings as unknown as Record<string, unknown>;
      const currentVersion = typeof settingsRecord.version === "number" ? settingsRecord.version as number : 0;
      await saveSettings({
        ...settingsRecord,
        status: "draft",
        updatedAt: now,
        updatedBy: admin?.username ?? "super_admin",
        version: currentVersion,
      });
      setSaved(true);
      showSettingsToast("Draft saved successfully.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      showSettingsToast("Failed to save draft.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (hasBandIssues) return;
    setPublishing(true);
    try {
      await publishSettings(settings as unknown as Record<string, unknown>, admin?.username);
      setPublished(true);
      if (settings.siteFavicon) {
        try {
          const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (link) link.href = `${settings.siteFavicon}?v=${Date.now()}`;
        } catch {}
      }
      showSettingsToast("Settings published! Users will see updates immediately.");
      setTimeout(() => setPublished(false), 2000);
    } catch (err) {
      console.error("Failed to publish settings:", err);
      showSettingsToast("Failed to publish settings.", "error");
    } finally {
      setPublishing(false);
    }
  }

  async function handlePasswordChange() {
    setPwError("");
    setPwSuccess(false);

    if (!pwCurrent.trim()) { setPwError("Current password is required."); return; }
    if (!pwNew.trim()) { setPwError("New password is required."); return; }
    if (pwNew.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwNew !== pwConfirm) { setPwError("New password and confirm password do not match."); return; }

    setPwChanging(true);
    try {
      const data = await api.post<{
        success: boolean;
        message?: string;
        admin?: typeof admin;
      }>("/api/admin/change-password", {
        currentPassword: pwCurrent,
        newPassword: pwNew,
        confirmPassword: pwConfirm,
        username: admin?.username,
        email: admin?.email,
      }, { requiresAdmin: true });
      if (data.admin) {
        updateAdminSession(data.admin);
      }
      setPwSuccess(true);
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (error) {
      setPwError(error instanceof ApiError ? error.message : "Unable to change password.");
    } finally {
      setPwChanging(false);
    }
  }

  async function handleCompanyLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const asset = await uploadAssetFile(file, "branding/logos");
      update("companyLogo", asset.url);
    } catch (error) {
      showSettingsToast(error instanceof Error ? error.message : "Failed to upload logo.", "error");
    } finally {
      if (companyLogoRef.current) companyLogoRef.current.value = "";
    }
  }

  async function handleFavicon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const asset = await uploadAssetFile(file, "branding/favicons");
      update("siteFavicon", asset.url);
    } catch (error) {
      showSettingsToast(error instanceof Error ? error.message : "Failed to upload favicon.", "error");
    } finally {
      if (faviconRef.current) faviconRef.current.value = "";
    }
  }

  async function handlePlatformLogo(id: PlatformLogoId, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const asset = await uploadAssetFile(file, `platform-logos/${id}`);
      const nextLogos = { ...platformLogos, [id]: asset.url };
      setPlatformLogos(nextLogos);
      const nextSettings = { ...settings, platformLogos: nextLogos } as PlatformSettings & { platformLogos: Record<PlatformLogoId, string> };
      setSettings(nextSettings);
      await saveSettings(nextSettings as unknown as Record<string, unknown>);
    } catch (error) {
      showSettingsToast("Failed to upload platform logo.", "error");
    } finally {
      if (platformLogoRefs.current[id]) platformLogoRefs.current[id]!.value = "";
    }
  }

  async function saveQrSetting(field: "depositQr" | "withdrawQr", url: string) {
    const nextSettings = { ...settings, [field]: url } as PlatformSettings;
    setSettings(nextSettings);
    await saveSettings({
      ...(nextSettings as unknown as Record<string, unknown>),
      status: "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: admin?.username ?? "super_admin",
    });
  }

  async function handleQrUpload(field: "depositQr" | "withdrawQr", folder: string, file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      showSettingsToast("Only PNG, JPG, WebP, GIF, or SVG images are allowed.", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showSettingsToast("QR image must be smaller than 5 MB.", "error");
      return;
    }

    try {
      const asset = await uploadAssetFile(file, folder);
      await saveQrSetting(field, asset.url);
      showSettingsToast("QR image uploaded and saved as draft.");
    } catch (error) {
      try {
        const dataUrl = await fileToSettingsImageDataUrl(file);
        await saveQrSetting(field, dataUrl);
        showSettingsToast("QR image saved as draft. Publish settings to show it to users.");
      } catch (fallbackError) {
        showSettingsToast("Failed to upload QR image.", "error");
      }
    }
  }

  async function removePlatformLogo(id: PlatformLogoId) {
    const nextLogos = { ...platformLogos, [id]: "" };
    setPlatformLogos(nextLogos);
    const nextSettings = { ...settings, platformLogos: nextLogos } as PlatformSettings & { platformLogos: Record<PlatformLogoId, string> };
    setSettings(nextSettings);
    await saveSettings(nextSettings as unknown as Record<string, unknown>);
  }

  function addWallet() {
    if (!newWallet.address.trim() || settings.wallets.length >= 3) return;
    const wallet: WalletConfig = { ...newWallet, id: generateWalletId() };
    update("wallets", [...settings.wallets, wallet]);
    setNewWallet({ label: "", network: "TRC20", address: "" });
    setShowAddWallet(false);
  }

  function removeWallet(id: string) {
    update("wallets", settings.wallets.filter(w => w.id !== id));
  }

  function updateWallet(id: string, field: keyof Omit<WalletConfig, "id">, value: string) {
    update("wallets", settings.wallets.map(w => w.id === id ? { ...w, [field]: value } : w));
  }

  function addContact() {
    if (!newContact.title.trim() || !newContact.link.trim()) return;
    const channel: ContactChannel = { ...newContact, id: `c-${Date.now()}` };
    update("contacts", [...(settings.contacts ?? []), channel]);
    setNewContact({ platform: "Telegram", title: "", link: "", enabled: true });
    setShowAddContact(false);
  }

  function removeContact(id: string) {
    update("contacts", (settings.contacts ?? []).filter(c => c.id !== id));
  }

  function updateContact(id: string, field: keyof Omit<ContactChannel, "id">, value: string | boolean) {
    update("contacts", (settings.contacts ?? []).map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  const inputCls = "w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500";

  return (
    <SuperAdminLayout title="Super Admin Platform Settings">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">

        {/* Header bar */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-purple-500" /> Super Admin Settings Suite
            </h1>
            <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">
              Complete platform control: Branding, Platform Logos, Marquee, Ad Codes, Wallets, Controls, Themes, Loader & Bands.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={hasBandIssues || saving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? "Saving..." : saved ? "Saved!" : "Save Draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={hasBandIssues || publishing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {publishing ? "Publishing..." : published ? "Published!" : "Publish Settings"}
            </button>
          </div>
        </div>

        {/* 1. Company Branding */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2">
          <SectionHeader icon={Building2} title="Company Branding" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Site identity, logo, and contact information.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center">
                {settings.companyLogo
                  ? <img src={settings.companyLogo} alt="Company logo" className="w-full h-full object-contain p-2" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <Building2 className="w-10 h-10 text-gray-600" />}
              </div>
              <input
                type="url"
                value={settings.companyLogo || ""}
                onChange={e => update("companyLogo", e.target.value.trim())}
                placeholder="https://example.com/logo.png"
                className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <input ref={companyLogoRef} type="file" accept="image/*" onChange={handleCompanyLogo} className="hidden" />
              <button onClick={() => companyLogoRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload Logo
              </button>
              {settings.companyLogo && (
                <button onClick={() => update("companyLogo", "")}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">
                  Remove
                </button>
              )}
            </div>
            <div className="sm:col-span-2 space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Company / Site Name</label>
                <input type="text" value={settings.siteName} onChange={e => update("siteName", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Company Email</label>
                <input type="email" value={settings.companyEmail} onChange={e => update("companyEmail", e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Site Favicon */}
          <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-slate-600 dark:text-gray-400 uppercase tracking-wide font-semibold mb-3">Site Favicon (Browser Tab Icon)</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                {settings.siteFavicon
                  ? <img src={settings.siteFavicon} alt="Favicon preview" className="w-full h-full object-contain p-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <Image className="w-5 h-5 text-slate-600 dark:text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 dark:text-white text-sm font-medium">
                  {settings.siteFavicon ? "Custom favicon active" : "Using default favicon.svg"}
                </p>
                <input
                  type="url"
                  value={settings.siteFavicon || ""}
                  onChange={e => {
                    const val = e.target.value.trim();
                    update("siteFavicon", val);
                  }}
                  placeholder="https://example.com/favicon.png"
                  className="mt-1.5 w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input ref={faviconRef} type="file" accept="image/*" onChange={handleFavicon} className="hidden" />
                <button onClick={() => faviconRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-700 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Platform Logos */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Image} title="Platform Logos" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Upload custom logos for Amazon, Alibaba, AliExpress.</p>
          <div className="space-y-3">
            {PLATFORM_LOGO_IDS.map(id => (
              <div key={id} className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl p-3">
                <div className="w-12 h-12 rounded-xl bg-gray-700 border border-gray-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {platformLogos[id]
                    ? <img src={platformLogos[id]} alt={id} className="w-full h-full object-contain p-1" />
                    : <span className="text-slate-600 dark:text-gray-400 text-xs font-bold uppercase">{id.slice(0, 2)}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white text-sm font-medium">{PLATFORM_LABELS[id]}</p>
                  <p className="text-slate-600 dark:text-gray-400 text-xs">{platformLogos[id] ? "Custom logo active" : "Using default icon"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input ref={el => { platformLogoRefs.current[id] = el; }} type="file" accept="image/*" onChange={e => handlePlatformLogo(id, e)} className="hidden" />
                  <button onClick={() => platformLogoRefs.current[id]?.click()}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors">
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  {platformLogos[id] && (
                    <button onClick={() => removePlatformLogo(id)} className="text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Brand Strip */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Layout} title="Brand Strip" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Control the scrolling brand marquee on home page.</p>
          <SettingRow label="Show Brand Strip" description="Display scrolling brand marquee on home page">
            <Toggle checked={settings.brandStripVisible} onChange={v => update("brandStripVisible", v)} />
          </SettingRow>
          {settings.brandStripVisible && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-slate-600 dark:text-gray-400 uppercase tracking-wide font-semibold mb-2">Visible Brands</p>
              {(["amazon", "alibaba", "aliexpress", "ebay"] as const).map(brand => (
                <SettingRow key={brand} label={brand.charAt(0).toUpperCase() + brand.slice(1)} description="">
                  <Toggle
                    checked={settings.brandStripItems[brand] !== false}
                    onChange={v => update("brandStripItems", { ...settings.brandStripItems, [brand]: v })}
                  />
                </SettingRow>
              ))}
            </div>
          )}
        </div>

        {/* 4. Extra Tasks */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Zap} title="Extra Tasks" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Enable exclusive extra earning task for users.</p>
          <SettingRow label="Extra Tasks Enabled" description="Show the Extra Task card to users in Mine page">
            <Toggle checked={settings.extraTaskEnabled ?? false} onChange={v => update("extraTaskEnabled", v)} />
          </SettingRow>
        </div>

        {/* 5. Amazon Task Settings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={DollarSign} title="Amazon Task Settings" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Control minimum balance requirements for Amazon tasks.</p>
          <SettingRow label="Require Minimum Balance" description="When ON, users must meet minimum balance to start Amazon tasks">
            <Toggle checked={settings.amazonMinBalanceRequired ?? true} onChange={v => update("amazonMinBalanceRequired", v)} />
          </SettingRow>
          <div className="pt-3">
            <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block font-medium font-mono">Minimum Balance ($)</label>
            <input
              type="number"
              value={settings.amazonMinTaskBalance ?? 20}
              onChange={e => update("amazonMinTaskBalance", Math.max(0, Number(e.target.value)))}
              className={inputCls}
            />
          </div>
        </div>

        {/* 6. Platform Ad Codes */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Tag} title="Platform Ad Codes" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Map specific ad code groups to each shopping platform.</p>
          <div className="space-y-3">
            {(["amazon", "alibaba", "aliexpress"] as const).map(platform => (
              <div key={platform} className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl p-3">
                <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase">{platform.slice(0, 2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 dark:text-white text-sm font-medium capitalize">{platform}</p>
                  <p className="text-slate-600 dark:text-gray-400 text-xs">{settings.platformAdCodes?.[platform] || "No code assigned"}</p>
                </div>
                <select
                  value={settings.platformAdCodes?.[platform] ?? ""}
                  onChange={e => update("platformAdCodes", { ...(settings.platformAdCodes ?? DEFAULT_SETTINGS.platformAdCodes), [platform]: e.target.value })}
                  className="bg-gray-700 border border-gray-600 rounded-xl px-2 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-purple-500 max-w-[120px]"
                >
                  <option value="">— None —</option>
                  {adGroups.map(g => (
                    <option key={g.code} value={g.code}>{g.code} ({g.tier})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* 7. Deposit Wallets */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Wallet} title="Deposit Wallets" />
            {settings.wallets.length < 3 && (
              <button onClick={() => setShowAddWallet(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Wallet
              </button>
            )}
          </div>
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Define up to 3 USDT wallet addresses.</p>

          {showAddWallet && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" placeholder="Label" value={newWallet.label} onChange={e => setNewWallet(p => ({ ...p, label: e.target.value }))} className={inputCls} />
                <select value={newWallet.network} onChange={e => setNewWallet(p => ({ ...p, network: e.target.value }))} className={inputCls}>
                  <option value="TRC20">TRC20</option>
                  <option value="ERC20">ERC20</option>
                  <option value="BEP20">BEP20</option>
                </select>
                <input type="text" placeholder="Address" value={newWallet.address} onChange={e => setNewWallet(p => ({ ...p, address: e.target.value }))} className={inputCls} />
              </div>
              <button onClick={addWallet} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-medium">Save Wallet</button>
            </div>
          )}

          <div className="space-y-3">
            {settings.wallets.map((wallet, idx) => (
              <div key={wallet.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">Wallet {idx + 1}: {wallet.label} ({wallet.network})</span>
                  <button onClick={() => removeWallet(wallet.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input type="text" value={wallet.address} onChange={e => updateWallet(wallet.id, "address", e.target.value)} className={inputCls} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Deposit QR Image</p>
              <div className="flex items-center gap-3">
                {settings.depositQr && <img src={normalizeExternalImageUrl(settings.depositQr)} alt="Deposit QR" className="w-20 h-20 object-contain rounded-xl border border-gray-700 bg-white p-1" />}
                <label className="cursor-pointer px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-medium">
                  Upload Deposit QR
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleQrUpload("depositQr", "deposit-qr", e.target.files[0])} />
                </label>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Withdraw QR Image</p>
              <div className="flex items-center gap-3">
                {settings.withdrawQr && <img src={normalizeExternalImageUrl(settings.withdrawQr)} alt="Withdraw QR" className="w-20 h-20 object-contain rounded-xl border border-gray-700 bg-white p-1" />}
                <label className="cursor-pointer px-3 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-medium">
                  Upload Withdraw QR
                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleQrUpload("withdrawQr", "withdraw-qr", e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 8. Platform Controls */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Shield} title="Platform Controls" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Control platform availability and access.</p>

          <SettingRow label="Maintenance Mode" description="Platform is online — toggle to block user access safely">
            <Toggle checked={settings.maintenanceMode} onChange={handleMaintenanceToggle} />
          </SettingRow>
          <SettingRow
            label="Firebase Alert Banner"
            description="Show the Cloud Service Alert banner on all pages. Enable when Firebase services are disrupted; disable to remove it instantly everywhere."
          >
            <Toggle checked={settings.firebaseAlertEnabled === true} onChange={handleFirebaseAlertToggle} />
          </SettingRow>
          <SettingRow label="Registration Enabled" description="Allow new users to register">
            <Toggle checked={settings.registrationEnabled} onChange={v => update("registrationEnabled", v)} />
          </SettingRow>
          <SettingRow label="Require Referral Code on Signup" description="When enabled, new accounts must enter a valid active referral code">
            <Toggle checked={settings.requireReferralCodeOnSignup === true} onChange={v => update("requireReferralCodeOnSignup", v)} />
          </SettingRow>
          <SettingRow label="Deposits Enabled" description="Allow users to submit deposit requests">
            <Toggle checked={settings.depositEnabled} onChange={v => update("depositEnabled", v)} />
          </SettingRow>
          <SettingRow label="Require Deposit Proof Screenshot" description="When enabled, users must attach a payment receipt/screenshot to submit deposits (Required badge). When disabled, it becomes optional">
            <Toggle checked={settings.depositProofRequired !== false} onChange={v => update("depositProofRequired", v)} />
          </SettingRow>
          <SettingRow label="Withdrawals Enabled" description="Allow users to submit withdrawal requests">
            <Toggle checked={settings.withdrawalEnabled} onChange={v => update("withdrawalEnabled", v)} />
          </SettingRow>
          <SettingRow label="Withdrawal Requires Completed Tasks" description="Require users to finish assigned tasks before submitting withdrawals">
            <Toggle checked={settings.withdrawalRequiresCompletedTasks !== false} onChange={v => update("withdrawalRequiresCompletedTasks", v)} />
          </SettingRow>
          <div>
            <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block mt-2">Required Completed Tasks Count</label>
            <input
              type="number"
              value={settings.requiredCompletedTasksCount ?? 25}
              onChange={e => update("requiredCompletedTasksCount", Math.max(1, Math.floor(Number(e.target.value) || 25)))}
              min={1}
              className={inputCls}
            />
          </div>
          <SettingRow label="Announcement Banner" description="Show announcement to all users">
            <Toggle checked={settings.announcementEnabled} onChange={v => update("announcementEnabled", v)} />
          </SettingRow>
        </div>

        {/* 9. UI Visibility */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Eye} title="UI Visibility" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Show or hide interface elements for all users.</p>
          <SettingRow label="Live Chat Button" description="Show the Telegram / live chat link in header">
            <Toggle checked={settings.showLiveChat} onChange={v => update("showLiveChat", v)} />
          </SettingRow>
          <SettingRow label="Support Email" description="Show support email contact link">
            <Toggle checked={settings.showSupportEmail} onChange={v => update("showSupportEmail", v)} />
          </SettingRow>
          <SettingRow label="Language Toggle" description="Show language selector in header">
            <Toggle checked={settings.showLanguageToggle} onChange={v => update("showLanguageToggle", v)} />
          </SettingRow>
        </div>

        {/* 10. Financial Settings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={DollarSign} title="Financial Settings" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Control deposit/withdrawal limits and referral thresholds.</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Min Deposit Amount ($)</label>
              <input type="number" value={settings.minDepositAmount} onChange={e => update("minDepositAmount", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Min Withdrawal Amount ($)</label>
              <input type="number" value={settings.minWithdrawalAmount} onChange={e => update("minWithdrawalAmount", Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Referral Bonus ($)</label>
              <input type="number" value={settings.referralBonus} onChange={e => update("referralBonus", Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </div>

        {/* 11. Withdrawal Tax */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={DollarSign} title="Withdrawal Tax" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Deduct fee from withdrawal requests.</p>
          <SettingRow label="Enable Withdrawal Tax" description="Apply tax on withdrawal">
            <Toggle checked={!!settings.withdrawalTaxEnabled} onChange={v => update("withdrawalTaxEnabled", v)} />
          </SettingRow>
          <div className="mt-3 space-y-3">
            <input type="number" value={settings.withdrawalTaxValue ?? 0} onChange={e => update("withdrawalTaxValue", Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        {/* 12. Deposit Bonus */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Gift} title="Deposit Bonus" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Reward users with extra balance on deposit approval.</p>
          <SettingRow label="Enable Deposit Bonus" description="Credit bonus on deposit">
            <Toggle checked={!!settings.depositBonusEnabled} onChange={v => update("depositBonusEnabled", v)} />
          </SettingRow>
          <div className="mt-3">
            <input type="number" value={settings.depositBonusValue ?? 0} onChange={e => update("depositBonusValue", Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        {/* 13. Contact Channels */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Link} title="Contact Channels" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Manage contact channels shown on Support page.</p>
          <div className="space-y-2">
            {(settings.contacts ?? []).map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs">
                <span>{c.platform}: {c.title} ({c.link})</span>
                <Toggle checked={c.enabled} onChange={v => updateContact(c.id, "enabled", v)} />
              </div>
            ))}
          </div>
        </div>

        {/* 14. Announcement */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Globe} title="Announcement" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Site-wide announcement banner text.</p>
          <input type="text" value={settings.announcementText} onChange={e => update("announcementText", e.target.value)} className={inputCls} />
        </div>

        {/* 15. Loading Screen (Atom Loader) */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Loader2} title="Loading Screen (Atom Loader)" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Configure the Atom loader animation shown across the site.</p>
          <SettingRow label="Enable Loader" description="Show Atom animation globally">
            <Toggle checked={settings.loaderEnabled ?? true} onChange={v => update("loaderEnabled", v)} />
          </SettingRow>
          <div className="flex items-center justify-center py-4 bg-gray-950 rounded-xl my-3">
            <Atom color={settings.loaderColor || "#2cd136"} size={settings.loaderSize ?? "medium"} text={settings.loaderText ?? "Loading..."} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="color" value={settings.loaderColor || "#2cd136"} onChange={e => update("loaderColor", e.target.value)} className="w-full h-10 rounded-lg cursor-pointer bg-gray-800 p-1" />
            <input type="text" value={settings.loaderText ?? ""} onChange={e => update("loaderText", e.target.value)} placeholder="Loading text" className={inputCls} />
          </div>
        </div>

        {/* 16. Platform Bands */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2">
          <SectionHeader icon={Zap} title="Platform Bands & Routing" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Show users only the platform matching their balance band. Configure thresholds & commission rates.</p>
          <SettingRow label="Balance-Based Routing" description="Users see only matching platform based on balance">
            <Toggle checked={settings.bandSwitchingEnabled ?? true} onChange={v => update("bandSwitchingEnabled", v)} />
          </SettingRow>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-800 p-3 rounded-xl space-y-2">
              <p className="text-xs font-bold text-orange-400">Amazon Band</p>
              <label className="text-[10px] text-gray-400 block">Max Balance ($)</label>
              <input type="number" value={settings.amazonBandMax ?? 499} onChange={e => update("amazonBandMax", Number(e.target.value))} className={inputCls} />
              <label className="text-[10px] text-gray-400 block">Commission Rate (%)</label>
              <input type="number" value={settings.amazonCommissionRate ?? 4} onChange={e => update("amazonCommissionRate", Number(e.target.value))} className={inputCls} />
            </div>

            <div className="bg-gray-800 p-3 rounded-xl space-y-2">
              <p className="text-xs font-bold text-yellow-400">Alibaba Band</p>
              <label className="text-[10px] text-gray-400 block">Min Balance ($)</label>
              <input type="number" value={settings.alibabaBandMin ?? 500} onChange={e => update("alibabaBandMin", Number(e.target.value))} className={inputCls} />
              <label className="text-[10px] text-gray-400 block">Max Balance ($)</label>
              <input type="number" value={settings.alibabaBandMax ?? 899} onChange={e => update("alibabaBandMax", Number(e.target.value))} className={inputCls} />
              <label className="text-[10px] text-gray-400 block">Commission Rate (%)</label>
              <input type="number" value={settings.alibabaCommissionRate ?? 8} onChange={e => update("alibabaCommissionRate", Number(e.target.value))} className={inputCls} />
            </div>

            <div className="bg-gray-800 p-3 rounded-xl space-y-2">
              <p className="text-xs font-bold text-red-400">AliExpress Band</p>
              <label className="text-[10px] text-gray-400 block">Min Balance ($)</label>
              <input type="number" value={settings.aliexpressBandMin ?? 900} onChange={e => update("aliexpressBandMin", Number(e.target.value))} className={inputCls} />
              <label className="text-[10px] text-gray-400 block">Commission Rate (%)</label>
              <input type="number" value={settings.aliexpressCommissionRate ?? 12} onChange={e => update("aliexpressCommissionRate", Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          {hasBandIssues && (
            <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800 rounded-xl flex items-center justify-between">
              <span className="text-xs text-amber-300 font-semibold">Band overlap or gap detected!</span>
              <button onClick={autoFixBands} className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold">Auto-fix Bands</button>
            </div>
          )}
        </div>

        {/* 17. Default Themes */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Monitor} title="Default Themes" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Set initial theme applied on first visit.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Admin Default</label>
              <select value={settings.adminDefaultTheme ?? "light"} onChange={e => update("adminDefaultTheme", e.target.value as "light" | "dark")} className={inputCls}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">User Default</label>
              <select value={settings.userDefaultTheme ?? "light"} onChange={e => update("userDefaultTheme", e.target.value as "light" | "dark")} className={inputCls}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </div>

        {/* 18. User Panel Color Theme */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Palette} title="User Panel Accent Color" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Choose accent theme color for User Dashboard.</p>
          <div className="grid grid-cols-5 gap-2">
            {PANEL_THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => update("panelTheme", theme.id as PlatformSettings["panelTheme"])}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 ${
                  (settings.panelTheme ?? "default") === theme.id ? "border-purple-500 bg-purple-950/40 text-purple-300" : "border-gray-700 text-gray-400"
                }`}
              >
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.accent }} />
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* 19. Change Admin Password */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2">
          <SectionHeader icon={KeyRound} title="Change Admin Password" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Update login password for Super Admin account.</p>
          <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="password" name="current-password" placeholder="Current Password" autoComplete="current-password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)} className={inputCls} />
              <input type="password" name="new-password" placeholder="New Password" autoComplete="new-password" value={pwNew} onChange={e => setPwNew(e.target.value)} className={inputCls} />
              <input type="password" name="confirm-password" placeholder="Confirm Password" autoComplete="new-password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} className={inputCls} />
            </div>
            {pwError && <p className="text-xs text-red-400 mt-2">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-400 mt-2">Password updated successfully!</p>}
            <button type="submit" disabled={pwChanging} className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold">
              {pwChanging ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>

      </div>

      {/* Toast */}
      {settingsToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 text-sm font-medium px-4 py-3 rounded-2xl shadow-xl border ${
          settingsToast.type === "error"
            ? "bg-gray-800 border-red-700/60 text-red-400"
            : "bg-gray-800 border-green-700/60 text-green-400"
        }`}>
          {settingsToast.type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          {settingsToast.msg}
        </div>
      )}
    </SuperAdminLayout>
  );
}
