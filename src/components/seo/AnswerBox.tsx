import { HelpCircle, ShieldCheck, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export interface AnswerBoxProps {
  question: string;
  shortAnswer: string;
  detailedExplanation?: string;
  howItWorksSteps?: { title: string; description: string }[];
  whyUseful?: string[];
  limitations?: string[];
  relatedPages?: { label: string; href: string }[];
}

export function AnswerBox({
  question,
  shortAnswer,
  detailedExplanation,
  howItWorksSteps,
  whyUseful,
  limitations,
  relatedPages,
}: AnswerBoxProps) {
  return (
    <div className="my-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-slate-50 to-white p-6 shadow-sm">
      {/* Question Header */}
      <div className="flex items-start gap-3 border-b border-slate-200 pb-4 mb-4">
        <div className="p-2 rounded-xl bg-primary/10 text-primary mt-0.5 font-bold">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <span className="text-[11px] font-bold tracking-wider text-primary uppercase">
            Quick Answer & Key Summary
          </span>
          <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">{question}</h2>
        </div>
      </div>

      {/* Short Answer */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 mb-4 shadow-xs">
        <p className="text-sm text-slate-800 leading-relaxed font-semibold">
          {shortAnswer}
        </p>
      </div>

      {/* Detailed Explanation */}
      {detailedExplanation && (
        <div className="mb-4 text-xs text-slate-700 leading-relaxed">
          <p className="font-bold text-slate-900 mb-1">Detailed Explanation:</p>
          <p>{detailedExplanation}</p>
        </div>
      )}

      {/* How it works steps */}
      {howItWorksSteps && howItWorksSteps.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-800 mb-2">How It Works:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {howItWorksSteps.map((step, idx) => (
              <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
                <span className="text-[11px] font-bold text-primary block">{step.title}</span>
                <span className="text-xs text-slate-600 leading-snug">{step.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why useful */}
      {whyUseful && whyUseful.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-800 mb-2">Key User Benefits:</p>
          <ul className="space-y-1 text-xs text-slate-700">
            {whyUseful.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Limitations */}
      {limitations && limitations.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span>Important Limitations & Disclaimers</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px]">
            {limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Internal Links */}
      {relatedPages && relatedPages.length > 0 && (
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-500 font-semibold">Related pages:</span>
          {relatedPages.map((page, idx) => (
            <a
              key={idx}
              href={page.href}
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-bold transition-colors"
            >
              <span>{page.label}</span>
              <ArrowRight className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
