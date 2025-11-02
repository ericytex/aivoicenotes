import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Mic, 
  FileText, 
  Upload, 
  Image as ImageIcon, 
  Settings, 
  LogOut,
  Home,
  Menu,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import SyncStatus from "./SyncStatus";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Redirect to auth if not authenticated (except for auth, shared, and root landing page)
  useEffect(() => {
    if (!isAuthenticated && 
        location.pathname !== '/' && 
        !location.pathname.startsWith('/auth') && 
        !location.pathname.startsWith('/shared')) {
      navigate('/auth');
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const navItems = [
    { path: "/notes", label: "Notes", icon: FileText },
    { path: "/recorder", label: "Record", icon: Mic },
    { path: "/upload", label: "Upload", icon: Upload },
    { path: "/image-upload", label: "Images", icon: ImageIcon },
  ];

  const handleLogout = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
    navigate('/auth');
  };

  // Don't show navigation on auth, shared, or root landing page
  if (location.pathname === '/' || location.pathname.startsWith('/auth') || location.pathname.startsWith('/shared')) {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (path: string) => {
    // Home should only be active on exactly "/notes"
    if (path === "/notes") {
      return location.pathname === "/notes";
    }
    // Notes nav item should be active on note detail pages
    // Check if it's a note detail page (starts with /notes/ but not exactly /notes)
    if (path === "/notes" && location.pathname !== "/notes") {
      return location.pathname.startsWith("/notes/");
    }
    return location.pathname === path;
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-card border-r border-border flex-col">
        <div className="p-6 border-b border-border">
          <Link to="/notes" className="flex items-center gap-2 text-xl font-bold hover:opacity-80 transition-opacity">
            <Mic className="w-6 h-6 text-primary" />
            <span>Sonic Notes</span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link
            to="/notes"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/notes"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          
          {navItems.map((item) => {
            const Icon = item.icon;
            // Notes item should be active on detail pages only
            let active = false;
            if (item.path === "/notes") {
              active = location.pathname.startsWith("/notes/") && location.pathname !== "/notes";
            } else {
              active = location.pathname === item.path;
            }
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-border">
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/settings"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </div>

        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-center">
            <SyncStatus />
          </div>
          {user && (
            <div className="px-4 py-2 text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full"
            size="sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="flex items-center justify-around px-2 py-2">
          <Link
            to="/notes"
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
              location.pathname === "/notes"
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </Link>
          
          <Link
            to="/recorder"
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
              isActive("/recorder")
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <Mic className="w-5 h-5" />
            <span className="text-xs">Record</span>
          </Link>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-muted-foreground transition-colors min-w-[64px]"
          >
            <Menu className="w-5 h-5" />
            <span className="text-xs">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Mic className="w-6 h-6 text-primary" />
                <span className="text-xl font-bold">Sonic Notes</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                // Notes item should be active on detail pages only
                let active = false;
                if (item.path === "/notes") {
                  active = location.pathname.startsWith("/notes/") && location.pathname !== "/notes";
                } else {
                  active = location.pathname === item.path;
                }
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}

              <div className="pt-4 mt-4 border-t border-border">
                <Link
                  to="/settings"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    location.pathname === "/settings"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Settings className="w-5 h-5" />
                  Settings
                </Link>
              </div>
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center justify-center">
                <SyncStatus />
              </div>
              {user && (
                <div className="px-4 py-2 text-sm text-muted-foreground text-center">
                  {user.email}
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;

