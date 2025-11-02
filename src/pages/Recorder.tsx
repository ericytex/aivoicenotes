import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mic, Square, Play, Pause, Save, ArrowLeft, Highlighter } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/database";
import { storage } from "@/lib/storage";
import { transcription as transcriptionService } from "@/lib/transcription";

const Recorder = () => {
  const [noteTitle, setNoteTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const [liveTranscription, setLiveTranscription] = useState<string>("");
  const [isLiveTranscribing, setIsLiveTranscribing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<{ current: number; total: number } | null>(null);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [highlightedText, setHighlightedText] = useState<string>("");
  const liveTranscriptionRef = useRef<string>("");
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const liveTranscriptionContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const isPausedRef = useRef(false);
  const autoTranscribeRef = useRef(autoTranscribe);
  const transcriptionQueueRef = useRef<Blob[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Update refs when values change
  useEffect(() => {
    autoTranscribeRef.current = autoTranscribe;
  }, [autoTranscribe]);

  // Process transcription queue to avoid overlapping requests
  const processTranscriptionQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || transcriptionQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    setIsLiveTranscribing(true);

    while (transcriptionQueueRef.current.length > 0 && !isPausedRef.current) {
      const chunk = transcriptionQueueRef.current.shift();
      if (!chunk) break;

      try {
        const transcribedText = await transcriptionService.transcribeChunk(chunk, 'groq');
        if (transcribedText && transcribedText.trim()) {
          // Split the new text into words for word-by-word display
          const newWords = transcribedText.trim().split(/\s+/).filter(word => word.length > 0);
          
          // Get current displayed words
          const currentWords = liveTranscriptionRef.current 
            ? liveTranscriptionRef.current.split(/\s+/).filter(word => word.length > 0)
            : [];
          
          // Find where to start appending (to avoid duplicating words)
          const lastFewWords = currentWords.slice(-5).join(' ').toLowerCase();
          let startIndex = 0;
          
          // Check if some words might overlap (common prefix detection)
          for (let i = 0; i < Math.min(newWords.length, 5); i++) {
            const prefix = newWords.slice(0, i + 1).join(' ').toLowerCase();
            if (lastFewWords.includes(prefix)) {
              startIndex = i + 1;
            }
          }
          
          // Display words in batches for real-time feel
          // Group words into batches of 3-5 for faster updates while maintaining smooth appearance
          const wordsToAdd = newWords.slice(startIndex);
          const batchSize = 3;
          
          for (let i = 0; i < wordsToAdd.length; i += batchSize) {
            const batch = wordsToAdd.slice(i, i + batchSize);
            const previousText = liveTranscriptionRef.current || '';
            const newText = previousText 
              ? `${previousText} ${batch.join(' ')}`
              : batch.join(' ');
            
            liveTranscriptionRef.current = newText;
            setLiveTranscription(newText);
            
            // Reduced delay for faster updates (10ms per batch instead of 30ms per word)
            if (i + batchSize < wordsToAdd.length) {
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
        }
      } catch (error) {
        console.error('Error transcribing chunk:', error);
        // Don't show error toasts during live transcription to avoid spam
      }
    }

    isProcessingQueueRef.current = false;
    setIsLiveTranscribing(false);
  }, []);

  // Handle live transcription chunks during recording - add to queue
  const handleLiveTranscriptionChunk = useCallback((chunk: Blob) => {
    if (!autoTranscribeRef.current || isPausedRef.current) return;
    
    // Add to queue and process if not already processing
    transcriptionQueueRef.current.push(chunk);
    
    // Limit queue size to prevent memory issues (keep last 3 chunks)
    if (transcriptionQueueRef.current.length > 3) {
      transcriptionQueueRef.current.shift();
    }
    
    // Trigger processing if not already processing
    if (!isProcessingQueueRef.current) {
      processTranscriptionQueue();
    }
  }, [processTranscriptionQueue]);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    pauseRecording,
    stopRecording,
    resetRecording,
  } = useVoiceRecorder(handleLiveTranscriptionChunk);

  // Update ref when isPaused changes
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Create audio URL when blob is available
  useEffect(() => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      console.log('Created audio URL:', url, 'Blob size:', audioBlob.size, 'Blob type:', audioBlob.type);
      setAudioUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setAudioUrl(null);
      setIsPlaying(false);
    }
  }, [audioBlob]);

  // Update audio source when URL changes
  useEffect(() => {
    if (audioPlayerRef.current && audioUrl) {
      audioPlayerRef.current.src = audioUrl;
      audioPlayerRef.current.load();
    }
  }, [audioUrl]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  const handlePlayPause = async () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    
    try {
      if (isPlaying) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        // Load the audio source if needed
        if (audioPlayerRef.current.src !== audioUrl) {
          audioPlayerRef.current.src = audioUrl;
          await audioPlayerRef.current.load();
        }
        await audioPlayerRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      toast({
        title: "Playback error",
        description: "Could not play audio. Please check your browser audio settings.",
        variant: "destructive",
      });
      setIsPlaying(false);
    }
  };

  const handleTranscribe = useCallback(async () => {
    if (!audioBlob) {
      toast({
        title: "No audio",
        description: "Please record something first.",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress({ current: 0, total: 1 });

    try {
      toast({
        title: "Transcribing",
        description: "Processing your audio recording...",
      });

      const transcribedText = await transcriptionService.transcribeInChunks(
        audioBlob,
        30, // 30 second chunks
        'groq',
        undefined,
        (current, total) => {
          setTranscriptionProgress({ current, total });
        },
        true // include timestamps
      );

      setTranscription(transcribedText);
      setIsTranscribing(false);
      setTranscriptionProgress(null);

      toast({
        title: "Transcription complete!",
        description: "Your audio has been transcribed.",
      });
    } catch (error: any) {
      console.error('Error transcribing:', error);
      setIsTranscribing(false);
      setTranscriptionProgress(null);
      toast({
        title: "Transcription failed",
        description: error.message || "Could not transcribe audio. Please try again.",
        variant: "destructive",
      });
    }
  }, [audioBlob, toast]);

  // When recording stops, use live transcription as final if available
  useEffect(() => {
    if (!isRecording && liveTranscription && !transcription) {
      // Use live transcription as final
      setTranscription(liveTranscription);
    }
  }, [isRecording, liveTranscription, transcription]);

  // Track if note has been auto-saved
  const [hasAutoSaved, setHasAutoSaved] = useState(false);

  const performAutoSave = useCallback(async () => {
    if (!audioBlob || !user || hasAutoSaved || isSaving) return;

    try {
      setIsSaving(true);
      setHasAutoSaved(true);
      
      // Initialize database
      await db.init();

      // Save audio to IndexedDB storage
      const audioKey = storage.generateAudioKey(user.id);
      await storage.saveAudio(audioKey, audioBlob);
      const savedAudioUrl = storage.createBlobURL(audioKey);

      // Get final transcription
      const finalTranscription = transcription || liveTranscription;

      // Save note to database
      await db.createNote({
        user_id: user.id,
        title: noteTitle || 'Voice Note',
        content: finalTranscription || null,
        audio_url: savedAudioUrl,
        duration: recordingTime,
      });

      toast({
        title: "Note saved",
        description: "Your voice note has been automatically saved.",
      });

      // Navigate to notes page after a short delay
      setTimeout(() => {
        navigate('/notes');
      }, 1500);
    } catch (error: any) {
      console.error('Error auto-saving recording:', error);
      setIsSaving(false);
      setHasAutoSaved(false);
      toast({
        title: "Save failed",
        description: "Could not save note. Please try again.",
        variant: "destructive",
      });
    }
  }, [audioBlob, user, hasAutoSaved, isSaving, transcription, liveTranscription, noteTitle, recordingTime, toast, navigate]);

  // Auto-save when recording stops and we have audio
  useEffect(() => {
    if (!isRecording && audioBlob && !hasAutoSaved && !isSaving && user && isAuthenticated) {
      // If auto-transcribe is disabled, save immediately
      if (!autoTranscribe) {
        const timer = setTimeout(() => {
          performAutoSave();
        }, 500);
        return () => clearTimeout(timer);
      }
      // If auto-transcribe is enabled, wait for transcription to finish
      else if (autoTranscribe && !isLiveTranscribing && (transcription || liveTranscription)) {
        const timer = setTimeout(() => {
          performAutoSave();
        }, 2000); // Wait 2 seconds after transcription appears
        return () => clearTimeout(timer);
      }
    }
  }, [isRecording, audioBlob, hasAutoSaved, isSaving, user, isAuthenticated, autoTranscribe, isLiveTranscribing, transcription, liveTranscription, performAutoSave]);

  // Reset live transcription and auto-save flag when starting new recording
  useEffect(() => {
    if (isRecording) {
      setLiveTranscription("");
      liveTranscriptionRef.current = "";
      setHasAutoSaved(false);
    }
  }, [isRecording]);

  // Auto-scroll live transcription to bottom as new text arrives
  useEffect(() => {
    if (liveTranscriptionContainerRef.current && liveTranscription) {
      const container = liveTranscriptionContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [liveTranscription]);

  const handleSaveRecording = async () => {
    if (!audioBlob) {
      toast({
        title: "No recording",
        description: "Please record something first.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please sign in to save notes.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setIsSaving(true);

    try {
      // Initialize database
      await db.init();

      // Save audio to IndexedDB storage
      const audioKey = storage.generateAudioKey(user.id);
      await storage.saveAudio(audioKey, audioBlob);
      const savedAudioUrl = storage.createBlobURL(audioKey);

      // Save note to database (include transcription if available)
      await db.createNote({
        user_id: user.id,
        title: noteTitle || 'Voice Note',
        content: transcription || null,
        audio_url: savedAudioUrl,
        duration: recordingTime,
      });

      toast({
        title: "Note saved!",
        description: "Your voice note has been saved.",
      });

      // Navigate to notes page
      navigate('/notes');
    } catch (error: any) {
      console.error('Error saving recording:', error);
      toast({
        title: "Error saving note",
        description: error.message || "Could not save your recording. Please try again.",
        variant: "destructive",
      });
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-gradient-to-b from-background to-secondary/20 flex flex-col overflow-hidden">
      <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/notes')}
            className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            size="sm"
          >
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="text-center flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">Voice Recorder</h1>
          </div>
          <div className="w-16 sm:w-20" /> {/* Spacer for centering */}
        </div>
      </div>

      <div className="flex-1 container mx-auto max-w-4xl px-3 sm:px-4 overflow-y-auto">
        <Card className="p-3 sm:p-4 md:p-6 bg-card/50 backdrop-blur-sm min-h-fit">
          {/* Title Input */}
          {!isRecording && audioBlob && (
            <div className="mb-3 sm:mb-4">
              <Input
                type="text"
                placeholder="Note title (optional)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="text-sm sm:text-base h-10 sm:h-11"
              />
            </div>
          )}

          {/* Audio Player */}
          {!isRecording && audioBlob && audioUrl && (
            <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-muted/50 rounded-lg border">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
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
                    src={audioUrl || undefined}
                    preload="auto"
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={(e) => {
                      console.error('Audio playback error:', e);
                      toast({
                        title: "Audio error",
                        description: "Could not load audio file.",
                        variant: "destructive",
                      });
                      setIsPlaying(false);
                    }}
                    onLoadedData={() => {
                      console.log('Audio loaded successfully');
                    }}
                    controls
                    className="w-full"
                  />
                </div>
              </div>
              
              {/* Transcribe Button - Only show when auto-transcribe is OFF */}
              {!autoTranscribe && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="rounded-full px-4 sm:px-6 min-h-[44px] text-sm sm:text-base flex-shrink-0"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span className="hidden sm:inline">
                          {transcriptionProgress 
                            ? `Transcribing ${transcriptionProgress.current}/${transcriptionProgress.total}...`
                            : 'Transcribing...'}
                        </span>
                        <span className="sm:hidden">Transcribing...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        Transcribe
                      </>
                    )}
                  </Button>
                  {transcriptionProgress && (
                    <div className="flex-1 min-h-[8px]">
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${(transcriptionProgress.current / transcriptionProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 text-center sm:hidden">
                        {transcriptionProgress.current}/{transcriptionProgress.total}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Auto-transcribe Toggle */}
          {!isRecording && !audioBlob && (
            <div className="mb-3 sm:mb-4 flex items-center justify-between p-2 sm:p-3 bg-muted/30 rounded-lg min-h-[44px]">
              <div className="flex items-center gap-2 flex-1">
                <Label htmlFor="auto-transcribe" className="text-sm sm:text-base font-medium cursor-pointer">
                  Auto-transcribe during recording
                </Label>
              </div>
              <Switch
                id="auto-transcribe"
                checked={autoTranscribe}
                onCheckedChange={setAutoTranscribe}
                className="flex-shrink-0"
              />
            </div>
          )}

          {/* Live Transcription Display - During Recording or After */}
          {(isRecording || (liveTranscription && !transcription) || isLiveTranscribing) && (
            <div className="mb-3 sm:mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {isRecording ? 'Live Transcription' : 'Transcribing'}
                </span>
                {isLiveTranscribing && (
                  <span className="text-xs text-muted-foreground">•</span>
                )}
                {liveTranscription && (
                  <span className="text-xs text-muted-foreground">
                    {liveTranscription.split(/\s+/).filter(w => w.length > 0).length} words
                  </span>
                )}
              </div>
              <div 
                ref={liveTranscriptionContainerRef}
                className="h-32 sm:h-40 p-3 sm:p-4 bg-background border rounded-lg overflow-y-auto"
              >
                {liveTranscription ? (
                  <p className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-wrap">
                    {liveTranscription}
                    {isLiveTranscribing && (
                      <span className="inline-block w-0.5 h-5 bg-primary ml-1 animate-pulse align-text-bottom" />
                    )}
                  </p>
                ) : (
                  <p className="text-base text-muted-foreground text-center py-8">
                    {isRecording ? (
                      <span>Recording... transcription will appear here</span>
                    ) : (
                      <span>Processing audio...</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Transcription Display - Editable */}
          {transcription && (
            <div className="mb-3 sm:mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">Transcription</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const selected = window.getSelection()?.toString();
                      if (selected) {
                        setHighlightedText(prev => prev ? `${prev}\n${selected}` : selected);
                        toast({
                          title: "Highlighted",
                          description: "Text saved to highlights",
                        });
                      } else {
                        toast({
                          title: "No text selected",
                          description: "Select text to highlight",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="h-8 px-2 text-xs"
                  >
                    <Highlighter className="w-3 h-3 mr-1.5" />
                    Highlight
                  </Button>
                </div>
              </div>
              <Textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder="Edit your transcription..."
                className="h-40 sm:h-48 text-sm sm:text-base leading-relaxed resize-none border-0 bg-background focus-visible:ring-1 focus-visible:ring-ring rounded-lg p-3 sm:p-4"
                style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Select text and click "Highlight" to save key points
                </p>
                <span className="text-xs text-muted-foreground">
                  {transcription.split(/\s+/).filter(w => w.length > 0).length} words
                </span>
              </div>
            </div>
          )}

          {/* Highlighted Text Display */}
          {highlightedText && (
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Highlighter className="w-3.5 h-3.5" />
                  Highlights
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setHighlightedText("")}
                  className="h-8 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {highlightedText.split('\n').filter(t => t.trim()).map((text, idx) => (
                  <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-yellow-400 dark:border-yellow-600 text-sm leading-relaxed">
                    {text.trim()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recording Visualization */}
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 my-2 sm:my-3">
            {/* Circular Recording Button */}
            <div className="relative">
              <button
                onClick={!isRecording && !audioBlob ? startRecording : undefined}
                className={`w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full flex items-center justify-center transition-all duration-300 touch-manipulation ${
                  isRecording 
                    ? 'bg-gradient-to-br from-primary to-primary-glow shadow-lg shadow-primary/50 cursor-default' 
                    : 'bg-secondary hover:bg-secondary/80 active:scale-95 cursor-pointer'
                } ${!isRecording && !audioBlob ? '' : 'pointer-events-none'}`}
              >
                {isRecording && (
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                )}
                <Mic className={`w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 ${isRecording ? 'text-primary-foreground' : 'text-primary'}`} />
              </button>
              
              {/* Recording indicator dots */}
              {isRecording && !isPaused && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse delay-75" />
                  <div className="w-2 h-2 rounded-full bg-destructive animate-pulse delay-150" />
                </div>
              )}
            </div>

            {/* Timer */}
            <div className="text-2xl sm:text-3xl md:text-4xl font-mono font-bold">
              {formatTime(recordingTime)}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {!isRecording && !audioBlob ? (
                <Button
                  size="lg"
                  onClick={startRecording}
                  className="bg-primary hover:bg-primary/90 active:scale-95 w-full sm:w-auto px-6 min-h-[48px] text-sm sm:text-base touch-manipulation"
                >
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Start Recording
                </Button>
              ) : isRecording ? (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={pauseRecording}
                    className="w-full sm:w-auto min-h-[48px] text-sm sm:text-base touch-manipulation"
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={stopRecording}
                    className="w-full sm:w-auto min-h-[48px] text-sm sm:text-base touch-manipulation"
                  >
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Stop
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => {
                      resetRecording();
                      setTranscription("");
                      setLiveTranscription("");
                      liveTranscriptionRef.current = "";
                      setHighlightedText("");
                      startRecording();
                    }}
                    className="w-full sm:w-auto min-h-[48px] text-sm sm:text-base touch-manipulation"
                  >
                    <Mic className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    Record Again
                  </Button>
                  
                  {!hasAutoSaved && (
                    <Button
                      size="lg"
                      className="bg-primary hover:bg-primary/90 active:scale-95 w-full sm:w-auto min-h-[48px] text-sm sm:text-base touch-manipulation"
                      onClick={handleSaveRecording}
                      disabled={isSaving}
                    >
                      <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                      {isSaving ? "Saving..." : "Save Note"}
                    </Button>
                  )}
                  {hasAutoSaved && (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>Note saved</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </Card>
      </div>
    </div>
  );
};

export default Recorder;

