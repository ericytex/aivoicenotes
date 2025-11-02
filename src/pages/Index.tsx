import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Sparkles, FileText, Mail, CheckSquare, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Mic,
      title: "Voice Recording",
      description: "Record high-quality audio with pause, resume, and save controls"
    },
    {
      icon: Sparkles,
      title: "AI Transcription",
      description: "Instant speech-to-text powered by advanced AI models"
    },
    {
      icon: FileText,
      title: "Smart Conversion",
      description: "Transform notes into blogs, emails, and to-do lists automatically"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "End-to-end encryption keeps your notes safe"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero Section */}
      <header className="container mx-auto px-4 pt-20 pb-32">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI-Powered Voice Notes
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Turn Your Voice Into
            <span className="block bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              Actionable Content
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Record meetings, capture ideas, and let AI transform your voice notes into polished blogs, 
            professional emails, and organized task lists.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 text-lg"
              onClick={() => navigate("/recorder")}
            >
              Start Recording
              <Mic className="w-5 h-5 ml-2" />
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              className="px-8 h-12 text-lg"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="container mx-auto px-4 pb-32">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index}
                className="p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 pb-32">
        <Card className="max-w-4xl mx-auto p-12 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="text-center space-y-6">
            <h2 className="text-4xl font-bold">Ready to Transform Your Workflow?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of professionals who trust VoiceNote AI for their meeting transcription 
              and content creation needs.
            </p>
            <Button 
              size="lg"
              className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 h-12 text-lg"
              onClick={() => navigate("/auth")}
            >
              Get Started Free
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Index;
