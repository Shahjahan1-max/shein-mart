import React from "react";
import { X, Download } from "lucide-react";

interface ImagePreviewModalProps {
  url: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({ url, onClose }: ImagePreviewModalProps) {
  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <div className="absolute top-2 right-2 flex items-center gap-2">
          <a
            href={url}
            download="attachment"
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-full bg-gray-800/80 text-gray-200 hover:text-white hover:bg-gray-700 transition-colors"
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-gray-800/80 text-gray-200 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <img src={url} alt="Enlarged Attachment" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
      </div>
    </div>
  );
}
