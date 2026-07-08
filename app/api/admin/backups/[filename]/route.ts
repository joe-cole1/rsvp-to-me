import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth-guards";

export async function GET(request: Request, props: { params: Promise<{ filename: string }> }) {
  try {
    await assertAdmin();
  } catch {
    return new NextResponse("Forbidden: Administrator access required", {
      status: 403,
    });
  }

  const { filename } = await props.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(process.cwd(), "data", "backups", safeFilename);

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Backup file not found", { status: 404 });
  }

  const fileStream = fs.createReadStream(filePath);
  const stats = fs.statSync(filePath);

  // Convert Node.js ReadStream to Web ReadableStream for standard Response usage
  const webStream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      fileStream.destroy();
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Content-Length": stats.size.toString(),
    },
  });
}
