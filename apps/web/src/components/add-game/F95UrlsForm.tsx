import { extractThreadMatches } from "@game-library/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Plus } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  type AddF95UrlsFormValues,
  addF95UrlsFormSchema,
} from "@/schemas/forms";

export interface F95UrlsFormProps {
  open: boolean;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (urlsText: string) => Promise<boolean>;
  onCancel: () => void;
}

export function F95UrlsForm({
  open,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: F95UrlsFormProps) {
  const form = useForm<AddF95UrlsFormValues>({
    resolver: zodResolver(addF95UrlsFormSchema),
    defaultValues: { urlsText: "" },
  });

  const urlsText = form.watch("urlsText");
  const detectedCount = extractThreadMatches(urlsText).length;

  useEffect(() => {
    if (open) {
      form.reset({ urlsText: "" });
    }
  }, [open, form]);

  const handleFormSubmit = async (values: AddF95UrlsFormValues) => {
    const ok = await onSubmit(values.urlsText);
    if (ok) {
      form.reset({ urlsText: "" });
      onCancel();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        noValidate
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="urlsText"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paste one or more F95zone thread URLs:</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="https://f95zone.to/threads/example-game.123456/"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Detected valid threads:{" "}
                <span className="font-semibold text-foreground">
                  {detectedCount}
                </span>
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && (
          <DismissibleAlert
            variant="destructive"
            icon={<AlertCircle className="h-4 w-4 shrink-0" />}
          >
            {serverError}
          </DismissibleAlert>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || form.formState.isSubmitting}
          >
            <Plus className="h-3.5 w-3.5" />
            {submitting ? "Adding..." : "Add to Library"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
