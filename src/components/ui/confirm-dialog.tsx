"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, HelpCircle } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export interface PromptOptions {
  title?: string;
  description?: React.ReactNode;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmDialogProvider");
  }
  return context.confirm;
}

export function usePrompt() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("usePrompt must be used within a ConfirmDialogProvider");
  }
  return context.prompt;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  // Confirm state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions>({ description: "" });
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  // Prompt state
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptOpts, setPromptOpts] = useState<PromptOptions>({});
  const [promptValue, setPromptValue] = useState("");
  const promptResolveRef = useRef<((value: string | null) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const normalized: ConfirmOptions =
        typeof options === "string"
          ? {
              title: "Confirm Action",
              description: options,
              confirmText: "Confirm",
              cancelText: "Cancel",
              variant: "destructive",
            }
          : {
              title: options.title || "Confirm Action",
              description: options.description,
              confirmText: options.confirmText || "Confirm",
              cancelText: options.cancelText || "Cancel",
              variant: options.variant || "default",
            };

      setConfirmOpts(normalized);
      confirmResolveRef.current = resolve;
      setConfirmOpen(true);
    });
  }, []);

  const handleConfirmAction = useCallback(() => {
    setConfirmOpen(false);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(true);
      confirmResolveRef.current = null;
    }
  }, []);

  const handleConfirmCancel = useCallback(() => {
    setConfirmOpen(false);
    if (confirmResolveRef.current) {
      confirmResolveRef.current(false);
      confirmResolveRef.current = null;
    }
  }, []);

  const prompt = useCallback((options: PromptOptions | string): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      const normalized: PromptOptions =
        typeof options === "string"
          ? {
              title: "Input Required",
              description: options,
              placeholder: "Type here...",
              defaultValue: "",
              confirmText: "Submit",
              cancelText: "Cancel",
            }
          : {
              title: options.title || "Input Required",
              description: options.description,
              placeholder: options.placeholder || "Type here...",
              defaultValue: options.defaultValue || "",
              confirmText: options.confirmText || "Submit",
              cancelText: options.cancelText || "Cancel",
            };

      setPromptOpts(normalized);
      setPromptValue(normalized.defaultValue || "");
      promptResolveRef.current = resolve;
      setPromptOpen(true);
    });
  }, []);

  const handlePromptSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      setPromptOpen(false);
      if (promptResolveRef.current) {
        promptResolveRef.current(promptValue);
        promptResolveRef.current = null;
      }
    },
    [promptValue]
  );

  const handlePromptCancel = useCallback(() => {
    setPromptOpen(false);
    if (promptResolveRef.current) {
      promptResolveRef.current(null);
      promptResolveRef.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) handleConfirmCancel();
        }}
      >
        <AlertDialogContent className="max-w-md border-border bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground font-semibold text-lg">
              {confirmOpts.variant === "destructive" ? (
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              ) : (
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <HelpCircle className="h-4 w-4" />
                </div>
              )}
              <span>{confirmOpts.title}</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pt-1">
              {confirmOpts.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 pt-2">
            <AlertDialogCancel
              onClick={handleConfirmCancel}
              className="rounded-lg border-border hover:bg-muted text-foreground"
            >
              {confirmOpts.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmOpts.variant === "destructive"
                  ? "rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium shadow-xs"
                  : "rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
              }
            >
              {confirmOpts.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Prompt Dialog */}
      <Dialog
        open={promptOpen}
        onOpenChange={(open) => {
          if (!open) handlePromptCancel();
        }}
      >
        <DialogContent className="max-w-md border-border bg-card shadow-2xl">
          <form onSubmit={handlePromptSubmit}>
            <DialogHeader>
              <DialogTitle className="text-foreground font-semibold text-lg">
                {promptOpts.title}
              </DialogTitle>
              {promptOpts.description && (
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
                  {promptOpts.description}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="py-4">
              <Input
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptOpts.placeholder}
                className="w-full text-sm font-sans"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePromptCancel}
                className="rounded-lg border-border"
              >
                {promptOpts.cancelText || "Cancel"}
              </Button>
              <Button
                type="submit"
                className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {promptOpts.confirmText || "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
