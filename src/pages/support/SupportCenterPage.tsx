import { useState } from "react";
import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { FaqSection } from "../../components/seo/FaqSection";
import { HOMEPAGE_FAQS } from "../../data/faq";
import { Send, Mail, AlertTriangle, MessageSquare, CheckCircle2 } from "lucide-react";
import { createTicket } from "../../hooks/useApi";

export default function SupportCenterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setLoading(true);
    try {
      await createTicket({
        id: `tkt-${Date.now()}`,
        userId: "guest",
        userName: form.name || "Guest User",
        userEmail: form.email || "guest@dealstocks.com",
        subject: form.subject || "General Inquiry",
        message: form.message,
        date: new Date().toLocaleDateString(),
        status: "open",
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <SeoContentLayout
      title="DealX Stocks Support Center"
      subtitle="Find answers, submit a ticket, report inaccurate pricing, or reach customer support."
      breadcrumbs={[{ label: "Support Center" }]}
      canonicalPath="/support"
      metaDescription="DealX Stocks support center — access our knowledge base, submit support tickets, report deal issues, or connect via Telegram."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <a
          href="https://t.me/customerservice_160"
          target="_blank"
          rel="noopener noreferrer"
          className="p-6 rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/50 dark:bg-blue-950/20 hover:border-blue-500 transition-all flex items-start gap-4 group shadow-sm"
        >
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">Telegram Support</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Connect directly with our 24/7 Telegram customer support channel @customerservice_160.
            </p>
          </div>
        </a>

        <a
          href="mailto:support@dealstocks.com"
          className="p-6 rounded-2xl border border-primary/20 dark:border-purple-800/60 bg-primary/5 dark:bg-purple-950/20 hover:border-primary transition-all flex items-start gap-4 group shadow-sm"
        >
          <div className="p-3 rounded-xl bg-primary/10 text-primary dark:text-purple-400 group-hover:scale-110 transition-transform">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-1">Email Support</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Send formal inquiries, privacy requests, or partnership questions to support@dealstocks.com.
            </p>
          </div>
        </a>
      </div>

      {/* Ticket Form */}
      <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm my-8 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary dark:text-purple-400" />
          Submit a Support Ticket
        </h2>

        {submitted ? (
          <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Thank you! Your ticket has been submitted. Our team will review your inquiry shortly.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">Your Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">Subject</label>
              <input
                type="text"
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief summary of your question"
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your question or issue in detail..."
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !form.message.trim()}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl transition-all shadow-sm"
            >
              {loading ? "Submitting..." : "Send Ticket"}
            </button>
          </form>
        )}
      </div>

      <FaqSection title="Platform FAQ" items={HOMEPAGE_FAQS} />
    </SeoContentLayout>
  );
}
