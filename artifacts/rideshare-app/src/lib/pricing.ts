// ── Regras de preço da UPcar ────────────────────────────────────────────────
// Toda estimativa de preço (passageiro e motorista) segue a mesma regra de
// arredondamento: o valor calculado (km rodado × preço por km, + tarifa base
// quando houver) é sempre arredondado para o múltiplo de R$5 mais próximo.
//
// Exemplos: R$17 → R$15 · R$18 → R$20 · R$26 → R$25

export const ROUND_STEP = 5;

/** Arredonda um valor para o múltiplo de R$5 mais próximo (mínimo R$5). */
export function roundToNearestStep(value: number, step: number = ROUND_STEP): number {
  if (!Number.isFinite(value) || value <= 0) return step;
  return Math.max(step, Math.round(value / step) * step);
}

// Preço por km usado na estimativa mostrada ao passageiro ao montar a corrida.
export const PASSENGER_PRICE_PER_KM = 2;

// Preço por km + tarifa base usados na sugestão de oferta do motorista
// (considera também o deslocamento até o ponto de embarque).
export const DRIVER_PRICE_PER_KM = 2.5;
export const DRIVER_BASE_FARE = 3.0;

export interface PriceBreakdown {
  distanceKm: number;
  pricePerKm: number;
  baseFare: number;
  /** Valor exato calculado, antes de arredondar. */
  rawPrice: number;
  /** Valor final mostrado ao usuário, arredondado para múltiplo de R$5. */
  roundedPrice: number;
}

export function estimatePassengerPrice(distanceKm: number): PriceBreakdown {
  const rawPrice = distanceKm * PASSENGER_PRICE_PER_KM;
  return {
    distanceKm,
    pricePerKm: PASSENGER_PRICE_PER_KM,
    baseFare: 0,
    rawPrice,
    roundedPrice: roundToNearestStep(rawPrice),
  };
}

export function estimateDriverPrice(distanceKm: number): PriceBreakdown {
  const rawPrice = DRIVER_BASE_FARE + distanceKm * DRIVER_PRICE_PER_KM;
  return {
    distanceKm,
    pricePerKm: DRIVER_PRICE_PER_KM,
    baseFare: DRIVER_BASE_FARE,
    rawPrice,
    roundedPrice: roundToNearestStep(rawPrice),
  };
}

export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}
