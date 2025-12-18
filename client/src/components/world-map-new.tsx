/*
Como instalar:
npm install framer-motion

Como usar:
import WorldMapInteractive from '@/components/world-map';
import type { Location } from '@shared/schema';

const locations: Location[] = [...]; // your data
<WorldMapInteractive locations={locations} />
*/

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { Location } from "@shared/schema";

interface WorldMapProps {
  locations: Location[];
}

// Fictional world regions with pixel-based coordinates (percentage of image)
// Coordinates based on your FinalMap.png layout
const regions = {
  umbra: { 
    name: "Umbra", 
    center: { x: 30, y: 25 }, 
    bounds: { x: 10, y: 8, width: 40, height: 32 },
    zoom: 2.8,
    color: "#1f2937",
    desc: "The dark, shadowed northern reaches"
  },
  silvanum: { 
    name: "Silvanum", 
    center: { x: 45, y: 55 }, 
    bounds: { x: 25, y: 44, width: 34, height: 22 },
    zoom: 3.2,
    color: "#065f46",
    desc: "Dense forests in the central band"
  },
  luminah: { 
    name: "Luminah", 
    center: { x: 45, y: 85 }, 
    bounds: { x: 25, y: 75, width: 38, height: 20 },
    zoom: 3.0,
    color: "#dc2626",
    desc: "The rosier southern lands"
  },
  aquarios: { 
    name: "Aquarios", 
    center: { x: 55, y: 50 }, 
    bounds: { x: 47, y: 45, width: 15, height: 12 },
    zoom: 4.8,
    color: "#1d4ed8",
    desc: "Oceanic city near the center"
  },
  akeli: { 
    name: "Akeli", 
    center: { x: 85, y: 35 }, 
    bounds: { x: 75, y: 20, width: 22, height: 30 },
    zoom: 3.5,
    color: "#7c3aed",
    desc: "Eastern lands (upper-right)"
  },
  ferros: { 
    name: "Ferros", 
    center: { x: 85, y: 75 }, 
    bounds: { x: 70, y: 60, width: 26, height: 30 },
    zoom: 3.2,
    color: "#ea580c",
    desc: "Rugged eastern desert lands"
  },
};

