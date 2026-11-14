import { describe, expect, it } from "vitest";
import { centerSquare } from "./staff-photo";

describe("centerSquare", () => {
  it("beskærer liggende billede på midten", () => {
    expect(centerSquare(1600, 900)).toEqual({ sx: 350, sy: 0, side: 900 });
  });
  it("beskærer stående billede på midten", () => {
    expect(centerSquare(900, 1600)).toEqual({ sx: 0, sy: 350, side: 900 });
  });
  it("lader kvadrat være", () => {
    expect(centerSquare(512, 512)).toEqual({ sx: 0, sy: 0, side: 512 });
  });
});
