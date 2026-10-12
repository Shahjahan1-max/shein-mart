import { apiUrl } from "./apiClient";

export function normalizeExternalImageUrl(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";

  if (/^\/api\//i.test(raw)) return apiUrl(raw);
  if (/^api\//i.test(raw)) return apiUrl(`/${raw}`);

  try {
    const url = new URL(raw);
    if (url.pathname.startsWith("/api/public-assets/")) {
      return apiUrl(`${url.pathname}${url.search}`);
    }
    const host = url.hostname.toLowerCase();
    const isDrive = host === "drive.google.com" || host.endsWith(".drive.google.com");
    if (!isDrive) return raw;

    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    const id = fileMatch?.[1] || url.searchParams.get("id");
    if (!id) return raw;
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`;
  } catch {
    return raw;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve((event.target?.result as string) || "");
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to process image file."));
    image.src = src;
  });
}

export async function fileToSettingsImageDataUrl(file: File): Promise<string> {
  const raw = await readFileAsDataUrl(file);
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    if (raw.length > 900_000) {
      throw new Error("Image is too large to save directly. Please use an image under 700 KB or configure Firebase Storage.");
    }
    return raw;
  }

  const image = await loadImage(raw);
  const maxDimension = 900;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to prepare image preview.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length > 900_000) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  }
  if (dataUrl.length > 900_000) {
    throw new Error("Image is too large to save directly. Please use a smaller QR image or configure Firebase Storage.");
  }
  return dataUrl;
}
