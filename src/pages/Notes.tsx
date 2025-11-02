import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, Search, Tag, Calendar, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { db, Note } from "@/lib/database";
import { storage } from "@/lib/storage";
import SyncStatus from "@/components/SyncStatus";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const Notes = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    fetchNotes();
  }, [isAuthenticated, user, navigate]);

  const fetchNotes = async () => {
    if (!user) return;

    try {
      await db.init();
      const userNotes = await db.getNotesByUserId(user.id);
      setNotes(userNotes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast({
        title: "Error loading notes",
        description: "Could not load your notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await db.deleteNote(noteId);

      // Also delete associated audio file if exists
      const note = notes.find(n => n.id === noteId);
      if (note?.audio_url) {
        try {
          // Extract key from audio_url (format: voicenote://audio/userId/timestamp.webm)
          const urlMatch = note.audio_url.match(/voicenote:\/\/audio\/(.+)/);
          if (urlMatch) {
            await storage.deleteAudio(urlMatch[1]);
          }
        } catch (error) {
          console.error("Error deleting audio file:", error);
        }
      }

      setNotes(notes.filter(note => note.id !== noteId));
      toast({
        title: "Note deleted",
        description: "Your note has been successfully deleted.",
      });
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Error",
        description: "Could not delete note. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold">My Notes</h1>
            <div className="flex items-center gap-2">
              <SyncStatus />
              <Button 
                onClick={() => navigate("/recorder")} 
                className="bg-primary hover:bg-primary/90 active:scale-95 text-xs sm:text-sm px-3 sm:px-4 h-9 sm:h-10"
                size="sm"
              >
                <Mic className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">New Recording</span>
                <span className="sm:hidden">New</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl">
        {/* Search Bar */}
        <div className="mb-4 sm:mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search your notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 sm:h-12 text-base"
            />
          </div>
        </div>

        {/* Notes Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm sm:text-base">Loading your notes...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Mic className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg sm:text-xl font-semibold mb-2">No notes yet</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              Start recording your first voice note
            </p>
            <Button 
              onClick={() => navigate("/recorder")} 
              className="bg-primary hover:bg-primary/90 active:scale-95 min-h-[48px] text-base touch-manipulation"
            >
              <Mic className="w-4 h-4 mr-2" />
              Create Note
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => (
              <Card 
                key={note.id} 
                className="p-4 sm:p-6 hover:shadow-lg transition-shadow bg-card/50 backdrop-blur-sm cursor-pointer"
                onClick={() => navigate(`/notes/${note.id}`)}
              >
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base sm:text-lg line-clamp-2 flex-1">{note.title}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {note.content && (
                    <div className="text-sm text-muted-foreground overflow-hidden" style={{ 
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.4',
                      maxHeight: '4.2em'
                    }}>
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:m-0 prose-p:mb-1 prose-headings:m-0 prose-headings:mb-1 prose-ul:m-0 prose-ul:mb-1 prose-ol:m-0 prose-ol:mb-1">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({node, ...props}) => <p className="m-0 mb-1 text-sm text-muted-foreground leading-relaxed" {...props} />,
                            h1: ({node, ...props}) => <h1 className="m-0 mb-1 text-sm font-semibold text-foreground leading-tight" {...props} />,
                            h2: ({node, ...props}) => <h2 className="m-0 mb-1 text-sm font-semibold text-foreground leading-tight" {...props} />,
                            h3: ({node, ...props}) => <h3 className="m-0 mb-1 text-sm font-semibold text-foreground leading-tight" {...props} />,
                            ul: ({node, ...props}) => <ul className="m-0 mb-1 text-sm text-muted-foreground list-disc pl-4 space-y-0.5" {...props} />,
                            ol: ({node, ...props}) => <ol className="m-0 mb-1 text-sm text-muted-foreground list-decimal pl-4 space-y-0.5" {...props} />,
                            li: ({node, ...props}) => <li className="text-sm text-muted-foreground leading-relaxed" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                          }}
                        >
                          {note.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                    </div>
                    {note.duration && (
                      <div className="flex items-center gap-1">
                        <Mic className="w-3 h-3 flex-shrink-0" />
                        {formatTime(note.duration)}
                      </div>
                    )}
                  </div>

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      {note.tags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="text-xs bg-secondary px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
