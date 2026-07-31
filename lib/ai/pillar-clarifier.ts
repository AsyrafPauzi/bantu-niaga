import type { UserLanguage } from "@/lib/ai/user-language";

const FREE_NOTE: Record<UserLanguage, string> = {
  english:
    "_These clarifying questions are free (no credits). Your next reply that gets a plan or action will use credits._",
  bahasa_malaysia:
    "_Soalan penjelasan ini percuma (tiada kredit). Jawapan seterusnya yang beri rancangan atau tindakan akan guna kredit._",
  bahasa_kelantan:
    "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
  bahasa_terengganu:
    "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
  bahasa_kedah:
    "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
  bahasa_sabah:
    "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
  bahasa_sarawak:
    "_Soalan ni percuma (tak guna kredit). Jawapan seterusnya yang bagi rancangan atau buat tindakan akan guna kredit._",
  mandarin_simplified:
    "_这些澄清问题免费（不扣积分）。下一条给出计划或执行操作的回复将使用积分。_",
  mandarin_traditional:
    "_這些澄清問題免費（不扣積分）。下一條給出計劃或執行操作的回覆將使用積分。_",
  cantonese:
    "_這些澄清問題免費（不扣積分）。下一條給出計劃或執行操作的回覆將使用積分。_",
  hokkien:
    "_Chit eh soal long free (bo kredit). Eh eh tiaw hui long plan aseh action toh sio kredit._",
  tamil:
    "_இந்த தெளிவுபடுத்தல் கேள்விகள் இலவசம் (கிரெடிட் இல்லை). அடுத்த பதில் திட்டம் அல்லது செயலைக் கொண்டு வந்தால் கிரெடிட் பயன்படுத்தப்படும்._",
};

const HEADER: Record<UserLanguage, string> = {
  english: "Before I plan, a few quick questions",
  bahasa_malaysia: "Sebelum saya rancang, beberapa soalan ringkas",
  bahasa_kelantan: "Sebelum ambo rancang, soalan sikit je",
  bahasa_terengganu: "Sebelum kito rancang, soalan sikit",
  bahasa_kedah: "Sebelum hang rancang, soalan sikit",
  bahasa_sabah: "Sebelum kita rancang, soalan sikit",
  bahasa_sarawak: "Sebelum kitak rancang, soalan sikit",
  mandarin_simplified: "在制定计划前，请先回答几个问题",
  mandarin_traditional: "在制定計劃前，請先回答幾個問題",
  cantonese: "制定計劃前，請先答幾條問題",
  hokkien: "Chia plan chit pai, ai lim kua kua lang eh soal",
  tamil: "திட்டமிடுவதற்கு முன், சில கேள்விகள்",
};

const DECIDE: Record<UserLanguage, string> = {
  english: "Reply in one message — or say **you decide**.",
  bahasa_malaysia: "Jawab dalam satu mesej — atau tulis **anda decide**.",
  bahasa_kelantan: "Jawab dalam satu mesej — atau tulis **hang decide**.",
  bahasa_terengganu: "Jawab dalam satu mesej — atau tulis **demo decide**.",
  bahasa_kedah: "Jawab dalam satu mesej — atau tulis **hang decide**.",
  bahasa_sabah: "Jawab dalam satu mesej — atau tulis **ko decide**.",
  bahasa_sarawak: "Jawab dalam satu mesej — atau tulis **kitak decide**.",
  mandarin_simplified: "请一条消息回复 — 或输入 **你来决定**。",
  mandarin_traditional: "請一條訊息回覆 — 或輸入 **你來決定**。",
  cantonese: "請一條訊息回覆 — 或輸入 **你決定**。",
  hokkien: "Hui chiok tiaw — aseh si **lu decide**.",
  tamil: "ஒரே செய்தியில் பதிலளியுங்கள் — அல்லது **நீங்கள் முடிவு செய்யுங்கள்** என்று எழுதுங்கள்.",
};

