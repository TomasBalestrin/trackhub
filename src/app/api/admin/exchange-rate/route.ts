import { NextResponse } from "next/server";
import { getUSDtoBRL } from "@/lib/currency";

export async function GET() {
  const rate = await getUSDtoBRL();
  return NextResponse.json({ rate, currency: "BRL", base: "USD" });
}
