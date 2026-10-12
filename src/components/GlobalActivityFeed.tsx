import { useEffect, useRef } from "react";

interface FeedItem {
  id: number;
  type: "deposit" | "withdrawal" | "earning" | "task";
  name: string;
  amount: number;
  detail: string;
  timeAgo: string;
  region: string;
  flag: string;
}

const REGION_FLAG_SRC: Record<string, string> = {
  Dubai: "/flags/ar.svg",
  Saudi: "/flags/ar.svg",
  India: "/flags/hi.svg",
  Pakistan: "/flags/ur.svg",
  USA: "/flags/en.svg",
  UK: "/flags/en.svg",
  Germany: "/flags/de.svg",
  Italy: "/flags/it.svg",
  France: "/flags/fr.svg",
  Spain: "/flags/es.svg",
};

function maskName(full: string): string {
  const parts = full.split(" ");
  const masked = parts.map(part => {
    if (part.length <= 2) return part;
    const keep = Math.ceil(part.length / 3);
    return part.slice(0, keep) + "*".repeat(part.length - keep * 2 > 0 ? part.length - keep * 2 : 1) + part.slice(-1);
  });
  return masked.join(" ");
}

const RAW_ITEMS: Omit<FeedItem, "id">[] = [
  { type: "deposit",    name: maskName("Mohammed Al Rashid"),  amount: 500,  detail: "Top-up via USDT",       timeAgo: "2m ago",  region: "Dubai",    flag: "🇦🇪" },
  { type: "earning",    name: maskName("Priya Sharma"),        amount: 12.5, detail: "Ad task commission",    timeAgo: "3m ago",  region: "India",    flag: "🇮🇳" },
  { type: "task",       name: maskName("Ahmed Hassan"),        amount: 8.4,  detail: "Completed 30 ads",      timeAgo: "4m ago",  region: "Pakistan", flag: "🇵🇰" },
  { type: "withdrawal", name: maskName("Emily Johnson"),       amount: 200,  detail: "Withdrawal to bank",    timeAgo: "5m ago",  region: "USA",      flag: "🇺🇸" },
  { type: "deposit",    name: maskName("Abdullah Al Saud"),    amount: 1000, detail: "Top-up via crypto",     timeAgo: "6m ago",  region: "Saudi",    flag: "🇸🇦" },
  { type: "earning",    name: maskName("Rajesh Kumar"),        amount: 18.2, detail: "Platform task reward",  timeAgo: "7m ago",  region: "India",    flag: "🇮🇳" },
  { type: "task",       name: maskName("Fatima Malik"),        amount: 9.6,  detail: "Completed 30 ads",      timeAgo: "8m ago",  region: "Pakistan", flag: "🇵🇰" },
  { type: "deposit",    name: maskName("James Williams"),      amount: 300,  detail: "Top-up via USDT",       timeAgo: "9m ago",  region: "UK",       flag: "🇬🇧" },
  { type: "withdrawal", name: maskName("Khalid Al Maktoum"),   amount: 750,  detail: "Withdrawal processed",  timeAgo: "10m ago", region: "Dubai",    flag: "🇦🇪" },
  { type: "earning",    name: maskName("Hans Mueller"),        amount: 22.8, detail: "Ad task commission",    timeAgo: "11m ago", region: "Germany",  flag: "🇩🇪" },
  { type: "task",       name: maskName("Vikram Singh"),        amount: 11.0, detail: "Completed 25 ads",      timeAgo: "12m ago", region: "India",    flag: "🇮🇳" },
  { type: "deposit",    name: maskName("Omar Al Farsi"),       amount: 600,  detail: "Top-up via USDT",       timeAgo: "13m ago", region: "Saudi",    flag: "🇸🇦" },
  { type: "earning",    name: maskName("Oliver Smith"),        amount: 14.7, detail: "Platform task reward",  timeAgo: "14m ago", region: "UK",       flag: "🇬🇧" },
  { type: "withdrawal", name: maskName("Ayesha Siddiqui"),     amount: 150,  detail: "Withdrawal to wallet",  timeAgo: "15m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "deposit",    name: maskName("Marco Rossi"),         amount: 450,  detail: "Top-up via bank",       timeAgo: "16m ago", region: "Italy",    flag: "🇮🇹" },
  { type: "task",       name: maskName("Hassan Raza"),         amount: 7.8,  detail: "Completed 20 ads",      timeAgo: "17m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "earning",    name: maskName("John Anderson"),       amount: 16.3, detail: "Ad task commission",    timeAgo: "18m ago", region: "USA",      flag: "🇺🇸" },
  { type: "deposit",    name: maskName("Nadia Rahman"),        amount: 200,  detail: "Top-up via USDT",       timeAgo: "19m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "withdrawal", name: maskName("Pierre Dubois"),       amount: 500,  detail: "Withdrawal processed",  timeAgo: "20m ago", region: "France",   flag: "🇫🇷" },
  { type: "earning",    name: maskName("Amna Butt"),           amount: 9.2,  detail: "Platform task reward",  timeAgo: "21m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "task",       name: maskName("Sarah Thompson"),      amount: 13.5, detail: "Completed 30 ads",      timeAgo: "22m ago", region: "USA",      flag: "🇺🇸" },
  { type: "deposit",    name: maskName("Yusuf Al Hamdan"),     amount: 800,  detail: "Top-up via crypto",     timeAgo: "23m ago", region: "Saudi",    flag: "🇸🇦" },
  { type: "earning",    name: maskName("Anjali Patel"),        amount: 20.1, detail: "Ad task commission",    timeAgo: "24m ago", region: "India",    flag: "🇮🇳" },
  { type: "withdrawal", name: maskName("Liam Brown"),          amount: 350,  detail: "Withdrawal to bank",    timeAgo: "25m ago", region: "UK",       flag: "🇬🇧" },
  { type: "deposit",    name: maskName("Usman Ghani"),         amount: 250,  detail: "Top-up via USDT",       timeAgo: "26m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "task",       name: maskName("Riya Kapoor"),         amount: 10.8, detail: "Completed 25 ads",      timeAgo: "27m ago", region: "India",    flag: "🇮🇳" },
  { type: "earning",    name: maskName("Carlos Martinez"),     amount: 17.4, detail: "Platform task reward",  timeAgo: "28m ago", region: "Spain",    flag: "🇪🇸" },
  { type: "deposit",    name: maskName("Sana Ijaz"),           amount: 300,  detail: "Top-up via bank",       timeAgo: "29m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "withdrawal", name: maskName("Tariq Al Mansouri"),   amount: 900,  detail: "Withdrawal processed",  timeAgo: "30m ago", region: "Dubai",    flag: "🇦🇪" },
  { type: "earning",    name: maskName("Emma Wilson"),         amount: 11.6, detail: "Ad task commission",    timeAgo: "31m ago", region: "UK",       flag: "🇬🇧" },
  { type: "task",       name: maskName("Bilal Chaudhry"),      amount: 8.9,  detail: "Completed 30 ads",      timeAgo: "32m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "deposit",    name: maskName("Neha Gupta"),          amount: 400,  detail: "Top-up via USDT",       timeAgo: "33m ago", region: "India",    flag: "🇮🇳" },
  { type: "earning",    name: maskName("Faisal Al Zahrani"),   amount: 25.3, detail: "Platform task reward",  timeAgo: "34m ago", region: "Saudi",    flag: "🇸🇦" },
  { type: "withdrawal", name: maskName("Sophie Müller"),       amount: 275,  detail: "Withdrawal to wallet",  timeAgo: "35m ago", region: "Germany",  flag: "🇩🇪" },
  { type: "deposit",    name: maskName("Imran Khan"),          amount: 150,  detail: "Top-up via crypto",     timeAgo: "36m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "task",       name: maskName("Deepak Nair"),         amount: 15.2, detail: "Completed 30 ads",      timeAgo: "37m ago", region: "India",    flag: "🇮🇳" },
  { type: "earning",    name: maskName("Noah Davis"),          amount: 19.7, detail: "Ad task commission",    timeAgo: "38m ago", region: "USA",      flag: "🇺🇸" },
  { type: "deposit",    name: maskName("Mariam Al Qasim"),     amount: 700,  detail: "Top-up via USDT",       timeAgo: "39m ago", region: "Dubai",    flag: "🇦🇪" },
  { type: "withdrawal", name: maskName("Thomas Leclerc"),      amount: 420,  detail: "Withdrawal to bank",    timeAgo: "40m ago", region: "France",   flag: "🇫🇷" },
  { type: "task",       name: maskName("Zainab Hussain"),      amount: 6.5,  detail: "Completed 20 ads",      timeAgo: "41m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "earning",    name: maskName("Sunita Verma"),        amount: 13.9, detail: "Platform task reward",  timeAgo: "42m ago", region: "India",    flag: "🇮🇳" },
  { type: "deposit",    name: maskName("George Clark"),        amount: 550,  detail: "Top-up via bank",       timeAgo: "43m ago", region: "USA",      flag: "🇺🇸" },
  { type: "withdrawal", name: maskName("Khalid Bin Nasser"),   amount: 1200, detail: "Withdrawal processed",  timeAgo: "44m ago", region: "Saudi",    flag: "🇸🇦" },
  { type: "earning",    name: maskName("Ali Hassan"),          amount: 8.1,  detail: "Ad task commission",    timeAgo: "45m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "task",       name: maskName("Sneha Reddy"),         amount: 12.3, detail: "Completed 25 ads",      timeAgo: "46m ago", region: "India",    flag: "🇮🇳" },
  { type: "deposit",    name: maskName("Lukas Schmidt"),       amount: 350,  detail: "Top-up via USDT",       timeAgo: "47m ago", region: "Germany",  flag: "🇩🇪" },
  { type: "earning",    name: maskName("Maryam Noor"),         amount: 10.4, detail: "Platform task reward",  timeAgo: "48m ago", region: "Pakistan", flag: "🇵🇰" },
  { type: "withdrawal", name: maskName("Jack Thompson"),       amount: 180,  detail: "Withdrawal to wallet",  timeAgo: "49m ago", region: "UK",       flag: "🇬🇧" },
  { type: "deposit",    name: maskName("Ravi Shankar"),        amount: 600,  detail: "Top-up via crypto",     timeAgo: "50m ago", region: "India",    flag: "🇮🇳" },
  { type: "task",       name: maskName("Samira Al Jaber"),     amount: 14.0, detail: "Completed 30 ads",      timeAgo: "51m ago", region: "Dubai",    flag: "🇦🇪" },
];

const FEED_ITEMS: FeedItem[] = RAW_ITEMS.map((item, i) => ({ ...item, id: i + 1 }));

const TYPE_CONFIG = {
  deposit:    { label: "Deposited",  color: "text-green-400",  bg: "bg-green-900/30",  border: "border-green-800/50",  dot: "bg-green-400"  },
  withdrawal: { label: "Withdrew",   color: "text-red-400",    bg: "bg-red-900/30",    border: "border-red-800/50",    dot: "bg-red-400"    },
  earning:    { label: "Earned",     color: "text-purple-400", bg: "bg-purple-900/30", border: "border-purple-800/50", dot: "bg-purple-400" },
  task:       { label: "Completed",  color: "text-blue-400",   bg: "bg-blue-900/30",   border: "border-blue-800/50",   dot: "bg-blue-400"   },
};

function FeedRow({ item }: { item: FeedItem }) {
  const cfg = TYPE_CONFIG[item.type];
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${cfg.bg} ${cfg.border} mx-1 mb-2 shrink-0`}>
      <img src={REGION_FLAG_SRC[item.region] ?? "/flags/en.svg"} alt="" aria-hidden="true" className="h-3.5 w-5 rounded-[3px] object-cover shadow-sm ring-1 ring-white/10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-semibold text-xs truncate">{item.name}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border} shrink-0`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-gray-500 text-[10px] truncate">{item.detail} · {item.timeAgo}</p>
      </div>
      <span className={`font-extrabold text-xs shrink-0 ${cfg.color}`}>
        {item.type === "withdrawal" ? "-" : "+"}${item.amount.toFixed(2)}
      </span>
    </div>
  );
}

export function GlobalActivityFeed({ maxHeight = 420 }: { maxHeight?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;

    const SPEED = 0.6;

    function step() {
      if (!inner) return;
      offsetRef.current += SPEED;
      const halfH = inner.scrollHeight / 2;
      if (offsetRef.current >= halfH) {
        offsetRef.current = 0;
      }
      inner.style.transform = `translateY(-${offsetRef.current}px)`;
      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const doubled = [...FEED_ITEMS, ...FEED_ITEMS];

  return (
    <div
      ref={containerRef}
      className="overflow-hidden relative"
      style={{ maxHeight }}
    >
      <div
        ref={innerRef}
        className="flex flex-col will-change-transform"
        style={{ paddingTop: 4 }}
      >
        {doubled.map((item, idx) => (
          <FeedRow key={`${item.id}-${idx}`} item={item} />
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-950 to-transparent" />
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-950 to-transparent" />
    </div>
  );
}
