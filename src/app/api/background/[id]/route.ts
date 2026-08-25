import { NextRequest, NextResponse } from "next/server";

const BACKGROUNDS = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2200&q=88",
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2200&q=88",
];

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const numericId = Number.parseInt(id, 10);

  if (!Number.isInteger(numericId) || numericId < 0 || numericId >= BACKGROUNDS.length) {
    return NextResponse.json({ error: "Imagem inválida." }, { status: 404 });
  }

  const response = await fetch(BACKGROUNDS[numericId], {
    headers: {
      Accept: "image/avif,image/webp,image/jpeg,image/*,*/*;q=0.8",
    },
    next: { revalidate: 86400 },
  });

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Imagem temporariamente indisponível." }, { status: 502 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "CDN-Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
      "Vercel-CDN-Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000",
    },
  });
}
