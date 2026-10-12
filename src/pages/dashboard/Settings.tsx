import { useState } from "react";
import { Moon, Sun, Monitor, Bell, Eye, EyeOff, CheckCircle2, Lock, Volume2, VolumeX } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useTheme } from "../../components/ThemeToggle";
import { useLang, LANGUAGES, LangCode } from "../../contexts/LangContext";
import { useAuth } from "../../contexts/AuthContext";
import { saveGenericFirebaseDoc, useFirebaseDoc } from "../../hooks/useApi";
import { apiUrl, authHeaders, storeUserSession } from "../../lib/apiClient";
import { LanguageFlag } from "../../components/LanguageFlag";

interface UserPreferences { id: string; userId: string; soundEnabled: boolean; notifEnabled: boolean; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-50 dark:border-gray-700">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-gray-50 dark:divide-gray-700">{children}</div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {desc && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-600"}`}>
      <span className={`absolute top-1 h-4 w-4 bg-white rounded-full shadow transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function Settings() {
  const { themeChoice, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const { user } = useAuth();
  const prefFallback: UserPreferences = { id: user?.id ?? "guest", userId: user?.id ?? "guest", soundEnabled: true, notifEnabled: true };
  const { data: prefs, refetch: refetchPrefs } = useFirebaseDoc<UserPreferences>("userPreferences", user?.id ?? "guest", prefFallback);
  const notifEnabled = prefs?.notifEnabled ?? true;
  const soundEnabled = prefs?.soundEnabled ?? true;

  async function savePrefs(patch: Partial<UserPreferences>) {
    if (!user) return;
    await saveGenericFirebaseDoc("userPreferences", user.id, { ...prefFallback, ...prefs, ...patch, id: user.id, userId: user.id });
    refetchPrefs();
  }

  function toggleNotif() { void savePrefs({ notifEnabled: !notifEnabled }); }
  function toggleSound() { void savePrefs({ soundEnabled: !soundEnabled }); }

  const [twoFa, setTwoFa] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const savePassword = async () => {
    setPwError("");
    if (!pwForm.current) { setPwError(t("enterCurrentPw")); return; }
    if (pwForm.next.length < 6) { setPwError(t("pwTooShort")); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError(t("pwNoMatch")); return; }
    if (!user?.email) return;
    setPwSaving(true);
    try {
      const res = await fetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          currentPassword: pwForm.current,
          newPassword: pwForm.next,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setPwError(body?.error || "Failed to update password. Please try again.");
        setPwSaving(false);
        return;
      }
      const pwResult = await res.json().catch(() => null);
      if (pwResult?.sessionToken && pwResult.sessionExpiresAt) {
        storeUserSession(pwResult.sessionToken, pwResult.sessionExpiresAt);
      }
    } catch {
      setPwError("Failed to update password. Please try again.");
      setPwSaving(false);
      return;
    }
    setPwSaving(false);
    setPwSaved(true);
    setPwForm({ current: "", next: "", confirm: "" });
    setTimeout(() => setPwSaved(false), 3000);
  };

  const themeOptions: { choice: "light" | "dark"; icon: React.ReactNode; label: string }[] = [
    { choice: "light", icon: <Sun className="h-3.5 w-3.5" />,  label: t("light") },
    { choice: "dark",  icon: <Moon className="h-3.5 w-3.5" />, label: t("dark")  },
  ];

  const pwFields = [
    { key: "current", label: t("currentPassword") },
    { key: "next",    label: t("newPassword") },
    { key: "confirm", label: t("confirmNewPassword") },
  ];

  return (
    <DashboardLayout showBack title={t("settings")} backTo="/dashboard/mine">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

        <Section title={t("appearance")}>
          <Row label={t("theme")} desc={t("chooseColorTheme")}>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              {themeOptions.map(({ choice, icon, label }) => (
                <button key={choice} onClick={() => setTheme(choice)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${themeChoice === choice ? "bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title={t("language")}>
          <Row label={t("language")} desc={t("chooseLanguage")}>
            <div className="flex flex-wrap gap-2 justify-end">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => setLang(l.code as LangCode)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${lang === l.code ? "bg-purple-600 text-white border-purple-600" : "text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-purple-400"}`}>
                  <LanguageFlag code={l.code} />
                  <span className="hidden sm:inline">{l.native}</span>
                  <span className="sm:hidden">{l.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title={t("notifications")}>
          <Row label={t("notifications")} desc={t("notificationsDesc")}>
            <div className="flex items-center gap-2">
              <Bell className={`h-4 w-4 ${notifEnabled ? "text-purple-600" : "text-slate-500 dark:text-gray-400"}`} />
              <Toggle on={notifEnabled} onToggle={toggleNotif} />
            </div>
          </Row>
        </Section>

        <Section title={t("sound")}>
          <Row label={t("completionSound")} desc={t("playChime")}>
            <div className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="h-4 w-4 text-purple-600" /> : <VolumeX className="h-4 w-4 text-slate-500 dark:text-gray-400" />}
              <Toggle on={soundEnabled} onToggle={toggleSound} />
            </div>
          </Row>
        </Section>

        <Section title={t("security")}>
          <Row label={t("twoFactorAuth")} desc={t("extraSecurity")}>
            <Toggle on={twoFa} onToggle={() => setTwoFa(s => !s)} />
          </Row>
          <div className="px-5 py-4">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-purple-600" /> {t("changePassword")}
            </p>
            {pwError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 rounded-lg mb-3">{pwError}</p>
            )}
            {pwSaved && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 rounded-lg mb-3">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("passwordUpdated")}
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); savePassword(); }} className="space-y-2.5">
              {pwFields.map(f => (
                <div key={f.key} className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={pwForm[f.key as keyof typeof pwForm]}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.label}
                    className="w-full pr-10 pl-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                  />
                  {f.key === "confirm" && (
                    <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              ))}
              <button type="submit" disabled={pwSaving} className="w-full py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {pwSaving ? "Updating…" : t("updatePassword")}
              </button>
            </form>
          </div>
        </Section>

        <Section title={t("about")}>
          <Row label={t("platformLabel")} desc={t("earningPlatform")}>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">v1.0</span>
          </Row>
          <Row label={t("memberSince")}>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
            </span>
          </Row>
        </Section>
      </div>
    </DashboardLayout>
  );
}
