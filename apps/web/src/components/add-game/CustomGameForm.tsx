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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  type AddCustomGameFormValues,
  addCustomGameFormSchema,
} from "@/schemas/forms";

export interface CustomGameFormProps {
  open: boolean;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: AddCustomGameFormValues) => Promise<boolean>;
  onCancel: () => void;
}

const DEFAULT_VALUES: AddCustomGameFormValues = {
  name: "",
  version: "1.0",
  developer: "",
  url: "",
};

export function CustomGameForm({
  open,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: CustomGameFormProps) {
  const form = useForm<AddCustomGameFormValues>({
    resolver: zodResolver(addCustomGameFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, form]);

  const handleFormSubmit = async (values: AddCustomGameFormValues) => {
    const ok = await onSubmit(values);
    if (ok) {
      form.reset(DEFAULT_VALUES);
      onCancel();
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        noValidate
        className="space-y-3"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Game Name *</FormLabel>
              <FormControl>
                <Input placeholder="Game Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="version"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Version *</FormLabel>
                <FormControl>
                  <Input placeholder="1.0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="developer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Developer</FormLabel>
                <FormControl>
                  <Input placeholder="Developer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Optional URL</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  {...field}
                />
              </FormControl>
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

        <DialogFooter className="pt-1">
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
