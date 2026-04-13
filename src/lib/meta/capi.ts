import { createHash } from "crypto";

interface CAPIEventData {
  event_name: string;
  event_id: string;
  event_time: number;
  event_source_url: string;
  user_data: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string | null;
    fbp?: string | null;
  };
  custom_data?: Record<string, unknown>;
}

function hashValue(value: string): string {
  return createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}

export async function sendCAPIEvent(data: CAPIEventData): Promise<{
  success: boolean;
  response?: Record<string, unknown>;
  error?: string;
}> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    return { success: false, error: "Missing PIXEL_ID or CAPI_ACCESS_TOKEN" };
  }

  const userData: Record<string, unknown> = {
    country: ["br"],
  };

  if (data.user_data.email) {
    userData.em = [hashValue(data.user_data.email)];
  }
  if (data.user_data.phone) {
    const cleanPhone = data.user_data.phone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    userData.ph = [hashValue(phoneWithCountry)];
  }
  if (data.user_data.first_name) {
    userData.fn = [hashValue(data.user_data.first_name)];
  }
  if (data.user_data.last_name) {
    userData.ln = [hashValue(data.user_data.last_name)];
  }
  if (data.user_data.city) {
    userData.ct = [hashValue(data.user_data.city)];
  }
  if (data.user_data.state) {
    userData.st = [hashValue(data.user_data.state.toLowerCase())];
  }
  if (data.user_data.client_ip_address) {
    userData.client_ip_address = data.user_data.client_ip_address;
  }
  if (data.user_data.client_user_agent) {
    userData.client_user_agent = data.user_data.client_user_agent;
  }
  if (data.user_data.fbc) {
    userData.fbc = data.user_data.fbc;
  }
  if (data.user_data.fbp) {
    userData.fbp = data.user_data.fbp;
  }

  const payload = {
    data: [
      {
        event_name: data.event_name,
        event_time: data.event_time,
        event_id: data.event_id,
        event_source_url: data.event_source_url,
        action_source: "website",
        user_data: userData,
        custom_data: data.custom_data || {},
      },
    ],
    access_token: accessToken,
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    return { success: response.ok, response: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
