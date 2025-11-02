import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Cloud, Loader2 } from "lucide-react";
import { syncService } from "@/lib/sync";
import { formatDistanceToNow } from "date-fns";

const SyncStatus = () => {
  const [status, setStatus] = useState<{
    isOnline: boolean;
    lastSync: string | null;
  }>(syncService.getSyncStatus());

  useEffect(() => {
    const unsubscribe = syncService.onSync((event) => {
      if (event.type === 'note_updated' && event.noteId === 'sync') {
        setStatus(syncService.getSyncStatus());
      }
    });

    // Update status periodically
    const interval = setInterval(() => {
      setStatus(syncService.getSyncStatus());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!status.isOnline) {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs">
        <WifiOff className="w-3 h-3" />
        Offline
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1.5 text-xs">
      <Wifi className="w-3 h-3" />
      {status.lastSync ? (
        <>Synced {formatDistanceToNow(new Date(status.lastSync), { addSuffix: true })}</>
      ) : (
        <>Syncing...</>
      )}
    </Badge>
  );
};

export default SyncStatus;

