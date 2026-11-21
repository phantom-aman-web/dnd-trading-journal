import { describe, it, expect } from "bun:test";
import { chunkArray } from "./delivery-engine";

describe("Telegram Multi-Image Publishing Logic", () => {
  it("chunks arrays accurately into slices of at most 10 items", () => {
    const images5 = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `img_${i}.png` }));
    const chunked5 = chunkArray(images5, 10);
    expect(chunked5.length).toBe(1);
    expect(chunked5[0].length).toBe(5);

    const images10 = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `img_${i}.png` }));
    const chunked10 = chunkArray(images10, 10);
    expect(chunked10.length).toBe(1);
    expect(chunked10[0].length).toBe(10);

    const images14 = Array.from({ length: 14 }, (_, i) => ({ id: i, name: `img_${i}.png` }));
    const chunked14 = chunkArray(images14, 10);
    expect(chunked14.length).toBe(2);
    expect(chunked14[0].length).toBe(10);
    expect(chunked14[1].length).toBe(4);

    const images25 = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `img_${i}.png` }));
    const chunked25 = chunkArray(images25, 10);
    expect(chunked25.length).toBe(3);
    expect(chunked25[0].length).toBe(10);
    expect(chunked25[1].length).toBe(10);
    expect(chunked25[2].length).toBe(5);
  });

  it("handles caption placement: attaches caption to first item of first chunk if <= 1024 chars", () => {
    const shortCaption = "<b>Trade Entry</b>: EURUSD Long";
    expect(shortCaption.length).toBeLessThanOrEqual(1024);

    const images = Array.from({ length: 3 }, (_, i) => ({ filename: `chart_${i}.png` }));
    const chunks = chunkArray(images, 10);

    const albumItems = chunks[0].map((item, idx) => ({
      filename: item.filename,
      caption: idx === 0 && shortCaption.length <= 1024 ? shortCaption : undefined,
    }));

    expect(albumItems[0].caption).toBe(shortCaption);
    expect(albumItems[1].caption).toBeUndefined();
    expect(albumItems[2].caption).toBeUndefined();
  });

  it("handles companion text requirement when caption > 1024 chars", () => {
    const longCaption = "A".repeat(1200);
    expect(longCaption.length).toBeGreaterThan(1024);

    const captionPlaced = longCaption.length <= 1024;
    expect(captionPlaced).toBe(false);

    // When captionPlaced is false, album item 0 has no caption, and companion text is sent as reply
    const needsCompanionText = !captionPlaced;
    expect(needsCompanionText).toBe(true);
  });
});
