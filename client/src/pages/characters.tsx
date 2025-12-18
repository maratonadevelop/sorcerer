import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import CharacterCard from "@/components/character-card";
import Footer from "@/components/footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { Character } from "@shared/schema";
// translations removed — single-language
import { useLanguage } from '@/contexts/LanguageContext';

export default function Characters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  // single-language: use primary fields only
  
  const { data: characters = [], isLoading } = useQuery<Character[]>({
    queryKey: ['/api/characters'],
  });

  const { t } = useLanguage();

  const roles = ["all", "protagonist", "antagonist", "supporting"];

  const localized = (item: any, field: string) => item?.[field] || '';

  const filteredCharacters = characters.filter(character => {
    const name = (character.name || '').toLowerCase();
    const desc = (localized(character, 'description') || '').toLowerCase();
    const matchesSearch = name.includes(searchQuery.toLowerCase()) || desc.includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === "all" || character.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      
      <main className="pt-24 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary mb-4" data-testid="text-characters-title">
              {t.characterGallery || 'Personagens'}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
              {t.characterGalleryDesc || 'Navegue pela galeria de personagens da história.'}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-2xl mx-auto">
                <Input
                  type="text"
                  placeholder={t.searchCharacters || 'Pesquisar personagens...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-search-characters"
              />
              
              <div className="flex gap-2">
                    {roles.map((role) => (
                  <Button
                    key={role}
                    variant={selectedRole === role ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRole(role)}
                    className="capitalize"
                    data-testid={`button-filter-${role}`}
                  >
                    {role === 'all' ? 'Todos' : role === 'protagonist' ? 'Protagonista' : role === 'antagonist' ? 'Antagonista' : 'Coadjuvante'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-card border border-border rounded-lg h-96 animate-pulse" />
              ))}
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="text-center py-20">
              <h3 className="font-display text-2xl font-semibold text-muted-foreground mb-4" data-testid="text-no-characters">
                {t.noCharacters}
              </h3>
              <p className="text-muted-foreground">
                {t.adjustFilters}
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredCharacters.map((character) => (
                <CharacterCard key={character.id} character={character} />
              ))}
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}


