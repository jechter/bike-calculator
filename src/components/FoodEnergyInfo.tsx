const PORTIONS = [
  { emoji: "🍌", label: "bananas", singular: "banana", kcal: 105, portion: "medium banana" },
  { emoji: "🍫", label: "power bars", singular: "power bar", kcal: 220, portion: "energy bar (~60 g)" },
  { emoji: "🍕", label: "whole pizzas", singular: "whole pizza", kcal: 1000, portion: "margherita pizza (~30 cm)" },
  { emoji: "🍺", label: "litres of beer", singular: "litre of beer", kcal: 430, portion: "litre of regular lager" },
] as const;

/** Illustrative energy equivalents, not a recommendation for how to fuel a ride. */
export function FoodEnergyInfo({ kcal }: { kcal: number }) {
  const energy = Math.max(0, Math.round(kcal));
  const quantity = (calories: number) => {
    const n = energy / calories;
    return n > 0 && n < 0.1 ? "<0.1" : n.toLocaleString("en", { maximumFractionDigits: n > 5 ? 0 : 1 });
  };
  return (
    <div className="food-energy-info">
      <strong>{energy.toLocaleString("en")} kcal is roughly equivalent to:</strong>
      <ul className="food-energy-equivalents">
        {PORTIONS.map(p => (
          <li key={p.label}>
            <span aria-hidden="true">{p.emoji}</span>
            <div><span className="food-energy-quantity">{quantity(p.kcal)} {quantity(p.kcal) === "1" ? p.singular : p.label}</span>
              <small>Using {p.kcal} kcal per {p.portion}</small>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
