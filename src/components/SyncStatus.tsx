import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { syncService } from "@/lib/sync";
import { serverSyncService } from "@/lib/sync-server";
import { formatDistanceToNow } from "date-fns";

const SyncStatus = () => {
  const [localStatus, setLocalStatus] = useState(syncService.getSyncStatus());
  const [serverStatus, setServerStatus] = useState(serverSyncService.getStatus());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.onSync((event) => {
      if (event.type === 'note_updated' && event.noteId === 'sync') {
        setLocalStatus(syncService.getSyncStatus());
      }
    });

    // Update status periodically
    const interval = setInterval(() => {
      setLocalStatus(syncService.getSyncStatus());
      setServerStatus(serverSyncService.getStatus());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleForceSync = async () => {
    if (!serverStatus.apiConfigured) return;
    
    setIsSyncing(true);
    try {
      await serverSyncService.forceSync();
      setServerStatus(serverSyncService.getStatus());
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!localStatus.isOnline) {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs">
        <WifiOff className="w-3 h-3" />
        Offline
      </Badge>
    );
  }

  // Show server sync status if configured
  if (serverStatus.apiConfigured) {
    return (
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className="gap-1.5 text-xs"
          title={serverStatus.isSyncing ? "Syncing..." : serverStatus.lastSync ? `Last sync: ${new Date(serverStatus.lastSync).toLocaleString()}` : "Not synced yet"}
        >
          {serverStatus.isSyncing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Cloud className="w-3 h-3" />
          )}
          {serverStatus.isSyncing ? (
            "Syncing..."
          ) : serverStatus.lastSync ? (
            <>Synced {formatDistanceToNow(new Date(serverStatus.lastSync), { addSuffix: true })}</>
          ) : (
            "Not synced"
          )}
          {serverStatus.pendingChanges > 0 && (
            <span className="text-destructive">({serverStatus.pendingChanges})</span>
          )}
        </Badge>
        {serverStatus.pendingChanges > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleForceSync}
            disabled={isSyncing}
            className="h-6 px-2"
            title="Sync now"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  // Fallback to local-only sync status
  return (
    <Badge variant="outline" className="gap-1.5 text-xs">
      <Wifi className="w-3 h-3" />
      {localStatus.lastSync ? (
        <>Synced {formatDistanceToNow(new Date(localStatus.lastSync), { addSuffix: true })}</>
      ) : (
        <>Syncing...</>
      )}
    </Badge>
  );
};

export default SyncStatus;
