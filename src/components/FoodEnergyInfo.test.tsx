// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodEnergyInfo } from "./FoodEnergyInfo";

describe("food energy equivalents", () => {
  it("converts calories using visible portion assumptions", () => {
    const { getByText, queryByText } = render(<FoodEnergyInfo kcal={1100} />);
    expect(getByText("1,100 kcal is roughly equivalent to:")).toBeTruthy();
    expect(getByText("10 bananas")).toBeTruthy();
    expect(getByText("5 power bars")).toBeTruthy();
    expect(getByText("1.1 whole pizzas")).toBeTruthy();
    expect(getByText("2.6 liters of beer")).toBeTruthy();
    expect(getByText("Using 105 kcal per medium banana")).toBeTruthy();
    expect(queryByText(/Portion sizes, recipes and products vary/)).toBeNull();
  });

  it("shows plain cooked pasta in grams, switching to kilograms at 1000 g", () => {
    const { getByText, rerender } = render(<FoodEnergyInfo kcal={150} />);
    expect(getByText("100 g of cooked pasta")).toBeTruthy();
    expect(getByText("Using 150 kcal per 100 g of plain cooked pasta")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={1499} />);
    expect(getByText("999 g of cooked pasta")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={1500} />);
    expect(getByText("1 kg of cooked pasta")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={1800} />);
    expect(getByText("1.2 kg of cooked pasta")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={9000} />);
    expect(getByText("6 kg of cooked pasta")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={0} />);
    expect(getByText("0 g of cooked pasta")).toBeTruthy();
  });

  it("uses US spelling for singular beer quantities and portion assumptions", () => {
    const { getByText, queryByText } = render(<FoodEnergyInfo kcal={430} />);
    expect(getByText("1 liter of beer")).toBeTruthy();
    expect(getByText("Using 430 kcal per liter of regular lager")).toBeTruthy();
    expect(queryByText(/litres?/)).toBeNull();
  });

  it("rounds quantities over five to whole numbers, keeping smaller quantities precise", () => {
    const { getByText, rerender } = render(<FoodEnergyInfo kcal={504} />);
    expect(getByText("4.8 bananas")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={525} />);
    expect(getByText("5 bananas")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={567} />);
    expect(getByText("5 bananas")).toBeTruthy();
    expect(getByText("2.6 power bars")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={588} />);
    expect(getByText("6 bananas")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={5670} />);
    expect(getByText("54 bananas")).toBeTruthy();
    expect(getByText("26 power bars")).toBeTruthy();
    expect(getByText("6 whole pizzas")).toBeTruthy();
    expect(getByText("13 liters of beer")).toBeTruthy();
  });

  it("updates live and does not round tiny positive amounts down to zero", () => {
    const { getByText, rerender } = render(<FoodEnergyInfo kcal={105} />);
    expect(getByText("1 banana")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={10} />);
    expect(getByText("<0.1 bananas")).toBeTruthy();
    rerender(<FoodEnergyInfo kcal={0} />);
    expect(getByText("0 bananas")).toBeTruthy();
  });
});
