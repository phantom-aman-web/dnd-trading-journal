"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useNav, type ViewKey } from "@/lib/nav-store";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { CURRENT_VERSIONS, LEGAL_DOCS_META, type LegalDocType } from "@/lib/legal-versions";

interface LegalDocData {
  docType: string;
  title: string;
  version: string;
  content: string;
  accepted?: boolean;
  acceptedVersion?: string | null;
  acceptedAt?: string | null;
  isCurrent?: boolean;
}

/**
 * Legal document viewer — accessible from the landing page, signup, and
 * footer links WITHOUT requiring authentication. The content is fetched
 * from the public /api/legal/[doc] endpoint.
 *
 * If the user IS authenticated and has not yet accepted the document,
 * an "Accept" button is shown. For anonymous users, this is read-only.
 *
 * Usage: navigates to view "terms" | "privacy" | "cookies" via nav-store.
 */
export function LegalDocViewer({ view }: { view: ViewKey }) {
  const { navigate } = useNav();
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<LegalDocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const docMeta = LEGAL_DOCS_META.find((d) => d.key === view || d.slug === view);

  useEffect(() => {
    if (!docMeta) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/legal/${docMeta.key}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [docMeta]);

  if (!docMeta) return null;

  function handleClose(open: boolean) {
    setOpen(open);
    if (!open) {
      // Return to the previous view (landing for anonymous, dashboard for auth)
      navigate(user ? "dashboard" : "landing");
    }
  }

  async function handleAccept() {
    if (!docMeta || !user) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/legal/${docMeta.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const result = await res.json();
        setData({
          ...(data as LegalDocData),
          accepted: true,
          acceptedVersion: result.version,
          acceptedAt: result.acceptedAt,
          isCurrent: true,
        });
        toast.success(`${docMeta.label} accepted.`);
      } else {
        toast.error("Failed to record acceptance.");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <button
              onClick={() => handleClose(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {docMeta.label}
          </DialogTitle>
          {data && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Version {data.version}</span>
              {user && (
                <>
                  <span>·</span>
                  {data.accepted ? (
                    <span className="inline-flex items-center gap-1 text-profit">
                      <Check className="h-3 w-3" />
                      Accepted
                      {data.acceptedAt && ` ${new Date(data.acceptedAt).toLocaleDateString()}`}
                      {data.isCurrent === false && (
                        <span className="text-warning ml-1">· outdated</span>
                      )}
                    </span>
                  ) : (
                    <span>Not yet accepted</span>
                  )}
                </>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scroll-thin pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {data?.content ?? "Document not found."}
            </div>
          )}
        </div>

        {user && data && !data.accepted && (
          <div className="border-t border-border pt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => handleClose(false)}>
              Close
            </Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Accept {docMeta.label}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
