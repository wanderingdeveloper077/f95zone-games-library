import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { type GameNotesFormValues, gameNotesFormSchema } from "@/schemas/forms";

export interface GameNotesFormProps {
  gameId: number;
  initialNotes: string;
  saving: boolean;
  onSave: (notes: string) => Promise<boolean>;
}

export function GameNotesForm({
  gameId,
  initialNotes,
  saving,
  onSave,
}: GameNotesFormProps) {
  const form = useForm<GameNotesFormValues>({
    resolver: zodResolver(gameNotesFormSchema),
    defaultValues: { notes: initialNotes },
  });

  useEffect(() => {
    form.reset({ notes: initialNotes });
  }, [gameId, initialNotes, form]);

  const handleSubmit = async (values: GameNotesFormValues) => {
    const ok = await onSave(values.notes);
    if (ok) {
      form.reset(values);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        className="space-y-2"
      >
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-foreground">
                  Personal Notes
                </FormLabel>
                <Button
                  type="submit"
                  variant="secondary"
                  size="xs"
                  disabled={
                    saving ||
                    form.formState.isSubmitting ||
                    !form.formState.isDirty
                  }
                >
                  {form.formState.isSubmitting ? "Saving..." : "Save Notes"}
                </Button>
              </div>
              <FormControl>
                <Textarea
                  rows={3}
                  placeholder="Write personal walkthrough notes, save locations, or reminders..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
