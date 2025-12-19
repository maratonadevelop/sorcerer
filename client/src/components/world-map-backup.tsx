/*
Como instalar:
npm install framer-motion

Como usar:
import WorldMapInteractive from '@/components/world-map';
import type { Location } from '@shared/schema';

const locations: Location[] = [...]; // your data
<WorldMapInteractive locations={locations} />
*/

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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
    desc: "The dark, shadowed northern reaches",
    clipPath: "polygon(20% 10%, 70% 5%, 85% 25%, 75% 45%, 45% 50%, 15% 40%, 5% 25%)"
  },
  silvanum: { 
    name: "Silvanum", 
    center: { x: 35, y: 55 }, 
    bounds: { x: 15, y: 44, width: 28, height: 20 },
    zoom: 3.2,
    color: "#065f46",
    desc: "Dense forests in the central band",
    clipPath: "polygon(15% 20%, 75% 15%, 80% 45%, 70% 75%, 50% 85%, 25% 80%, 10% 50%)"
  },
  luminah: { 
    name: "Luminah", 
    center: { x: 45, y: 85 }, 
    bounds: { x: 25, y: 75, width: 38, height: 20 },
    zoom: 3.0,
    color: "#dc2626",
    desc: "The rosier southern lands",
    clipPath: "polygon(25% 75%, 63% 70%, 70% 95%, 30% 100%, 20% 85%)"
  },
  crystalis: { 
    name: "Crystalis", 
    center: { x: 75, y: 30 }, 
    bounds: { x: 65, y: 15, width: 30, height: 30 },
    zoom: 2.5,
    color: "#7c3aed",
    desc: "Crystal formations in the east",
    clipPath: "polygon(65% 15%, 95% 20%, 90% 45%, 70% 45%, 60% 25%)"
  },
  aethermoor: { 
    name: "Aethermoor", 
    center: { x: 70, y: 70 }, 
    bounds: { x: 60, y: 55, width: 35, height: 30 },
    zoom: 2.7,
    color: "#059669",
    desc: "Mystic moorlands of the southeast",
    clipPath: "polygon(60% 55%, 95% 60%, 90% 85%, 75% 85%, 65% 70%)"
  },
  vortexia: { 
    name: "Vortexia", 
    center: { x: 15, y: 70 }, 
    bounds: { x: 5, y: 60, width: 25, height: 25 },
    zoom: 3.5,
    color: "#b45309",
    desc: "Swirling energies of the southwest",
    clipPath: "circle(40% at 15% 70%)"
  }
};

