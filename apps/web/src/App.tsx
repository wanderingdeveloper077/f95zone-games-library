import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { AddGameModal } from "@/components/AddGameModal";
import { DismissibleAlert } from "@/components/DismissibleAlert";
import { FilterToolbar } from "@/components/FilterToolbar";
import { GameDetailModal } from "@/components/GameDetailModal";
import { GameGrid } from "@/components/GameGrid";
import { HeaderBar } from "@/components/HeaderBar";
import { IndexingBanner } from "@/components/IndexingBanner";
import { SettingsPairingDrawer } from "@/components/SettingsPairingDrawer";
import { ChooseExecutableDialog } from "@/components/games/ChooseExecutableDialog";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { useSseEvents } from "@/hooks/useSseEvents";
import { useSystemStatus } from "@/hooks/useSystemStatus";

export function App() {
  useSseEvents();

  const {
    games,
    totalCount,
    updatesCount,
    hasMore,
    loading,
    loadingMore,
    error,
    filter,
    viewMode,
    refreshing,
    launchingGameId,
    chooseExeGame,
    updateFilter,
    changeViewMode,
    selectGame,
    toggleInstalled,
    toggleFinished,
    playGame,
    closeChooseExe,
    loadMore,
    refreshAll,
    dismissError,
  } = useGameLibrary();

  const {
    sseConnected,
    activeJob,
    currentItemName,
    lastJobError,
    accountStatus,
    cancelJob,
  } = useSystemStatus();

  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <HeaderBar
        totalGames={totalCount}
        updatesCount={updatesCount}
        sseConnected={sseConnected}
        accountStatus={accountStatus}
        isRefreshing={Boolean(activeJob) || refreshing}
        onAddClick={() => setAddOpen(true)}
        onRefreshAll={refreshAll}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <IndexingBanner
        activeJob={activeJob}
        currentItemName={currentItemName}
        lastJobError={lastJobError}
        accountStatus={accountStatus}
        onCancelJob={cancelJob}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {error && (
        <div className="mx-auto mt-3 max-w-7xl px-4">
          <DismissibleAlert
            variant="destructive"
            icon={<AlertCircle className="h-4 w-4 shrink-0" />}
            onDismiss={dismissError}
            dismissLabel="Dismiss error"
          >
            {error}
          </DismissibleAlert>
        </div>
      )}

      <FilterToolbar
        filter={filter}
        viewMode={viewMode}
        onChangeFilter={updateFilter}
        onChangeViewMode={changeViewMode}
      />

      {loading && games.length === 0 ? (
        <div className="mx-auto mt-12 flex max-w-lg items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading game library...
        </div>
      ) : (
        <GameGrid
          games={games}
          totalCount={totalCount}
          hasMore={hasMore}
          loadingMore={loadingMore}
          viewMode={viewMode}
          launchingGameId={launchingGameId}
          onSelectGame={(id) => selectGame(id)}
          onPlayGame={playGame}
          onToggleInstalled={toggleInstalled}
          onToggleFinished={toggleFinished}
          onLoadMore={loadMore}
        />
      )}

      <AddGameModal open={addOpen} onClose={() => setAddOpen(false)} />

      <GameDetailModal onClose={() => selectGame(null)} />

      <ChooseExecutableDialog
        game={chooseExeGame}
        launching={chooseExeGame !== null && launchingGameId === chooseExeGame.id}
        onSelect={(game, exe) => playGame(game, exe)}
        onClose={closeChooseExe}
      />

      <SettingsPairingDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
