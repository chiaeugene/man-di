// The onboarding interview. Deterministic step script (works without an LLM key);
// answers are stored raw (keyed by step id, locale-independent) and compiled
// into the brains by compile.ts. Questions are offered in EN/ZH/MS; the step
// order and ids never change across locales.

import type { Locale } from "@/lib/i18n/config";

export type OnboardingSection = "brand" | "packages" | "sales" | "booking";

export interface OnboardingStep {
  id: string;
  section: OnboardingSection;
  question: string;
}

const STEP_ORDER = [
  "photographerName",
  "studioName",
  "location",
  "category",
  "targetCustomer",
  "photographyStyle",
  "brandPersonality",
  "values",
  "toneOfVoice",
  "languageStyle",
  "differentiators",
  "offerings",
  "travelFeeRules",
  "overtimeFeeRules",
  "discountRules",
  "followUpRules",
  "allowedToSay",
  "neverSay",
  "salesPressure",
  "depositAmount",
  "paymentMethods",
  "paymentInstructions",
  "balanceRules",
  "cancellationPolicy",
  "consultationRules",
  "availabilityRules",
  "humanOnlyTopics",
] as const;

const SECTIONS: Record<(typeof STEP_ORDER)[number], OnboardingSection> = {
  photographerName: "brand",
  studioName: "brand",
  location: "brand",
  category: "brand",
  targetCustomer: "brand",
  photographyStyle: "brand",
  brandPersonality: "brand",
  values: "brand",
  toneOfVoice: "brand",
  languageStyle: "brand",
  differentiators: "brand",
  offerings: "packages",
  travelFeeRules: "packages",
  overtimeFeeRules: "packages",
  discountRules: "sales",
  followUpRules: "sales",
  allowedToSay: "sales",
  neverSay: "sales",
  salesPressure: "sales",
  depositAmount: "booking",
  paymentMethods: "booking",
  paymentInstructions: "booking",
  balanceRules: "booking",
  cancellationPolicy: "booking",
  consultationRules: "booking",
  availabilityRules: "booking",
  humanOnlyTopics: "booking",
};

const QUESTIONS_EN: Record<(typeof STEP_ORDER)[number], string> = {
  photographerName:
    "Hi! I'm Mandy 👋 — your AI sales coordinator. I'll be chatting with your customers, so first let me get to know you and your business. This takes about 10 minutes.\n\nFirst things first: what's your name?",
  studioName: "Nice to meet you! And what's your studio or company name?",
  location: "Where are you based? (city and state — e.g. Petaling Jaya, Selangor)",
  category:
    "What's your main photography category? (e.g. wedding photography — you can mention others you also do)",
  targetCustomer:
    "Who are your ideal customers? (e.g. Chinese couples in KL doing full-day weddings, Malay couples for nikah + sanding, premium clients, budget-conscious couples...)",
  photographyStyle:
    "How would you describe your photography style? (e.g. candid & documentary, cinematic, editorial, bright & airy, moody...)",
  brandPersonality:
    "If your brand were a person, how would it feel? (e.g. warm & friendly, premium & polished, fun & casual, artistic...)",
  values:
    "What does your studio truly care about? (e.g. capturing real emotions, family moments, making couples feel relaxed, craftsmanship...)",
  toneOfVoice:
    "When YOU reply customers on WhatsApp, what's your tone like? (e.g. friendly with emojis, professional and concise, warm big-sister vibes...)",
  languageStyle:
    "What languages do your customers usually use, and how should I reply? (e.g. mostly English + Mandarin mixed, some Bahasa Malaysia — reply in whatever they use)",
  differentiators:
    "Last brand question: why do couples choose YOU over other photographers? Tell me your honest selling points — I'll use these when customers ask \"why you?\" 😊",
  offerings:
    "Now your services. What types of wedding photography do you offer? (e.g. actual day, pre-wedding, ROM, overseas pre-wedding, photo+video...)",
  travelFeeRules:
    "Do you charge travel fees? If yes, how does it work? (e.g. free within Klang Valley, RM200 for Johor, quote separately for East Malaysia)",
  overtimeFeeRules: "How about overtime charges if the event runs longer than the package hours?",
  discountRules:
    "Important one: what are your discount rules? Can I ever offer a discount, and under what conditions? If it's strictly no discounts, say so — I'll hold the line politely. 💪",
  followUpRules:
    "When a customer goes quiet or says \"I'll think about it\", how do you want me to follow up? (e.g. gentle nudge after 2 days, mention date may be taken, or don't chase at all)",
  allowedToSay:
    "Anything you specifically WANT me to mention or emphasize when selling? (e.g. limited slots per month, award mentions, free consultation call...)",
  neverSay:
    "And things I must NEVER say or promise? (e.g. never promise delivery under 4 weeks, never criticize other studios, never guarantee a specific shooter...)",
  salesPressure:
    "How hard should I sell? Reply with one of: soft (helpful, no pushing), balanced (guide them to the next step), or assertive (actively close, create urgency).",
  depositAmount:
    "Almost done! Booking rules now. How much deposit do you collect to secure a date? (e.g. RM500 flat, or 30% of package price)",
  paymentMethods:
    "How can customers pay? (e.g. bank transfer to Maybank, DuitNow, Touch 'n Go, payment link...)",
  paymentInstructions:
    "Please give me the exact payment instructions I should send when a customer is ready to pay the deposit (account number / DuitNow ID / instructions). I'll only send this when they're ready to book.",
  balanceRules:
    "When is the balance payment due? (e.g. 50% one week before the wedding, full balance on delivery...)",
  cancellationPolicy: "What's your cancellation / reschedule policy?",
  consultationRules:
    "Do you like doing a consultation call or meetup before booking? If yes, when should I offer it? (e.g. offer a free 15-min call once they're seriously considering)",
  availabilityRules:
    "How should I handle date availability? For now I can't see your calendar, so my default is: \"let me check with you and confirm\". Anything to add? (e.g. always fully booked on CNY, only 4 weddings per month...)",
  humanOnlyTopics:
    "Last question! 🎉 Which situations should I ALWAYS pass to you instead of handling myself? (besides my defaults: custom discounts, angry customers, refunds, and anything I'm unsure about)",
};

