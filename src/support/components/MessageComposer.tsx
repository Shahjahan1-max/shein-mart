import React, { useState, useRef, KeyboardEvent } from "react";
import { Send, Paperclip, X, Loader2 } from "lucide-react";
import { compressImageFile } from "../services/supportApi";

interface MessageComposerProps {
  userId: string;
  onSendMessage: (text: string, imageUrl?: string, imageData?: { path?: string; fileName?: string; size?: number }) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

export function MessageComposer({ userId, onSendMessage, onTyping, disabled }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const handleSend = async () => {
    if ((!text.trim() && !selectedFile) || uploading || disabled) return;

    setError(null);
    const currentText = text.trim();
    const currentFile = selectedFile;

    // Instant input clearing (WhatsApp-style 0ms responsiveness)
    setText("");
    clearAttachment();
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let uploadedUrl: string | undefined;
    let imageData: { path?: string; fileName?: string; size?: number } | undefined;

    if (currentFile) {
      setUploading(true);
      try {
        // Fast client-side canvas compression (< 150KB WebP/JPEG dataUrl) in ~10-20ms
        uploadedUrl = await compressImageFile(currentFile);
        imageData = { fileName: currentFile.name, size: currentFile.size };
      } catch {
        uploadedUrl = await fileToBase64(currentFile);
        imageData = { fileName: currentFile.name, size: currentFile.size };
      } finally {
        setUploading(false);
      }
    }

    // Trigger message send via RTDB
    try {
      await onSendMessage(currentText, uploadedUrl, imageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping?.();
    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-[#f0f2f5] dark:bg-gray-900 border-t border-slate-200 dark:border-gray-800 space-y-2">
      {error && (
        <div className="text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 flex items-center justify-between font-medium">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="relative inline-block border border-slate-300 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 p-1 shadow-sm">
          <img src={previewUrl} alt="Preview" className="h-20 w-auto object-cover rounded-lg" />
          <button
            onClick={clearAttachment}
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/70 text-white hover:bg-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-300 hover:text-[#008069] hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex-shrink-0 shadow-xs touch-manipulation active:scale-95"
          title="Attach image"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 focus-within:border-[#008069] transition-colors px-3 py-2 flex items-center min-h-[42px] shadow-xs">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // On mobile, scroll the composer into view when keyboard opens
              setTimeout(() => {
                textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }, 300);
            }}
            placeholder="Type a message..."
            rows={1}
            disabled={disabled || uploading}
            className="w-full bg-transparent text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 resize-none focus:outline-none max-h-32"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={(!text.trim() && !selectedFile) || uploading || disabled}
          className="p-2.5 rounded-full bg-[#008069] hover:bg-[#006e5a] disabled:opacity-40 text-white font-medium shadow-md transition-all flex-shrink-0 touch-manipulation active:scale-95"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
