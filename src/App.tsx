import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Navigation from "@/components/Navigation";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Recorder from "./pages/Recorder";
import Notes from "./pages/Notes";
import NoteDetail from "./pages/NoteDetail";
import NoteChat from "./pages/NoteChat";
import SharedNote from "./pages/SharedNote";
import Settings from "./pages/Settings";
import Upload from "./pages/Upload";
import ImageUpload from "./pages/ImageUpload";
import NotFound from "./pages/NotFound";
import { cn } from "@/lib/utils";

const queryClient = new QueryClient();

const AppLayout = () => {
  const location = useLocation();
  const isRootPath = location.pathname === '/';
  
  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className={cn(
        "flex-1 pb-16 md:pb-0",
        !isRootPath && "md:ml-64"
      )}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/recorder" element={<Recorder />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/image-upload" element={<ImageUpload />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/notes/:id" element={<NoteDetail />} />
          <Route path="/notes/:id/chat" element={<NoteChat />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/shared/:token" element={<SharedNote />} />
            <Route path="/*" element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
