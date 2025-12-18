import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import type { Chapter } from "@shared/schema";
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface ChapterCardProps {
  chapter: Chapter;
}

export default function ChapterCard({ chapter }: ChapterCardProps) {
  const { t } = useLanguage();

  const timeAgo = (date: Date | string) => {
    const now = new Date();
    const publishedDate = new Date(date);
    const diffTime = Math.abs(now.getTime() - publishedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return t.oneDayAgo;
    if (diffDays < 7) return `${diffDays} ${t.daysAgo}`;
    if (diffDays < 14) return t.oneWeekAgo;
    if (diffDays < 21) return t.twoWeeksAgo;
    return t.threeWeeksAgo;
  };

  const { language } = useLanguage();

  const localized = (field: string | null | undefined) => field || '';

  return (
    <Link href={`/chapters/${chapter.slug}`} className="block">
      <Card className="chapter-card card-equal bg-card border border-border rounded-lg overflow-hidden hover-glow flex flex-col">
      {chapter.imageUrl ? (
        <img 
          src={chapter.imageUrl} 
          alt={chapter.title}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-muted/40" aria-hidden="true" />
      )}
      <CardContent className="p-6 flex-1 flex flex-col overflow-hidden">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className="text-sm text-accent font-medium" data-testid={`text-chapter-${chapter.chapterNumber}`}>
              {t.chapterLabel} {chapter.chapterNumber}
            </span>
              {(chapter as any).arcNumber || (chapter as any).arcTitle ? (
                <div className="mb-2 text-xs text-primary/80" data-testid={`text-arc-${chapter.slug}`}>
                  Arco {(chapter as any).arcNumber ?? ''}{(chapter as any).arcTitle ? `: ${(chapter as any).arcTitle}` : ''}
                </div>
              ) : null}
          </div>
          <span className="text-sm text-muted-foreground" data-testid={`text-date-${chapter.slug}`}>
            {timeAgo(chapter.publishedAt)}
          </span>
        </div>
          <h3 className="font-display text-xl font-semibold text-card-foreground mb-2 clamp-2" data-testid={`text-title-${chapter.slug}`}>
          {localized(chapter.title)}
        </h3>
          <p className="text-muted-foreground text-sm mb-4 clamp-3 whitespace-normal break-all" data-testid={`text-excerpt-${chapter.slug}`}>
          <span dangerouslySetInnerHTML={{ __html: chapter.excerpt || '' }} />
        </p>
          <div className="mt-auto flex justify-between items-center pt-1">
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            <span data-testid={`text-reading-time-${chapter.slug}`}>
              {chapter.readingTime} {t.minRead}
            </span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary hover:text-accent transition-colors p-2"
            data-testid={`button-read-${chapter.slug}`}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
      </Card>
    </Link>
  );
}


