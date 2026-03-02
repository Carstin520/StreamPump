import { useMemo } from "react";

interface BondingCurveParams {
  slope: number;
  exponent: number;
  basePrice: number;
  currentSupply: number;
}

export const useBondingCurve = ({
  slope,
  exponent,
  basePrice,
  currentSupply,
}: BondingCurveParams) => {
  const estimateBuyCost = useMemo(
    () => (quantity: number) => {
      let total = 0;
      for (let i = 0; i < quantity; i += 1) {
        const supply = currentSupply + i;
        total += slope * supply ** exponent + basePrice;
      }
      return total;
    },
    [basePrice, currentSupply, exponent, slope]
  );

  return { estimateBuyCost };
};
