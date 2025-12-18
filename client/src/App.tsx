import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AudioProvider } from '@/contexts/AudioProvider';
import { ImageLightboxProvider } from '@/components/image-lightbox';
import { useEffect } from "react";
import Home from "@/pages/home";
import Chapters from "@/pages/chapters";
import ChapterReader from "@/pages/chapter-reader";
import Characters from "@/pages/characters";
import CharacterProfile from "@/pages/character-profile";
import World from "@/pages/world";
import LocationProfile from "@/pages/location-profile";
import Codex from "@/pages/codex";
import CodexEntryProfile from "@/pages/codex-entry";
import CodexUploads from "@/pages/codex-uploads";
import Blog from "@/pages/blog";
import BlogPostProfile from "@/pages/blog-post";
import Admin from "@/pages/admin";
import CharacterPage from "@/pages/character";
import CodexEntryPage from "@/pages/codex-entry";
import LocationPage from "@/pages/location";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import SettingsPage from "@/pages/settings";
import AudioControls from '@/components/AudioControls';
import SoftErrorBoundary from '@/components/SoftErrorBoundary';

const READER_FONT_SIZE_KEY = 'reader.fontSize';
const READER_FONT_SIZES: Record<string, string> = {
  xsmall: '10px',
  small: '12px',
  medium: '16px',
  large: '18px',
};

function ScrollIndicator() {
  useEffect(() => {
    const updateScrollIndicator = () => {
      const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      const indicator = document.querySelector('.scroll-indicator') as HTMLElement;
      if (indicator) {
        indicator.style.transform = `scaleX(${scrolled / 100})`;
      }
    };

    window.addEventListener('scroll', updateScrollIndicator);
    return () => window.removeEventListener('scroll', updateScrollIndicator);
  }, []);

  return <div className="scroll-indicator" />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/chapters" component={Chapters} />
      <Route path="/chapters/:slug" component={ChapterReader} />
      <Route path="/characters" component={Characters} />
  <Route path="/characters/:slug" component={CharacterProfile} />
      <Route path="/world" component={World} />
      <Route path="/world/:id" component={LocationProfile} />
  {/* Portuguese slug aliases */}
  <Route path="/mundo" component={World} />
  <Route path="/mundo/:id" component={LocationProfile} />
      <Route path="/codex" component={Codex} />
  <Route path="/codex-uploads" component={CodexUploads} />
      <Route path="/codex/:id" component={CodexEntryProfile} />
  <Route path="/login" component={Login} />
  <Route path="/register" component={Register} />
  <Route path="/settings" component={SettingsPage} />
      <Route path="/blog" component={Blog} />
      <Route path="/blog/:slug" component={BlogPostProfile} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(READER_FONT_SIZE_KEY) || 'medium';
      // Back-compat: older values might exist; fall back to medium if unknown.
      const size = READER_FONT_SIZES[stored] || READER_FONT_SIZES.medium;
      document.documentElement.style.setProperty('--reader-font-size', size);
    } catch {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <ImageLightboxProvider>
            <SoftErrorBoundary>
              <AudioProvider>
                <ScrollIndicator />
                <Toaster />
                <Router />
                <AudioControls />
              </AudioProvider>
            </SoftErrorBoundary>
          </ImageLightboxProvider>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;


