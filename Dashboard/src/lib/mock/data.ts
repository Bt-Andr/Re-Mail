// Deterministic seeded mock data for the back-office dashboard.

let seed = 42;
function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function intBetween(a: number, b: number) {
  return Math.floor(rand() * (b - a + 1)) + a;
}

export type TxStatus = "completed" | "pending" | "failed" | "flagged";
export type TxChannel = "mobile" | "web" | "api" | "agency" | "card";
export type TxType = "transfer" | "card" | "direct_debit" | "swift" | "fx" | "deposit";

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: "EUR" | "USD" | "XOF" | "GBP";
  type: TxType;
  channel: TxChannel;
  status: TxStatus;
  counterparty: string;
  account: string;
  reference: string;
  country: string;
  risk: number;
}

const FIRST = ["Léa", "Marc", "Sofia", "Adama", "Yuki", "Hugo", "Amina", "Noah", "Clara", "Omar", "Inès", "Lucas", "Fatou", "Mateo", "Zara", "Elias"];
const LAST = ["Martin", "Diallo", "Petit", "Garcia", "Nakamura", "Touré", "Lambert", "Silva", "Bernard", "Okafor", "Rossi", "Dubois", "Mendes", "Kovač"];
const COMPANIES = ["Lumen SAS", "Aether Capital", "Solaris Trade", "Northwind Bank", "Helios Logistics", "Vega Imports", "Atlas Cloud", "Borealis Energy"];
const COUNTRIES = ["FR", "DE", "ES", "GB", "US", "SN", "CI", "MA", "BE", "NL", "IT", "PT", "JP", "BR"];
const CITIES: Record<string, string> = { FR: "Paris", DE: "Berlin", ES: "Madrid", GB: "Londres", US: "New York", SN: "Dakar", CI: "Abidjan", MA: "Casablanca", BE: "Bruxelles", NL: "Amsterdam", IT: "Milan", PT: "Lisbonne", JP: "Tokyo", BR: "São Paulo" };

function randomName() {
  return rand() > 0.4 ? `${pick(FIRST)} ${pick(LAST)}` : pick(COMPANIES);
}

function genTx(i: number): Transaction {
  const status = pick<TxStatus>(["completed", "completed", "completed", "completed", "pending", "failed", "flagged"]);
  const type = pick<TxType>(["transfer", "card", "direct_debit", "swift", "fx", "deposit"]);
  const channel = pick<TxChannel>(["mobile", "web", "api", "agency", "card"]);
  const currency = pick<"EUR" | "USD" | "XOF" | "GBP">(["EUR", "EUR", "EUR", "USD", "XOF", "GBP"]);
  const country = pick(COUNTRIES);
  const daysAgo = intBetween(0, 30);
  const date = new Date(Date.now() - daysAgo * 86400000 - intBetween(0, 86400000));
  return {
    id: `TX-${(100000 + i).toString()}`,
    date: date.toISOString(),
    amount: Math.round((rand() * 50000 + 5) * 100) / 100,
    currency,
    type,
    channel,
    status,
    counterparty: randomName(),
    account: `FR76 ${intBetween(1000, 9999)} ${intBetween(1000, 9999)} ${intBetween(1000, 9999)}`,
    reference: `REF-${intBetween(100000, 999999)}`,
    country,
    risk: Math.round(rand() * 100),
  };
}

export const TRANSACTIONS: Transaction[] = Array.from({ length: 120 }, (_, i) => genTx(i));

export type KycStatus = "verified" | "pending" | "rejected" | "review";
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: "retail" | "premium" | "business" | "private";
  kyc: KycStatus;
  country: string;
  city: string;
  joined: string;
  balance: number;
  accounts: number;
  riskScore: number;
}

export const CUSTOMERS: Customer[] = Array.from({ length: 80 }, (_, i) => {
  const name = randomName();
  const country = pick(COUNTRIES);
  return {
    id: `CUS-${(1000 + i).toString()}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}@example.com`,
    phone: `+33 ${intBetween(1, 9)} ${intBetween(10, 99)} ${intBetween(10, 99)} ${intBetween(10, 99)} ${intBetween(10, 99)}`,
    segment: pick(["retail", "retail", "premium", "business", "private"]),
    kyc: pick<KycStatus>(["verified", "verified", "verified", "pending", "review", "rejected"]),
    country,
    city: CITIES[country] ?? "—",
    joined: new Date(Date.now() - intBetween(1, 900) * 86400000).toISOString(),
    balance: Math.round(rand() * 250000 * 100) / 100,
    accounts: intBetween(1, 4),
    riskScore: Math.round(rand() * 100),
  };
});

export interface Account {
  id: string;
  iban: string;
  customer: string;
  customerId: string;
  type: "current" | "savings" | "business" | "fx";
  currency: "EUR" | "USD" | "XOF" | "GBP";
  balance: number;
  status: "active" | "frozen" | "closed";
  opened: string;
}

