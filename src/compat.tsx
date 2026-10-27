// Standalone replacements for the two @hatch/space-sdk helpers the frontend
// used, so the app builds outside the Muse hosted runtime.
// fileToBase64: same behaviour as the SDK helper — awaited, returns the
// raw base64 payload (without the data: prefix) AND the file's MIME
// type. Every caller (seller documents, profile media, chat
// attachments, deposit screenshots, header logo) reads
// { dataBase64, mimeType }; returning a bare string here silently
// broke ALL uploads (enc.dataBase64 was undefined, so every upload
// threw before it ever reached the server).
// PdfViewer: simplified viewer - the PDF renders in the browser's native PDF
// viewer (which has its own page navigation) instead of the SDK's custom
// paginated viewer. Props kept compatible with the old call sites.
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
  svg: "image/svg+xml", heic: "image/heic", heif: "image/heif",
};
export function fileToBase64(file: File): Promise<{ dataBase64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      const dataBase64 = comma >= 0 ? result.slice(comma + 1) : result;
      // The data: URL header carries the MIME type when the browser
      // knows it (data:<mime>;base64,<payload>).
      let mimeType = "";
      if (comma > 0 && result.startsWith("data:")) {
        const semi = result.indexOf(";");
        if (semi > 5) mimeType = result.slice(5, semi);
      }
      // Some mobile pickers report an empty type: fall back to the
      // file extension so a perfectly good JPG/PNG is not rejected.
      if (!mimeType) mimeType = file.type || "";
      if (!mimeType) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        mimeType = EXT_MIME[ext] ?? "";
      }
      resolve({ dataBase64, mimeType });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type PdfLabels = {
  loading?: string;
  loadError?: string;
  pageError?: string;
  previousPage?: string;
  nextPage?: string;
  pageIndicator?: (pg: number, tot: number) => string;
  navigationAriaLabel?: string;
  pageAriaLabel?: (pg: number) => string;
};

export function PdfViewer({ src, ariaLabel }: { src: string; ariaLabel?: string; labels?: PdfLabels }) {
  return (
    <iframe
      src={src}
      title={ariaLabel ?? "PDF"}
      aria-label={ariaLabel ?? "PDF"}
      style={{ width: "100%", height: "70vh", border: "none" }}
    />
  );
}