const QUESTIONS_ZH: Record<(typeof STEP_ORDER)[number], string> = {
  photographerName:
    "你好！我是 Mandy 👋 — 你的 AI 销售协调员。我会负责和你的客户聊天，所以先来认识一下你和你的业务吧，大概需要 10 分钟。\n\n首先，请问你的名字是？",
  studioName: "很高兴认识你！那你的工作室或公司名称是？",
  location: "你的工作室在哪里呢？（城市和州属，例如：八打灵再也，雪兰莪）",
  category: "你的主要摄影类别是什么？（例如：婚纱摄影 — 也可以提及你也提供的其他类别）",
  targetCustomer:
    "你的理想客户是怎样的？（例如：吉隆坡做全天婚礼的华人新人、办理马来婚礼的新人、高端客户、注重预算的客户……）",
  photographyStyle:
    "你会怎么形容自己的摄影风格？（例如：纪实抓拍、电影感、时尚编辑风、明亮清新、氛围感浓厚……）",
  brandPersonality:
    "如果你的品牌是一个人，会给人什么感觉？（例如：温暖友善、高端精致、轻松有趣、艺术感……）",
  values:
    "你的工作室真正在乎的是什么？（例如：捕捉真实情感、家庭时刻、让新人感到放松、精湛工艺……）",
  toneOfVoice:
    "当你亲自在 WhatsApp 回复客户时，你的语气是怎样的？（例如：亲切并带表情符号、专业简洁、像温暖的大姐姐……）",
  languageStyle:
    "你的客户通常使用什么语言？我该如何回复？（例如：主要是中英文混合，偶尔有马来文 — 客户用什么语言我就用什么语言回复）",
  differentiators:
    "最后一个关于品牌的问题：新人为什么会选择你而不是其他摄影师？请诚实告诉我你的卖点 — 当客户问「为什么选你」时，我会用上这些内容 😊",
  offerings:
    "接下来是你的服务项目。你提供哪些类型的婚纱摄影服务？（例如：正日、婚纱照、注册仪式、海外婚纱照、照片+录影……）",
  travelFeeRules:
    "你会收取交通费吗？如果会，是怎么计算的？（例如：巴生谷范围内免费，柔佛 RM200，东马另行报价）",
  overtimeFeeRules: "如果活动超过套餐时数，超时费用是怎么计算的？",
  discountRules:
    "这个很重要：你的折扣规则是什么？我可以提供折扣吗？在什么条件下？如果完全不能给折扣，请直接告诉我 — 我会礼貌地坚持立场。💪",
  followUpRules:
    "当客户沉默不回复，或说「我们再考虑看看」时，你希望我怎么跟进？（例如：2 天后温柔提醒一次、提及档期可能被订走、或完全不追问）",
  allowedToSay:
    "有没有什么你特别希望我在销售时提及或强调的？（例如：每月名额有限、得奖经历、免费咨询电话……）",
  neverSay:
    "有没有什么我绝对不能说或承诺的？（例如：绝不能承诺 4 周内交件、绝不能批评其他工作室、绝不能保证特定摄影师……）",
  salesPressure:
    "我应该用多大的力度来销售？请回复以下其中一个：温和（乐于助人，不施压）、平衡（引导客户走向下一步）、或积极（主动促成，营造急迫感）。",
  depositAmount:
    "快完成了！接下来是预订规则。你收取多少订金来锁定档期？（例如：固定 RM500，或套餐价格的 30%）",
  paymentMethods: "客户可以怎么付款？（例如：转账至 Maybank、DuitNow、Touch 'n Go、付款链接……）",
  paymentInstructions:
    "请告诉我当客户准备支付订金时，我应该发送的确切付款说明（账户号码 / DuitNow ID / 相关指示）。我只会在客户准备好预订时才发送这个信息。",
  balanceRules: "尾款什么时候需要支付？（例如：婚礼前一周付 50%，交件时付清全部尾款……）",
  cancellationPolicy: "你的取消 / 改期政策是什么？",
  consultationRules:
    "你喜欢在预订前安排一次咨询电话或见面吗？如果是，什么时候应该提出？（例如：当客户认真考虑时，提供 15 分钟的免费通话）",
  availabilityRules:
    "我该怎么处理档期查询？目前我看不到你的日历，所以默认回复是：「让我确认后再回复你」。有什么要补充的吗？（例如：农历新年档期一定客满、每月只接 4 场婚礼……）",
  humanOnlyTopics:
    "最后一个问题！🎉 除了我默认会转交给你处理的情况（自订折扣、生气的客户、退款、以及任何我不确定的事）之外，还有哪些情况你希望我一定要转交给你处理？",
};

