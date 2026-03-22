import { put, del } from "@vercel/blob";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export async function uploadImage(
  stream: ReadableStream<Uint8Array> | Blob,
  hint: string,
  contentType: string
): Promise<string> {
  const ext = EXT_BY_TYPE[contentType] ?? ".bin";
  const blobName = `post-${hint}-${crypto.randomUUID().replace(/-/g, "")}${ext}`;
  const blob = await put(blobName, stream, {
    access: "public",
    contentType,
  });
  return blob.url;
}

export async function deleteBlobByUrl(url: string): Promise<void> {
  await del(url);
}
