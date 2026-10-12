import React from "react";
import SuperAdminLayout from "./SuperAdminLayout";
import AdminLeads from "../admin/AdminLeads";

export default function SuperAdminLeads() {
  return (
    <SuperAdminLayout title="Lead Management Console">
      <div className="space-y-4">
        {/* Page Header */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Lead Management Console
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Super Admin portal for inspecting, searching, exporting, and managing deal hunter playbook signups & leads in real time.
          </p>
        </div>

        {/* Embedded Leads Console */}
        <AdminLeads isEmbedded={true} />
      </div>
    </SuperAdminLayout>
  );
}
