import React from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import AdminLandingPage from "../admin/AdminLandingPage";

export default function SuperAdminLandingPage() {
  return (
    <SuperAdminLayout title="Landing Page Management">
      <div className="space-y-4">
        {/* Page Header */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Landing Page Management & Live CMS
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Super Admin governance portal for editing website hero content, navigation items, marketplace cards, support sections, footer links, and reviews in real time.
          </p>
        </div>

        {/* Embedded Landing Page Editor */}
        <AdminLandingPage isEmbedded={true} />
      </div>
    </SuperAdminLayout>
  );
}