export const ACCOUNTS: Account[] = CUSTOMERS.flatMap((c) =>
  Array.from({ length: c.accounts }, (_, j) => ({
    id: `ACC-${c.id.slice(4)}-${j}`,
    iban: `FR76 ${intBetween(1000, 9999)} ${intBetween(1000, 9999)} ${intBetween(1000, 9999)} ${intBetween(1000, 9999)}`,
    customer: c.name,
    customerId: c.id,
    type: pick(["current", "current", "savings", "business", "fx"]),
    currency: pick(["EUR", "EUR", "USD", "GBP"]),
    balance: Math.round(rand() * 500000 * 100) / 100,
    status: pick(["active", "active", "active", "active", "frozen", "closed"]),
    opened: c.joined,
  })),
);

export interface Alert {
  id: string;
  type: "aml" | "fraud" | "sanction" | "limit" | "kyc";
  severity: "low" | "medium" | "high" | "critical";
  customer: string;
  customerId: string;
  amount?: number;
  reason: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  date: string;
  assignee?: string;
}

const ALERT_REASONS = [
  "Volume inhabituel sur 24h",
  "Pays à risque élevé détecté",
  "Correspondance liste sanctions OFAC",
  "Dépassement limite quotidienne",
  "Documents KYC expirés",
  "Multiples comptes même IP",
  "Pattern de structuration détecté",
  "Velocity anormale (15 tx/min)",
];

export const ALERTS: Alert[] = Array.from({ length: 35 }, (_, i) => {
  const c = CUSTOMERS[intBetween(0, CUSTOMERS.length - 1)];
  return {
    id: `ALT-${(2000 + i).toString()}`,
    type: pick(["aml", "fraud", "sanction", "limit", "kyc"]),
    severity: pick(["low", "medium", "medium", "high", "high", "critical"]),
    customer: c.name,
    customerId: c.id,
    amount: rand() > 0.3 ? Math.round(rand() * 80000) : undefined,
    reason: pick(ALERT_REASONS),
    status: pick(["open", "open", "investigating", "resolved", "dismissed"]),
    date: new Date(Date.now() - intBetween(0, 15) * 86400000).toISOString(),
    assignee: rand() > 0.4 ? pick(FIRST) + " " + pick(LAST) : undefined,
  };
});

export interface AuditLog {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  ip: string;
  date: string;
  outcome: "success" | "denied" | "error";
}

const ACTIONS = [
  "Connexion au back-office",
  "Validation virement SWIFT",
  "Modification limite quotidienne",
  "Gel de compte",
  "Création utilisateur",
  "Réinitialisation mot de passe",
  "Export rapport conformité",
  "Approbation KYC",
  "Refus KYC",
  "Marquage transaction suspecte",
];

export const AUDIT_LOGS: AuditLog[] = Array.from({ length: 60 }, (_, i) => ({
  id: `LOG-${(50000 + i).toString()}`,
  actor: `${pick(FIRST)} ${pick(LAST)}`,
  role: pick(["Admin", "Operations", "Compliance", "Audit", "Support"]),
  action: pick(ACTIONS),
  target: pick(["CUS-1023", "ACC-1023-0", "TX-100487", "USR-12", "système"]),
  ip: `192.168.${intBetween(1, 250)}.${intBetween(1, 250)}`,
  date: new Date(Date.now() - intBetween(0, 14) * 86400000 - intBetween(0, 86400000)).toISOString(),
  outcome: pick(["success", "success", "success", "success", "denied", "error"]),
}));

export interface Ticket {
  id: string;
  subject: string;
  customer: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "waiting" | "resolved";
  channel: "email" | "phone" | "chat" | "app";
  date: string;
  assignee: string;
}

const SUBJECTS = [
  "Carte bloquée après plusieurs essais",
  "Demande de relevé annuel",
  "Virement SEPA non reçu",
  "Modification adresse postale",
  "Soupçon de fraude transaction inconnue",
  "Augmentation plafond carte",
  "Activation paiement sans contact",
  "Documents KYC à mettre à jour",
];

export const TICKETS: Ticket[] = Array.from({ length: 28 }, (_, i) => ({
  id: `TKT-${(7000 + i).toString()}`,
  subject: pick(SUBJECTS),
  customer: pick(CUSTOMERS).name,
  priority: pick(["low", "medium", "medium", "high"]),
  status: pick(["open", "open", "in_progress", "waiting", "resolved"]),
  channel: pick(["email", "phone", "chat", "app"]),
  date: new Date(Date.now() - intBetween(0, 10) * 86400000).toISOString(),
  assignee: `${pick(FIRST)} ${pick(LAST)}`,
}));

export interface BackOfficeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  status: "active" | "inactive" | "locked";
  mfa: boolean;
  lastSeen: string;
}

export const BO_USERS: BackOfficeUser[] = Array.from({ length: 24 }, (_, i) => ({
  id: `USR-${(10 + i).toString()}`,
  name: `${pick(FIRST)} ${pick(LAST)}`,
  email: `user${i + 1}@northwind-bank.io`,
  role: pick(["Admin", "Operations", "Compliance", "Audit", "Support", "Risk", "Finance"]),
  branch: pick(["Paris HQ", "Lyon", "Dakar", "Genève", "Londres", "Casablanca"]),
  status: pick(["active", "active", "active", "active", "inactive", "locked"]),
  mfa: rand() > 0.2,
  lastSeen: new Date(Date.now() - intBetween(0, 30) * 86400000).toISOString(),
}));

