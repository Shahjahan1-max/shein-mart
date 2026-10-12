import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { User, Settings, ChevronRight, Zap, Clock, Users, ClipboardList, Star, Wallet, ArrowDownLeft, ArrowUpRight, LogOut } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { DEFAULT_SETTINGS, type ExtraTaskApproval } from "../../data/adminData";
import { useFirebaseDoc, useSettings, useTeamMembers } from "../../hooks/useApi";
import { normalizeExternalImageUrl } from "../../lib/imageUrl";

export function Mine() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLang();
  const { data: apiSettings } = useSettings<typeof DEFAULT_SETTINGS>();
  const { data: users = [] } = useTeamMembers(user?.id, user?.referralCode);
  const { data: extraApproval = { approved: false, rejected: false, limit: 10 } } = useFirebaseDoc<ExtraTaskApproval>(
    "extraTaskApprovals",
    user?.id ?? "guest",
    { approved: false, rejected: false, limit: 10 },
  );
  const settings = apiSettings ? { ...DEFAULT_SETTINGS, ...apiSettings } : DEFAULT_SETTINGS;
  const extraTaskEnabled = settings.extraTaskEnabled ?? false;
  const teamData = useMemo(() => ({
    members: users.filter(item => item.referredByUserId === user?.id || item.referredBy === user?.referralCode),
    teamEarnings: users
      .filter(item => item.referredByUserId === user?.id || item.referredBy === user?.referralCode)
      .reduce((sum, item) => sum + Number(item.earnings ?? 0), 0),
  }), [users, user?.id, user?.referralCode]);

  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const teamCode = user?.referralCode ?? "------";
  const balance = user?.balance ?? 0;
  const earnings = user?.earnings ?? 0;
  const referralCount = teamData.members.length;
  const profileImage = user?.profileImage ? normalizeExternalImageUrl(String(user.profileImage)) : "";
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileImage]);

  const MENU_ROWS = [
    { label: t("profile"),   icon: User,          path: "/dashboard/profile",            desc: t("editPersonalInfo"),                  color: "bg-primary/10 text-primary" },
    { label: t("myTeam"),    icon: Users,         path: "/dashboard/team",               desc: `${referralCount} ${t("membersInNetwork")}`, color: "bg-accent/10 text-accent" },
    { label: t("wallet"),    icon: Wallet,        path: "/dashboard/deposit-withdrawal", desc: t("walletDesc"),                        color: "bg-primary/10 text-primary" },
    { label: t("records"),   icon: ClipboardList, path: "/dashboard/records",            desc: t("recordsDesc"),                       color: "bg-accent/10 text-accent" },
    { label: t("settings"),  icon: Settings,       path: "/dashboard/settings",           desc: t("settingsDesc"),                      color: "bg-muted text-muted-foreground" },
  ];

  const headerActions = (
    <div className="flex items-center gap-1 sm:gap-2">
      <button
        onClick={() => navigate("/dashboard/deposit")}
        aria-label={t("deposit")}
        title={t("deposit")}
        className="flex h-9 w-9 sm:w-auto items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-0 sm:px-3 py-2 rounded-xl transition-all shadow-sm flex-shrink-0"
      >
        <ArrowDownLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">{t("deposit")}</span>
      </button>
      <button
        onClick={() => navigate("/dashboard/withdraw")}
        aria-label={t("withdrawal")}
        title={t("withdrawal")}
        className="flex h-9 w-9 sm:w-auto items-center justify-center gap-1.5 bg-accent hover:bg-accent/90 active:scale-95 text-accent-foreground text-xs font-bold px-0 sm:px-3 py-2 rounded-xl transition-all shadow-sm flex-shrink-0"
      >
        <ArrowUpRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">{t("withdrawal")}</span>
      </button>
    </div>
  );

  return (
    <DashboardLayout actions={headerActions}>
      <div className="relative bg-gradient-to-r from-[#1B365D] via-[#254C73] to-[#32608F] px-5 pt-8 pb-8 shadow-xl overflow-hidden rounded-3xl mx-4 mt-4 text-white">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <div className="flex items-center gap-4 relative">
          <div className="w-[68px] h-[68px] rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center text-slate-900 dark:text-white text-2xl font-extrabold flex-shrink-0 shadow-lg overflow-hidden">
            {profileImage && !avatarLoadFailed ? (
              <img src={profileImage} alt="Profile" onError={() => setAvatarLoadFailed(true)} className="h-full w-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-slate-900 dark:text-white text-[18px] font-extrabold leading-tight truncate">{user?.name ?? "Guest"}</p>
              <span className="bg-accent text-accent-foreground text-[10px] font-black px-2 py-0.5 rounded-full leading-none flex-shrink-0 flex items-center gap-1"><Star className="w-2.5 h-2.5" />VIP</span>
            </div>
            <p className="text-blue-100 text-xs tracking-wide">{t("teamCode")}:&nbsp;<span className="font-bold text-slate-900 dark:text-white">{teamCode}</span></p>
            {user?.email && <p className="text-blue-200 text-[11px] mt-0.5 truncate">{user.email}</p>}
          </div>
          <button onClick={() => navigate("/dashboard/settings")} className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center active:scale-95 transition-transform" title={t("settings")}>
            <Settings className="w-4 h-4 text-slate-900 dark:text-white" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-5 relative">
          {[
            { label: t("balance"),         value: `$${balance.toFixed(2)}`,  sub: "USDT"   },
            { label: t("totalEarnedLabel"),value: `$${earnings.toFixed(2)}`, sub: "USD"    },
            { label: t("referrals"),       value: String(referralCount),     sub: t("members") },
          ].map((stat, i) => (
            <div key={i} className="flex-1 bg-white/10 border border-white/15 rounded-2xl px-3 py-3 text-center">
              <p className="text-slate-900 dark:text-white text-base font-extrabold leading-tight tabular-nums">{stat.value}</p>
              <p className="text-blue-100 text-[10px] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 mx-4 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 shadow-sm border border-gray-100 dark:border-gray-800">
        {MENU_ROWS.map(row => {
          const Icon = row.icon;
          return (
            <button key={row.path} onClick={() => navigate(row.path)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left active:bg-gray-100 dark:active:bg-gray-750">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${row.color}`}><Icon className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{row.label}</p>
                <p className="text-[12px] text-slate-500 dark:text-gray-400 mt-0.5">{row.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {extraTaskEnabled && (
        <div className="mx-4 mt-4">
          <button onClick={() => navigate("/dashboard/extra-task")} className="w-full text-left active:scale-[0.98] transition-transform">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-5 shadow-lg">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white" />
                <div className="absolute -bottom-6 -left-4 w-32 h-32 rounded-full bg-white" />
              </div>
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-slate-900 dark:text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-slate-900 dark:text-white font-extrabold text-sm leading-tight">{t("extraTasks")}</p>
                    {extraApproval.approved ? (
                      <span className="bg-white/25 text-slate-900 dark:text-white text-[10px] font-black px-2 py-0.5 rounded-full leading-none">{t("approved").toUpperCase()}</span>
                    ) : extraApproval.rejected ? (
                      <span className="bg-red-900/40 text-red-200 text-[10px] font-black px-2 py-0.5 rounded-full leading-none">{t("rejected").toUpperCase()}</span>
                    ) : extraApproval.requestedAt ? (
                      <span className="bg-white/20 text-white/80 text-[10px] font-black px-2 py-0.5 rounded-full leading-none flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {t("pending").toUpperCase()}</span>
                    ) : (
                      <span className="bg-white/20 text-white/80 text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">{t("requestAccess").toUpperCase()}</span>
                    )}
                  </div>
                  <p className="text-white/80 text-[12px]">
                    {extraApproval.approved ? `Up to ${extraApproval.limit} ${t("extraTasks").toLowerCase()}` : t("exclusiveBonus")}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/70 flex-shrink-0" />
              </div>
            </div>
          </button>
        </div>
      )}

      <div className="mx-4 mt-5 mb-8">
        <button onClick={() => { logout(); navigate("/"); }} className="w-full flex items-center justify-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-2xl px-4 py-4 text-sm font-bold active:scale-[0.98] transition-all shadow-sm hover:bg-red-100 dark:hover:bg-red-900/30">
          <LogOut className="w-4 h-4" /> {t("signOut")}
        </button>
      </div>
    </DashboardLayout>
  );
}
