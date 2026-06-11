import { Router } from "express";

const router = Router();

router.get("/geocode", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") return res.status(400).json({ error: "q required" });
  try {
    // Photon (Komoot) — OSM-based, no rate limit, no API key needed
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=default&limit=5`;
    const r = await fetch(url, { headers: { "User-Agent": "UPcar/1.0" } });
    const raw = await r.json() as { features?: any[] };
    // Normalize to the shape the frontend expects (same as Nominatim)
    const results = (raw.features ?? []).map((f: any) => ({
      display_name: [
        f.properties.name,
        f.properties.street,
        f.properties.city,
        f.properties.state,
        "Brasil",
      ].filter(Boolean).join(", "),
      lat: String(f.geometry.coordinates[1]),
      lon: String(f.geometry.coordinates[0]),
    }));
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
