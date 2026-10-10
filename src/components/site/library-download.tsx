"use client";

import { Download } from "lucide-react";
import { supabaseBrowser } from "@/lib/auth";

/**
 * DownloadButton — opens the file AND bumps download_count through the
 * increment_download_count RPC (the only path that can change the counter).
 */
export function DownloadButton({ fileId, url, title }: { fileId: string; url: string; title: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        const sb = supabaseBrowser();
        if (sb) void sb.rpc("increment_download_count", { p_file_id: fileId });
      }}
      className="button-press inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold text-primary-foreground hover:opacity-90"
      aria-label={`Download ${title}`}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      Open / Download
    </a>
  );
}
