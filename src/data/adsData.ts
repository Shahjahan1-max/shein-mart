/**
 * adsData.ts — Real per-ad data sourced from verified DOCX files.
 * Each ad within a code has its own amount and commission rate.
 * URL patterns vary by code series:
 *   201, 301-304, 404 → /{code}/{n}.webp
 *   401-403, 502-504   → /{code}/ads{n}.webp
 */

export interface AdEntry {
  adNo: number;
  title: string;
  contentUrl: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  afterCommission: number;
  /** Admin-set deposit restriction for this specific ad */
  depositRequired?: boolean;
  requiredDeposit?: number;
}

export interface AdGroup {
  code: string;
  urlPath: string;
  label: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  afterCommission: number;
  tier: string;
  ads: AdEntry[];
  isActive: boolean;
}

/** [amount, commissionPct] per ad (25 entries each) */
type RawRow = [number, number];

function makeUrl(code: string, n: number): string {
  const adsPrefix = ["401","402","403","502","503","504"].includes(code);
  return adsPrefix
    ? `https://aczmall.netlify.app/${code}/ads${n}.webp`
    : `https://aczmall.netlify.app/${code}/${n}.webp`;
}

function buildAdsFromRaw(code: string, rows: RawRow[]): AdEntry[] {
  return rows.map(([amount, commPct], i) => {
    const adNo = i + 1;
    const commissionRate = commPct / 100;
    const commissionAmount = parseFloat((amount * commissionRate).toFixed(2));
    const afterCommission = commissionAmount;
    return {
      adNo,
      title: `Ad ${String(adNo).padStart(2, "0")}`,
      contentUrl: makeUrl(code, adNo),
      amount,
      commissionRate,
      commissionAmount,
      afterCommission,
    };
  });
}

function buildGroup(
  code: string,
  tier: string,
  rows: RawRow[],
): AdGroup {
  const ads = buildAdsFromRaw(code, rows);
  const totalAmount = parseFloat(ads.reduce((s, a) => s + a.amount, 0).toFixed(2));
  const totalComm = parseFloat(ads.reduce((s, a) => s + a.commissionAmount, 0).toFixed(2));
  const avgRate = totalAmount > 0 ? totalComm / totalAmount : 0.04;
  return {
    code,
    urlPath: code,
    label: `Code ${code}`,
    amount: totalAmount,
    commissionRate: avgRate,
    commissionAmount: totalComm,
    afterCommission: totalComm,
    tier,
    ads,
    isActive: true,
  };
}

/* ─── Verified DOCX data ────────────────────────────────────────── */

const RAW_201: RawRow[] = [
  [14,4],[11,4],[15,4],[12,4],[9,4],[12,4],[11,4],[18,4],[19,4],[18,4],
  [17,4],[13,4],[16,4],[15,4],[40.72,15],[17,4],[17,4],[10,4],[12,4],[8,4],
  [13,4],[13,4],[17,4],[7,4],[11,4],
];

const RAW_301: RawRow[] = [
  [5,4],[11,4],[15,4],[21,4],[26,4],[10,4],[30,4],[33,4],[35,4],[37,4],
  [38,4],[40,4],[57,20],[17,4],[10,4],[12,4],[8,4],[13,4],[17,4],[7,4],
  [9,4],[11,4],[15,4],[12,4],[13,4],
];

const RAW_302: RawRow[] = [
  [8,4],[12,4],[9,4],[13,4],[7,4],[12,4],[15,4],[57,20],[18,4],[15,4],
  [32,4],[42,4],[31,4],[28,4],[127,20],[85,4],[50,4],[42,4],[78,4],[45,4],
  [75,4],[274,20],[105,4],[80,4],[95,4],
];

const RAW_303: RawRow[] = [
  [16,4],[13,4],[8,4],[12,4],[10,4],[11,4],[65,20],[17,4],[14,4],[13,4],
  [19,4],[22,4],[18,4],[145,20],[80,4],[70,4],[60,4],[45,4],[25,4],[22,4],
  [303,20],[15,4],[23,4],[18,4],[19,4],
];

const RAW_304: RawRow[] = [
  [21,4],[24,4],[25,4],[27,4],[22,4],[26,4],[278,20],[150,4],[210,4],[240,4],
  [280,4],[265,4],[831.8,20],[520,8],[550,8],[650,8],[785,8],[810,8],[2983.2,20],[2800,12],
  [3274,12],[3678,12],[3212,12],[10715.65,20],[27145,20],
];

