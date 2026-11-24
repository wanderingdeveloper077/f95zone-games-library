import { useEffect, useState } from "react";
import { CustomGameForm } from "@/components/add-game/CustomGameForm";
import { F95UrlsForm } from "@/components/add-game/F95UrlsForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddGame } from "@/hooks/useAddGame";

interface AddGameModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddGameModal({ open, onClose }: AddGameModalProps) {
  const {
    creating,
    createError,
    clearError,
    submitF95Urls,
    submitCustomGame,
  } = useAddGame();

  const [mode, setMode] = useState<"f95" | "custom">("f95");

  useEffect(() => {
    if (open) {
      clearError();
    }
  }, [open, clearError]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle>Add Games</DialogTitle>
          <DialogDescription>
            Add F95zone thread URLs for automatic indexing or enter a custom
            game manually.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as "f95" | "custom");
            clearError();
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="f95">F95zone Thread URLs</TabsTrigger>
            <TabsTrigger value="custom">Custom Game</TabsTrigger>
          </TabsList>

          <TabsContent value="f95" className="mt-3">
            <F95UrlsForm
              open={open}
              submitting={creating}
              serverError={createError}
              onSubmit={submitF95Urls}
              onCancel={onClose}
            />
          </TabsContent>

          <TabsContent value="custom" className="mt-3">
            <CustomGameForm
              open={open}
              submitting={creating}
              serverError={createError}
              onSubmit={submitCustomGame}
              onCancel={onClose}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
