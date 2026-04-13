import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { sendCAPIEvent } from "./capi";

const sha = (v: string) => createHash("sha256").update(v.toLowerCase().trim()).digest("hex");

const baseEvent = {
  event_name: "Lead",
  event_id: "evt-123",
  event_time: 1_700_000_000,
  event_source_url: "https://example.com",
};

describe("sendCAPIEvent", () => {
  const realEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "PIXEL_TEST";
    process.env.META_CAPI_ACCESS_TOKEN = "TOKEN_TEST";
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ events_received: 1 }),
    } as unknown as Response));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env = { ...realEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns failure when PIXEL_ID is missing", async () => {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    const r = await sendCAPIEvent({ ...baseEvent, user_data: {} });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/PIXEL_ID|CAPI_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns failure when CAPI_ACCESS_TOKEN is missing", async () => {
    delete process.env.META_CAPI_ACCESS_TOKEN;
    const r = await sendCAPIEvent({ ...baseEvent, user_data: {} });
    expect(r.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to v21.0 events endpoint with correct pixel id", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: { email: "a@b.com" } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/PIXEL_TEST/events");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("hashes email with sha256(lowercase + trim)", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: { email: "  Foo@Bar.COM  " } });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.em).toEqual([sha("Foo@Bar.COM")]);
  });

  it("prefixes phone with 55 when not already present, then hashes", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: { phone: "(11) 91234-5678" } });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.ph).toEqual([sha("5511912345678")]);
  });

  it("does not double-prefix phones already starting with 55", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: { phone: "5511912345678" } });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.ph).toEqual([sha("5511912345678")]);
  });

  it("hashes name fields", async () => {
    await sendCAPIEvent({
      ...baseEvent,
      user_data: { first_name: "João", last_name: "Silva" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.fn).toEqual([sha("João")]);
    expect(body.data[0].user_data.ln).toEqual([sha("Silva")]);
  });

  it("passes fbc/fbp through unhashed (Meta requires raw)", async () => {
    await sendCAPIEvent({
      ...baseEvent,
      user_data: { fbc: "fb.1.123.abc", fbp: "fb.1.456.def" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.fbc).toBe("fb.1.123.abc");
    expect(body.data[0].user_data.fbp).toBe("fb.1.456.def");
  });

  it("passes IP and user agent unhashed", async () => {
    await sendCAPIEvent({
      ...baseEvent,
      user_data: { client_ip_address: "1.2.3.4", client_user_agent: "Mozilla/5.0" },
    });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.client_ip_address).toBe("1.2.3.4");
    expect(body.data[0].user_data.client_user_agent).toBe("Mozilla/5.0");
  });

  it("includes country=['br'] always", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: {} });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.data[0].user_data.country).toEqual(["br"]);
  });

  it("propagates event_id, event_name, event_time, event_source_url", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: {} });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const e = body.data[0];
    expect(e.event_id).toBe("evt-123");
    expect(e.event_name).toBe("Lead");
    expect(e.event_time).toBe(1_700_000_000);
    expect(e.event_source_url).toBe("https://example.com");
    expect(e.action_source).toBe("website");
  });

  it("includes access_token at envelope level", async () => {
    await sendCAPIEvent({ ...baseEvent, user_data: {} });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.access_token).toBe("TOKEN_TEST");
  });

  it("returns success=false when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    const r = await sendCAPIEvent({ ...baseEvent, user_data: {} });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/network down/);
  });
});
