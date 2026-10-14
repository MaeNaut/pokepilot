import { describe, expect, it, vi } from "vitest";
import { readBoundedRequestJson, readBoundedRequestText, RequestBodyTooLargeError } from "./requestBody";

function streamRequest(chunks: Uint8Array[], length?: string) {
  const cancel = vi.fn();
  let reads = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      reads += 1;
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    }, cancel,
  }, { highWaterMark: 0 });
  return {
    request: new Request("https://pokepilot.app/api/test", {
      method: "POST", body, duplex: "half",
      headers: length === undefined ? {} : { "Content-Length": length },
    } as RequestInit),
    cancel, reads: () => reads,
  };
}

describe("bounded request body reader", () => {
  it("rejects a declared oversized body without reading it", async () => {
    const { request, cancel, reads } = streamRequest([new Uint8Array(20)], "20");
    await expect(readBoundedRequestText(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(reads()).toBe(0); expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([undefined, "1", "0", "-1", "invalid"])("counts actual streamed bytes regardless of length=%s", async (length) => {
    const { request, cancel, reads } = streamRequest([new Uint8Array(8), new Uint8Array(3), new Uint8Array(1)], length);
    await expect(readBoundedRequestText(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(reads()).toBe(2); expect(cancel).toHaveBeenCalledOnce();
    expect(request.body!.locked).toBe(false);
  });
  it("preserves split UTF-8 and escaped JSON at the exact byte boundary", async () => {
    const value = { name: "가나다😀", escaped: "\u0041" };
    const raw = JSON.stringify(value).replace("가", "\\uac00");
    const bytes = new TextEncoder().encode(raw);
    const { request, cancel } = streamRequest(Array.from(bytes, byte => Uint8Array.of(byte)));
    await expect(readBoundedRequestJson(request, bytes.length)).resolves.toEqual(value);
    expect(cancel).not.toHaveBeenCalled(); expect(request.body!.locked).toBe(false);
  });
  it("counts UTF-8 bytes rather than JavaScript string length", async () => {
    const raw = "가나다";
    const { request } = streamRequest([new TextEncoder().encode(raw)]);
    await expect(readBoundedRequestText(request, raw.length)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
  it("distinguishes invalid JSON and missing bodies from oversized requests", async () => {
    await expect(readBoundedRequestJson(new Request("https://example.com", { method: "POST", body: "{" }), 10)).rejects.toBeInstanceOf(SyntaxError);
    await expect(readBoundedRequestJson(new Request("https://example.com", { method: "POST" }), 10)).rejects.toBeInstanceOf(SyntaxError);
  });
});
