import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useReadingProgress(chapterId: string) {
  const [progress, setProgress] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('reading-session-id');
    if (!id) {
      id = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('reading-session-id', id);
    }
    return id;
  });

  const queryClient = useQueryClient();

  const updateProgressMutation = useMutation({
    mutationFn: async ({ progress }: { progress: number }) => {
      const response = await apiRequest("PUT", "/api/reading-progress", {
        sessionId,
        chapterId,
        progress,
        lastReadAt: new Date(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reading-progress', sessionId, chapterId] });
    },
  });

  useEffect(() => {
    // Restore last saved progress from localStorage for this session+chapter
    try {
      const key = `reading-progress:${sessionId}:${chapterId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const p = Math.max(0, Math.min(100, Number(saved)));
        setProgress(p);
        setMaxSeen(p);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  useEffect(() => {
    const calculateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = (scrollTop / docHeight) * 100;
      const raw = Math.min(Math.max(scrollPercent, 0), 100);
      // Monotonic: don't decrease while scrolling up
      const newProgress = Math.max(maxSeen, raw);
      if (newProgress !== progress) {
        setProgress(newProgress);
        setMaxSeen(newProgress);
        try { localStorage.setItem(`reading-progress:${sessionId}:${chapterId}`, String(Math.round(newProgress))); } catch {}
        // Update server every 5% increase
        if (newProgress - (maxSeen || 0) >= 5) {
          updateProgressMutation.mutate({ progress: newProgress });
        }
      }
    };

    const throttledCalculateProgress = () => {
      requestAnimationFrame(calculateProgress);
    };

    window.addEventListener('scroll', throttledCalculateProgress);
    window.addEventListener('resize', throttledCalculateProgress);

    return () => {
      window.removeEventListener('scroll', throttledCalculateProgress);
      window.removeEventListener('resize', throttledCalculateProgress);
    };
  }, [chapterId, progress, sessionId, updateProgressMutation, maxSeen]);

  return { progress, sessionId };
}