function roleIntro(
  pillar: "marketing" | "admin",
  lang: UserLanguage,
  name: string,
): string {
  const intros: Record<
    "marketing" | "admin",
    Record<UserLanguage, string>
  > = {
    marketing: {
      english: `I'm **${name}**, your Marketing staff.`,
      bahasa_malaysia: `Saya **${name}**, staf Marketing anda.`,
      bahasa_kelantan: `Ambe **${name}**, staf Marketing hang.`,
      bahasa_terengganu: `Aku **${name}**, staf Marketing demo.`,
      bahasa_kedah: `Aku **${name}**, staf Marketing hang.`,
      bahasa_sabah: `Aku **${name}**, staf Marketing kita.`,
      bahasa_sarawak: `Kamek **${name}**, staf Marketing kitak.`,
      mandarin_simplified: `我是 **${name}**，您的营销助手。`,
      mandarin_traditional: `我是 **${name}**，您的行銷助手。`,
      cantonese: `我係 **${name}**，你嘅 Marketing 助手。`,
      hokkien: `Wa **${name}**, lu eh Marketing staff.`,
      tamil: `நான் **${name}**, உங்கள் Marketing உதவியாளர்.`,
    },
    admin: {
      english: `I'm **${name}**, your Admin staff.`,
      bahasa_malaysia: `Saya **${name}**, staf Admin anda.`,
      bahasa_kelantan: `Ambe **${name}**, staf Admin hang.`,
      bahasa_terengganu: `Aku **${name}**, staf Admin demo.`,
      bahasa_kedah: `Aku **${name}**, staf Admin hang.`,
      bahasa_sabah: `Aku **${name}**, staf Admin kita.`,
      bahasa_sarawak: `Kamek **${name}**, staf Admin kitak.`,
      mandarin_simplified: `我是 **${name}**，您的行政助手。`,
      mandarin_traditional: `我是 **${name}**，您的行政助手。`,
      cantonese: `我係 **${name}**，你嘅 Admin 助手。`,
      hokkien: `Wa **${name}**, lu eh Admin staff.`,
      tamil: `நான் **${name}**, உங்கள் Admin உதவியாளர்.`,
    },
  };
  return intros[pillar][lang] ?? intros[pillar].english;
}

const QUESTIONS: Record<
  "marketing" | "admin",
  Record<UserLanguage, string[]>
