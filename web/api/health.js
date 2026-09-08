export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ galat: "metode tidak didukung" });
    return;
  }
  const kunci = process.env.DEEPSEEK_API_KEY;
  res.status(200).json({
    status: "ok",
    waktu: new Date().toISOString(),
    runtime: process.version,
    kunciDeepseekTerbaca: Boolean(kunci),
    panjangKunci: kunci ? kunci.length : 0,
  });
}
