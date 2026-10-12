import { useMemo, useState } from "react";
import { Copy, Check, Share2, Gift, Users, DollarSign } from "lucide-react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LangContext";
import { useTeamMembers } from "../../hooks/useApi";

function QRCode({ value }: { value: string }) {
  const size = 180; const cell = 7;
  const n = Math.floor(size / cell);
  const rows = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      const corner = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
      const inner = (r >= 2 && r < 5 && c >= 2 && c < 5) || (r >= 2 && r < 5 && c >= n - 5 && c < n - 2) || (r >= n - 5 && r < n - 2 && c >= 2 && c < 5);
      const data = (value.charCodeAt((r * n + c) % value.length) + r * 7 + c * 11) % 3 === 0;
      return corner || inner || (!((r < 7 && (c === 0 || c === 6)) || (c < 7 && (r === 0 || r === 6))) && data);
    })
  );
  return (
    <div className="inline-flex border-4 border-white dark:border-gray-200 rounded-2xl shadow-lg overflow-hidden bg-white">
      {rows.map((row, r) => (
        <div key={r} className="flex flex-col">
          {row.map((filled, c) => (
            <div key={c} style={{ width: cell, height: cell, backgroundColor: filled ? "#1a1a2e" : "#fff" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${copied ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

export function Invite() {
  const { user } = useAuth();
  const { t } = useLang();
  const code = user?.referralCode ?? "------";
  const shareLink = `https://dealstocks.com/register?code=${code}`;

  const { data: users = [] } = useTeamMembers(user?.id, user?.referralCode);
  const teamMembers = useMemo(
    () => users.filter(item => item.referredByUserId === user?.id || item.referredBy === user?.referralCode),
    [users, user?.id, user?.referralCode],
  );
  const referralCount = teamMembers.length;
  const teamEarnings = teamMembers.reduce((sum, item) => sum + Number(item.earnings ?? 0), 0);

  const REFERRAL_STATS = [
    { icon: Users, label: "Total Referrals", value: String(referralCount), color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
    { icon: DollarSign, label: "Team Earnings", value: `$${teamEarnings.toFixed(2)}`, color: "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" },
    { icon: Gift, label: "Referral Code", value: code, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400" },
  ];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: "Join DealX Stocks", text: `Use my code ${code} to sign up and start earning!`, url: shareLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareLink).catch(() => {});
    }
  };

  return (
    <DashboardLayout showBack title="Invite Friends" backTo="/dashboard/mine">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {REFERRAL_STATS.map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* QR code panel */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-1">My Invitation Code</h2>
            <p className="text-4xl font-black text-purple-700 dark:text-purple-400 tracking-widest mb-5">{code}</p>
            <QRCode value={shareLink} />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 max-w-xs">Scan this QR code to register using your referral code</p>
          </div>

          {/* Share panel */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">Share Link</p>
                <CopyBtn text={shareLink} label="Copy" />
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3">
                <p className="text-xs font-mono text-gray-600 dark:text-gray-300 break-all leading-relaxed">{shareLink}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">Your Code</p>
                <CopyBtn text={code} label="Copy code" />
              </div>
              <p className="text-3xl font-black text-purple-700 dark:text-purple-400 tracking-widest">{code}</p>
            </div>

            <button onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-4 text-base font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-2xl transition-colors shadow-sm">
              <Share2 className="h-5 w-5" /> {t("shareLink")}
            </button>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-5">
              <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-3 flex items-center gap-2">
                <Gift className="h-4 w-4" /> How it works
              </h4>
              <ul className="space-y-2 text-xs text-purple-700 dark:text-purple-400">
                <li className="flex items-start gap-2"><span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0" />Share your unique referral code or link with friends</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0" />Friends sign up using your code</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0" />Earn bonus rewards for each successful referral</li>
                <li className="flex items-start gap-2"><span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-500 flex-shrink-0" />No limit on how many friends you can invite</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
