import { useState } from "react";
import { SeoContentLayout } from "../../components/seo/SeoContentLayout";
import { MessageSquare, CheckCircle2 } from "lucide-react";
import { createTicket } from "../../hooks/useApi";

export default function FeedbackPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    setLoading(true);
    try {
      await createTicket({
        id: `tkt-${Date.now()}`,
        userId: "guest-feedback",
        userName: "User Feedback",
        userEmail: "feedback@dealstocks.com",
        subject: "Platform Feedback",
        message: feedback,
        date: new Date().toLocaleDateString(),
        status: "open",
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <SeoContentLayout
      title="Submit Product Feedback"
      subtitle="Share your suggestions, feature ideas, or discovery experience with our product team."
      breadcrumbs={[{ label: "Support", href: "/support" }, { label: "Feedback" }]}
      canonicalPath="/feedback"
      metaDescription="Provide feedback and feature requests to help improve the DealX Stocks deal aggregation platform."
    >
      <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary dark:text-purple-400" />
          User Feedback Form
        </h2>

        {submitted ? (
          <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>Thank you for your feedback! We appreciate your insights.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">Your Feedback or Feature Request</label>
              <textarea
                rows={5}
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="What features or marketplace coverage would make DealX Stocks even better for you?"
                className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !feedback.trim()}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold rounded-xl transition-all shadow-sm"
            >
              {loading ? "Submitting..." : "Submit Feedback"}
            </button>
          </form>
        )}
      </div>
    </SeoContentLayout>
  );
}
