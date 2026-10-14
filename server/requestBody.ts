export class RequestBodyTooLargeError extends RangeError {
  constructor() {
    super("PAYLOAD_TOO_LARGE");
  }
}

export async function readBoundedRequestText(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw new RequestBodyTooLargeError();
  }
  const reader = request.body?.getReader();
  if (!reader) return "";
  let bytes = new Uint8Array(Math.min(maxBytes, 8_192));
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      if (total > bytes.length) {
        const expanded = new Uint8Array(Math.min(maxBytes, Math.max(total, bytes.length * 2)));
        expanded.set(bytes);
        bytes = expanded;
      }
      bytes.set(value, total - value.byteLength);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(bytes.subarray(0, total));
}

export async function readBoundedRequestJson(request: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readBoundedRequestText(request, maxBytes));
}
