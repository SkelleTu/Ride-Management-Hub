import { Router } from "express";

const router = Router();

router.get("/geocode", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") return res.status(400).json({ error: "q required" });
  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      countrycodes: "BR",
      limit: "7",
      addressdetails: "1",
    });
    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "UPcar/1.0 (contato@upcar.com.br)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(502).json({ error: "geocode failed" });
    const raw = await r.json() as any[];

    const results = raw.map((item: any) => {
      const addr = item.address ?? {};
      const street = addr.road ?? addr.pedestrian ?? addr.footway ?? null;
      const number = addr.house_number ?? null;
      const neighbourhood = addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? null;
      const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;
      const state = addr.state ?? null;
      const postcode = addr.postcode
        ? addr.postcode.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2")
        : null;

      const parts: string[] = [];
      if (street) parts.push(number ? `${street}, ${number}` : street);
      if (neighbourhood) parts.push(neighbourhood);
      if (city) parts.push(city);
      if (state) parts.push(state);
      const display_name = parts.length > 0 ? parts.join(", ") : item.display_name;

      return { display_name, postcode, lat: item.lat, lon: item.lon };
    });

    res.json(results);
  } catch (e) {
    res.status(502).json({ error: "geocode failed" });
  }
});

router.get("/route", async (req, res) => {
  const { olng, olat, dlng, dlat } = req.query;
  if (!olng || !olat || !dlng || !dlat) return res.status(400).json({ error: "coords required" });
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${olng},${olat};${dlng},${dlat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: "route failed" });
  }
});

export default router;
