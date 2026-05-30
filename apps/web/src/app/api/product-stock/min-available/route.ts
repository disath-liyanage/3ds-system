import { NextResponse } from "next/server";

import { getProductMinAvailableByPrice } from "@/app/actions/product-stock";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await getProductMinAvailableByPrice();
    return NextResponse.json({ products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load product stock";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 500 });
  }
}
