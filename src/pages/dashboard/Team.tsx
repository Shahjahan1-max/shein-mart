import { useMemo, useState } from "react";
import { type LucideIcon, Copy, Check, Users, TrendingUp, DollarSign, Activity, Gift, Share2 } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import type { TeamData } from "../../data/teamData";
import { useTeamMembers } from "../../hooks/useApi";

function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-slate-900 dark:text-white" />
      </div>
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

const EMPTY_TEAM: TeamData = { id: "", name: "My Team", code: "—", members: [], totalMembers: 0, activeMembers: 0, teamEarnings: 0, todayEarnings: 0, weeklyEarnings: 0, packageParticipation: 0 };

export function Team() {
  const { user } = useAuth();
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const { data: users = [] } = useTeamMembers(user?.id, user?.referralCode);
  const team = useMemo<TeamData>(() => {
    if (!user) return EMPTY_TEAM;
    const members = users
      .filter(item => item.referredByUserId === user.id || item.referredBy === user.referralCode)
      .map(item => ({
        id: item.id,
        name: item.name,
        joinedAt: item.createdAt,
        earnings: item.earnings ?? 0,
        status: (item.status === "suspended" ? "inactive" : "active") as "active" | "inactive",
      }));
    return {
      ...EMPTY_TEAM,
      id: user.id,
      code: user.referralCode,
      members,
      totalMembers: members.length,
      activeMembers: members.filter(member => member.status === "active").length,
      teamEarnings: members.reduce((sum, member) => sum + member.earnings, 0),
    };
  }, [user, users]);

  const teamCode = user?.referralCode ?? "—";

  function copyCode() {
    navigator.clipboard.writeText(teamCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DashboardLayout showBack title={t("myTeam")} backTo="/dashboard/mine">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
        {/* Top row: Team Code + Invite side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Team Code Card */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-5 text-white">
            <p className="text-sm text-white/70 font-medium mb-1">{t("teamCode")}</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-extrabold tracking-wider">{teamCode}</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-xl text-sm font-semibold"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t("copied") : t("copyCode")}
              </button>
            </div>
            <p className="text-xs text-white/60 mt-3">{t("shareYourCode")}</p>
          </div>

          {/* Invite Friends */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Gift className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t("inviteFriends")}</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">{t("shareYourCode")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 mb-3">
              <span className="flex-1 text-sm font-bold text-purple-600 dark:text-purple-400 tracking-widest">{teamCode}</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t("copied") : t("copyCode")}
              </button>
            </div>
            <button
              onClick={() => {
                const msg = `Join me on DealX Stocks! Use my referral code: ${teamCode}`;
                if (navigator.share) {
                  navigator.share({ title: "DealX Stocks Invite", text: msg }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(msg).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              {t("shareInviteLink")}
            </button>
          </div>
        </div>

        {/* Stats Grid — 4 columns on desktop, 2 on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users}      label={t("teamMembers")}   value={String(team.totalMembers)}            color="bg-blue-500"    />
          <StatCard icon={Activity}   label={t("activeMembers")} value={String(team.activeMembers)}           color="bg-green-500"   />
          <StatCard icon={DollarSign} label={t("teamEarnings")}  value={`$${team.teamEarnings.toFixed(2)}`}  color="bg-purple-600"  />
          <StatCard icon={TrendingUp} label={t("todayEarnings")} value={`$${team.todayEarnings.toFixed(2)}`} color="bg-orange-500"  />
        </div>

        {/* Bottom row: Members list + Analytics side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Team Members list — takes 2/3 on desktop */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t("teamMembers")}</h3>
              <span className="text-xs text-slate-500 dark:text-gray-400">{team.totalMembers} {t("totalLabel")}</span>
            </div>
            {team.members.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <p className="text-slate-500 dark:text-gray-400 text-sm">{t("noMembersYet")}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {t("shareYourCode")} <span className="font-semibold text-purple-500">{teamCode}</span>
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {team.members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{member.name}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">{t("joined")} {member.joinedAt}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 dark:text-gray-400">${member.earnings.toFixed(2)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        member.status === "active"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                      }`}>
                        {member.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team Analytics — takes 1/3 on desktop */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-3 self-start">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">{t("teamAnalytics")}</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: t("weeklyEarnings"),       value: `$${team.weeklyEarnings.toFixed(2)}`    },
                { label: t("packageParticipation"), value: `${team.packageParticipation}%`          },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <p className="text-base font-bold text-gray-900 dark:text-white">{item.value}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 text-center">
              {t("adminControlledLabel")}
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
