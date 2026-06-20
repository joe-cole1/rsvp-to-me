import { type NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { getSession } from "@/lib/session";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

function detectImageBuffer(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 4) return null;

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: ".jpg", mime: "image/jpeg" };
  }

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: ".png", mime: "image/png" };
  }

  // GIF
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { ext: ".gif", mime: "image/gif" };
  }

  // WEBP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50    // P
  ) {
    return { ext: ".webp", mime: "image/webp" };
  }

  return null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImageBuffer(buffer);

  if (!detected) {
    return NextResponse.json({ error: "Images only" }, { status: 400 });
  }

  const filename = `${randomUUID()}${detected.ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return NextResponse.json({ url: `/api/uploads/${filename}` });
}