const QUESTIONS_MS: Record<(typeof STEP_ORDER)[number], string> = {
  photographerName:
    "Hai! Saya Mandy 👋 — penyelaras jualan AI anda. Saya akan berbual dengan pelanggan anda, jadi mari kita berkenalan dahulu dengan anda dan perniagaan anda. Ini mengambil masa kira-kira 10 minit.\n\nPerkara pertama dahulu: siapa nama anda?",
  studioName: "Selamat berkenalan! Apakah nama studio atau syarikat anda?",
  location: "Di mana anda beroperasi? (bandar dan negeri — cth. Petaling Jaya, Selangor)",
  category:
    "Apakah kategori fotografi utama anda? (cth. fotografi perkahwinan — anda boleh nyatakan kategori lain juga)",
  targetCustomer:
    "Siapakah pelanggan ideal anda? (cth. pasangan Cina di KL untuk perkahwinan sehari penuh, pasangan Melayu untuk nikah + sanding, pelanggan premium, pelanggan sensitif bajet...)",
  photographyStyle:
    "Bagaimana anda menggambarkan gaya fotografi anda? (cth. candid & dokumentari, sinematik, editorial, cerah & lapang, moody...)",
  brandPersonality:
    "Jika jenama anda seorang manusia, bagaimana perasaannya? (cth. mesra & peramah, premium & bergaya, seronok & santai, artistik...)",
  values:
    "Apa yang studio anda benar-benar utamakan? (cth. menangkap emosi sebenar, detik kekeluargaan, membuatkan pasangan berasa selesa, ketukangan...)",
  toneOfVoice:
    "Apabila ANDA membalas pelanggan di WhatsApp, bagaimana nada anda? (cth. mesra dengan emoji, profesional dan ringkas, seperti kakak yang penyayang...)",
  languageStyle:
    "Apakah bahasa yang pelanggan anda selalu gunakan, dan bagaimana saya patut membalas? (cth. kebanyakan Bahasa Inggeris + Mandarin bercampur, sedikit Bahasa Malaysia — balas mengikut bahasa yang mereka gunakan)",
  differentiators:
    "Soalan terakhir tentang jenama: kenapa pasangan memilih ANDA berbanding jurugambar lain? Kongsikan titik jualan sebenar anda — saya akan gunakannya apabila pelanggan bertanya \"kenapa pilih anda?\" 😊",
  offerings:
    "Sekarang perkhidmatan anda. Apakah jenis fotografi perkahwinan yang anda tawarkan? (cth. hari sebenar, pra-perkahwinan, akad nikah, pra-perkahwinan luar negara, foto+video...)",
  travelFeeRules:
    "Adakah anda mengenakan yuran perjalanan? Jika ya, bagaimana ia berfungsi? (cth. percuma dalam Lembah Klang, RM200 untuk Johor, sebut harga berasingan untuk Malaysia Timur)",
  overtimeFeeRules: "Bagaimana pula dengan caj lebih masa jika majlis melebihi jam pakej?",
  discountRules:
    "Soalan penting: apakah peraturan diskaun anda? Bolehkah saya menawarkan diskaun, dan dalam keadaan apa? Jika sememangnya tiada diskaun langsung, beritahu sahaja — saya akan berdiri teguh dengan sopan. 💪",
  followUpRules:
    "Apabila pelanggan senyap atau berkata \"kami fikir-fikirkan dahulu\", bagaimana anda mahu saya susuli? (cth. peringatan lembut selepas 2 hari, sebut tarikh mungkin diambil orang lain, atau tidak mengejar langsung)",
  allowedToSay:
    "Ada apa-apa yang anda mahu saya sebut atau tekankan semasa menjual? (cth. slot terhad setiap bulan, sebutan anugerah, panggilan konsultasi percuma...)",
  neverSay:
    "Dan perkara yang saya TIDAK BOLEH sebut atau janjikan? (cth. jangan janji penghantaran bawah 4 minggu, jangan kritik studio lain, jangan jamin jurugambar tertentu...)",
  salesPressure:
    "Sejauh mana tahap jualan saya patut? Balas dengan salah satu: lembut (membantu, tiada paksaan), seimbang (bimbing ke langkah seterusnya), atau agresif (aktif menutup jualan, cipta desakan).",
  depositAmount:
    "Hampir siap! Sekarang peraturan tempahan. Berapa deposit yang anda kutip untuk mengunci tarikh? (cth. RM500 tetap, atau 30% daripada harga pakej)",
  paymentMethods: "Bagaimana pelanggan boleh membayar? (cth. pindahan bank ke Maybank, DuitNow, Touch 'n Go, pautan pembayaran...)",
  paymentInstructions:
    "Berikan saya arahan pembayaran yang tepat untuk saya hantar apabila pelanggan bersedia membayar deposit (nombor akaun / ID DuitNow / arahan). Saya hanya akan menghantar ini apabila mereka bersedia untuk menempah.",
  balanceRules: "Bilakah baki pembayaran perlu dijelaskan? (cth. 50% seminggu sebelum majlis, baki penuh semasa penghantaran...)",
  cancellationPolicy: "Apakah dasar pembatalan / penjadualan semula anda?",
  consultationRules:
    "Adakah anda suka membuat panggilan konsultasi atau pertemuan sebelum tempahan? Jika ya, bila saya patut tawarkan? (cth. tawarkan panggilan percuma 15 minit apabila mereka serius mempertimbangkan)",
  availabilityRules:
    "Bagaimana saya patut mengendalikan pertanyaan ketersediaan tarikh? Buat masa ini saya tidak dapat melihat kalendar anda, jadi lalai saya ialah: \"biar saya semak dengan anda dan sahkan\". Ada apa-apa nak ditambah? (cth. sentiasa penuh semasa Tahun Baru Cina, hanya 4 perkahwinan sebulan...)",
  humanOnlyTopics:
    "Soalan terakhir! 🎉 Situasi manakah yang anda mahu saya SENTIASA serahkan kepada anda dan bukan uruskan sendiri? (selain lalai saya: diskaun khas, pelanggan marah, bayaran balik, dan apa-apa yang saya tidak pasti)",
};