export default function WorldMapInteractive({ locations }: WorldMapProps) {
  const auth = useAuth();
  const isAdmin = !!auth?.isAdmin;

  // Basic states
  const [hoveredContinent, setHoveredContinent] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState<string | null>(null);
  const [editableRegions, setEditableRegions] = useState(regions);
  
  // Map reference
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Simple drag system
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    pointIndex: number | null;
    region: string | null;
    startMousePos: { x: number; y: number } | null;
    startPointPos: { x: number; y: number } | null;
  }>({
    isDragging: false,
    pointIndex: null,
    region: null,
    startMousePos: null,
    startPointPos: null
  });

  useEffect(() => {
    if (!isAdmin) {
      setEditMode(false);
      setSelectedRegionForEdit(null);
    }
  }, [isAdmin]);

  // Parse clip-path string to points
  const parseClipPath = (clipPath: string) => {
    if (clipPath.startsWith('polygon(')) {
      const coords = clipPath.match(/polygon\(([^)]+)\)/)?.[1];
      return coords?.split(',').map(point => {
        const [x, y] = point.trim().split(' ');
        return { x: parseFloat(x), y: parseFloat(y) };
      }) || [];
    } else if (clipPath.startsWith('circle(')) {
      const match = clipPath.match(/circle\((\d+)% at (\d+)% (\d+)%\)/);
      if (match) {
        return [{ x: parseFloat(match[2]), y: parseFloat(match[3]), radius: parseFloat(match[1]) }];
      }
    }
    return [];
  };

  // Convert points back to clip-path string
  const pointsToClipPath = (points: any[]) => {
    if (points.length === 1 && 'radius' in points[0]) {
      const p = points[0];
      return `circle(${p.radius || 40}% at ${p.x}% ${p.y}%)`;
    }
    return `polygon(${points.map(p => `${p.x}% ${p.y}%`).join(', ')})`;
  };

  // Update region clip path
  const updateRegionClipPath = (regionKey: string, newClipPath: string) => {
    setEditableRegions(prev => ({
      ...prev,
      [regionKey]: {
        ...prev[regionKey as keyof typeof prev],
        clipPath: newClipPath
      }
    }));
  };

  // Mouse down on point - start drag
  const handlePointMouseDown = (pointIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedRegionForEdit) return;
    
    const region = editableRegions[selectedRegionForEdit as keyof typeof editableRegions];
    const points = parseClipPath(region.clipPath);
    
    if (!points || pointIndex >= points.length) return;
    
    setDragState({
      isDragging: true,
      pointIndex,
      region: selectedRegionForEdit,
      startMousePos: { x: e.clientX, y: e.clientY },
      startPointPos: { x: points[pointIndex].x, y: points[pointIndex].y }
    });
    
    console.log('Started dragging point', pointIndex, 'at', points[pointIndex]);
  };

  // Global mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.isDragging || !dragState.region || dragState.pointIndex === null || !mapRef.current) {
        return;
      }

      // Get map image for coordinate calculation
      const mapImage = mapRef.current.querySelector('img');
      if (!mapImage) return;

      const imageRect = mapImage.getBoundingClientRect();
      
      // Calculate new position relative to image
      const relativeX = ((e.clientX - imageRect.left) / imageRect.width) * 100;
      const relativeY = ((e.clientY - imageRect.top) / imageRect.height) * 100;

      // Clamp to bounds
      const clampedX = Math.max(0, Math.min(100, relativeX));
      const clampedY = Math.max(0, Math.min(100, relativeY));

      // Update the point
      const region = editableRegions[dragState.region as keyof typeof editableRegions];
      const points = parseClipPath(region.clipPath);
      
      if (points && dragState.pointIndex < points.length) {
        const newPoints = [...points];
        newPoints[dragState.pointIndex] = { x: clampedX, y: clampedY };
        
        const newClipPath = pointsToClipPath(newPoints);
        updateRegionClipPath(dragState.region, newClipPath);
      }
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        console.log('Finished dragging');
        setDragState({
          isDragging: false,
          pointIndex: null,
          region: null,
          startMousePos: null,
          startPointPos: null
        });
      }
    };

    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, editableRegions]);

  // Add point on double click
  const addPoint = (e: React.MouseEvent) => {
    if (!editMode || !selectedRegionForEdit || !mapRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();

    const mapImage = mapRef.current.querySelector('img');
    if (!mapImage) return;
    
    const imageRect = mapImage.getBoundingClientRect();
    const relativeX = ((e.clientX - imageRect.left) / imageRect.width) * 100;
    const relativeY = ((e.clientY - imageRect.top) / imageRect.height) * 100;
    const clampedX = Math.max(0, Math.min(100, relativeX));
    const clampedY = Math.max(0, Math.min(100, relativeY));

    const region = editableRegions[selectedRegionForEdit as keyof typeof editableRegions];
    const points = parseClipPath(region.clipPath);
    
    if (points) {
      const newPoints = [...points, { x: clampedX, y: clampedY }];
      const newClipPath = pointsToClipPath(newPoints);
      updateRegionClipPath(selectedRegionForEdit, newClipPath);
      console.log(`Added point at: ${clampedX.toFixed(1)}%, ${clampedY.toFixed(1)}%`);
    }
  };

  // Remove point
  const removePoint = (pointIndex: number) => {
    if (!selectedRegionForEdit) return;
    
    const region = editableRegions[selectedRegionForEdit as keyof typeof editableRegions];
    const points = parseClipPath(region.clipPath);
    
    if (points && points.length > 3) { // Keep at least 3 points for polygon
      const newPoints = points.filter((_, index) => index !== pointIndex);
      const newClipPath = pointsToClipPath(newPoints);
      updateRegionClipPath(selectedRegionForEdit, newClipPath);
      console.log(`Removed point ${pointIndex + 1}`);
    }
  };

  // Handle region click
  const handleRegionClick = (regionKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editMode) {
      setSelectedRegionForEdit(regionKey);
      console.log(`Selected ${regionKey} for editing`);
    } else {
      setHoveredContinent(regionKey);
    }
  };

  // Point-in-polygon test
  const isPointInRegion = (x: number, y: number, regionKey: string) => {
    const region = regions[regionKey as keyof typeof regions];
    if (region.clipPath.startsWith('circle(')) {
      const match = region.clipPath.match(/circle\((\d+)% at (\d+)% (\d+)%\)/);
      if (match) {
        const radius = parseFloat(match[1]);
        const centerX = parseFloat(match[2]);
        const centerY = parseFloat(match[3]);
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        return distance <= radius;
      }
    }
    return false;
  };

  return (
    <Card className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
      <div className="sr-only" aria-live="polite">
        {hoveredContinent ? `Viewing ${regions[hoveredContinent as keyof typeof regions].name} region` : "Viewing global map"}
      </div>

      <div 
        ref={mapRef}
        className="relative h-[70vh] md:h-[80vh] w-full select-none bg-slate-50 dark:bg-slate-900 overflow-hidden border-2 border-gray-300 dark:border-gray-600 rounded-lg"
        onDoubleClick={editMode ? addPoint : undefined}
        style={{
          cursor: editMode ? (dragState.isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      >
        {/* Map Image */}
        <motion.img
          src="/FinalMap.png"
          alt="Fantasy World Map"
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Regions */}
        {Object.entries(editMode ? editableRegions : regions).map(([regionKey, region]) => {
          const isSelected = editMode && selectedRegionForEdit === regionKey;
          
          return (
            <div key={regionKey}>
              {/* Region Clickable Area */}
              <motion.div
                className={`absolute ${editMode ? 'cursor-pointer z-40' : 'cursor-pointer'}`}
                style={{
                  left: `${region.bounds.x}%`,
                  top: `${region.bounds.y}%`,
                  width: `${region.bounds.width}%`,
                  height: `${region.bounds.height}%`,
                }}
                onClick={(e) => handleRegionClick(regionKey, e)}
                onMouseEnter={() => !editMode && !dragState.isDragging && setHoveredContinent(regionKey)}
                onMouseLeave={() => !editMode && !dragState.isDragging && setHoveredContinent(null)}
              />

              {/* Region Visual Overlay */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  clipPath: region.clipPath,
                  backgroundColor: isSelected ? `${region.color}40` : `${region.color}20`,
                }}
                whileHover={!editMode ? {
                  backgroundColor: `${region.color}30`,
                } : {}}
                animate={isSelected ? {
                  backgroundColor: `${region.color}40`,
                } : {}}
              />

              {/* Edit Points - aparece quando região está selecionada */}
              {editMode && isSelected && (() => {
                const points = parseClipPath(region.clipPath);
                return points ? points.map((point, index) => (
                  <motion.div
                    key={index}
                    className="absolute w-6 h-6 bg-yellow-400 border-3 border-yellow-600 rounded-full cursor-grab active:cursor-grabbing z-50 hover:bg-yellow-300"
                    style={{
                      left: `${point.x}%`,
                      top: `${point.y}%`,
                      transform: 'translate(-50%, -50%)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 0 0 3px rgba(255,255,255,0.9)',
                      border: '3px solid #d97706',
                    }}
                    onMouseDown={(e) => handlePointMouseDown(index, e)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      removePoint(index);
                    }}
                    whileHover={{ 
                      scale: 1.4,
                      backgroundColor: '#fbbf24',
                    }}
                    animate={{ 
                      scale: dragState.pointIndex === index ? 1.2 : 1,
                      backgroundColor: dragState.pointIndex === index ? '#f59e0b' : '#fbbf24'
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none opacity-0 hover:opacity-100 transition-opacity">
                      Point {index + 1}<br />
                      <span className="text-xs text-gray-300">Double-click to remove</span>
                    </div>
                  </motion.div>
                )) : null;
              })()}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <CardContent className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {isAdmin && (
            <motion.button
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                editMode 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              onClick={() => {
                setEditMode(!editMode);
                setSelectedRegionForEdit(null);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {editMode ? '🔒 Exit Edit' : '✏️ Edit Masks'}
            </motion.button>
          )}

          {isAdmin && editMode && (
            <>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedRegionForEdit ? (
                  <span>
                    Editing: <strong>{editableRegions[selectedRegionForEdit as keyof typeof editableRegions].name}</strong>
                    {' • '}
                    Points: {parseClipPath(editableRegions[selectedRegionForEdit as keyof typeof editableRegions].clipPath)?.length || 0}
                    {' • '}
                    Double-click map to add • Double-click point to remove
                  </span>
                ) : (
                  'Click a region to start editing'
                )}
              </div>
              
              <motion.button
                className="px-4 py-2 rounded-lg font-medium text-sm bg-green-500 hover:bg-green-600 text-white transition-all"
                onClick={() => {
                  console.log('Current regions:', JSON.stringify(editableRegions, null, 2));
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                📋 Export to Console
              </motion.button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
