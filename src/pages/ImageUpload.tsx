import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Image as ImageIcon, X, Loader2, Tag } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/database";
import { createWorker } from "tesseract.js";
import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Navigation from "@/components/Navigation";

const ImageUpload = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [structuredNotes, setStructuredNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
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
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      
      // Create preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setImagePreview(preview);
        
        // Automatically start text extraction once image is loaded
        // Use the selectedFile directly and ensure preview is set
        setTimeout(() => {
          handleExtractText(selectedFile, preview);
        }, 200);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
    }
  };

  const extractWithGemini = async (imageFile: File): Promise<string> => {
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) {
      throw new Error('AI service not configured');
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    // Upload the image file to Gemini
    const uploadedFile = await ai.files.upload({
      file: imageFile,
      config: {
        mimeType: imageFile.type || 'image/png'
      }
    });

    // Use Gemini Vision to extract text
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        "Extract all text from this image accurately. Return only the extracted text without any additional commentary, formatting, or explanations. Preserve line breaks and structure."
      ]),
    });

    // Clean up the uploaded file
    try {
      await ai.files.delete({ name: uploadedFile.name });
    } catch (cleanupError) {
      console.warn('Failed to cleanup image file:', cleanupError);
    }

    return response.text || '';
  };

  const extractWithTesseract = async (imageFile: File): Promise<string> => {
    // Create Tesseract worker
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(m.progress * 100);
          setExtractionProgress(progress);
        }
      }
    });

    // Perform OCR on the image
    const { data: { text } } = await worker.recognize(imageFile);

    // Clean up worker
    await worker.terminate();

    return text;
  };

  const handleExtractText = async (fileToExtract?: File, previewToUse?: string) => {
    const fileToUse = fileToExtract || file;
    const preview = previewToUse || imagePreview;
    
    if (!fileToUse) {
      toast({
        title: "No image",
        description: "Please upload an image first.",
        variant: "destructive",
      });
      return;
    }

    if (!preview) {
      // Wait a bit for preview to load if it's not ready
      await new Promise(resolve => setTimeout(resolve, 300));
      const currentPreview = imagePreview;
      if (!currentPreview) {
        toast({
          title: "Image loading",
          description: "Please wait for the image to load.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsExtracting(true);
    setExtractionProgress(10);

    try {
      let extractedText = '';
      let usedGemini = false;

      // Try Gemini first (more accurate)
      try {
        toast({
          title: "Extracting text",
          description: "Analyzing image and extracting text...",
        });

        setExtractionProgress(30);
        extractedText = await extractWithGemini(fileToUse);
        usedGemini = true;
        setExtractionProgress(100);

        toast({
          title: "Text extracted",
          description: "Text extracted successfully.",
        });
      } catch (geminiError: any) {
        console.warn('Gemini extraction failed, falling back to Tesseract:', geminiError);
        
        // Fallback to Tesseract
        toast({
          title: "Processing image",
          description: "Analyzing image...",
        });

        setExtractionProgress(20);
        extractedText = await extractWithTesseract(fileToUse);
        setExtractionProgress(100);

        toast({
          title: "Text extracted",
          description: "Text extracted successfully.",
        });
      }

      // Clean and format the extracted text
      const cleanedText = extractedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n')
        .trim();

      if (!cleanedText) {
        toast({
          title: "No text found",
          description: "Could not extract any text from the image. Please ensure the image contains clear, readable text.",
          variant: "destructive",
        });
        return;
      }

      setExtractedText(cleanedText);

      // Auto-organize the extracted text
      if (cleanedText && cleanedText.trim().length > 0) {
        // Small delay to let extraction complete
        setTimeout(() => {
          handleOrganizeNotes(cleanedText);
        }, 500);
      }
    } catch (error: any) {
      console.error('Error extracting text:', error);
      toast({
        title: "Extraction failed",
        description: error.message || "Could not extract text. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
      setExtractionProgress(0);
    }
  };

  const handleOrganizeNotes = async (textToOrganize?: string) => {
    const text = textToOrganize || extractedText;
    
    if (!text || text.trim().length === 0) {
      if (!textToOrganize) {
        toast({
          title: "No text",
          description: "Please extract text from the image first.",
          variant: "destructive",
        });
      }
      return;
    }

    setIsOrganizing(true);

    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!geminiKey) {
        toast({
          title: "Configuration error",
          description: "AI service not configured. Please check your environment variables.",
          variant: "destructive",
        });
        setIsOrganizing(false);
        return;
      }

      if (!textToOrganize) {
        toast({
          title: "Organizing notes",
          description: "Structuring and organizing content...",
        });
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey });

      // Use Gemini to organize the text
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: createUserContent([
          `You are a helpful assistant that organizes unstructured text from handwritten notes or images into well-structured, professional notes.

Analyze the following extracted text and organize it into a clear, structured format with:
- Meaningful section headings based on topics/themes
- Bullet points or numbered lists where appropriate
- Clear hierarchy and organization
- Preserved important details, dates, names, and key information
- Logical flow and readability

Do not just format it as markdown. Instead, intelligently organize it into sections with proper headings, group related items together, and make it easy to understand and reference.

Extracted text:
${text}`
        ]),
      });

      const organizedText = response.text || '';
      
      if (!organizedText || organizedText.trim().length === 0) {
        throw new Error('Received empty response from API');
      }

      setStructuredNotes(organizedText.trim());

      // Auto-generate intelligent title from organized content
      if (organizedText.trim().length > 0) {
        try {
          const titleResponse = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: createUserContent([
              `Based on the following organized notes, generate a concise, descriptive title (max 60 characters) that captures the main topic or theme. Return only the title, no additional text.

Notes:
${organizedText.trim().substring(0, 500)}`
            ]),
          });

          const generatedTitle = titleResponse.text?.trim() || '';
          if (generatedTitle) {
            // Clean up title (remove quotes, extra whitespace, etc.)
            const cleanTitle = generatedTitle
              .replace(/^["']|["']$/g, '')
              .trim()
              .substring(0, 60);
            if (cleanTitle) {
              setNoteTitle(cleanTitle);
            }
          }
        } catch (titleError) {
          console.warn('Failed to generate title:', titleError);
          // Continue without auto-title if it fails
        }
      }
      
      toast({
        title: "Notes organized",
        description: "Text has been organized into structured notes.",
      });
    } catch (error: any) {
      console.error('Error organizing notes:', error);
      const errorMessage = error.message || "Could not organize notes. Please try again.";
      toast({
        title: "Organization failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsOrganizing(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!file) {
      toast({
        title: "No image",
        description: "Please upload an image first.",
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

      // Save note with structured content
      await db.createNote({
        user_id: user.id,
        title: noteTitle || (file ? file.name : 'Image Note'),
        content: structuredNotes || extractedText || null,
        audio_url: null,
        duration: null,
        tags: tags.length > 0 ? tags : undefined,
      });

      toast({
        title: "Note saved!",
        description: "Your image note has been saved.",
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <Navigation />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Image to Notes</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Upload an image to extract and organize text automatically
          </p>
        </div>

        {/* Note Title - Always at the top */}
        {file && (
          <div className="mb-4 sm:mb-6">
            <div className="mb-2">
              <label className="text-sm font-medium text-muted-foreground">Note Title</label>
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
              className="text-base sm:text-lg h-11 sm:h-12"
            />
          </div>
        )}

        {/* Main Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Left Column - Image Upload & Status */}
          <div className="flex flex-col space-y-4 sm:space-y-6">
            <Card className="p-4 sm:p-6 bg-card/50 backdrop-blur-sm h-fit">
              {/* Image Upload */}
              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Upload Image</label>
                <div
                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 sm:p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-48 sm:max-h-64 mx-auto rounded-lg"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setImagePreview(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-2 right-2 bg-background/80"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <ImageIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Images (JPG, PNG, etc.)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Extraction Status */}
              {isExtracting && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {extractionProgress > 0 ? `Extracting... ${extractionProgress}%` : 'Initializing...'}
                    </span>
                  </div>
                  {extractionProgress > 0 && (
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${extractionProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Organization Status */}
              {isOrganizing && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Auto-organizing notes...</span>
                  </div>
                </div>
              )}

              {/* Manual Organize Button (fallback) */}
              {extractedText && extractedText.trim().length > 0 && !structuredNotes && !isOrganizing && (
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOrganizeNotes();
                    }}
                    disabled={!extractedText || extractedText.trim().length === 0}
                    className="w-full min-h-[40px]"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Organize Notes
                  </Button>
                </div>
              )}
            </Card>

            {/* Tags Section - Left Column */}
            {structuredNotes && (
              <Card className="p-4 sm:p-6 bg-card/50 backdrop-blur-sm">
                <label className="text-sm font-medium mb-3 block">Tags</label>
                <div className="flex gap-2 mb-3">
                  <Input
                    type="text"
                    placeholder="Add a tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handleAddTag} variant="outline" size="sm">
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center gap-1 bg-secondary px-3 py-1 rounded-full text-sm"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTag(tag)}
                          className="h-4 w-4 p-0 hover:bg-transparent"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* Right Column - Structured Notes Preview */}
          <div className="flex flex-col">
            {structuredNotes && (
              <Card className="p-4 sm:p-6 bg-card/50 backdrop-blur-sm h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <span className="text-sm font-medium text-muted-foreground">Structured Notes</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStructuredNotes("");
                      setExtractedText("");
                    }}
                    className="h-8 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none 
                    prose-headings:font-semibold 
                    prose-headings:text-foreground
                    prose-p:text-foreground
                    prose-strong:text-foreground
                    prose-strong:font-semibold
                    prose-ul:text-foreground
                    prose-ol:text-foreground
                    prose-li:text-foreground
                    prose-a:text-primary
                    prose-a:underline
                    prose-code:text-foreground
                    prose-pre:bg-secondary">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl sm:text-2xl font-bold mt-4 mb-3 text-foreground" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg sm:text-xl font-semibold mt-4 mb-2 text-foreground" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base sm:text-lg font-semibold mt-3 mb-2 text-foreground" {...props} />,
                        p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-foreground text-sm sm:text-base" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="text-foreground text-sm sm:text-base" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                        code: ({node, ...props}) => <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-foreground" {...props} />,
                      }}
                    >
                      {structuredNotes}
                    </ReactMarkdown>
                  </div>
                </div>
                {/* Editable Source (collapsible) */}
                <details className="mt-4 flex-shrink-0">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground mb-2">
                    Edit Markdown Source
                  </summary>
                  <Textarea
                    value={structuredNotes}
                    onChange={(e) => setStructuredNotes(e.target.value)}
                    placeholder="Structured notes will appear here..."
                    className="min-h-[150px] text-sm leading-relaxed resize-y font-mono mt-2"
                  />
                </details>
              </Card>
            )}
          </div>
        </div>

        {/* Save Button - Full Width at Bottom */}
        {structuredNotes && (
          <div className="mt-4 sm:mt-6 flex justify-end">
            <Button
              size="lg"
              onClick={handleSave}
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90 min-h-[48px] px-8"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;