// Time series helpers for charts
export function txVolumeSeries(days = 30) {
  const out: { date: string; in: number; out: number; net: number }[] = [];
  const today = new Date();
  let s = 1;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    s = (s * 9301 + 49297) % 233280;
    const inAmt = 800000 + (s / 233280) * 600000 + Math.sin(i / 4) * 200000;
    s = (s * 9301 + 49297) % 233280;
    const outAmt = 600000 + (s / 233280) * 500000 + Math.cos(i / 5) * 180000;
    out.push({
      date: d.toISOString().slice(0, 10),
      in: Math.round(inAmt),
      out: Math.round(outAmt),
      net: Math.round(inAmt - outAmt),
    });
  }
  return out;
}

export const CHANNEL_BREAKDOWN = [
  { channel: "Mobile", value: 48230, color: "var(--brand)" },
  { channel: "Web", value: 31420, color: "var(--info)" },
  { channel: "API", value: 18750, color: "var(--navy)" },
  { channel: "Agence", value: 7820, color: "var(--warning)" },
  { channel: "Carte", value: 25600, color: "var(--chart-5)" },
];

export const TX_TYPE_BREAKDOWN = [
  { name: "Virement SEPA", value: 42, color: "var(--brand)" },
  { name: "Paiement carte", value: 28, color: "var(--info)" },
  { name: "Prélèvement", value: 14, color: "var(--navy)" },
  { name: "SWIFT", value: 9, color: "var(--warning)" },
  { name: "Change FX", value: 7, color: "var(--chart-5)" },
];

export function kycMonthlySeries() {
  const months = ["Juil", "Août", "Sep", "Oct", "Nov", "Déc", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin"];
  return months.map((m, i) => {
    const base = 320 + i * 12;
    return {
      month: m,
      verified: Math.round(base + Math.sin(i) * 30),
      pending: Math.round(60 + Math.cos(i) * 15),
      rejected: Math.round(18 + Math.sin(i / 2) * 5),
    };
  });
}

export function heatmapData() {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const rows: { day: string; hour: number; value: number }[] = [];
  let s = 7;
  for (const day of days) {
    for (let h = 0; h < 24; h++) {
      s = (s * 9301 + 49297) % 233280;
      const r = s / 233280;
      const businessHours = h >= 8 && h <= 19;
      const weekend = day === "Sam" || day === "Dim";
      const base = businessHours ? (weekend ? 0.35 : 0.85) : 0.15;
      rows.push({ day, hour: h, value: Math.round((base + r * 0.2) * 100) });
    }
  }
  return rows;
}

export const FUNNEL_DATA = [
  { stage: "Inscriptions", value: 12480, color: "var(--info)" },
  { stage: "KYC démarré", value: 9320, color: "var(--navy)" },
  { stage: "KYC validé", value: 7180, color: "var(--brand)" },
  { stage: "Compte activé", value: 6420, color: "var(--success)" },
  { stage: "1er dépôt", value: 4830, color: "var(--warning)" },
];

export const TOP_CORRIDORS = [
  { from: "France", to: "Sénégal", flag: "🇫🇷→🇸🇳", volume: 4_280_000, count: 1820 },
  { from: "France", to: "Maroc", flag: "🇫🇷→🇲🇦", volume: 3_120_000, count: 1450 },
  { from: "Allemagne", to: "Turquie", flag: "🇩🇪→🇹🇷", volume: 2_840_000, count: 980 },
  { from: "Espagne", to: "Côte d'Ivoire", flag: "🇪🇸→🇨🇮", volume: 1_960_000, count: 720 },
  { from: "Royaume-Uni", to: "Nigeria", flag: "🇬🇧→🇳🇬", volume: 1_540_000, count: 610 },
  { from: "Italie", to: "Albanie", flag: "🇮🇹→🇦🇱", volume: 980_000, count: 410 },
];

export const NOTIFICATIONS = [
  { id: "N1", title: "Alerte AML critique", body: "Pattern de structuration détecté sur CUS-1042", time: new Date(Date.now() - 5 * 60000).toISOString(), unread: true, severity: "critical" as const },
  { id: "N2", title: "SLA support dépassé", body: "12 tickets ouverts depuis +24h", time: new Date(Date.now() - 28 * 60000).toISOString(), unread: true, severity: "high" as const },
  { id: "N3", title: "Nouveau virement SWIFT > 100k€", body: "Approbation requise — REF-394820", time: new Date(Date.now() - 2 * 3600000).toISOString(), unread: true, severity: "medium" as const },
  { id: "N4", title: "Rapport mensuel conformité prêt", body: "Export disponible dans Reports", time: new Date(Date.now() - 5 * 3600000).toISOString(), unread: false, severity: "low" as const },
  { id: "N5", title: "Maintenance planifiée", body: "Dimanche 02:00 — passerelle SWIFT", time: new Date(Date.now() - 26 * 3600000).toISOString(), unread: false, severity: "low" as const },
];