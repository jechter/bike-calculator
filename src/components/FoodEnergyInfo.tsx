const PORTIONS = [
  { emoji: "🍌", label: "bananas", singular: "banana", kcal: 105, portion: "medium banana" },
  { emoji: "🍫", label: "power bars", singular: "power bar", kcal: 220, portion: "energy bar (~60 g)" },
  { emoji: "🍝", label: "cooked pasta", singular: "cooked pasta", kcal: 150, portion: "100 g of plain cooked pasta", grams: 100 },
  { emoji: "🍕", label: "whole pizzas", singular: "whole pizza", kcal: 1000, portion: "margherita pizza (~30 cm)" },
  { emoji: "🍺", label: "liters of beer", singular: "liter of beer", kcal: 430, portion: "liter of regular lager" },
] as const;

/** Illustrative energy equivalents, not a recommendation for how to fuel a ride. */
export function FoodEnergyInfo({ kcal }: { kcal: number }) {
  const energy = Math.max(0, Math.round(kcal));
  const quantity = (n: number) => {
    return n > 0 && n < 0.1 ? "<0.1" : n.toLocaleString("en", { maximumFractionDigits: n > 5 ? 0 : 1 });
  };
  return (
    <div className="food-energy-info">
      <strong>{energy.toLocaleString("en")} kcal is roughly equivalent to:</strong>
      <ul className="food-energy-equivalents">
        {PORTIONS.map(p => {
          let amount = energy / p.kcal;
          let label: string = p.label;
          if ("grams" in p) {
            const grams = amount * p.grams;
            const useKg = grams >= 1000;
            amount = useKg ? grams / 1000 : grams;
            label = `${useKg ? "kg" : "g"} of ${p.label}`;
          } else if (quantity(amount) === "1") {
            label = p.singular;
          }
          return (
            <li key={p.label}>
              <span aria-hidden="true">{p.emoji}</span>
              <div><span className="food-energy-quantity">{quantity(amount)} {label}</span>
                <small>Using {p.kcal} kcal per {p.portion}</small>
              </div>
            </li>
          );
        })}
      </ul>
      <small>Not nutrition advice</small>
    </div>
  );
}