const RAW_401: RawRow[] = [
  [17,4],[19,4],[14,4],[22,4],[80,9],[16,4],[25,4],[38,4],[32,4],[30,4],
  [35,4],[33,4],[69,20],[15,4],[12,4],[10,4],[13,4],[16,4],[11,4],[10,4],
  [13,4],[12,4],[10,4],[11,4],[10,4],
];

const RAW_402: RawRow[] = [
  [8,4],[12,4],[9,4],[13,4],[7,4],[12,4],[15,4],[67,20],[18,4],[15,4],
  [32,4],[42,4],[31,4],[28,4],[144,20],[85,4],[50,4],[42,4],[78,4],[45,4],
  [75,4],[304,20],[105,4],[80,4],[95,4],
];

const RAW_403: RawRow[] = [
  [16,4],[13,4],[8,4],[12,4],[10,4],[11,4],[75,20],[17,4],[14,4],[13,4],
  [19,4],[22,4],[18,4],[155,20],[80,4],[70,4],[60,4],[45,4],[25,4],[22,4],
  [313,20],[15,4],[23,4],[18,4],[19,4],
];

const RAW_404: RawRow[] = [
  [21,4],[24,4],[25,4],[27,4],[22,4],[26,4],[288,20],[150,4],[210,4],[240,4],
  [280,4],[265,4],[841.8,20],[520,8],[550,8],[650,8],[785,8],[810,8],[2993.2,20],[2800,12],
  [3274,12],[3678,12],[3212,12],[10725.65,20],[27155,20],
];

const RAW_502: RawRow[] = [
  [8,4],[12,4],[9,4],[13,4],[7,4],[12,4],[15,4],[77,20],[18,4],[15,4],
  [32,4],[42,4],[31,4],[28,4],[157,20],[85,4],[50,4],[42,4],[78,4],[45,4],
  [75,4],[318,20],[105,4],[80,4],[95,4],
];

const RAW_503: RawRow[] = [
  [16,4],[13,4],[8,4],[12,4],[10,4],[11,4],[85,20],[17,4],[14,4],[13,4],
  [19,4],[22,4],[18,4],[167,20],[80,4],[70,4],[60,4],[45,4],[25,4],[22,4],
  [323,20],[15,4],[23,4],[18,4],[19,4],
];

const RAW_504: RawRow[] = [
  [21,4],[24,4],[25,4],[27,4],[22,4],[26,4],[288,20],[150,4],[210,4],[240,4],
  [280,4],[265,4],[841.8,20],[520,8],[550,8],[650,8],[785,8],[810,8],[2993.2,20],[2800,12],
  [3274,12],[3678,12],[3212,12],[10725.65,20],[27155,20],
];

/* ─── Generated data for codes not in verified DOCX ─────────────── */
/** Generate a 25-ad pattern similar to the 402/502 series but scaled */
function genMid(base: number, bonusIdx: number, bonusAmt: number): RawRow[] {
  const pool: RawRow[] = [
    [base*0.6,4],[base*0.9,4],[base*0.7,4],[base,4],[base*0.5,4],
    [base*0.9,4],[base*1.1,4],[0,20],[base*1.3,4],[base*1.1,4],
    [base*2.4,4],[base*3.2,4],[base*2.3,4],[base*2.1,4],[0,20],
    [base*6.5,4],[base*3.8,4],[base*3.2,4],[base*5.9,4],[base*3.4,4],
    [base*5.7,4],[0,20],[base*8,4],[base*6,4],[base*7.2,4],
  ];
  pool[bonusIdx - 1] = [bonusAmt, 20];
  const bonus2 = bonusIdx < 22 ? 21 : 15;
  pool[bonus2 - 1] = [bonusAmt * 1.1, 20];
  return pool;
}

function genLow(base: number): RawRow[] {
  return [
    [base*0.7,4],[base*0.55,4],[base*0.75,4],[base*0.6,4],[base*0.45,4],
    [base*0.6,4],[base*0.55,4],[base*0.9,4],[base*0.95,4],[base*0.9,4],
    [base*0.85,4],[base*0.65,4],[base*0.8,4],[base*0.75,4],[base*2,15],
    [base*0.85,4],[base*0.85,4],[base*0.5,4],[base*0.6,4],[base*0.4,4],
    [base*0.65,4],[base*0.65,4],[base*0.85,4],[base*0.35,4],[base*0.55,4],
  ];
}

/**
 * Override specific ad positions (1-based) with verified JSON data.
 * Keeps all other 25 ads intact — duplicate-safe: same slot in-place update.
 */
function patchRaw(rows: RawRow[], patches: Array<[number, number, number]>): RawRow[] {
  const result: RawRow[] = rows.map(r => [r[0], r[1]]);
  for (const [adNo, amount, commPct] of patches) {
    result[adNo - 1] = [amount, commPct];
  }
  return result;
}

