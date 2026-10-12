import { useState } from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import { PageHeader, SectionCard, StatusBadge, statusToneFor, PermissionGate } from "../../components/super-admin/SuperAdminUi";
import { FileText, Plus, Eye } from "lucide-react";

const PAGES = [
  { id: "pg-1", title: "Home — SEO & eCommerce Growth", slug: "/", status: "published", updated: "2026-08-01", seo: { title: true, desc: true } },
  { id: "pg-2", title: "Services Overview", slug: "/services", status: "published", updated: "2026-07-30", seo: { title: true, desc: true } },
  { id: "pg-3", title: "International SEO", slug: "/services/international-seo", status: "published", updated: "2026-07-29", seo: { title: true, desc: true } },
  { id: "pg-4", title: "Marketplace Intelligence", slug: "/services/marketplace-intelligence", status: "draft", updated: "2026-07-28", seo: { title: true, desc: false } },
  { id: "pg-5", title: "Case Studies", slug: "/case-studies", status: "draft", updated: "2026-07-25", seo: { title: false, desc: false } },
  { id: "pg-6", title: "Contact", slug: "/contact", status: "published", updated: "2026-07-20", seo: { title: true, desc: true } },
];

export default function SuperAdminCms() {
  const [pages] = useState(PAGES);

  return (
    <SuperAdminLayout title="CMS & Pages">
      <PageHeader
        title="CMS & Pages"
        description="Manage public pages, content, and SEO metadata for the agency website."
        icon={<FileText className="w-5 h-5" />}
        actions={
          <PermissionGate permission="cms.create">
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" /> New Page
            </button>
          </PermissionGate>
        }
      />

      <SectionCard title="Pages" description={`${pages.length} pages`} icon={<FileText className="w-4 h-4" />}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="py-2.5 pr-4 font-semibold">Page</th>
                <th className="py-2.5 pr-4 font-semibold">Slug</th>
                <th className="py-2.5 pr-4 font-semibold">SEO Ready</th>
                <th className="py-2.5 pr-4 font-semibold">Updated</th>
                <th className="py-2.5 pr-4 font-semibold">Status</th>
                <th className="py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {pages.map(p => (
                <tr key={p.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-500 dark:text-gray-400">{p.slug}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-1">
                      {p.seo.title ? <StatusBadge status="meta" tone="green" /> : <StatusBadge status="meta" tone="gray" />}
                      {p.seo.desc ? <StatusBadge status="desc" tone="green" /> : <StatusBadge status="desc" tone="gray" />}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{p.updated}</td>
                  <td className="py-3 pr-4"><StatusBadge status={p.status} tone={statusToneFor(p.status)} /></td>
                  <td className="py-3 text-right">
                    <PermissionGate permission="cms.edit">
                      <button className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                        <Eye className="w-3.5 h-3.5" /> Edit
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </SuperAdminLayout>
  );
}
