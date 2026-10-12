import { useState, useEffect } from "react";
import AdminLayout from "./AdminLayout";
import {
  DEFAULT_SETTINGS, PlatformSettings, WalletConfig, ContactChannel,
} from "../../data/adminData";
import {
  Save, DollarSign, Shield, Link, Eye, EyeOff,
  Wallet, Plus, Upload, MessageCircle, Mail, Zap, KeyRound, Send, Check, Loader2, AlertCircle, CheckCircle, AlertTriangle,
} from "lucide-react";
import { useAdminSettingsDraft, saveSettings, publishSettings, uploadAssetFile } from "../../hooks/useApi";
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

export default function AdminSettings() {
  const { admin, updateAdminSession } = useAdmin();
  const isSuperAdmin = admin?.role === "super_admin" || admin?.role === "superadmin" || admin?.role === "owner";
  const { data: apiSettings } = useAdminSettingsDraft<PlatformSettings>();

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

  // Admin password change
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwChanging, setPwChanging] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwShowCurrent, setPwShowCurrent] = useState(false);
  const [pwShowNew, setPwShowNew] = useState(false);
  const [pwShowConfirm, setPwShowConfirm] = useState(false);

  async function handlePasswordChange() {
    setPwError("");
    setPwSuccess(false);

    if (!pwCurrent.trim()) { setPwError("Current password is required."); return; }
    if (!pwNew.trim()) { setPwError("New password is required."); return; }
    if (pwNew.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (pwNew !== pwConfirm) { setPwError("New password and confirm password do not match."); return; }
    if (pwNew === pwCurrent) { setPwError("New password must be different from current password."); return; }

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
      setPwError(error instanceof ApiError ? error.message : "Unable to reach server. Please try again.");
    } finally {
      setPwChanging(false);
    }
  }

  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWallet, setNewWallet] = useState<Omit<WalletConfig, "id">>({
    label: "", network: "TRC20", address: "",
  });

  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<Omit<ContactChannel, "id">>({
    platform: "Telegram", title: "", link: "", enabled: true,
  });

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

  async function handleSave() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const settingsRecord = settings as unknown as Record<string, unknown>;
      const currentVersion = typeof settingsRecord.version === "number" ? settingsRecord.version as number : 0;
      await saveSettings({
        ...settingsRecord,
        status: "draft",
        updatedAt: now,
        updatedBy: admin?.username ?? "admin",
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
    setPublishing(true);
    try {
      await publishSettings(settings as unknown as Record<string, unknown>, admin?.username);
      setPublished(true);
      showSettingsToast("Settings published! Users will see updates immediately.");
      setTimeout(() => setPublished(false), 2000);
    } catch (err) {
      console.error("Failed to publish settings:", err);
      showSettingsToast("Failed to publish settings.", "error");
    } finally {
      setPublishing(false);
    }
  }

  async function saveQrSetting(field: "depositQr" | "withdrawQr", url: string) {
    const nextSettings = { ...settings, [field]: url } as PlatformSettings;
    setSettings(nextSettings);
    await saveSettings({
      ...(nextSettings as unknown as Record<string, unknown>),
      status: "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: admin?.username ?? "admin",
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

  function addWallet() {
    if (!newWallet.address.trim() || settings.wallets.length >= 3) return;
    const wallet: WalletConfig = { ...newWallet, id: generateWalletId() };
    update("wallets", [...settings.wallets, wallet]);
    setNewWallet({ label: "", network: "TRC20", address: "" });
    setShowAddWallet(false);
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

  function updateContact(id: string, field: keyof Omit<ContactChannel, "id">, value: string | boolean) {
    update("contacts", (settings.contacts ?? []).map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  const inputCls = "w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-purple-500";

  return (
    <AdminLayout title="Platform Settings">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">

        {/* 1. Deposit Wallets */}
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
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Define up to 3 USDT wallet addresses. Users will be shown their assigned wallet when depositing.</p>

          {showAddWallet && (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
              <p className="text-slate-900 dark:text-white text-xs font-semibold uppercase tracking-wide">New Wallet</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Label</label>
                  <input type="text" placeholder="e.g. Main TRC20" value={newWallet.label}
                    onChange={e => setNewWallet(p => ({ ...p, label: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Network</label>
                  <select value={newWallet.network} onChange={e => setNewWallet(p => ({ ...p, network: e.target.value }))}
                    className={inputCls}>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                    <option value="BEP20">BEP20</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Wallet Address</label>
                  <input type="text" placeholder="T... or 0x..." value={newWallet.address}
                    onChange={e => setNewWallet(p => ({ ...p, address: e.target.value }))}
                    className={`${inputCls} font-mono text-xs`} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addWallet} disabled={!newWallet.address.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-slate-600 dark:text-gray-400 text-white rounded-xl text-xs font-medium transition-colors">
                  Save Wallet
                </button>
                <button onClick={() => setShowAddWallet(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {settings.wallets.length === 0 && !showAddWallet ? (
            <div className="text-center py-8 text-gray-600 text-sm">No wallets configured. Add up to 3 wallets.</div>
          ) : (
            <div className="space-y-3">
              {settings.wallets.map((wallet, idx) => (
                <div key={wallet.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wide">Wallet {idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Label</label>
                      <input type="text" value={wallet.label}
                        onChange={e => updateWallet(wallet.id, "label", e.target.value)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Network</label>
                      <select value={wallet.network} onChange={e => updateWallet(wallet.id, "network", e.target.value)}
                        className={inputCls}>
                        <option value="TRC20">TRC20</option>
                        <option value="ERC20">ERC20</option>
                        <option value="BEP20">BEP20</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Wallet Address</label>
                      <input type="text" value={wallet.address}
                        onChange={e => updateWallet(wallet.id, "address", e.target.value)}
                        className={`${inputCls} font-mono text-xs`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Deposit QR / Barcode Image */}
          <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Deposit QR / Barcode Image</p>
            <p className="text-xs text-slate-600 dark:text-gray-400 mb-3">Paste a URL or upload a QR code / barcode shown on the user deposit screen.</p>
            <div className="flex items-start gap-4">
              {settings.depositQr ? (
                <div className="relative flex-shrink-0">
                  <img src={normalizeExternalImageUrl(settings.depositQr)} alt="Deposit QR" className="w-28 h-28 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button
                    onClick={() => update("depositQr", "")}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                    title="Remove QR image"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="w-28 h-28 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  <Upload className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  value={settings.depositQr || ""}
                  onChange={e => update("depositQr", normalizeExternalImageUrl(e.target.value))}
                  placeholder="https://example.com/deposit-qr.png"
                  className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {settings.depositQr ? "Replace Image" : "Upload QR / Barcode"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await handleQrUpload("depositQr", "deposit-qr", file);
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-gray-400">PNG, JPG, GIF, or public Google Drive image link - Shown on deposit screen</p>
              </div>
            </div>
          </div>

          {/* Withdraw QR / Barcode Image */}
          <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Withdraw QR / Barcode Image</p>
            <p className="text-xs text-slate-600 dark:text-gray-400 mb-3">Paste a URL or upload a QR code / barcode shown on the user withdrawal screen.</p>
            <div className="flex items-start gap-4">
              {settings.withdrawQr ? (
                <div className="relative flex-shrink-0">
                  <img src={normalizeExternalImageUrl(settings.withdrawQr)} alt="Withdraw QR" className="w-28 h-28 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-white p-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <button
                    onClick={() => update("withdrawQr", "")}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                    title="Remove QR image"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <div className="w-28 h-28 flex-shrink-0 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                  <Upload className="w-6 h-6 text-slate-500 dark:text-gray-400" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  value={settings.withdrawQr || ""}
                  onChange={e => update("withdrawQr", normalizeExternalImageUrl(e.target.value))}
                  placeholder="https://example.com/withdraw-qr.png"
                  className="w-full text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-medium transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {settings.withdrawQr ? "Replace Image" : "Upload QR / Barcode"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await handleQrUpload("withdrawQr", "withdraw-qr", file);
                      } finally {
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-gray-400">PNG, JPG, GIF, or public Google Drive image link - Shown on withdrawal screen</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Extra Tasks */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Zap} title="Extra Tasks" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Enable an exclusive extra earning task. Users must request access via Support, and admin approves per user.</p>
          <SettingRow label="Extra Tasks Enabled" description="Show the Extra Task card to users in Mine page">
            <Toggle checked={settings.extraTaskEnabled ?? false} onChange={v => update("extraTaskEnabled", v)} />
          </SettingRow>
          {settings.extraTaskEnabled && (
            <p className="text-xs text-amber-400 mt-2">Users will see the Extra Task card. Requests appear in Support → Extra Tasks tab.</p>
          )}
        </div>

        {/* 3. Platform Controls */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={Shield} title="Platform Controls" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Control platform availability and access.</p>

          <div className={`rounded-xl mb-1 transition-colors ${settings.maintenanceMode ? "bg-amber-950/30 border border-amber-800/60 p-3" : ""}`}>
            <SettingRow
              label="Maintenance Mode"
              description={settings.maintenanceMode
                ? "Platform is OFFLINE for regular users — admin access unaffected"
                : "Platform is online — toggle to block user access safely"}
            >
              <div className="flex items-center gap-2">
                {maintenanceSaved && (
                  <span className="text-xs text-green-400 font-medium">Saved</span>
                )}
                {settings.maintenanceMode && (
                  <span className="text-xs font-semibold text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded-full">ACTIVE</span>
                )}
                <Toggle checked={settings.maintenanceMode} onChange={handleMaintenanceToggle} />
              </div>
            </SettingRow>
          </div>
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
          <div className={`${settings.withdrawalRequiresCompletedTasks === false ? "opacity-50" : ""}`}>
            <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Required Completed Tasks Count</label>
            <input
              type="number"
              value={settings.requiredCompletedTasksCount ?? 25}
              onChange={e => update("requiredCompletedTasksCount", Math.max(1, Math.floor(Number(e.target.value) || 25)))}
              min={1}
              step={1}
              disabled={settings.withdrawalRequiresCompletedTasks === false}
              className={`${inputCls} ${settings.withdrawalRequiresCompletedTasks === false ? "cursor-not-allowed" : ""}`}
            />
            <p className="text-slate-600 dark:text-gray-400 text-xs mt-1">
              Default is 25. This count is enforced before withdrawal when the restriction is on.
            </p>
          </div>
          <SettingRow label="Announcement Banner" description="Show announcement to all users">
            <Toggle checked={settings.announcementEnabled} onChange={v => update("announcementEnabled", v)} />
          </SettingRow>
        </div>

        {/* 4. Withdrawal Tax */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <SectionHeader icon={DollarSign} title="Withdrawal Tax" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Deduct a fee from withdrawal requests.</p>
          <div className="space-y-4">
            <SettingRow label="Enable Withdrawal Tax" description="Apply a tax/fee when users withdraw funds">
              <Toggle checked={!!settings.withdrawalTaxEnabled} onChange={v => update("withdrawalTaxEnabled", v)} />
            </SettingRow>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">Tax Type</label>
              <div className="flex gap-2">
                {(["fixed", "percentage"] as const).map(t => (
                  <button key={t} onClick={() => update("withdrawalTaxType", t)}
                    disabled={!settings.withdrawalTaxEnabled}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all capitalize
                      ${settings.withdrawalTaxType === t ? "bg-purple-600 text-white border-purple-600" : "bg-gray-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border-gray-700"}
                      ${!settings.withdrawalTaxEnabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                    {t === "fixed" ? "Fixed (USDT)" : "Percentage (%)"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block">
                {settings.withdrawalTaxType === "percentage" ? "Tax Percentage (%)" : "Tax Amount (USDT)"}
              </label>
              <input
                type="number"
                value={settings.withdrawalTaxValue ?? 0}
                onChange={e => update("withdrawalTaxValue", Number(e.target.value))}
                min={0}
                step={settings.withdrawalTaxType === "percentage" ? 0.1 : 0.5}
                max={settings.withdrawalTaxType === "percentage" ? 100 : undefined}
                disabled={!settings.withdrawalTaxEnabled}
                className={`${inputCls} ${!settings.withdrawalTaxEnabled ? "opacity-40 cursor-not-allowed" : ""}`}
              />
              {settings.withdrawalTaxEnabled && (settings.withdrawalTaxValue ?? 0) > 0 && (
                <p className="text-xs text-yellow-500 mt-1">
                  Example: {settings.withdrawalTaxType === "percentage"
                    ? `${settings.withdrawalTaxValue}% of 100 USDT = ${(100 * (settings.withdrawalTaxValue ?? 0) / 100).toFixed(2)} USDT tax`
                    : `Fixed ${settings.withdrawalTaxValue} USDT per withdrawal`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 5. Contact Channels */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Link} title="Contact Channels" />
            <button onClick={() => setShowAddContact(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-700 hover:bg-purple-600 text-white rounded-xl transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Channel
            </button>
          </div>
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">Manage contact channels shown on the Support page. Toggle to show/hide each.</p>

          {showAddContact && (
            <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
              <p className="text-xs font-semibold text-slate-700 dark:text-gray-300">New Contact Channel</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Platform</label>
                  <select value={newContact.platform}
                    onChange={e => setNewContact(c => ({ ...c, platform: e.target.value as ContactChannel["platform"] }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-sm">
                    <option>Telegram</option>
                    <option>Email</option>
                    <option>WhatsApp</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Display Title</label>
                  <input value={newContact.title} onChange={e => setNewContact(c => ({ ...c, title: e.target.value }))}
                    placeholder="e.g. Live Chat" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block">Link / Email</label>
                  <input value={newContact.link} onChange={e => setNewContact(c => ({ ...c, link: e.target.value }))}
                    placeholder="https://t.me/... or email@example.com"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-sm font-mono" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addContact} disabled={!newContact.title.trim() || !newContact.link.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg transition-colors">
                  Add
                </button>
                <button onClick={() => setShowAddContact(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-slate-700 dark:text-gray-300 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {(settings.contacts ?? []).map(c => {
              const Icon = c.platform === "Email" ? Mail : MessageCircle;
              return (
                <div key={c.id} className="flex items-start gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
                  <div className="p-2 bg-gray-700 rounded-lg mt-0.5 flex-shrink-0">
                    <Icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Platform</label>
                      <select value={c.platform}
                        onChange={e => updateContact(c.id, "platform", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white text-xs">
                        <option>Telegram</option>
                        <option>Email</option>
                        <option>WhatsApp</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Title</label>
                      <input value={c.title} onChange={e => updateContact(c.id, "title", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 dark:text-gray-400 mb-1 block">Link / Email</label>
                      <input value={c.link} onChange={e => updateContact(c.id, "link", e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white text-xs font-mono" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pt-5">
                    <Toggle checked={c.enabled} onChange={v => updateContact(c.id, "enabled", v)} />
                  </div>
                </div>
              );
            })}
            {(settings.contacts ?? []).length === 0 && (
              <p className="text-slate-600 dark:text-gray-400 text-xs text-center py-4">No contact channels. Click "Add Channel" to add one.</p>
            )}
          </div>
        </div>

        {/* 6. Change Admin Password */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 lg:col-span-2">
          <SectionHeader icon={KeyRound} title="Change Admin Password" />
          <p className="text-slate-600 dark:text-gray-400 text-xs mb-4">
            Update your admin login password. You must enter your current password to confirm the change.
            {admin?.username && (
              <span className="ml-1 text-slate-500 dark:text-gray-400">Logged in as <strong className="text-gray-300">{admin.username}</strong>.</span>
            )}
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block font-medium">Current Password</label>
                <div className="relative">
                  <input
                    type={pwShowCurrent ? "text" : "password"}
                    value={pwCurrent}
                    onChange={e => { setPwCurrent(e.target.value); setPwError(""); setPwSuccess(false); }}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    name="current-password"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPwShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {pwShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block font-medium">New Password</label>
                <div className="relative">
                  <input
                    type={pwShowNew ? "text" : "password"}
                    value={pwNew}
                    onChange={e => { setPwNew(e.target.value); setPwError(""); setPwSuccess(false); }}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    name="new-password"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPwShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {pwShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-gray-400 mb-1.5 block font-medium">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={pwShowConfirm ? "text" : "password"}
                    value={pwConfirm}
                    onChange={e => { setPwConfirm(e.target.value); setPwError(""); setPwSuccess(false); }}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    name="confirm-password"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 pr-10 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPwShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {pwShowConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {pwError && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="mt-3 flex items-center gap-2 text-green-400 text-xs bg-green-900/20 border border-green-800/40 rounded-xl px-3 py-2.5">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                Password changed successfully. Use your new password next time you log in.
              </div>
            )}

            <div className="mt-4">
              <button
                type="submit"
                disabled={pwChanging || !pwCurrent || !pwNew || !pwConfirm}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-slate-600 dark:text-gray-400 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
              >
                {pwChanging ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Changing Password…</>
                ) : (
                  <><KeyRound className="w-4 h-4" /> Change Password</>
                )}
              </button>
            </div>
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

      {/* Save button */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            saved
              ? "bg-green-600 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-slate-900 dark:text-white"
          }`}
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : saved ? "Draft Saved!" : "Save Draft"}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            published
              ? "bg-green-600 text-white"
              : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          <Send className="w-4 h-4" />
          {publishing ? "Publishing…" : published ? "Published!" : "Publish"}
        </button>
      </div>
    </AdminLayout>
  );
}