const RAW_202 = genLow(15);
const RAW_203 = genLow(18);
const RAW_204 = genLow(22);

/*
 * Codes below are synced with the verified JSON source.
 * patchRaw only overrides the specific verified positions (ad_id → row index);
 * all other 25 ads remain from genMid — no duplicates created.
 *
 * Key:  [[adNo, amount, commissionPct], ...]
 *   501: ad1=[2,4%], ad13=[62,20%]
 *   601: ad1=[3,4%], ad13=[85,20%]
 *   602: ad1=[4,4%], ad8=[105,20%]
 *   603: ad1=[5,4%], ad7=[142,20%]
 *   604: ad1=[6,4%], ad7=[185,20%]
 *   701: ad1=[7,4%], ad7=[245,20%]
 *   702: ad1=[8,4%], ad7=[285,20%]
 *   703: ad1=[9,4%], ad7=[325,20%]
 *   704: ad1=[10,4%], ad7=[365,20%]
 *   801: ad1=[12,4%], ad7=[410,20%]
 *   802: ad1=[15,4%], ad7=[465,20%]
 *   803: ad1=[18,4%], ad7=[520,20%]
 *   804: ad1=[10,4%], ad7=[365,20%]
 *   901: ad1=[20,4%], ad7=[630,20%]
 *   902: ad1=[25,4%], ad7=[750,20%]
 *   903: ad1=[30,4%], ad7=[880,20%]
 *  Rank: ad1=[100,4%], ad7=[1500,20%]
 */
const RAW_501 = patchRaw(genMid(8,  8,  72),  [[1, 2, 4], [13, 62,  20]]);
const RAW_601 = patchRaw(genMid(12, 8,  95),  [[1, 3, 4], [13, 85,  20]]);
const RAW_602 = patchRaw(genMid(14, 8, 115),  [[1, 4, 4], [ 8, 105, 20]]);
const RAW_603 = patchRaw(genMid(16, 7, 130),  [[1, 5, 4], [ 7, 142, 20]]);
const RAW_604 = patchRaw(genMid(18, 7, 290),  [[1, 6, 4], [ 7, 185, 20]]);
const RAW_701 = patchRaw(genMid(18, 8, 135),  [[1, 7, 4], [ 7, 245, 20]]);
const RAW_702 = patchRaw(genMid(20, 8, 160),  [[1, 8, 4], [ 7, 285, 20]]);
const RAW_703 = patchRaw(genMid(22, 7, 180),  [[1, 9, 4], [ 7, 325, 20]]);
const RAW_704 = patchRaw(genMid(25, 7, 400),  [[1, 10, 4], [ 7, 365, 20]]);
const RAW_801 = patchRaw(genMid(25, 8, 190),  [[1, 12, 4], [ 7, 410, 20]]);
const RAW_802 = patchRaw(genMid(28, 8, 220),  [[1, 15, 4], [ 7, 465, 20]]);
const RAW_803 = patchRaw(genMid(32, 7, 260),  [[1, 18, 4], [ 7, 520, 20]]);
const RAW_804 = patchRaw(genMid(36, 7, 520),  [[1, 10, 4], [ 7, 365, 20]]);
const RAW_901 = patchRaw(genMid(35, 8, 260),  [[1, 20, 4], [ 7, 630, 20]]);
const RAW_902 = patchRaw(genMid(40, 8, 310),  [[1, 25, 4], [ 7, 750, 20]]);
const RAW_903 = patchRaw(genMid(45, 7, 380),  [[1, 30, 4], [ 7, 880, 20]]);
const RAW_904 = genMid(50, 7, 700); /* 904 not in verified JSON — untouched */

const RAW_RANK = patchRaw(
  [
    [50,4],[60,4],[55,4],[65,4],[70,4],[58,4],[350,20],[200,4],[280,4],[320,4],
    [380,4],[350,4],[1100,20],[700,8],[740,8],[880,8],[1050,8],[1090,8],[4000,20],[3800,12],
    [4400,12],[4900,12],[4300,12],[14000,20],[36000,20],
  ],
  [[1, 100, 4], [7, 1500, 20]],
);

/* ─── Build all groups ──────────────────────────────────────────── */

