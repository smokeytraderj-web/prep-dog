const SOURCE_URL = "https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx";
export default async function handler(req, res) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ error: "Method not allowed" }); }
  try {
    const upstream = await fetch(SOURCE_URL, { headers: { "User-Agent": "Prep-Dog/1.0" } });
    if (!upstream.ok) return res.status(502).json({ error: "Benchmark provider unavailable", providerStatus: upstream.status });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Cache-Control", "s-maxage=21600, stale-while-revalidate=86400");
    res.setHeader("X-Benchmark-Source", "State Street SPY daily holdings");
    return res.status(200).send(body);
  } catch (error) { return res.status(502).json({ error: "Benchmark provider unavailable", detail: error.message }); }
}
