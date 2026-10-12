import React, { useState } from 'react';
import { Send, Mail, MapPin, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { addFirebaseDoc } from '../../lib/apiClient';
import type { LeadCapture } from '../../lib/leads';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ContactQuote() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [marketplace, setMarketplace] = useState('Amazon');
  const [storeUrl, setStoreUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setErrorMessage('Please enter a valid work email address.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      await addFirebaseDoc<LeadCapture>('leadCaptures', {
        name: name.trim() || 'Anonymous Lead',
        email: cleanEmail,
        marketplace,
        storeUrl: storeUrl.trim() || undefined,
        source: 'marketplace-audit-quote',
        status: 'new',
        createdAt: new Date().toISOString(),
      });

      setStatus('success');
      setName('');
      setEmail('');
      setStoreUrl('');

      // Broadcast event so Super Admin Leads Console updates in real-time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ds:data-changed', { detail: { collection: 'leadCaptures' } }));
      }
    } catch (err: unknown) {
      console.error('Failed to submit quote lead:', err);
      setErrorMessage('Failed to submit request. Please try again or email us directly.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col font-sans transition-colors duration-300">
      <Header />
      <main className="flex-grow pt-24 pb-16">
        <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-16">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
              Get Your Free <span className="bg-gradient-to-r from-primary to-indigo-600 dark:from-purple-400 dark:to-indigo-500 bg-clip-text text-transparent">Marketplace Audit</span>
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Speak with our senior marketplace strategists to uncover hidden revenue opportunities for your listings.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="p-8 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Request Audit & Quote</h2>
              </div>

              {status === 'success' ? (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Request Received!</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Thank you! Our growth strategists have received your marketplace audit request and will reach out within 24 hours.
                  </p>
                  <button
                    onClick={() => setStatus('idle')}
                    className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {status === 'error' && errorMessage && (
                    <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium">
                      {errorMessage}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">Work Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@company.com"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">Target Marketplace</label>
                    <select
                      value={marketplace}
                      onChange={(e) => setMarketplace(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    >
                      <option value="Amazon">Amazon</option>
                      <option value="Alibaba">Alibaba</option>
                      <option value="AliExpress">AliExpress</option>
                      <option value="eBay">eBay</option>
                      <option value="Multiple Marketplaces">Multiple Marketplaces</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">Store / Website URL</label>
                    <input
                      type="url"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
                  >
                    {status === 'submitting' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Submitting Request...
                      </>
                    ) : (
                      <>
                        Submit Request <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="space-y-8 flex flex-col justify-center">
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                <Mail className="w-6 h-6 text-primary dark:text-purple-400" />
                <div>
                  <div className="text-xs text-gray-500">Email Us</div>
                  <div className="font-bold text-gray-900 dark:text-white">support@dealxstocks.com</div>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                <Send className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                <div>
                  <div className="text-xs text-gray-500">Telegram Support</div>
                  <div className="font-bold text-gray-900 dark:text-white">@DealXStocks_Support</div>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                <MapPin className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                <div>
                  <div className="text-xs text-gray-500">Global Headquarters</div>
                  <div className="font-bold text-gray-900 dark:text-white">International Growth Center</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
