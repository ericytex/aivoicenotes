import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, Calendar, Mic, Lock, Edit } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { db, Note } from "@/lib/database";
import { storage } from "@/lib/storage";
import { sharing, ShareSettings } from "@/lib/sharing";

const SharedNote = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [note, setNote] = useState<Note | null>(null);
  const [shareSettings, setShareSettings] = useState<ShareSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    const loadSharedNote = async () => {
      try {
        // Get share settings
        const share = sharing.getShareByToken(token);
        if (!share) {
          toast({
            title: "Invalid link",
            description: "This shared link is invalid or has expired.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setShareSettings(share);

        // Load the note
        await db.init();
        const loadedNote = await db.getNoteById(share.noteId);
        
        if (!loadedNote) {
          toast({
            title: "Note not found",
            description: "The shared note could not be found.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setNote(loadedNote);
        setEditedContent(loadedNote.content || "");

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
        console.error("Error loading shared note:", error);
        toast({
          title: "Error",
          description: "Could not load the shared note.",
          variant: "destructive",
        });
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    loadSharedNote();
  }, [token, navigate, toast]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleSave = async () => {
    if (!note || !token || !sharing.hasPermission(token, 'edit')) {
      return;
    }

    setIsSaving(true);

    try {
      await db.updateNote(note.id, {
        content: editedContent,
      });

      setNote({ ...note, content: editedContent });

      toast({
        title: "Changes saved",
        description: "Your edits have been saved.",
      });
    } catch (error) {
      console.error("Error saving note:", error);
      toast({
        title: "Error",
        description: "Could not save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

  const canEdit = shareSettings && sharing.hasPermission(token!, 'edit');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <p className="text-muted-foreground">Loading shared note...</p>
      </div>
    );
  }

  if (!note || !shareSettings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-3 sm:p-4">
      <div className="container mx-auto max-w-4xl pt-4 sm:pt-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4 text-sm sm:text-base"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold">{note.title}</h1>
                {canEdit ? (
                  <Badge variant="outline" className="gap-1">
                    <Edit className="w-3 h-3" />
                    Editable
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="w-3 h-3" />
                    Read-only
                  </Badge>
                )}
              </div>
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
          <div className="mb-3">
            <span className="text-sm font-medium text-muted-foreground">Transcription</span>
          </div>
          {canEdit ? (
            <>
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-[280px] sm:min-h-[320px] text-base leading-relaxed resize-y"
              />
              <div className="mt-3">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || editedContent === note.content}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedNote;

