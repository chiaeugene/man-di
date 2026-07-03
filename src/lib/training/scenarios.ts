// Mock-customer role-play scenarios. Mandy plays the customer; the photographer
// replies as they naturally would. Replies become TrainingExample rows and are
// injected into the customer-facing prompt as style few-shots. Offered in
// EN/ZH/MS; the scenario order and `key` never change across locales.

import type { Locale } from "@/lib/i18n/config";

export interface TrainingScenario {
  key: string;
  label: string;
  intro: string; // Mandy's framing before the mock message
  customerMessage: string;
  learns: string; // what this scenario teaches Mandy (shown in UI)
}

const SCENARIO_ORDER = [
  "package-inquiry",
  "price-only",
  "too-expensive",
  "discount-request",
  "date-availability",
  "photo-video",
  "low-budget",
  "unsure-package",
  "why-you",
  "think-about-it",
  "ready-to-book",
  "deposit-how",
] as const;

type ScenarioKey = (typeof SCENARIO_ORDER)[number];
type ScenarioText = Omit<TrainingScenario, "key">;

const EN: Record<ScenarioKey, ScenarioText> = {
  "package-inquiry": {
    label: "Package inquiry",
    intro: "Let's role-play! I'll act as different customers, and you reply exactly how you normally would on WhatsApp. First one — a fresh inquiry:",
    customerMessage: "Hi, can I know your wedding photography package?",
    learns: "Your greeting style and how you open a conversation",
  },
  "price-only": {
    label: "Price-only ask",
    intro: "Next: the classic price hunter.",
    customerMessage: "How much for wedding photo?",
    learns: "How you respond when someone only asks for price",
  },
  "too-expensive": {
    label: '"Too expensive"',
    intro: "Now an objection. You quoted your package, and the customer says:",
    customerMessage: "Wah, quite expensive leh... a bit over our budget.",
    learns: "How you defend your value without discounting",
  },
  "discount-request": {
    label: "Discount request",
    intro: "Direct discount ask this time:",
    customerMessage: "Can give discount or not? Other studio offer us cheaper.",
    learns: "How firmly or flexibly you handle discount pressure",
  },
  "date-availability": {
    label: "Date availability",
    intro: "A date check:",
    customerMessage: "Are you available on 14 November next year? Our dinner is in Penang.",
    learns: "How you handle availability questions",
  },
  "photo-video": {
    label: "Photo + video",
    intro: "A bigger job:",
    customerMessage: "We want both photo and video for actual day. Do you provide that?",
    learns: "How you present combined or larger offerings",
  },
  "low-budget": {
    label: "Low budget",
    intro: "A budget-conscious couple:",
    customerMessage: "Our budget is only around RM1,500... do you have anything within that?",
    learns: "How you handle below-package budgets",
  },
  "unsure-package": {
    label: "Unsure which package",
    intro: "An undecided customer:",
    customerMessage: "We're not sure which package suits us. Morning ceremony plus dinner, maybe 300 guests?",
    learns: "How you guide customers to the right package",
  },
  "why-you": {
    label: '"Why you?"',
    intro: "The comparison shopper:",
    customerMessage: "We're comparing a few photographers. What makes you different from others?",
    learns: "Your core differentiators, in your own words",
  },
  "think-about-it": {
    label: '"We\'ll think about it"',
    intro: "The slow fade:",
    customerMessage: "Okay thanks for the info, we'll discuss and think about it first.",
    learns: "How you keep the door open and follow up",
  },
  "ready-to-book": {
    label: "Ready to book",
    intro: "Good news — a hot lead:",
    customerMessage: "We've decided! We want to go ahead with the package. What's next?",
    learns: "Your closing and booking steps",
  },
  "deposit-how": {
    label: "How to pay deposit",
    intro: "Last one! The close:",
    customerMessage: "How do we pay the deposit?",
    learns: "How you deliver payment instructions",
  },
};

const ZH: Record<ScenarioKey, ScenarioText> = {
  "package-inquiry": {
    label: "套餐询问",
    intro: "我们来做角色扮演吧！我会扮演不同类型的客户，你就像平时在 WhatsApp 上一样自然回复。第一个 — 一个全新的询问：",
    customerMessage: "你好，请问可以了解一下你们的婚纱摄影套餐吗？",
    learns: "你的问候风格与开场方式",
  },
  "price-only": {
    label: "只问价格",
    intro: "接下来：典型的比价客户。",
    customerMessage: "婚纱摄影大概多少钱？",
    learns: "当客户只问价格时你怎么回应",
  },
  "too-expensive": {
    label: "「太贵了」",
    intro: "现在是异议处理。你报价后，客户说：",
    customerMessage: "哇，有点贵哦……有点超出我们的预算了。",
    learns: "如何在不打折的情况下捍卫你的价值",
  },
  "discount-request": {
    label: "要求折扣",
    intro: "这次是直接要求折扣：",
    customerMessage: "可以给折扣吗？别家工作室比较便宜。",
    learns: "你如何坚定或灵活地处理折扣压力",
  },
  "date-availability": {
    label: "档期查询",
    intro: "查询档期：",
    customerMessage: "明年 11 月 14 号你们有档期吗？我们晚宴在槟城。",
    learns: "你如何处理档期问题",
  },
  "photo-video": {
    label: "照片+录影",
    intro: "一个更大的项目：",
    customerMessage: "我们正日想要照片和录影都拍。你们有提供吗？",
    learns: "你如何介绍组合或更大型的服务",
  },
  "low-budget": {
    label: "预算较低",
    intro: "一对注重预算的新人：",
    customerMessage: "我们的预算只有大概 RM1,500……你们有符合这个预算的吗？",
    learns: "你如何处理低于套餐价格的预算",
  },
  "unsure-package": {
    label: "不确定选哪个套餐",
    intro: "一位还没决定的客户：",
    customerMessage: "我们不确定哪个套餐适合我们。早上有仪式，晚上有晚宴，大概 300 位宾客？",
    learns: "你如何引导客户选择合适的套餐",
  },
  "why-you": {
    label: "「为什么选你」",
    intro: "货比三家的客户：",
    customerMessage: "我们正在比较几位摄影师。你们和其他人有什么不同？",
    learns: "用你自己的话表达你的核心差异化优势",
  },
  "think-about-it": {
    label: "「我们再考虑看看」",
    intro: "逐渐冷淡的客户：",
    customerMessage: "好的，谢谢你的资讯，我们先讨论和考虑一下。",
    learns: "你如何保持联系并适当跟进",
  },
  "ready-to-book": {
    label: "准备预订",
    intro: "好消息 — 一位热切的客户：",
    customerMessage: "我们决定了！想要预订这个套餐。接下来怎么进行？",
    learns: "你的促成交易与预订流程",
  },
  "deposit-how": {
    label: "如何支付订金",
    intro: "最后一个！促成交易的时刻：",
    customerMessage: "我们要怎么支付订金？",
    learns: "你如何传达付款说明",
  },
};

