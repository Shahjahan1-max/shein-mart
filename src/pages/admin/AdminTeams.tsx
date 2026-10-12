import { useMemo, useState } from "react";
import { Users, Search, DollarSign, Activity } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { useUsersPage } from "../../hooks/useApi";

export default function AdminTeams() {
  const { data: users = [], loading, hasMore, loadMore, loadingMore } = useUsersPage(25);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    return users.map(owner => {
      const members = users.filter(user =>
        user.referredByUserId === owner.id ||
        (owner.referralCode && user.referredBy === owner.referralCode)
      );
      return {
        owner,
        members,
        earnings: members.reduce((sum, member) => sum + Number(member.earnings ?? 0), 0),
      };
    });
  }, [users]);

  const filtered = rows.filter(row => {
    const q = query.toLowerCase();
    return !q ||
      row.owner.id.toLowerCase().includes(q) ||
      row.owner.name?.toLowerCase().includes(q) ||
      row.owner.email?.toLowerCase().includes(q) ||
      row.owner.referralCode?.toLowerCase().includes(q);
  });

  const totalMembers = rows.reduce((sum, row) => sum + row.members.length, 0);
  const totalEarnings = rows.reduce((sum, row) => sum + row.earnings, 0);

  return (
    <AdminLayout title="Teams">
      <div className="p-4 md:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <Users className="w-5 h-5 text-purple-500 mb-2" />
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{users.length}</p>
            <p className="text-xs text-slate-600 dark:text-gray-400">Total users</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <Activity className="w-5 h-5 text-blue-500 mb-2" />
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{totalMembers}</p>
            <p className="text-xs text-slate-600 dark:text-gray-400">Referral links</p>
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
            <DollarSign className="w-5 h-5 text-emerald-500 mb-2" />
            <p className="text-2xl font-extrabold text-gray-900 dark:text-white">${totalEarnings.toFixed(2)}</p>
            <p className="text-xs text-slate-600 dark:text-gray-400">Team earnings</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search user, email, code..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-slate-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
            <span className="col-span-4">User</span>
            <span className="col-span-2">Code</span>
            <span className="col-span-2 text-center">Members</span>
            <span className="col-span-2 text-right">Earnings</span>
            <span className="col-span-2">Latest Members</span>
          </div>
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-600 dark:text-gray-400">Loading teams...</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-600 dark:text-gray-400">No teams found.</div>
          ) : (
            filtered.map(row => (
              <div key={row.owner.id} className="grid grid-cols-12 gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm">
                <div className="col-span-4 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{row.owner.name}</p>
                  <p className="text-xs text-slate-600 dark:text-gray-400 truncate">{row.owner.email}</p>
                </div>
                <div className="col-span-2 text-gray-700 dark:text-gray-300 font-mono">{row.owner.referralCode || "-"}</div>
                <div className="col-span-2 text-center text-gray-900 dark:text-white font-bold">{row.members.length}</div>
                <div className="col-span-2 text-right text-emerald-500 font-bold">${row.earnings.toFixed(2)}</div>
                <div className="col-span-2 text-xs text-slate-600 dark:text-gray-400 truncate">
                  {row.members.slice(0, 3).map(member => member.name).join(", ") || "-"}
                </div>
              </div>
            ))
          )}
        </div>
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-slate-900 dark:text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
