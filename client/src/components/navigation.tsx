import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Settings, LogOut, LogIn, User as UserIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/authHeaders";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Dev mode UI removed – only the primary Entrar button remains.
  
  const navigationItems = [
    { name: t.home, href: "/" },
    { name: t.chapters, href: "/chapters" },
    { name: t.characters, href: "/characters" },
    { name: t.world, href: "/mundo" },
    { name: t.codex, href: "/codex" },
    { name: t.blog, href: "/blog" },
  ];

  useEffect(() => {
    const smoothScroll = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      if (target.href?.includes('#')) {
        e.preventDefault();
        const id = target.href.split('#')[1];
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    };

    document.addEventListener('click', smoothScroll);
    return () => document.removeEventListener('click', smoothScroll);
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0">
            <Link href="/" data-testid="link-home">
              <h1 className="font-display text-xl font-bold text-primary">
                {t.heroTitle}
              </h1>
            </Link>
          </div>
          
          <div className="hidden md:flex flex-1 justify-center">
            <div className="flex items-baseline space-x-8">
              {navigationItems.map((item) => {
                const displayName = item.name ?? "";
                const safeId = displayName
                  ? `link-${displayName.toLowerCase().replace(/\s+/g, "-")}`
                  : `link-${item.href.replace(/\//g, "-")}`;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-testid={safeId}
                    className={`nav-link font-medium transition-colors duration-200 ${
                      location === item.href
                        ? "text-primary"
                        : "text-foreground hover:text-primary"
                    }`}
                    aria-current={location === item.href ? 'page' : undefined}
                    data-active={location === item.href ? 'true' : 'false'}
                    onClick={async () => {
                      // Debug log and SPA navigation; fallback to hard reload if it doesn't change the path
                      try {
                        // eslint-disable-next-line no-console
                        console.debug('[nav] click', item.href, 'current', location);
                        try { await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); } catch(e) {}
                        setLocation(item.href);
                        setTimeout(() => {
                          try {
                            if (window.location.pathname !== item.href) {
                              // eslint-disable-next-line no-console
                              console.debug('[nav] SPA navigation failed, falling back to full navigation', item.href);
                              window.location.href = item.href;
                            }
                          } catch (err) {
                            // ignore
                          }
                        }, 100);
                      } catch (err) {
                        // nothing — allow default behavior
                      }
                    }}
                  >
                    {item.name}
                  </Link>
                );
              })}
              
              {/* Admin link for admins */}
              {isAdmin && (
                <Link
                  href="/admin"
                  data-testid="link-admin"
                  aria-label="Admin"
                  className={`nav-link font-medium transition-colors duration-200 ${
                    location === "/admin"
                      ? "text-primary"
                      : "text-foreground hover:text-primary"
                  }`}
                  aria-current={location === '/admin' ? 'page' : undefined}
                  data-active={location === '/admin' ? 'true' : 'false'}
                >
                  <Settings className="h-4 w-4 inline" />
                  <span className="sr-only">Admin</span>
                </Link>
              )}
              
              {/* Single-language app: Portuguese only. Language selector removed. */}

              {/* Authentication */}
              {isLoading ? (
                <div className="h-8 w-24 animate-pulse rounded bg-muted" aria-hidden />
              ) : isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-foreground hover:text-primary transition-colors flex items-center gap-2"
                      data-testid="button-user-menu"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={(user as any)?.profileImageUrl || ''} alt={user?.firstName || user?.email || 'User'} />
                        <AvatarFallback className="text-xs">
                          {(user?.firstName || user?.email || 'U')?.slice(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user?.firstName || user?.email || 'Usuário'}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer w-full">
                        <UserIcon className="h-4 w-4 mr-2" />
                        Configurações
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/admin" className="cursor-pointer w-full">
                            <Settings className="h-4 w-4 mr-2" />
                            Admin Panel
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onSelect={async () => {
                      try { await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: authHeaders() }); } catch {}
                      try { localStorage.removeItem('devToken'); } catch (e) {}
                      try { await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); } catch (e) {}
                      window.location.reload();
                    }}>
                      <div className="cursor-pointer w-full">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sair
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="default" size="sm">
                  <a
                    href="/login"
                    data-testid="button-login"
                    onClick={(e) => {
                      e.preventDefault();
                      setLocation('/login');
                    }}
                    className="btn-gold btn-font px-3 py-1 rounded-md"
                  >
                    <LogIn className="h-4 w-4 mr-1" />
                    Entrar
                  </a>
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Single-language app: show static Portuguese flag */}
            <div className="hidden md:flex items-center" aria-hidden>
              <span className="text-lg">🇧🇷</span>
            </div>

            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-foreground hover:text-primary"
                aria-label="Admin"
                onClick={() => setLocation('/admin')}
                data-testid="button-mobile-admin"
              >
                <Settings className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-foreground hover:text-primary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-background border-b border-border">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigationItems.map((item) => {
              const displayName = item.name ?? "";
              const safeId = displayName
                ? `mobile-link-${displayName.toLowerCase().replace(/\s+/g, "-")}`
                : `mobile-link-${item.href.replace(/\//g, "-")}`;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={safeId}
                  className={`nav-link block px-3 py-2 rounded-md font-medium transition-colors ${
                    location === item.href
                      ? "text-primary bg-primary/10"
                      : "text-foreground hover:text-primary hover:bg-muted"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              );
            })}
            
            {/* Admin link for mobile */}
            {isAdmin && (
              <Link
                href="/admin"
                data-testid="mobile-link-admin"
                aria-label="Admin"
                className={`nav-link flex items-center px-3 py-2 rounded-md font-medium transition-colors ${
                  location === "/admin"
                    ? "text-primary bg-primary/10"
                    : "text-foreground hover:text-primary hover:bg-muted"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Admin</span>
              </Link>
            )}
            
            {/* Authentication for mobile */}
            <div className="border-t border-border mt-3 pt-3">
              {isAuthenticated ? (
                <>
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {user?.firstName || user?.email || 'Usuário'}
                  </div>
                  <a
                    onClick={async (e) => {
                      e.preventDefault();
                      try { await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: authHeaders() }); } catch (err) {}
                      try { localStorage.removeItem('devToken'); } catch (e) {}
                      try { await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }); } catch (e) {}
                      window.location.reload();
                    }}
                    className="nav-link flex items-center px-3 py-2 rounded-md font-medium transition-colors text-foreground hover:text-primary hover:bg-muted cursor-pointer"
                    data-testid="mobile-button-logout"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </a>
                </>
              ) : (
                <a
                  href="/login"
                  className="flex items-center px-3 py-2 rounded-md font-medium transition-colors text-foreground hover:text-primary hover:bg-muted"
                  data-testid="mobile-button-login"
                  onClick={(e) => { e.preventDefault(); setLocation('/login'); }}
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