const MS: Record<ScenarioKey, ScenarioText> = {
  "package-inquiry": {
    label: "Pertanyaan pakej",
    intro: "Mari kita main peranan! Saya akan bertindak sebagai pelanggan berbeza, dan anda balas seperti biasa di WhatsApp. Yang pertama — pertanyaan baharu:",
    customerMessage: "Hi, boleh saya tahu pakej fotografi perkahwinan anda?",
    learns: "Gaya salam anda dan cara anda memulakan perbualan",
  },
  "price-only": {
    label: "Hanya tanya harga",
    intro: "Seterusnya: pemburu harga klasik.",
    customerMessage: "Berapa harga untuk gambar perkahwinan?",
    learns: "Cara anda membalas apabila seseorang hanya bertanya harga",
  },
  "too-expensive": {
    label: '"Terlalu mahal"',
    intro: "Sekarang satu bantahan. Anda sudah sebut harga pakej, dan pelanggan berkata:",
    customerMessage: "Wah, agak mahal jugak... sikit melebihi bajet kami.",
    learns: "Cara anda mempertahankan nilai tanpa memberi diskaun",
  },
  "discount-request": {
    label: "Minta diskaun",
    intro: "Kali ini permintaan diskaun secara terus:",
    customerMessage: "Boleh bagi diskaun tak? Studio lain tawarkan harga lebih murah kat kami.",
    learns: "Sejauh mana anda tegas atau fleksibel dengan tekanan diskaun",
  },
  "date-availability": {
    label: "Semakan ketersediaan tarikh",
    intro: "Semakan tarikh:",
    customerMessage: "Available tak pada 14 November tahun depan? Majlis makan malam kami di Pulau Pinang.",
    learns: "Cara anda mengendalikan soalan ketersediaan",
  },
  "photo-video": {
    label: "Foto + video",
    intro: "Kerja yang lebih besar:",
    customerMessage: "Kami nak foto dan video sekali untuk hari sebenar. Ada tawarkan tak?",
    learns: "Cara anda membentangkan pakej gabungan atau lebih besar",
  },
  "low-budget": {
    label: "Bajet rendah",
    intro: "Pasangan yang sensitif tentang bajet:",
    customerMessage: "Bajet kami sekitar RM1,500 sahaja... ada apa-apa dalam julat tu?",
    learns: "Cara anda mengendalikan bajet di bawah harga pakej",
  },
  "unsure-package": {
    label: "Tidak pasti pakej mana",
    intro: "Pelanggan yang belum membuat keputusan:",
    customerMessage: "Kami tak pasti pakej mana yang sesuai. Ada majlis akad nikah pagi dan makan malam, anggaran 300 tetamu?",
    learns: "Cara anda membimbing pelanggan ke pakej yang sesuai",
  },
  "why-you": {
    label: '"Kenapa pilih anda?"',
    intro: "Pelanggan yang membanding-banding:",
    customerMessage: "Kami sedang banding beberapa jurugambar. Apa yang membezakan anda daripada yang lain?",
    learns: "Titik pembeza utama anda, dalam kata-kata anda sendiri",
  },
  "think-about-it": {
    label: '"Kami fikir-fikirkan dahulu"',
    intro: "Pelanggan yang semakin senyap:",
    customerMessage: "Okay terima kasih atas maklumatnya, kami akan bincang dan fikirkan dahulu.",
    learns: "Cara anda mengekalkan hubungan dan menyusuli",
  },
  "ready-to-book": {
    label: "Bersedia menempah",
    intro: "Berita baik — lead yang panas:",
    customerMessage: "Kami sudah putuskan! Kami nak teruskan dengan pakej ini. Apa langkah seterusnya?",
    learns: "Langkah anda menutup jualan dan tempahan",
  },
  "deposit-how": {
    label: "Cara bayar deposit",
    intro: "Yang terakhir! Masa untuk menutup jualan:",
    customerMessage: "Macam mana kami nak bayar deposit?",
    learns: "Cara anda menyampaikan arahan pembayaran",
  },
};

const DATA: Record<Locale, Record<ScenarioKey, ScenarioText>> = { en: EN, zh: ZH, ms: MS };

export function getTrainingScenarios(locale: Locale): TrainingScenario[] {
  const data = DATA[locale] ?? EN;
  return SCENARIO_ORDER.map((key) => ({ key, ...(data[key] ?? EN[key]) }));
}