> = {
  marketing: {
    english: [
      "1. Main goal — more customers, clear slow stock, or higher ticket size?",
      "2. What's the **max discount %** you'll allow?",
      "3. Any product/category to push, or should I choose from sales & catalog?",
      "4. Audience — dormant, VIP, everyone, or a segment? Channel — WhatsApp, email, or social?",
    ],
    bahasa_malaysia: [
      "1. Matlamat utama — lebih pelanggan, habiskan stok lambat, atau naikkan nilai beli?",
      "2. Diskauan maksimum yang anda benarkan (contoh 10%)?",
      "3. Fokus produk/kategori, atau biar saya pilih dari jualan & stok?",
      "4. Sasaran — dormant, VIP, semua, atau segmen? Saluran — WhatsApp, email, atau kandungan sosial?",
    ],
    bahasa_kelantan: [
      "1. Matlamat — lebih pelanggan, habiskan stok, atau naikkan nilai beli?",
      "2. Diskaun maksimum berapo % hang benarkan?",
      "3. Produk/kategori tertentu, atau ambo pilih dari jualan & katalog?",
      "4. Sasaran — dormant, VIP, semua, atau segmen? Saluran — WhatsApp, email, atau sosial?",
    ],
    bahasa_terengganu: [
      "1. Matlamat — lebih pelanggan, habiskan stok, atau naikkan nilai beli?",
      "2. Diskaun maksimum berapo % demo benarkan?",
      "3. Produk/kategori tertentu, atau kito pilih dari jualan & katalog?",
      "4. Sasaran — dormant, VIP, semua, atau segmen? Saluran — WhatsApp, email, atau sosial?",
    ],
    bahasa_kedah: [
      "1. Matlamat — lebih pelanggan, habiskan stok, atau naikkan nilai beli?",
      "2. Diskaun maksimum berapo % hang benarkan?",
      "3. Produk/kategori tertentu, atau hang pilih dari jualan & katalog?",
      "4. Sasaran — dormant, VIP, semua, atau segmen? Saluran — WhatsApp, email, atau sosial?",
    ],
    bahasa_sabah: [
      "1. Matlamat — lebih pelanggan, habiskan stok, atau naikkan nilai beli?",
      "2. Diskaun maksimum berapa % ko benarkan?",
      "3. Produk/kategori tertentu, atau kita pilih dari jualan & katalog?",
      "4. Sasaran — dormant, VIP, semua, atau segmen? Saluran — WhatsApp, email, atau sosial?",
    ],
    bahasa_sarawak: [
      "1. Matlamat — lebih pelanggan, habiskan stok, atau naikkan nilai beli?",
      "2. Diskaun maksimum berapa % kitak benarkan?",
      "3. Produk/kategori tertentu, atau kamek pilih dari jualan & katalog?",
      "4. Sasaran — dormant, VIP, semua, atau segmen? Saluran — WhatsApp, email, atau sosial?",
    ],
    mandarin_simplified: [
      "1. 目标 — 更多客户、清慢销库存，还是提高客单价？",
      "2. 最高折扣百分比是多少？",
      "3. 要推哪类产品/品类，还是我从销售和目录里选？",
      "4. 受众 — 沉睡、VIP、所有人或某细分？渠道 — WhatsApp、邮件或社媒？",
    ],
    mandarin_traditional: [
      "1. 目標 — 更多客戶、清慢銷庫存，還是提高客單價？",
      "2. 最高折扣百分比是多少？",
      "3. 要推哪類產品/品類，還是我從銷售和目錄裡選？",
      "4. 受眾 — 沉睡、VIP、所有人或某細分？渠道 — WhatsApp、郵件或社媒？",
    ],
    cantonese: [
      "1. 目標 — 更多客戶、清慢銷存貨，定係提高客單價？",
      "2. 最高折扣幾多 %？",
      "3. 推邊類產品/品類，定係我從銷售同目錄揀？",
      "4. 受眾 — dormant、VIP、所有人定某 segment？渠道 — WhatsApp、email 定社媒？",
    ],
    hokkien: [
      "1. Goal — more customers, clear slow stock, aseh higher ticket?",
      "2. Max discount % lu beh tahan?",
      "3. Product/category to push, aseh wa choose from sales & catalog?",
      "4. Audience — dormant, VIP, everyone, aseh segment? Channel — WhatsApp, email, aseh social?",
    ],
    tamil: [
      "1. இலக்கு — அதிக வாடிக்கையாளர்கள், மெதுவான ஸ்டாக் குறைப்பு, அல்லது அதிக டிக்கெட்?",
      "2. அனுமதிக்கும் **அதிகபட்ச தள்ளுபடி %** என்ன?",
      "3. எந்த தயாரிப்பு/வகை — அல்லது விற்பனை & பட்டியலிலிருந்து நான் தேர்வு செய்யலாமா?",
      "4. பார்வையாளர்கள் — dormant, VIP, அனைவரும், அல்லது segment? சேனல் — WhatsApp, email, அல்லது சமூகம்?",
    ],
  },
  admin: {
    english: [
      "1. Goal — clear open tasks, chase licence renewals, or organise document storage?",
      "2. Timeframe — today, this week, or this month?",
      "3. Focus — tasks, compliance, or documents?",
      "4. Priority — overdue renewals or routine tidy-up?",
    ],
    bahasa_malaysia: [
      "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
      "2. Tempoh — hari ini, minggu ini, atau bulan ini?",
      "3. Fokus — tugas, pematuhan, atau dokumen?",
      "4. Keutamaan — lesen tertunggak atau kemas rutin?",
    ],
    bahasa_kelantan: [
      "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
      "2. Tempoh — hari ni, minggu ni, atau bulan ni?",
      "3. Fokus — tugas, pematuhan, atau dokumen?",
      "4. Keutamaan — lesen tertunggak atau kemas rutin?",
    ],
    bahasa_terengganu: [
      "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
      "2. Tempoh — hari ni, minggu ni, atau bulan ni?",
      "3. Fokus — tugas, pematuhan, atau dokumen?",
      "4. Keutamaan — lesen tertunggak atau kemas rutin?",
    ],
    bahasa_kedah: [
      "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
      "2. Tempoh — hari ni, minggu ni, atau bulan ni?",
      "3. Fokus — tugas, pematuhan, atau dokumen?",
      "4. Keutamaan — lesen tertunggak atau kemas rutin?",
    ],
    bahasa_sabah: [
      "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
      "2. Tempoh — hari ni, minggu ni, atau bulan ni?",
      "3. Fokus — tugas, pematuhan, atau dokumen?",
      "4. Keutamaan — lesen tertunggak atau kemas rutin?",
    ],
    bahasa_sarawak: [
      "1. Matlamat — selesaikan tugas terbuka, kejar pembaharuan lesen, atau susun storan dokumen?",
      "2. Tempoh — hari ni, minggu ni, atau bulan ni?",
      "3. Fokus — tugas, pematuhan, atau dokumen?",
      "4. Keutamaan — lesen tertunggak atau kemas rutin?",
    ],
    mandarin_simplified: [
      "1. 目标 — 清理待办、跟进证照续期，还是整理文件存储？",
      "2. 时间 — 今天、本周还是本月？",
      "3. 重点 — 任务、合规还是文档？",
      "4. 优先级 — 逾期续期还是日常整理？",
    ],
    mandarin_traditional: [
      "1. 目標 — 清理待辦、跟進證照續期，還是整理文件儲存？",
      "2. 時間 — 今天、本週還是本月？",
      "3. 重點 — 任務、合規還是文檔？",
      "4. 優先級 — 逾期續期還是日常整理？",
    ],
    cantonese: [
      "1. 目標 — 清待辦、跟進續牌，定整理文件儲存？",
      "2. 時間 — 今日、本週定本月？",
      "3. 重點 — 任務、合規定文件？",
      "4. 優先 — 逾期續期定日常整理？",
    ],
    hokkien: [
      "1. Goal — clear tasks, chase licence renewals, aseh organise storage?",
      "2. Timeframe — today, this week, aseh this month?",
      "3. Focus — tasks, compliance, aseh documents?",
      "4. Priority — overdue renewals aseh routine tidy-up?",
    ],
    tamil: [
      "1. இலக்கு — திறந்த பணிகள், உரிமம் புதுப்பிப்பு, அல்லது ஆவண சேமிப்பு?",
      "2. காலம் — இன்று, இந்த வாரம், அல்லது இந்த மாதம்?",
      "3. கவனம் — பணிகள், இணக்கம், அல்லது ஆவணங்கள்?",
      "4. முன்னுரிமை — காலாவதியான புதுப்பிப்புகள் அல்லது வழக்கமான சீரமைப்பு?",
    ],
  },
};

function questionsFor(
  pillar: "marketing" | "admin",
  lang: UserLanguage,
): string[] {
  const set = QUESTIONS[pillar][lang] ?? QUESTIONS[pillar].english;
  return set;
}

export function pillarClarifierLines(
  pillar: "marketing" | "admin",
  lang: UserLanguage,
  name: string,
): string[] {
  return [
    roleIntro(pillar, lang, name),
    "",
    `**${HEADER[lang] ?? HEADER.english}:**`,
    "",
    ...questionsFor(pillar, lang),
    "",
    DECIDE[lang] ?? DECIDE.english,
    "",
    FREE_NOTE[lang] ?? FREE_NOTE.english,
  ];
}
