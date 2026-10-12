import { useState } from "react";
import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createTicket } from "../../hooks/useApi";

export default function ReportIssuePage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ productUrl: "", issueType: "Expired Deal", details: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.details.trim()) return;
    setLoading(true);
    try {
      await createTicket({
        id: `tkt-${Date.now()}`,
        userId: "guest-reporter",
        userName: "Community Reporter",
        userEmail: "report@dealstocks.com",
        subject: `Issue Report: ${form.issueType}`,
        message: `Target URL: ${form.productUrl}\nType: ${form.issueType}\nDetails: ${form.details}`,
        date: new Date().toLocaleDateString(),
        status: "open",
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <SeoContentLayout
      title="Report a Pricing or Listing Issue"
      subtitle="Help us maintain 100% catalog accuracy by reporting expired deals or broken affiliate links."
      breadcrumbs={[{ label: "Support", href: "/support" }, { label: "Report Issue" }]}
      canonicalPath="/report-issue"
      metaDescription="Report stale product pricing, broken affiliate links, or inaccurate merchant information to the DealX Stocks catalog audit team."
    >
      <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-amber-700 font-bold text-base">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span>Catalog Accuracy Reporting Form</span>
        </div>

        {submitted ? (
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>Thank you for reporting! Our audit team will review the listing and refresh catalog data.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Issue Type</label>
              <select
                value={form.issueType}
                onChange={e => setForm({ ...form, issueType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-colors"
              >
                <option value="Expired Deal">Expired Deal / Stock Sold Out</option>
                <option value="Price Discrepancy">Price Discrepancy (Marketplace price differs)</option>
                <option value="Broken Outbound Link">Broken Outbound Affiliate Link</option>
                <option value="Incorrect Category">Incorrect Category Classification</option>
                <option value="Other">Other Listing Issue</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Deal or Page URL (Optional)</label>
              <input
                type="text"
                value={form.productUrl}
                onChange={e => setForm({ ...form, productUrl: e.target.value })}
                placeholder="https://dealxstocks.com/products/..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Issue Details</label>
              <textarea
                rows={4}
                value={form.details}
                onChange={e => setForm({ ...form, details: e.target.value })}
                placeholder="Describe what is incorrect or what price you observed on the destination merchant page..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !form.details.trim()}
              className="px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-50 text-accent-foreground font-bold rounded-xl transition-all shadow-sm"
            >
              {loading ? "Submitting Report..." : "Submit Report"}
            </button>
          </form>
        )}
      </div>
    </SeoContentLayout>
  );
}
