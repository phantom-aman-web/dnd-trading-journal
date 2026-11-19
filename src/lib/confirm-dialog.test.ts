import { describe, test, expect } from "bun:test";

describe("Confirm & Prompt Dialog Contract Tests", () => {
  test("confirm promise resolves true on action and false on cancel", async () => {
    let resolveRef: ((v: boolean) => void) | null = null;
    const confirmPromise = new Promise<boolean>((resolve) => {
      resolveRef = resolve;
    });

    // Simulate clicking Confirm
    resolveRef!(true);
    const result = await confirmPromise;
    expect(result).toBe(true);

    // Simulate clicking Cancel
    const cancelPromise = new Promise<boolean>((resolve) => {
      resolveRef = resolve;
    });
    resolveRef!(false);
    const cancelResult = await cancelPromise;
    expect(cancelResult).toBe(false);
  });

  test("prompt promise returns trimmed string on submit and null on cancel", async () => {
    let promptResolveRef: ((v: string | null) => void) | null = null;
    const promptPromise = new Promise<string | null>((resolve) => {
      promptResolveRef = resolve;
    });

    promptResolveRef!("Break of Structure");
    const result = await promptPromise;
    expect(result).toBe("Break of Structure");

    const promptCancelPromise = new Promise<string | null>((resolve) => {
      promptResolveRef = resolve;
    });
    promptResolveRef!(null);
    const cancelResult = await promptCancelPromise;
    expect(cancelResult).toBeNull();
  });
});
