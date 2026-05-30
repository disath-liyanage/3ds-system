import { NextResponse } from "next/server";

import { getProductStockByPrice } from "@/app/actions/product-stock";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") || "";

  try {
    const rows = await getProductStockByPrice(productId);
    return NextResponse.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load product stock";
    return NextResponse.json({ error: message }, { status: message === "Authentication required" ? 401 : 500 });
  }
}