export default function WorldMapInteractive({ locations }: WorldMapProps) {
  const [hoveredContinent, setHoveredContinent] = useState<string | null>(null);
  const [mapDimensions, setMapDimensions] = useState({ width: 800, height: 600 });

  // Current view calculations for zoom/pan
  const currentRegion = hoveredContinent ? regions[hoveredContinent as keyof typeof regions] : null;
  
  const getLocationColor = (type: string) => {
    switch (type) {
      case "capital": return "bg-yellow-400";
      case "forest": return "bg-green-500";
      case "shadowlands": return "bg-purple-600";
      default: return "bg-blue-500";
    }
  };

  // Check if a point is inside a region's bounds
  const isPointInRegion = (x: number, y: number, regionKey: string) => {
    const region = regions[regionKey as keyof typeof regions];
    const bounds = region.bounds;
    return (
      x >= bounds.x && 
      x <= bounds.x + bounds.width &&
      y >= bounds.y && 
      y <= bounds.y + bounds.height
    );
  };

  // Handle clicks on the map to detect region
  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    // Find which region was clicked
    for (const [regionKey, region] of Object.entries(regions)) {
      if (isPointInRegion(x, y, regionKey)) {
        setHoveredContinent(regionKey);
        return;
      }
    }
    
    // If no region clicked, reset to global view
    setHoveredContinent(null);
  };

  return (
    <Card className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
      {/* Screen reader announcement */}
      <div className="sr-only" aria-live="polite">
        {hoveredContinent ? `Viewing ${regions[hoveredContinent as keyof typeof regions].name} region` : "Viewing global map"}
      </div>

      <div className="relative h-96 md:h-[600px] select-none bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {/* Main map container with zoom/pan transforms */}
        <motion.div
          className="absolute inset-0 cursor-pointer"
          onClick={handleMapClick}
          animate={{
            scale: currentRegion ? currentRegion.zoom : 1,
            x: currentRegion ? -(currentRegion.center.x - 50) * (mapDimensions.width / 100) * (currentRegion.zoom - 1) : 0,
            y: currentRegion ? -(currentRegion.center.y - 50) * (mapDimensions.height / 100) * (currentRegion.zoom - 1) : 0,
          }}
          transition={{ 
            duration: 0.28,
            ease: [0.22, 0.9, 0.27, 1]
          }}
          style={{ transformOrigin: "center center" }}
        >
          {/* Base map image */}
          <img
            src="/FinalMap.png"
            alt="Fantasy World Map"
            className="w-full h-full object-cover block"
            draggable={false}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              setMapDimensions({ width: img.clientWidth, height: img.clientHeight });
            }}
          />

          {/* Interactive region overlays */}
          <div className="absolute inset-0">
            {Object.entries(regions).map(([regionKey, region]) => {
              const isHovered = hoveredContinent === regionKey;
              const isActive = hoveredContinent && hoveredContinent !== regionKey;
              
              return (
                <motion.div
                  key={regionKey}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${region.bounds.x}%`,
                    top: `${region.bounds.y}%`,
                    width: `${region.bounds.width}%`,
                    height: `${region.bounds.height}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoveredContinent(regionKey);
                  }}
                  onMouseEnter={() => setHoveredContinent(regionKey)}
                  onMouseLeave={() => setHoveredContinent(null)}
                  tabIndex={0}
                  onFocus={() => setHoveredContinent(regionKey)}
                  onBlur={() => setHoveredContinent(null)}
                  role="button"
                  aria-label={`${region.name} region - ${region.desc}`}
                >
                  {/* Region highlight overlay */}
                  <motion.div
                    className="w-full h-full rounded-lg border-2"
                    style={{
                      backgroundColor: region.color,
                      borderColor: isHovered ? "#ffffff" : region.color,
                    }}
                    animate={{
                      opacity: isHovered ? 0.35 : isActive ? 0.08 : 0.12,
                      scale: isHovered ? 1.02 : 1,
                    }}
                    transition={{ duration: 0.25 }}
                    whileHover={{
                      opacity: 0.4,
                      scale: 1.02,
                      boxShadow: `0 8px 32px ${region.color}40`,
                    }}
                  />

                  {/* Region label */}
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    animate={{
                      scale: isHovered ? 1.1 : 1,
                      y: isHovered ? -4 : 0,
                    }}
                    transition={{ duration: 0.25 }}
                  >
                    <motion.span
                      className="text-white font-bold text-shadow-lg drop-shadow-lg"
                      style={{
                        fontSize: isHovered ? "1.2rem" : "1rem",
                        textShadow: "2px 2px 4px rgba(0,0,0,0.8)",
                      }}
                      animate={{
                        fontSize: isHovered ? "1.2rem" : "1rem",
                      }}
                      transition={{ duration: 0.25 }}
                    >
                      {region.name}
                    </motion.span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>

          {/* Location pins */}
          <div className="absolute inset-0">
            {locations.map((location) => (
              <Link 
                key={location.id} 
                href={`/mundo/${location.id}`} 
                className="absolute transform -translate-x-1/2 -translate-y-1/2"
                style={{ 
                  left: `${location.mapX}%`, 
                  top: `${location.mapY}%` 
                }}
              >
                <motion.div
                  animate={{
                    scale: hoveredContinent ? 0.8 : 1,
                    opacity: hoveredContinent ? 0.7 : 1,
                  }}
                  whileHover={{ scale: 1.5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    variant="ghost"
                    className={`w-4 h-4 ${getLocationColor(location.type)} rounded-full p-0 shadow-lg`}
                    style={{
                      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    }}
                  >
                    <span className="sr-only">{location.name}</span>
                  </Button>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Region info overlay */}
        <AnimatePresence>
          {hoveredContinent && (
            <motion.div
              className="absolute top-4 left-4 bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur-sm max-w-sm"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-bold text-lg capitalize">
                {regions[hoveredContinent as keyof typeof regions].name}
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                {regions[hoveredContinent as keyof typeof regions].desc}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CardContent className="p-6 bg-muted/50">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <h4 className="font-display text-lg font-semibold text-card-foreground mb-2">
              Interactive Fantasy Map
            </h4>
            <p className="text-muted-foreground text-sm">
              Click or hover over regions to zoom and explore.
            </p>
          </div>
          <div className="text-center">
            <h4 className="font-display text-lg font-semibold text-card-foreground mb-2">Regions</h4>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Object.entries(regions).map(([regionKey, region]) => (
                <motion.button
                  key={regionKey} 
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors"
                  onClick={() => setHoveredContinent(regionKey)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ 
                    backgroundColor: hoveredContinent === regionKey ? `${region.color}20` : 'transparent',
                    borderColor: hoveredContinent === regionKey ? region.color : 'transparent'
                  }}
                >
                  <span 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: region.color }} 
                  />
                  <span className="text-muted-foreground font-medium">
                    {region.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
          <div className="text-center">
            <h4 className="font-display text-lg font-semibold text-card-foreground mb-2">Navigation</h4>
            <p className="text-muted-foreground text-sm">
              Use keyboard focus, mouse hover, or click regions. Click pins for details.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
