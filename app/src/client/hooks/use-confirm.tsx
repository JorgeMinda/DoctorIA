import React, { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { AlertTriangle, Info } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: "",
    description: "",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "default",
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions({
      confirmText: "Confirmar",
      cancelText: "Cancelar",
      variant: "default",
      ...opts,
    });
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolverRef.current?.(true);
  };

  const handleCancel = () => {
    setOpen(false);
    resolverRef.current?.(false);
  };

  const ConfirmDialog = (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancel();
      }}
    >
      <DialogContent className="max-w-md border-outline-variant bg-surface/90 backdrop-blur-xl">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-full ${
                options.variant === "destructive"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {options.variant === "destructive" ? (
                <AlertTriangle className="size-5" />
              ) : (
                <Info className="size-5" />
              )}
            </div>
            <DialogTitle className="text-base font-semibold">
              {options.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {options.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 pt-3">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            {options.cancelText ?? "Cancelar"}
          </Button>
          <Button
            variant={options.variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirm}
          >
            {options.confirmText ?? "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, ConfirmDialog };
}