const GROUP_SPECS: Array<{ code: string; tier: string; raw: RawRow[] }> = [
  { code: "201", tier: "Starter", raw: RAW_201 },
  { code: "202", tier: "Starter", raw: RAW_202 },
  { code: "203", tier: "Starter", raw: RAW_203 },
  { code: "204", tier: "Starter", raw: RAW_204 },
  { code: "301", tier: "Bronze",  raw: RAW_301 },
  { code: "302", tier: "Bronze",  raw: RAW_302 },
  { code: "303", tier: "Bronze",  raw: RAW_303 },
  { code: "304", tier: "Bronze",  raw: RAW_304 },
  { code: "401", tier: "Silver",  raw: RAW_401 },
  { code: "402", tier: "Silver",  raw: RAW_402 },
  { code: "403", tier: "Silver",  raw: RAW_403 },
  { code: "404", tier: "Silver",  raw: RAW_404 },
  { code: "501", tier: "Gold",    raw: RAW_501 },
  { code: "502", tier: "Gold",    raw: RAW_502 },
  { code: "503", tier: "Gold",    raw: RAW_503 },
  { code: "504", tier: "Gold",    raw: RAW_504 },
  { code: "601", tier: "Diamond", raw: RAW_601 },
  { code: "602", tier: "Diamond", raw: RAW_602 },
  { code: "603", tier: "Diamond", raw: RAW_603 },
  { code: "604", tier: "Diamond", raw: RAW_604 },
  { code: "701", tier: "Elite",   raw: RAW_701 },
  { code: "702", tier: "Elite",   raw: RAW_702 },
  { code: "703", tier: "Elite",   raw: RAW_703 },
  { code: "704", tier: "Elite",   raw: RAW_704 },
  { code: "801", tier: "Platinum",raw: RAW_801 },
  { code: "802", tier: "Platinum",raw: RAW_802 },
  { code: "803", tier: "Platinum",raw: RAW_803 },
  { code: "804", tier: "Platinum",raw: RAW_804 },
  { code: "901", tier: "Royal",   raw: RAW_901 },
  { code: "902", tier: "Royal",   raw: RAW_902 },
  { code: "903", tier: "Royal",   raw: RAW_903 },
  { code: "904", tier: "Royal",   raw: RAW_904 },
  { code: "Rank", tier: "Supreme", raw: RAW_RANK },
];

export const AD_GROUPS: AdGroup[] = GROUP_SPECS.map(s => buildGroup(s.code, s.tier, s.raw));

export const TIERS = ["Starter","Bronze","Silver","Gold","Diamond","Elite","Platinum","Royal","Supreme"];

/* ─── Custom ad groups (admin-created) ─────────────────────────── */
export const CUSTOM_ADS_KEY = "ds_custom_ad_groups";

export interface CustomAdDef {
  code: string;
  title: string;
  imageUrl: string;
  price: number;
  commission: number;
  afterCommission: number;
  tier: string;
  createdAt: string;
}

export function loadCustomAdDefs(): CustomAdDef[] {
  return [];
}

export function saveCustomAdDef(def: CustomAdDef) {
  void def;
}

export function deleteCustomAdDef(code: string) {
  void code;
}

function customDefToAdGroup(def: CustomAdDef): AdGroup {
  const commissionRate = def.price > 0 ? def.commission / def.price : 0.04;
  return {
    code: def.code,
    urlPath: def.code,
    label: def.title,
    amount: def.price,
    commissionRate,
    commissionAmount: def.commission,
    afterCommission: def.afterCommission,
    tier: def.tier || "Starter",
    ads: Array.from({ length: 25 }, (_, i) => ({
      adNo: i + 1,
      title: `${def.title} — Task ${i + 1}`,
      contentUrl: def.imageUrl || `https://placehold.co/400x400/8A4FFF/white?text=${def.code}`,
      amount: def.price,
      commissionRate,
      commissionAmount: def.commission,
      afterCommission: def.afterCommission,
    })),
    isActive: true,
  };
}

export function getCustomAdGroups(): AdGroup[] {
  return loadCustomAdDefs().map(customDefToAdGroup);
}

export function getAdGroup(code: string): AdGroup | undefined {
  const built = AD_GROUPS.find(g => g.code === code);
  if (built) return built;
  const customDef = loadCustomAdDefs().find(d => d.code === code);
  return customDef ? customDefToAdGroup(customDef) : undefined;
}

export function getAdGroupsByTier(tier: string): AdGroup[] {
  return AD_GROUPS.filter(g => g.tier === tier);
}

/* ─── LocalStorage overrides for admin active/inactive toggle ──── */
const OVERRIDES_KEY = "ds_ad_group_overrides";
interface GroupOverride { isActive?: boolean; amount?: number }

function loadOverrides(): Record<string, GroupOverride> {
  return {};
}

export function saveGroupOverride(code: string, data: GroupOverride) {
  void code;
  void data;
}

