// The range line under a day tile's sparkline in assets/js/day-tile.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sparkRange } from "../assets/js/day-tile.js";

test("sparkRange: run count and lowest to highest value; nothing for one run", () => {
  assert.equal(sparkRange([0.29, 0.26, 0.16, 0.19]), "4 runs, 16%–29%");
  assert.equal(sparkRange([0.5, 0.5]), "2 runs, 50%–50%");
  assert.equal(sparkRange([0.5]), null);
  assert.equal(sparkRange([]), null);
});
