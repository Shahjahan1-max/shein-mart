// Standalone replacements for the two @hatch/space-sdk helpers the frontend
// used, so the app builds outside the Muse hosted runtime.
// fileToBase64: same behaviour as the SDK helper (awaited, returns the raw
// base64 payload without the data: prefix).
// PdfViewer: simplified viewer - the PDF renders in the browser's native PDF
// viewer (which has its own page navigation) instead of the SDK's custom
// paginated viewer. Props kept compatible with the old call sites.
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
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
