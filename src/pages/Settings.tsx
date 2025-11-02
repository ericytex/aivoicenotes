import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Trash2, Shield, Lock, Eye, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/database";
import { storage } from "@/lib/storage";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated, signOut } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  const handleExportData = async () => {
    if (!user) return;

    setIsExporting(true);

    try {
      await db.init();
      const notes = await db.getNotesByUserId(user.id);

      // Get all audio URLs
      const notesWithAudio = await Promise.all(
        notes.map(async (note) => {
          let audioData = null;
          if (note.audio_url) {
            const urlMatch = note.audio_url.match(/voicenote:\/\/audio\/(.+)/);
            if (urlMatch) {
              const audioBlob = await storage.getAudio(urlMatch[1]);
              if (audioBlob) {
                // Convert blob to base64 for JSON export
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve, reject) => {
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsDataURL(audioBlob);
                });
                audioData = {
                  key: urlMatch[1],
                  data: base64,
                  type: audioBlob.type,
                  size: audioBlob.size,
                };
              }
            }
          }
          return {
            ...note,
            audio: audioData,
          };
        })
      );

      const exportData = {
        user: {
          id: user.id,
          email: user.email,
        },
        notes: notesWithAudio,
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sonic-note-maker-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: "Your data has been exported.",
      });
    } catch (error: any) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export failed",
        description: error.message || "Could not export data.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete all your data? This action cannot be undone."
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      await db.init();
      const notes = await db.getNotesByUserId(user.id);

      // Delete all notes and their audio files
      for (const note of notes) {
        await db.deleteNote(note.id);
        
        if (note.audio_url) {
          try {
            const urlMatch = note.audio_url.match(/voicenote:\/\/audio\/(.+)/);
            if (urlMatch) {
              await storage.deleteAudio(urlMatch[1]);
            }
          } catch (error) {
            console.error(`Error deleting audio for note ${note.id}:`, error);
          }
        }
      }

      // Clear all IndexedDB data
      try {
        const databases = await indexedDB.databases();
        for (const database of databases) {
          if (database.name) {
            indexedDB.deleteDatabase(database.name);
          }
        }
      } catch (error) {
        console.error('Error clearing IndexedDB:', error);
      }

      // Clear localStorage
      localStorage.clear();

      toast({
        title: "Data deleted",
        description: "All your data has been deleted.",
      });

      // Sign out and redirect
      await signOut();
      navigate("/auth");
    } catch (error: any) {
      console.error('Error deleting data:', error);
      toast({
        title: "Deletion failed",
        description: error.message || "Could not delete all data.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-3 sm:p-4">
      <div className="container mx-auto max-w-4xl pt-4 sm:pt-8">
        <div className="mb-4 sm:mb-8">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4">Privacy & Settings</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Manage your data and privacy</p>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {/* Data Export */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Download className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Export Your Data</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Download all your notes, transcriptions, and audio files as a JSON file.
                </p>
                <Button
                  onClick={handleExportData}
                  disabled={isExporting}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {isExporting ? "Exporting..." : "Export All Data"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Data Deletion */}
          <Card className="p-4 sm:p-6 border-destructive/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  <h2 className="text-lg font-semibold text-destructive">Delete All Data</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Permanently delete all your notes, recordings, and account data. This action cannot be undone.
                </p>
                <Button
                  onClick={handleDeleteAllData}
                  disabled={isDeleting}
                  variant="destructive"
                  className="w-full sm:w-auto"
                >
                  {isDeleting ? "Deleting..." : "Delete All Data"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Privacy Information */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">Privacy & Security</h2>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      All data is stored locally in your browser. We don't collect or transmit your data to external servers.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      Your recordings and transcriptions remain private unless you explicitly share them.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>
                      You have full control over your data. Export or delete your data at any time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;

