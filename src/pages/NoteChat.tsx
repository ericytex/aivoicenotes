import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Loader2, Bot, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db, Note } from "@/lib/database";
import { GoogleGenAI, createUserContent } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const NoteChat = () => {
  const { id } = useParams<{ id: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNote, setIsLoadingNote] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    loadNote();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadNote = async () => {
    if (!id || !user) return;

    try {
      await db.init();
      const loadedNote = await db.getNoteById(id);
      
      if (!loadedNote) {
        toast({
          title: "Note not found",
          description: "The note you're looking for doesn't exist.",
          variant: "destructive",
        });
        navigate("/notes");
        return;
      }

      // Verify ownership
      if (loadedNote.user_id !== user.id) {
        toast({
          title: "Access denied",
          description: "You don't have permission to access this note.",
          variant: "destructive",
        });
        navigate("/notes");
        return;
      }

      setNote(loadedNote);
      
      // Initialize with a welcome message
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm here to help you with your note "${loadedNote.title}". You can ask me questions about the content, request summaries, clarifications, or ask me to expand on specific sections.`,
        timestamp: new Date(),
      }]);
    } catch (error: any) {
      console.error('Error loading note:', error);
      toast({
        title: "Error",
        description: error.message || "Could not load note.",
        variant: "destructive",
      });
      navigate("/notes");
    } finally {
      setIsLoadingNote(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !note || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!geminiKey) {
        throw new Error('AI service not configured');
      }

      // Build context from note content
      const noteContext = note.content || 'No content available in this note.';

      const ai = new GoogleGenAI({ apiKey: geminiKey });

      // Build system prompt with note context
      const systemPrompt = `You are a helpful AI assistant helping the user understand and work with their voice notes. The note is titled "${note.title}" and contains the following content:\n\n${noteContext}\n\nAnswer questions about the note, provide summaries, clarify points, expand on sections, or help organize the information. Be concise but helpful.`;

      // Build conversation for Gemini - combine system prompt with conversation history
      const allMessages = [
        systemPrompt,
        ...messages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`),
        `User: ${userMessage.content}`
      ].join('\n\n');

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: createUserContent([allMessages]),
      });

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.text || 'I apologize, but I couldn\'t generate a response.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Error getting AI response:', error);
      toast({
        title: "Error",
        description: error.message || "Could not get AI response. Please try again.",
        variant: "destructive",
      });
      
      // Add error message to chat
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoadingNote) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!note) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex flex-col">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate(`/notes/${id}`)}
            size="sm"
            className="text-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate">Chat: {note.title}</h1>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <Card className={`max-w-[85%] sm:max-w-[75%] p-3 sm:p-4 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card'
              }`}>
                <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </Card>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <Card className="p-3 sm:p-4 bg-card">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-card/50 backdrop-blur-sm sticky bottom-0">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 max-w-4xl">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about this note..."
              className="flex-1 text-base sm:text-lg h-11 sm:h-12"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="lg"
              className="bg-primary hover:bg-primary/90 min-w-[48px] min-h-[48px]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteChat;

