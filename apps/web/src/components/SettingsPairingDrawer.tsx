import { AlertCircle, Info, Settings } from "lucide-react";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { IndexerSettingsForm } from "@/components/settings/IndexerSettingsForm";
import { PairingSection } from "@/components/settings/PairingSection";
import { SessionSection } from "@/components/settings/SessionSection";
import { TagHighlightsSection } from "@/components/settings/TagHighlightsSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSettingsDrawer } from "@/hooks/useSettingsDrawer";

interface SettingsPairingDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPairingDrawer({
  open,
  onClose,
}: SettingsPairingDrawerProps) {
  const {
    f95Account,
    settings,
    settingsSaving,
    pairing,
    pairingLoading,
    verifyingAccount,
    importing,
    statusNotice,
    errorMessage,
    generatePairingCode,
    rotatePairingToken,
    verifySession,
    importList,
    clearSession,
    savePreferences,
    addTagHighlight,
    removeTagHighlight,
  } = useSettingsDrawer(open);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="pr-10">
          <SheetTitle>Extension Pairing, Session & Settings</SheetTitle>
          <SheetDescription>
            Manage browser extension pairing, F95zone cookies, and indexer
            preferences.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          {statusNotice && (
            <DismissibleAlert
              icon={<Info className="h-4 w-4 shrink-0 text-primary" />}
            >
              {statusNotice}
            </DismissibleAlert>
          )}

          {errorMessage && (
            <DismissibleAlert
              variant="destructive"
              icon={<AlertCircle className="h-4 w-4 shrink-0" />}
            >
              {errorMessage}
            </DismissibleAlert>
          )}

          <PairingSection
            pairing={pairing}
            loading={pairingLoading}
            onGenerateCode={generatePairingCode}
            onRotateToken={rotatePairingToken}
          />

          <SessionSection
            account={f95Account}
            verifying={verifyingAccount}
            importing={importing}
            onVerify={verifySession}
            onImportList={(source) => void importList(source)}
            onClear={clearSession}
          />

          {settings && (
            <Card className="bg-card/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xs">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Indexer & Extension Settings
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 pt-1">
                <IndexerSettingsForm
                  preferences={settings}
                  saving={settingsSaving}
                  onSave={savePreferences}
                />

                <Separator />

                <TagHighlightsSection
                  tagHighlights={settings.tagHighlights}
                  saving={settingsSaving}
                  onAddHighlight={addTagHighlight}
                  onRemoveHighlight={(tagName) =>
                    void removeTagHighlight(tagName)
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
