"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useBondingCurve = void 0;
const react_1 = require("react");
const useBondingCurve = ({ slope, exponent, basePrice, currentSupply, }) => {
    const estimateBuyCost = (0, react_1.useMemo)(() => (quantity) => {
        let total = 0;
        for (let i = 0; i < quantity; i += 1) {
            const supply = currentSupply + i;
            total += slope * supply ** exponent + basePrice;
        }
        return total;
    }, [basePrice, currentSupply, exponent, slope]);
    return { estimateBuyCost };
};
exports.useBondingCurve = useBondingCurve;