export function getGroupWithOverride(code: string): AdGroup | undefined {
  const group = getAdGroup(code);
  if (!group) return undefined;
  const overrides = loadOverrides();
  const ov = overrides[code] ?? {};
  return { ...group, ...(ov.isActive !== undefined ? { isActive: ov.isActive } : {}), ...(ov.amount !== undefined ? { amount: ov.amount } : {}) };
}

export function getAllGroupsWithOverrides(): AdGroup[] {
  const overrides = loadOverrides();
  return AD_GROUPS.map(g => {
    const ov = overrides[g.code] ?? {};
    return { ...g, ...(ov.isActive !== undefined ? { isActive: ov.isActive } : {}), ...(ov.amount !== undefined ? { amount: ov.amount } : {}) };
  });
}

/* ─── Admin ad code assignment ──────────────────────────────────── */
export function getAssignedAdCode(userId: string): string | null {
  void userId;
  return null;
}

/**
 * Returns the assignment-session timestamp stored alongside the assigned code.
 * Each call to setAssignedAdCode writes a fresh timestamp, so re-assigning the
 * same code produces a new ts → triggers a reset in AdCodeTask.
 */
export function getAssignedAdCodeTs(userId: string): string {
  void userId;
  return "";
}

export function setAssignedAdCode(userId: string, code: string | null) {
  void userId;
  void code;
}

export function setAssignedAdCodesBulk(userIds: string[], code: string | null) {
  void userIds;
  void code;
}

/* ─── Per-ad row overrides (admin editable) ────────────────────── */
const AD_ROW_OVERRIDES_KEY = "ds_ad_row_overrides";

export interface AdRowOverride {
  title?: string;
  contentUrl?: string;
  amount?: number;
  commissionAmount?: number;
  afterCommission?: number;
  /** Admin-set deposit restriction for this specific ad */
  depositRequired?: boolean;
  requiredDeposit?: number;
}

function loadAllAdRowOverrides(): Record<string, AdRowOverride> {
  return {};
}

export function loadAdRowOverridesForCode(code: string): Record<number, AdRowOverride> {
  const all = loadAllAdRowOverrides();
  const result: Record<number, AdRowOverride> = {};
  for (const k of Object.keys(all)) {
    if (k.startsWith(`${code}_`)) {
      const adNo = parseInt(k.split("_")[1], 10);
      if (!isNaN(adNo)) result[adNo] = all[k];
    }
  }
  return result;
}

export function saveAdRowOverride(code: string, adNo: number, data: AdRowOverride) {
  void code;
  void adNo;
  void data;
}

export function getAdGroupWithRowOverrides(code: string): AdGroup | undefined {
  const group = getAdGroup(code);
  if (!group) return undefined;
  const rowOverrides = loadAdRowOverridesForCode(code);
  return {
    ...group,
    ads: group.ads.map(ad => {
      const ov = rowOverrides[ad.adNo];
      if (!ov) return ad;
      const amount = ov.amount ?? ad.amount;
      const commissionAmount = ov.commissionAmount ?? ad.commissionAmount;
      const afterCommission = ov.afterCommission ?? ad.afterCommission;
      return {
        ...ad,
        title: ov.title ?? ad.title,
        contentUrl: ov.contentUrl ?? ad.contentUrl,
        amount,
        commissionAmount,
        afterCommission,
        commissionRate: amount > 0 ? commissionAmount / amount : ad.commissionRate,
        depositRequired: ov.depositRequired ?? ad.depositRequired,
        requiredDeposit: ov.requiredDeposit ?? ad.requiredDeposit,
      };
    }),
  };
}

/* ─── User ad task progress ─────────────────────────────────────── */
export interface AdTaskProgress {
  code: string;
  taskIndex: number;
  totalEarned: number;
  completedToday: number;
  lastDate: string;
  /** Timestamp from getAssignedAdCodeTs — used to detect re-assignments of the same code */
  assignedTs?: string;
}

export function loadAdTaskProgress(userId: string): AdTaskProgress | null {
  void userId;
  return null;
}

export function saveAdTaskProgress(userId: string, progress: AdTaskProgress) {
  void userId;
  void progress;
}

/* ─── User ad task history ──────────────────────────────────────── */
export interface AdTaskHistoryEntry {
  id: string;
  date: string;
  code: string;
  tasksCompleted: number;
  earnings: number;
}

export function loadAdTaskHistory(userId: string): AdTaskHistoryEntry[] {
  void userId;
  return [];
}

export function appendAdTaskHistory(userId: string, entry: Omit<AdTaskHistoryEntry, "id">) {
  const history = loadAdTaskHistory(userId);
  const newEntry: AdTaskHistoryEntry = {
    ...entry,
    id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  void userId;
  void newEntry;
}
