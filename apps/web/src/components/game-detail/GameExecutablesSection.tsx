import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  FilePlus2,
  FolderOpen,
  FolderPlus,
  Loader2,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  type AddExecutableFormValues,
  addExecutableFormSchema,
} from "@/schemas/forms";

export interface GameExecutablesSectionProps {
  gameId: number;
  executables: string[];
  mutating: boolean;
  launching: boolean;
  launchError: string | null;
  onDismissError: () => void;
  onUpdateExecutables: (next: string[]) => Promise<boolean>;
  onPlay: (executable: string) => void;
  onOpenFolder: (executable: string) => void;
  onBrowse: (mode: "file" | "folder") => Promise<string | null>;
}

export function GameExecutablesSection({
  gameId,
  executables,
  mutating,
  launching,
  launchError,
  onDismissError,
  onUpdateExecutables,
  onPlay,
  onOpenFolder,
  onBrowse,
}: GameExecutablesSectionProps) {
  const [browsing, setBrowsing] = useState<"file" | "folder" | null>(null);

  const form = useForm<AddExecutableFormValues>({
    resolver: zodResolver(addExecutableFormSchema),
    defaultValues: { executable: "" },
  });

  useEffect(() => {
    form.reset({ executable: "" });
  }, [gameId, form]);

  async function appendExecutable(candidate: string): Promise<boolean> {
    const trimmed = candidate.trim();
    if (!trimmed) return false;
    if (executables.includes(trimmed)) {
      return true;
    }
    return onUpdateExecutables([...executables, trimmed]);
  }

  async function handleBrowse(mode: "file" | "folder") {
    setBrowsing(mode);
    try {
      const picked = await onBrowse(mode);
      if (picked) {
        await appendExecutable(picked);
      }
    } finally {
      setBrowsing(null);
    }
  }

  async function handleSubmit(values: AddExecutableFormValues) {
    const saved = await appendExecutable(values.executable);
    if (saved) {
      form.reset({ executable: "" });
    }
  }

  const busy = mutating || browsing !== null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          Game Executables
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => void handleBrowse("file")}
          >
            {browsing === "file" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FilePlus2 className="h-3.5 w-3.5" />
            )}
            Browse File
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={busy}
            onClick={() => void handleBrowse("folder")}
          >
            {browsing === "folder" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderPlus className="h-3.5 w-3.5" />
            )}
            Browse Folder
          </Button>
          {executables.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={busy}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void onUpdateExecutables([])}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {launchError && (
        <DismissibleAlert
          variant="destructive"
          icon={<AlertCircle className="h-3.5 w-3.5 shrink-0" />}
          onDismiss={onDismissError}
          dismissLabel="Dismiss launch error"
          className="py-1.5"
        >
          {launchError}
        </DismissibleAlert>
      )}

      {executables.length > 0 ? (
        <ul className="space-y-1.5">
          {executables.map((exe) => (
            <li
              key={exe}
              className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2 py-1.5"
            >
              <Button
                type="button"
                size="xs"
                disabled={launching}
                onClick={() => onPlay(exe)}
                title={`Play ${exe}`}
                className="bg-emerald-600/90 text-white hover:bg-emerald-500"
              >
                <Play className="h-3 w-3" />
                Play
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => onOpenFolder(exe)}
                title="Open containing folder"
                aria-label={`Open folder for ${exe}`}
                className="h-6 w-6 shrink-0"
              >
                <FolderOpen className="h-3 w-3" />
              </Button>
              <span
                title={exe}
                className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
              >
                {exe}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() =>
                  void onUpdateExecutables(executables.filter((item) => item !== exe))
                }
                title="Remove executable"
                aria-label={`Remove ${exe}`}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          No game executable added yet. Browse for the local game binary/folder or
          paste its path or URI below to enable quick Play from game cards.
        </p>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex items-start gap-2"
        >
          <FormField
            control={form.control}
            name="executable"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1">
                <FormControl>
                  <Input
                    {...field}
                    disabled={busy}
                    placeholder="Path (e.g. C:\Games\Title\game.exe) or URI (e.g. steam://...)"
                    className="h-8 font-mono text-xs"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="sm" disabled={busy} className="h-8 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Add Game
          </Button>
        </form>
      </Form>
    </div>
  );
}
