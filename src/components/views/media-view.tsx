"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Image as ImageIcon, Video, Trash2, Search, X, Download } from "lucide-react";
import { toast } from "sonner";
import { ImageViewer } from "@/components/trade/image-viewer";
import { EmptyState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

async function fetchMedia(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/media?${qs}`, { cache: "no-store" });
  return res.json();
}

export function MediaView() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const params: Record<string, string> = {};
  if (filter !== "all") params.kind = filter === "videos" ? "video" : "image";

  const { data, isLoading } = useQuery({
    queryKey: ["media", params, search],
    queryFn: async () => {
      const res = await fetchMedia(params);
      let items = res.items ?? [];
      if (search) {
        items = items.filter((m: any) => (m.filename ?? "").toLowerCase().includes(search.toLowerCase()) || (m.caption ?? "").toLowerCase().includes(search.toLowerCase()));
      }
      // The /api/media list response already includes `url` (signed) per
      // item, so we no longer need to fan out N individual GET
      // /api/media/[id] requests just to populate thumbnails.
      return { items };
    },
  });

  const items = data?.items ?? [];
  const images = items.filter((m: any) => m.kind === "image");
  const videos = items.filter((m: any) => m.kind === "video");
  const visibleItems = filter === "videos" ? videos : filter === "images" ? images : items;

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/media", { method: "POST", body: formData });
      if (res.ok) {
        toast.success(`${file.name} uploaded.`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error ?? `Failed to upload ${file.name}`);
      }
    }
    qc.invalidateQueries({ queryKey: ["media"] });
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
          <p className="text-sm text-muted-foreground">Screenshots, chart recordings and evidence.</p>
        </div>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          multiple
          className="hidden"
          onChange={(e) => onUpload(e.target.files)}
        />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search media"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="images">Images</SelectItem>
              <SelectItem value="videos">Videos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : visibleItems.length === 0 ? (
        <EmptyState
          title="No media yet."
          description="Upload screenshots, chart recordings or trade evidence. Files are stored privately and served via short-lived signed URLs."
          icon={ImageIcon}
          action={{ label: "Upload Media", onClick: () => fileRef.current?.click() }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {visibleItems.map((m: any, i: number) => (
            <Card key={m.id} className="overflow-hidden group relative">
              {m.kind === "image" ? (
                <button
                  className="block w-full aspect-video bg-muted"
                  onClick={() => setViewerIndex(visibleItems.indexOf(m))}
                >
                  {m.url && <img src={m.url} alt={m.caption ?? m.filename} className="w-full h-full object-cover" />}
                </button>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  {m.url ? (
                    <video src={m.url} className="w-full h-full object-cover" controls preload="metadata" />
                  ) : (
                    <Video className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}
              <div className="p-2">
                <div className="text-xs font-medium truncate">{m.filename}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()} · {(m.sizeBytes / 1024).toFixed(0)} KB
                </div>
              </div>
              <div className="absolute top-1 right-1 flex items-center gap-1">
                <a
                  href={m.url ? `${m.url}&download=1` : undefined}
                  onClick={(e) => {
                    if (!m.url) e.preventDefault();
                  }}
                  className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  title={`Download ${m.filename}`}
                  aria-label={`Download ${m.filename}`}
                  download
                >
                  <Download className="h-3 w-3" />
                </a>
                <button
                  className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  onClick={async () => {
                    if (!confirm("Delete this media?")) return;
                    await fetch(`/api/media/${m.id}`, { method: "DELETE" });
                    qc.invalidateQueries({ queryKey: ["media"] });
                  }}
                  title="Delete media"
                  aria-label="Delete media"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewerIndex != null && visibleItems[viewerIndex] && (
        <ImageViewer
          mediaItems={visibleItems}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
