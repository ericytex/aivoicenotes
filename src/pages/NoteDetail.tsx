import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2, Play, Pause, Mic, MessageCircle, ListTodo, Loader2, Share2, Copy, Check, Calendar, Mail, FileText, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { db, Note } from "@/lib/database";
import { storage } from "@/lib/storage";
import { extractActionItems, ActionItem } from "@/lib/actionItems";
import { sharing } from "@/lib/sharing";
import ActionItemsList from "@/components/ActionItemsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToNotion, exportToGmail, exportToICal, sendViaGmail, generateZapierPayload } from "@/lib/integrations";

const NoteDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [isExtractingActionItems, setIsExtractingActionItems] = useState(false);
  const [showActionItems, setShowActionItems] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [sharePermission, setSharePermission] = useState<'read' | 'edit'>('read');
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!id) {
      navigate("/notes");
      return;
    }

    const loadNote = async () => {
      try {
        await db.init();
        const loadedNote = await db.getNoteById(id);
        
        // Verify the note belongs to the current user
        if (loadedNote.user_id !== user.id) {
          toast({
            title: "Access denied",
            description: "This note doesn't belong to you.",
            variant: "destructive",
          });
          navigate("/notes");
          return;
        }

        setNote(loadedNote);

        // Load audio if available
        if (loadedNote.audio_url) {
          const urlMatch = loadedNote.audio_url.match(/voicenote:\/\/audio\/(.+)/);
          if (urlMatch) {
            const audioBlob = await storage.getAudio(urlMatch[1]);
            if (audioBlob) {
              const url = URL.createObjectURL(audioBlob);
              setAudioUrl(url);
            }
          }
        }
      } catch (error) {
        console.error("Error loading note:", error);
        toast({
          title: "Note not found",
          description: "Could not load the note. It may have been deleted.",
          variant: "destructive",
        });
        navigate("/notes");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadNote();
  }, [id, isAuthenticated, user, navigate, toast]);

  // Cleanup audio URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleDeleteNote = async () => {
    if (!note || !id) return;

    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      await db.deleteNote(id);

      // Delete associated audio file if exists
      if (note.audio_url) {
        try {
          const urlMatch = note.audio_url.match(/voicenote:\/\/audio\/(.+)/);
          if (urlMatch) {
            await storage.deleteAudio(urlMatch[1]);
          }
        } catch (error) {
          console.error("Error deleting audio file:", error);
        }
      }

      toast({
        title: "Note deleted",
        description: "Your note has been successfully deleted.",
      });

      navigate("/notes");
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({
        title: "Error",
        description: "Could not delete note. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    const audio = audioPlayerRef.current;
    if (!audio || !audioUrl) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      toast({
        title: "Playback error",
        description: "Could not play audio.",
        variant: "destructive",
      });
    }
  };

  const handleExtractActionItems = async () => {
    if (!note?.content) {
      toast({
        title: "No content",
        description: "This note has no transcription to extract action items from.",
        variant: "destructive",
      });
      return;
    }

    setIsExtractingActionItems(true);

    try {
      const result = await extractActionItems(note.content);
      setActionItems(result.actionItems);
      setShowActionItems(true);
      toast({
        title: "Action items extracted",
        description: `Found ${result.actionItems.length} action item(s).`,
      });
    } catch (error: any) {
      console.error("Error extracting action items:", error);
      toast({
        title: "Extraction failed",
        description: error.message || "Could not extract action items.",
        variant: "destructive",
      });
    } finally {
      setIsExtractingActionItems(false);
    }
  };

  const handleActionItemStatusChange = (id: string, status: ActionItem['status']) => {
    setActionItems(prev => prev.map(item => 
      item.id === id ? { ...item, status } : item
    ));
  };

  const handleCreateShare = async () => {
    if (!note || !user || !id) return;

    try {
      const url = await sharing.createShareLink(id, user.id, sharePermission);
      setShareUrl(url);
    } catch (error: any) {
      console.error('Error creating share link:', error);
      toast({
        title: "Error",
        description: error.message || "Could not create share link.",
        variant: "destructive",
      });
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not copy link. Please copy manually.",
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading note...</p>
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-3 sm:p-4">
      <div className="container mx-auto max-w-4xl pt-4 sm:pt-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold mb-3">{note.title}</h1>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                </div>
                {note.duration && (
                  <div className="flex items-center gap-1.5">
                    <Mic className="w-4 h-4" />
                    {formatTime(note.duration)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="text-primary hover:bg-primary/10">
                    <Download className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!note) return;
                      const content = await exportToNotion(note);
                      const blob = new Blob([content], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${note.title}-notion.md`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Exported", description: "Note exported to Notion format." });
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Export to Notion
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!note) return;
                      const content = await exportToGmail(note);
                      const blob = new Blob([content], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${note.title}-email.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Exported", description: "Note exported as HTML email." });
                    }}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Export as Email
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!note) return;
                      sendViaGmail(note);
                      toast({ title: "Opening Gmail", description: "Gmail compose window opened." });
                    }}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Send via Gmail
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (!note) return;
                      const ical = await exportToICal(note);
                      const blob = new Blob([ical], { type: 'text/calendar' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${note.title}.ics`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Exported", description: "Note exported to iCal format." });
                    }}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Export to Calendar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-primary hover:bg-primary/10"
                  >
                    <Share2 className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Share Note</DialogTitle>
                    <DialogDescription>
                      Create a shareable link for this note
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="permission">Permission</Label>
                      <Select
                        value={sharePermission}
                        onValueChange={(value: 'read' | 'edit') => setSharePermission(value)}
                      >
                        <SelectTrigger id="permission">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="read">Read-only</SelectItem>
                          <SelectItem value="edit">Can Edit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!shareUrl ? (
                      <Button onClick={handleCreateShare} className="w-full">
                        <Share2 className="w-4 h-4 mr-2" />
                        Create Share Link
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Label>Share Link</Label>
                        <div className="flex gap-2">
                          <Input value={shareUrl} readOnly className="flex-1" />
                          <Button
                            onClick={handleCopyShareLink}
                            variant="outline"
                            size="icon"
                          >
                            {isCopying ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                onClick={() => navigate(`/notes/${id}/chat`)}
                className="text-primary hover:bg-primary/10"
              >
                <MessageCircle className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Chat</span>
              </Button>
              <Button
                variant="ghost"
                onClick={handleDeleteNote}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <Card className="p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <Button
                size="lg"
                variant={isPlaying ? "outline" : "default"}
                onClick={handlePlayPause}
                className="flex-shrink-0 w-full sm:w-auto min-h-[48px] text-base"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Play
                  </>
                )}
              </Button>
              <div className="flex-1 min-h-[48px]">
                <audio
                  ref={audioPlayerRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                  className="w-full"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Transcription */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Transcription</span>
            {note.content && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExtractActionItems}
                disabled={isExtractingActionItems}
                className="h-8"
              >
                {isExtractingActionItems ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <ListTodo className="w-3 h-3 mr-2" />
                    Extract Action Items
                  </>
                )}
              </Button>
            )}
          </div>
          <Card className="p-4 sm:p-6">
            {note.content ? (
              <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground">
                {note.content}
              </p>
            ) : (
              <p className="text-muted-foreground italic">
                No transcription available for this note.
              </p>
            )}
          </Card>
        </div>

        {/* Action Items */}
        {showActionItems && actionItems.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <div className="mb-3">
              <span className="text-sm font-medium text-muted-foreground">Action Items</span>
            </div>
            <ActionItemsList
              actionItems={actionItems}
              onStatusChange={handleActionItemStatusChange}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default NoteDetail;