const QUESTIONS: Record<Locale, Record<string, string>> = {
  en: QUESTIONS_EN,
  zh: QUESTIONS_ZH,
  ms: QUESTIONS_MS,
};

const SECTION_LABELS: Record<Locale, Record<OnboardingSection, string>> = {
  en: {
    brand: "Your brand",
    packages: "Services & fees",
    sales: "How you sell",
    booking: "Booking & payment",
  },
  zh: {
    brand: "您的品牌",
    packages: "服务与收费",
    sales: "您的销售方式",
    booking: "预订与付款",
  },
  ms: {
    brand: "Jenama anda",
    packages: "Perkhidmatan & yuran",
    sales: "Cara anda menjual",
    booking: "Tempahan & pembayaran",
  },
};

const CANNED_ACKS: Record<Locale, string[]> = {
  en: [
    "Got it! 📝",
    "Perfect, noted!",
    "Nice — that really helps me understand you better.",
    "Okay, saved that! 👍",
    "Love it. Next one:",
  ],
  zh: ["明白了！📝", "很好，已记录！", "不错 — 这真的让我更了解你了。", "好的，已保存！👍", "很喜欢。下一个问题："],
  ms: [
    "Baik, faham! 📝",
    "Sempurna, dicatat!",
    "Bagus — ini benar-benar membantu saya memahami anda dengan lebih baik.",
    "Okay, telah disimpan! 👍",
    "Suka! Seterusnya:",
  ],
};

export function getOnboardingSteps(locale: Locale): OnboardingStep[] {
  const questions = QUESTIONS[locale] ?? QUESTIONS_EN;
  return STEP_ORDER.map((id) => ({
    id,
    section: SECTIONS[id],
    question: questions[id] ?? QUESTIONS_EN[id],
  }));
}

export function getSectionLabels(locale: Locale): Record<OnboardingSection, string> {
  return SECTION_LABELS[locale] ?? SECTION_LABELS.en;
}

export function getCannedAcks(locale: Locale): string[] {
  return CANNED_ACKS[locale] ?? CANNED_ACKS.en;
}
