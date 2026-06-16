import { createUploadthing } from "uploadthing/next";
import type { FileRouter } from "uploadthing/next";
import { getSession } from "@/lib/session";

const f = createUploadthing();

export const ourFileRouter = {
  coverImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getSession();
      if (!session) throw new Error("Unauthorized");
      return { userId: session.userId };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
