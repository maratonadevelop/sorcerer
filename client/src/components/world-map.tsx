import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ParallaxLayer from "@/components/parallax-layer";
import InteractiveWorldMap from "@/components/interactive-world-map/InteractiveWorldMap";
import type { Location } from "@shared/schema";

interface WorldMapProps {
  locations: Location[];
}

export default function WorldMap({ locations }: WorldMapProps) {

  const [initialSvg, setInitialSvg] = useState<string | null>(null);

  const getLocationColor = (type: string) => {
    switch (type) {
      case "capital":
        return "bg-primary";
      case "forest":
        return "bg-accent";
      case "shadowlands":
        return "bg-destructive";
      default:
        return "bg-secondary";
    }
  };

  return (
    <Card className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="relative">
        <ParallaxLayer depth={0.3} className="map-bg min-h-[640px] lg:min-h-[720px]">
          <InteractiveWorldMap />
        </ParallaxLayer>

  {/* editor removed - rendering inline SVG map */}
      </div>
    </Card>
  );
}
