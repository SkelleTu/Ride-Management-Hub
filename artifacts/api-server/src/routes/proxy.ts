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
    const results = (raw.features ?? []).map((f: any) => {
      const p = f.properties;
      // Build street line: "Rua X, 123" or just "Rua X"
      const streetPart = p.street
        ? (p.housenumber ? `${p.street}, ${p.housenumber}` : p.street)
        : null;
      // Main name (place/POI) — skip if same as street
      const namePart = p.name && p.name !== p.street ? p.name : null;
      const display_name = [namePart, streetPart, p.district, p.city, p.state]
        .filter(Boolean).join(", ");
      return {
        display_name,
        postcode: p.postcode ?? null,
        lat: String(f.geometry.coordinates[1]),
        lon: String(f.geometry.coordinates[0]),
      };
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
