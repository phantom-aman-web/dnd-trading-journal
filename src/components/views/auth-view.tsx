"use client";

import { useNav } from "@/lib/nav-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-store";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { ArrowLeft, Loader2, FileText, X, Eye, EyeOff } from "lucide-react";
import { CURRENT_VERSIONS, LEGAL_DOCS_META, type LegalDocType } from "@/lib/legal-versions";

export function AuthView() {
  const { view, navigate } = useNav();
  const { fetchUser } = useAuth();
  const isSignup = view === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  // Legal acceptance checkboxes (signup only)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [ackPrivacy, setAckPrivacy] = useState(false);
  // Show/hide password toggle
  const [showPassword, setShowPassword] = useState(false);
  // Inline legal document viewer — opens ON TOP of the signup form
  // instead of navigating away. `null` = closed.
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSignup) {
      if (!agreeTerms || !ackPrivacy) {
        toast.error("Please accept the Terms and acknowledge the Privacy Policy to continue.");
        return;
      }
    }
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { email, password };
      if (isSignup) {
        payload.name = name;
        payload.agreeTerms = agreeTerms;
        payload.acknowledgePrivacy = ackPrivacy;
        payload.termsVersion = CURRENT_VERSIONS.terms;
        payload.privacyVersion = CURRENT_VERSIONS.privacy;
      }
      const res = await fetch(`/api/auth?mode=${isSignup ? "signup" : "signin"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Authentication failed");
        setLoading(false);
        return;
      }
      toast.success(isSignup ? "Account created" : "Signed in");
      await fetchUser();
      navigate("dashboard");
    } catch {
      toast.error("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e2330] p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate("landing")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>
        {/* Premium white card — matches the reference site aesthetic */}
        <div className="rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#1e2330] text-white font-bold text-xl tracking-wider">
              D
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isSignup ? "Create your account" : "Sign in to DnD"}
            </h1>
            <p className="text-xs text-slate-500">
              {isSignup
                ? "Start journaling trades, building playbooks and tracking performance."
                : "Welcome back. Sign in to continue."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <Label htmlFor="name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="w-full px-3.5 py-3 md:py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2330]"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-3.5 py-3 md:py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2330]"
              />
            </div>
            <div>
              <Label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignup ? 8 : 1}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-3 md:py-2.5 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2330]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isSignup && <p className="text-xs text-slate-400 mt-1">Minimum 8 characters.</p>}
            </div>

            {/* Legal acceptance (signup only) — links open INLINE dialog */}
            {isSignup && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label
                  htmlFor="agree-terms"
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <Checkbox
                    id="agree-terms"
                    checked={agreeTerms}
                    onCheckedChange={(v) => setAgreeTerms(v === true)}
                    className="mt-0.5 border-slate-400"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    I agree to the{" "}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setLegalDoc("terms"); }}
                      className="font-medium text-[#1e2330] underline underline-offset-2 hover:text-slate-700"
                    >
                      Terms of Service
                    </button>
                    {" (v" + CURRENT_VERSIONS.terms + ")."}
                  </span>
                </label>
                <label
                  htmlFor="ack-privacy"
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <Checkbox
                    id="ack-privacy"
                    checked={ackPrivacy}
                    onCheckedChange={(v) => setAckPrivacy(v === true)}
                    className="mt-0.5 border-slate-400"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed">
                    I acknowledge that I have read the{" "}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setLegalDoc("privacy"); }}
                      className="font-medium text-[#1e2330] underline underline-offset-2 hover:text-slate-700"
                    >
                      Privacy Policy
                    </button>
                    {" (v" + CURRENT_VERSIONS.privacy + ")."}
                  </span>
                </label>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (isSignup && (!agreeTerms || !ackPrivacy))}
              className="w-full py-3 md:py-2.5 bg-[#1e2330] hover:bg-[#2a3040] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 border-0"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="text-center border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button onClick={() => navigate("signin")} className="font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2">
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New to DnD?{" "}
                  <button onClick={() => navigate("signup")} className="font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2">
                    Create an account
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Inline legal document viewer — opens ON TOP of the signup form.
          The signup form stays mounted underneath; closing the dialog
          returns the user to exactly where they were. */}
      {legalDoc && (
        <LegalDocInline
          doc={legalDoc}
          onClose={() => setLegalDoc(null)}
        />
      )}
    </div>
  );
}

/**
 * Inline legal document viewer rendered as a Dialog overlay on top of the
 * auth form. Fetches content from the public /api/legal/[doc] endpoint.
 * The auth form stays mounted underneath — the user doesn't lose their
 * entered data.
 */
function LegalDocInline({ doc, onClose }: { doc: LegalDocType; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const meta = LEGAL_DOCS_META.find((d) => d.key === doc);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/legal/${doc}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-white text-slate-900 border-slate-200 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <FileText className="h-5 w-5 text-slate-500" />
            {meta?.label ?? "Legal Document"}
          </DialogTitle>
          {data && (
            <DialogDescription className="text-slate-500">
              Version {data.version}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
              {data?.content ?? "Document not found."}
            </div>
          )}
        </div>
        <div className="border-t border-slate-100 pt-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4 mr-1" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
