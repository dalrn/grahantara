// Modul bantu klien LLM (DeepSeek). Nama berawalan garis bawah agar Vercel
// tidak memperlakukannya sebagai endpoint. BELUM dipakai siapa pun.
// Kunci hanya dibaca dari environment di sisi server; tidak pernah dikirim
// ke browser dan tidak pernah dikembalikan ke klien.

export async function panggilDeepseek({ sistem, pengguna, maxTokens = 800 }) {
  const kunci = process.env.DEEPSEEK_API_KEY;
  if (!kunci) {
    throw new Error("DEEPSEEK_API_KEY tidak diset");
  }

  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: sistem },
      { role: "user", content: pengguna },
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
  };

  const pengendali = new AbortController();
  const waktu = setTimeout(() => pengendali.abort(), 20000);
  let respon;
  try {
    respon = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kunci}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: pengendali.signal,
    });
  } catch (e) {
    throw new Error(`panggilan DeepSeek gagal: ${e.name === "AbortError" ? "timeout 20 dtk" : e.message}`);
  } finally {
    clearTimeout(waktu);
  }

  const teks = await respon.text();
  if (!respon.ok) {
    // sensor: jangan sampai nilai kunci bocor lewat pesan galat
    const aman = teks.replace(kunci, "[KUNCI DISENSOR]");
    throw new Error(`DeepSeek HTTP ${respon.status}: ${aman}`);
  }
  const data = JSON.parse(teks);
  const isi = data?.choices?.[0]?.message?.content;
  if (typeof isi !== "string") {
    throw new Error("DeepSeek: struktur respons tak dikenal (choices kosong)");
  }
  return isi;
}

export function parseJsonLonggar(teks) {
  if (typeof teks !== "string") return null;
  let t = teks.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const awal = t.indexOf("{");
  const akhir = t.lastIndexOf("}");
  if (awal === -1 || akhir === -1 || akhir <= awal) return null;
  t = t.slice(awal, akhir + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
