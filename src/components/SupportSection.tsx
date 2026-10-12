import { MessageCircle, Mail, HelpCircle, Clock, Shield } from "lucide-react";
import supportIcon from "@assets/Customer_Support_Icon.webp";
import { useLandingPageSettings } from "../hooks/useLandingPageSettings";

const CARD_COLORS = [
  { color: "bg-blue-500",   hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/20",     borderColor: "border-blue-200 dark:border-blue-800",     textColor: "text-blue-700 dark:text-blue-400",     icon: MessageCircle },
  { color: "bg-purple-500", hoverBg: "hover:bg-purple-50 dark:hover:bg-purple-900/20", borderColor: "border-purple-200 dark:border-purple-800", textColor: "text-purple-700 dark:text-purple-400", icon: Mail },
  { color: "bg-green-500",  hoverBg: "hover:bg-green-50 dark:hover:bg-green-900/20",   borderColor: "border-green-200 dark:border-green-800",   textColor: "text-green-700 dark:text-green-400",   icon: HelpCircle },
  { color: "bg-amber-500",  hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",   borderColor: "border-amber-200 dark:border-amber-800",   textColor: "text-amber-700 dark:text-amber-400",   icon: MessageCircle },
];

export function SupportSection() {
  const { data: landingPage } = useLandingPageSettings();

  const cfg = landingPage.support;
  if (!cfg.active) return null;

  const activeCards = cfg.cards.filter(c => c.active);

  return (
    <section id="support" className="py-10 sm:py-16 px-3 sm:px-4 max-w-7xl mx-auto">
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 p-5 sm:p-8 md:p-12">
          <div className="flex-shrink-0">
            <img src={supportIcon} alt="Customer Support" className="w-28 h-28 sm:w-40 sm:h-40 object-contain drop-shadow-2xl" />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
              <div className="h-1.5 w-8 bg-yellow-400 rounded-full" />
              <span className="text-yellow-400 text-sm font-semibold uppercase tracking-wider">Support</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">{cfg.title}</h2>
            {cfg.description && (
              <p className="text-purple-200 mb-2 leading-relaxed">{cfg.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 justify-center md:justify-start text-sm text-purple-300 mt-4">
              <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-green-400" /><span>24/7 Available</span></div>
              <div className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-blue-400" /><span>Secure & Private</span></div>
            </div>
          </div>
        </div>

        {activeCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 px-5 sm:px-8 md:px-12 pb-8 sm:pb-10">
            {activeCards.map((card, i) => {
              const style = CARD_COLORS[i % CARD_COLORS.length];
              const Icon = style.icon;
              return (
                <a
                  key={card.id}
                  href={card.href}
                  target={card.href.startsWith("http") ? "_blank" : undefined}
                  rel={card.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 hover:bg-white/20 transition-all group flex flex-col items-center text-center"
                >
                  <div className={`${style.color} p-3 rounded-xl mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white mb-1 text-sm">{card.label}</h3>
                  {card.desc && <p className="text-purple-300 text-xs mb-3 leading-relaxed">{card.desc}</p>}
                  {card.cta && <span className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors underline underline-offset-2">{card.cta} →</span>}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
