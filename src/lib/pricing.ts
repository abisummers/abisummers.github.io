export interface PricingOption {
  name: string;
  title: string;
  description: string;
  price: number;
  included: number;
  unit: string;
  min: number;
  max: number;
}

export interface Pricing {
  base: number;
  currency: string;
  options: PricingOption[];
}

export function calculateTotalPrice(
  pricing: Pricing,
  quantities: Record<string, number>,
): number {
  const optionsTotal = pricing.options.reduce((total, option) => {
    const quantity = quantities[option.name];

    if (quantity === undefined || quantity === null || isNaN(quantity)) {
      return total;
    }

    const additionalQuantity = Math.max(quantity - option.included, 0);
    return total + additionalQuantity * option.price;
  }, 0);

  return pricing.base + optionsTotal;
}
