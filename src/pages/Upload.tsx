import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileAudio, FileVideo, Link, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/database";
import { storage } from "@/lib/storage";
import { transcription as transcriptionService } from "@/lib/transcription";
import { GoogleGenAI, createUserContent } from "@google/genai";

const Upload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [transcription, setTranscription] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState<{ current: number; total: number } | null>(null);
  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check if it's audio or video
      if (selectedFile.type.startsWith('audio/') || selectedFile.type.startsWith('video/')) {
        setFile(selectedFile);
        setYoutubeUrl(""); // Clear YouTube URL if file selected
        
        // Auto-transcribe immediately
        setTimeout(() => {
          handleTranscribe(selectedFile);
        }, 300);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an audio or video file.",
          variant: "destructive",
        });
      }
    }
  };

  const handleYouTubeUrl = () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a YouTube URL.",
        variant: "destructive",
      });
      return;
    }

    // Extract video ID from YouTube URL
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = youtubeUrl.match(youtubeRegex);
    
    if (!match) {
      toast({
        title: "Invalid YouTube URL",
        description: "Please enter a valid YouTube URL.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "YouTube processing",
      description: "YouTube video processing will be implemented in the next phase.",
    });
  };

  const handleTranscribe = async (fileToTranscribe?: File) => {
    const fileToUse = fileToTranscribe || file;
    
    if (!fileToUse && !youtubeUrl) {
      toast({
        title: "No file or URL",
        description: "Please upload a file or enter a YouTube URL.",
        variant: "destructive",
      });
      return;
    }

    if (!fileToUse) {
      toast({
        title: "File required",
        description: "YouTube URL processing coming soon. Please upload a file.",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribing(true);
    setTranscriptionProgress({ current: 0, total: 1 });

    try {
      // Convert file to blob if needed
      const audioBlob = fileToUse instanceof Blob ? fileToUse : new Blob([fileToUse], { type: fileToUse.type });

      toast({
        title: "Transcribing",
        description: "Processing your audio/video file...",
      });

      // Transcribe using Gemini
      const transcribedText = await transcriptionService.transcribeInChunks(
        audioBlob,
        30, // 30 second chunks
        'gemini',
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
        description: "Your file has been transcribed.",
      });

      // Auto-generate title from transcription
      if (transcribedText && transcribedText.trim().length > 0) {
        try {
          const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (geminiKey) {
            const ai = new GoogleGenAI({ apiKey: geminiKey });
            const titleResponse = await ai.models.generateContent({
              model: "gemini-2.0-flash-exp",
              contents: createUserContent([
                `Based on the following transcription, generate a concise, descriptive title (max 60 characters) that captures the main topic or theme. Return only the title, no additional text.

Transcription:
${transcribedText.trim().substring(0, 500)}`
              ]),
            });

            const generatedTitle = titleResponse.text?.trim() || '';
            if (generatedTitle) {
              const cleanTitle = generatedTitle
                .replace(/^["']|["']$/g, '')
                .trim()
                .substring(0, 60);
              if (cleanTitle) {
                setNoteTitle(cleanTitle);
              }
            }
          }
        } catch (titleError) {
          console.warn('Failed to generate title:', titleError);
        }

        // Auto-generate summary after a short delay
        setTimeout(() => {
          handleGenerateSummary();
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error transcribing:', error);
      setIsTranscribing(false);
      setTranscriptionProgress(null);
      toast({
        title: "Transcription failed",
        description: error.message || "Could not transcribe file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcription) {
      toast({
        title: "No transcription",
        description: "Please transcribe the file first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingSummary(true);

    try {
      // Use Gemini API to generate summary
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error('AI service not configured');
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: createUserContent([
          `You are a helpful assistant that creates concise summaries of meeting transcripts and voice notes. Generate a clear, structured summary with key points.

Please provide a concise summary of the following transcription:

${transcription}`
        ]),
      });

      const summaryText = response.text || '';
      setSummary(summaryText);
      
      toast({
        title: "Summary generated",
        description: "AI summary created successfully.",
      });
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast({
        title: "Summary failed",
        description: error.message || "Could not generate summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSave = async () => {
    if (!file && !youtubeUrl) {
      toast({
        title: "No file or URL",
        description: "Please upload a file or enter a YouTube URL.",
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

    setIsProcessing(true);

    try {
      await db.init();

      let savedAudioUrl = null;
      let duration = 0;

      if (file) {
        // Save file to IndexedDB
        const audioKey = storage.generateAudioKey(user.id);
        await storage.saveAudio(audioKey, file);
        savedAudioUrl = storage.createBlobURL(audioKey);

        // Try to get duration
        if (file.type.startsWith('audio/')) {
          try {
            const url = URL.createObjectURL(file);
            const audio = new Audio(url);
            await new Promise((resolve, reject) => {
              audio.addEventListener('loadedmetadata', () => {
                duration = audio.duration;
                URL.revokeObjectURL(url);
                resolve(null);
              });
              audio.addEventListener('error', reject);
            });
          } catch (e) {
            console.warn('Could not get audio duration:', e);
          }
        }
      }

      // Save note to database
      await db.createNote({
        user_id: user.id,
        title: noteTitle || (file ? file.name : 'Uploaded Note'),
        content: transcription || null,
        audio_url: savedAudioUrl,
        duration: duration,
      });

      toast({
        title: "Note saved!",
        description: "Your uploaded note has been saved.",
      });

      navigate('/notes');
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast({
        title: "Error saving note",
        description: error.message || "Could not save your note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = (format: 'meeting-minutes' | 'blog-draft') => {
    if (!transcription && !summary) {
      toast({
        title: "No content",
        description: "Please transcribe and generate a summary first.",
        variant: "destructive",
      });
      return;
    }

    let content = '';
    if (format === 'meeting-minutes') {
      content = `Meeting Minutes\n\n${'='.repeat(50)}\n\n`;
      content += `Title: ${noteTitle || 'Untitled Note'}\n`;
      content += `Date: ${new Date().toLocaleDateString()}\n\n`;
      content += `Summary:\n${summary || 'No summary available'}\n\n`;
      content += `Full Transcript:\n${transcription || 'No transcription available'}\n`;
    } else {
      content = `# ${noteTitle || 'Blog Post'}\n\n`;
      content += `**Summary**\n\n${summary || transcription?.substring(0, 200) || 'No content'}\n\n`;
      content += `## Full Content\n\n${transcription || 'No transcription available'}\n`;
    }

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${noteTitle || 'note'}-${format === 'meeting-minutes' ? 'minutes' : 'blog'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Exported",
      description: `File exported as ${format === 'meeting-minutes' ? 'meeting minutes' : 'blog draft'}.`,
    });
  };

  return (
    <div className="h-screen bg-gradient-to-b from-background to-secondary/20 flex flex-col overflow-hidden">
      <div className="container mx-auto max-w-7xl px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">Upload & Transcribe</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Upload audio/video files for transcription</p>
          </div>
        </div>

        {/* Title Input - At top when available */}
        {(file || transcription) && (
          <div className="mb-3">
            <div className="mb-1">
              <label className="text-xs font-medium text-muted-foreground">Note Title</label>
              {noteTitle && (
                <span className="ml-2 text-xs text-muted-foreground italic">
                  (Auto-generated, edit if needed)
                </span>
              )}
            </div>
            <Input
              type="text"
              placeholder={noteTitle || "Auto-generating title..."}
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="text-sm sm:text-base h-10 sm:h-11"
            />
          </div>
        )}
      </div>

      <div className="flex-1 container mx-auto max-w-7xl px-3 sm:px-4 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 pb-4">
          {/* Left Column - Upload & Controls */}
          <div className="flex flex-col space-y-4 sm:space-y-6">
            <Card className="p-3 sm:p-4 bg-card/50 backdrop-blur-sm h-fit">
              {/* File Upload */}
              <div className="mb-4">
                <label className="text-xs sm:text-sm font-medium mb-2 block">Upload Audio/Video File</label>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
                  <Upload className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Audio or video files (MP3, WAV, MP4, etc.)
                  </p>
                  {file && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                      {file.type.startsWith('audio/') ? (
                        <FileAudio className="w-4 h-4 text-primary" />
                      ) : (
                        <FileVideo className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-xs sm:text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setTranscription("");
                          setSummary("");
                          setNoteTitle("");
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="h-6 w-6 p-0 flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* YouTube URL */}
              <div className="mb-4">
                <label className="text-xs sm:text-sm font-medium mb-2 block">Or Enter YouTube URL</label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      if (e.target.value) setFile(null);
                    }}
                    className="flex-1 text-sm h-9 sm:h-10"
                  />
                  <Button onClick={handleYouTubeUrl} variant="outline" size="sm" className="h-9 sm:h-10">
                    <Link className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Process
                  </Button>
                </div>
              </div>

              {/* Transcription Status */}
              {isTranscribing && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {transcriptionProgress
                        ? `Transcribing ${transcriptionProgress.current}/${transcriptionProgress.total}...`
                        : 'Transcribing...'}
                    </span>
                  </div>
                  {transcriptionProgress && (
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${(transcriptionProgress.current / transcriptionProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Summary Generation Status */}
              {isGeneratingSummary && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating summary...</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Save Button */}
            {(file || youtubeUrl) && transcription && (
              <Button
                size="lg"
                onClick={handleSave}
                disabled={isProcessing}
                className="bg-primary hover:bg-primary/90 min-h-[48px] w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Note'
                )}
              </Button>
            )}
          </div>

          {/* Right Column - Transcription & Summary */}
          <div className="flex flex-col space-y-4 sm:space-y-6">
            {/* Transcription Display */}
            {transcription && (
              <Card className="p-3 sm:p-4 bg-card/50 backdrop-blur-sm flex flex-col" style={{ minHeight: transcription && summary ? 'calc(50% - 0.5rem)' : '100%' }}>
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">Transcription</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setTranscription("")}
                      className="h-7 px-2 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <Textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Transcription will appear here..."
                    className="min-h-[250px] sm:min-h-[300px] text-sm sm:text-base leading-relaxed resize-none border-0 bg-background focus-visible:ring-1 focus-visible:ring-ring rounded-lg p-3 sm:p-4"
                    style={{ height: transcription && summary ? '100%' : 'auto' }}
                  />
                </div>
              </Card>
            )}

            {/* Summary Display */}
            {summary && (
              <Card className="p-3 sm:p-4 bg-card/50 backdrop-blur-sm flex flex-col" style={{ minHeight: transcription && summary ? 'calc(50% - 0.5rem)' : '100%' }}>
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">AI Summary</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSummary("")}
                    className="h-7 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-foreground p-2 min-h-[150px]">
                    {summary}
                  </div>
                </div>
              </Card>
            )}

            {/* Export Buttons */}
            {(transcription || summary) && (
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('meeting-minutes')}
                  className="flex-1 text-xs sm:text-sm"
                >
                  Export Minutes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExport('blog-draft')}
                  className="flex-1 text-xs sm:text-sm"
                >
                  Export Blog
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;

