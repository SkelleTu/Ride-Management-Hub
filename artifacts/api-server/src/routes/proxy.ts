import { Router } from "express";

const router = Router();

router.get("/geocode", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") return res.status(400).json({ error: "q required" });
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=br`;
    const r = await fetch(url, { headers: { "User-Agent": "UPcar/1.0" } });
    const data = await r.json();
    res.json(data);
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
