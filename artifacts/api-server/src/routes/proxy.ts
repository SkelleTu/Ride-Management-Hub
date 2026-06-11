import { Router } from "express";

const router = Router();

const STATE_TO_UF: Record<string, string> = {
  "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM",
  "Bahia": "BA", "Ceará": "CE", "Espírito Santo": "ES", "Goiás": "GO",
  "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR",
  "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO",
  "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP",
  "Sergipe": "SE", "Tocantins": "TO", "Distrito Federal": "DF",
};

async function lookupViaCEP(street: string, city: string, stateName: string): Promise<string | null> {
  const uf = STATE_TO_UF[stateName];
  if (!uf || !street || !city) return null;
  try {
    const url = `https://viacep.com.br/ws/${uf}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`;
    const r = await fetch(url, {
      headers: { "User-Agent": "UPcar/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const data = await r.json() as any;
    if (Array.isArray(data) && data.length > 0 && data[0].cep) return data[0].cep as string;
    return null;
  } catch {
    return null;
  }
}

router.get("/geocode", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string") return res.status(400).json({ error: "q required" });
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=default&limit=5`;
    const r = await fetch(url, { headers: { "User-Agent": "UPcar/1.0" } });
    const raw = await r.json() as { features?: any[] };
    const features = raw.features ?? [];

    // Map Photon results then enrich Brazilian ones with ViaCEP
    const mapped = features.map((f: any) => {
      const p = f.properties;
      const streetPart = p.street
        ? (p.housenumber ? `${p.street}, ${p.housenumber}` : p.street)
        : null;
      const namePart = p.name && p.name !== p.street ? p.name : null;
      const display_name = [namePart, streetPart, p.district, p.city, p.state]
        .filter(Boolean).join(", ");
      return {
        display_name,
        postcode: (p.postcode as string | undefined) ?? null,
        lat: String(f.geometry.coordinates[1]),
        lon: String(f.geometry.coordinates[0]),
        _street: p.street as string | undefined,
        _city: p.city as string | undefined,
        _state: p.state as string | undefined,
        _country: p.countrycode as string | undefined,
      };
    });

    // ViaCEP enrichment — parallel, only for Brazilian results missing a postcode
    const enriched = await Promise.all(
      mapped.map(async (item) => {
        if (item._country === "BR" && item._street && item._city && item._state) {
          const viacep = await lookupViaCEP(item._street, item._city, item._state);
          if (viacep) item.postcode = viacep;
        }
        const { _street, _city, _state, _country, ...clean } = item;
        return clean;
      })
    );

    res.json(enriched);
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
