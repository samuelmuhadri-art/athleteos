import { afterEach, expect, it, vi } from "vitest";
import { withAuthTimeout } from "./authTimeout";
afterEach(() => vi.useRealTimers());
it("rend une réponse et nettoie le délai", async () => {
  vi.useFakeTimers();
  await expect(withAuthTimeout(Promise.resolve(42), "timeout")).resolves.toBe(42);
  expect(vi.getTimerCount()).toBe(0);
});
it("rend la main sans prétendre annuler la création distante", async () => {
  vi.useFakeTimers();
  const assertion = expect(withAuthTimeout(new Promise(() => {}), "Compte peut-être créé", 20)).rejects.toThrow("Compte peut-être créé");
  await vi.advanceTimersByTimeAsync(20); await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
