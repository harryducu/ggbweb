import { NextResponse } from "next/server";
import { blobToken } from "@/lib/storage";

/**
 * Streams an image out of a private Blob store.
 *
 * A private blob's own URL can't be fetched by a browser, so team logos and
 * player photos are linked here instead. There is deliberately no auth: these
 * are a public league's crests and headshots, and they appear on pages anyone
 * can read. Only the uploads prefix is reachable, so the league document itself
 * can't be pulled through this route.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const pathname = path.map(decodeURIComponent).join("/");

  if (!pathname.startsWith("uploads/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const { get } = await import("@vercel/blob");
    const token = blobToken();
    const result = await get(pathname, {
      access: "private",
      ...(token ? { token } : {}),
    } as never);

    if (!result || result.statusCode !== 200 || !result.stream) {
      return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        // Filenames are content-addressed on upload, so a given path never
        // changes and can be cached hard.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
