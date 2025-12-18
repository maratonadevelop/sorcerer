import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { Character } from "@shared/schema";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from '@tanstack/react-query';

interface CharacterCardProps {
  character: Character;
}

export default function CharacterCard({ character }: CharacterCardProps) {
  const { t } = useLanguage();

  const getRoleColor = (role: string) => {
    switch (role) {
      case "protagonist":
        return "text-primary";
      case "antagonist":
        return "text-destructive";
      default:
        return "text-accent";
    }
  };

  // Translation system disabled: always use primary (Portuguese) fields.
  const title = character.title;
  // Only show the short description on cards (no full story/HTML)
  const summary = character.description || '';

  const linkTarget = character.slug || character.id;

  const isValidImageUrl = (u?: string | null) => {
    if (!u) return false;
    const trimmed = (u || '').trim();
    if (trimmed === '' || trimmed === '=' || trimmed === 'null') return false;
    // simple heuristic: must contain at least one slash or start with http
    if (trimmed.startsWith('http') || trimmed.startsWith('/') || trimmed.includes('/')) return true;
    return false;
  };

  const imgSrc = isValidImageUrl(character.imageUrl) ? character.imageUrl as string : '/uploads/default-character.png';

  return (
    <Link href={`/characters/${linkTarget}`} className="block">
  <Card className="bg-card border border-border rounded-lg overflow-hidden hover-glow card-equal flex flex-col">
        <img 
          src={imgSrc}
          alt={character.name}
          className="w-full h-64 object-cover"
          data-testid={`img-character-${character.id}`}
        />
        <CardContent className="p-6 flex-1 flex flex-col">
          <h3 className="font-display text-xl font-semibold text-card-foreground mb-2 clamp-2" data-testid={`text-name-${character.id}`}>
            {character.name}
          </h3>
          <p className={`text-sm font-medium mb-3 ${getRoleColor(character.role)} clamp-1`} data-testid={`text-title-${character.id}`}>
            {title}
          </p>
          <p className="text-muted-foreground text-sm clamp-3" data-testid={`text-description-${character.id}`}>
            {summary}
          </p>
          {/* actions intentionally minimal here; click card to open */}
        </CardContent>
      </Card>
    </Link>
  );
}


