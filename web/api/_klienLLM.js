import https from "node:https";

// Modul bantu klien LLM (DeepSeek). Nama berawalan garis bawah agar Vercel
// tidak memperlakukannya sebagai endpoint. Dipakai oleh parse-preference.js,
// explain-score.js, dan compare.js.
// Kunci hanya dibaca dari environment di sisi server; tidak pernah dikirim
// ke browser dan tidak pernah dikembalikan ke klien.
//
// Catatan: memakai node:https alih-alih fetch global karena fetch dalam
// runtime Vercel Node menambahkan header Expect: 100-continue yang ditolak
// undici bawaan @vercel/node (NotSupportedError: expect header not supported).

function mintaHttps(body, kunci, pengendali) {
  return new Promise((selesai, gagal) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kunci}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (respon) => {
        const potongan = [];
        respon.on("data", (c) => potongan.push(c));
        respon.on("end", () => selesai({ status: respon.statusCode, teks: Buffer.concat(potongan).toString("utf-8") }));
      },
    );
    req.on("error", (e) => {
      gagal(new Error(e.name === "AbortError" ? "timeout 20 dtk" : e.message));
    });
    pengendali.signal.addEventListener("abort", () => req.destroy(new Error("AbortError")), { once: true });
    req.write(payload);
    req.end();
  });
}

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
    respon = await mintaHttps(body, kunci, pengendali);
  } catch (e) {
    throw new Error(`panggilan DeepSeek gagal: ${e.message}`);
  } finally {
    clearTimeout(waktu);
  }

  if (respon.status < 200 || respon.status >= 300) {
    // sensor: jangan sampai nilai kunci bocor lewat pesan galat
    const aman = respon.teks.replace(kunci, "[KUNCI DISENSOR]");
    throw new Error(`DeepSeek HTTP ${respon.status}: ${aman}`);
  }
  const data = JSON.parse(respon.teks);
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
