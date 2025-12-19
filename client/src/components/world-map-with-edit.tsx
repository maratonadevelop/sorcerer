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
// Final coordinates based on manual editing
const regions = {
  umbra: { 
    name: "Umbra", 
    center: { x: 23, y: 25 }, 
    bounds: { x: 1, y: 0, width: 45, height: 41 },
    zoom: 2.8,
    color: "#1f2937",
    desc: "The dark, shadowed northern reaches",
    clipPath: "polygon(23.194662480376767% 0.52687906478966%, 43.4458398744113% 16.596690540874288%, 45.6436420722135% 27.79287066765456%, 37.244897959183675% 39.779369391619326%, 14.717425431711145% 40.43796822260641%, 3.571428571428571% 40.30624845640899%, 1.6091051805337522% 22.39236025356055%, 10.08634222919937% 16.06981147608463%)"
  },
  silvanum: { 
    name: "Silvanum", 
    center: { x: 30, y: 54 }, 
    bounds: { x: 15, y: 29, width: 30, height: 50 },
    zoom: 3.2,
    color: "#065f46",
    desc: "Dense forests in the central band",
    clipPath: "polygon(16.444270015698585% 38.857331028237425%, 37.009419152276294% 29.900386926813205%, 44.230769230769226% 59.010455256441915%, 38.893249607535324% 67.5722400592739%, 33.16326530612245% 78.37326088746192%, 24.607535321821036% 71.78727257759118%, 15.580847723704865% 50.185230921215116%)"
  },
  luminah: { 
    name: "Luminah", 
    center: { x: 44, y: 83 }, 
    bounds: { x: 30, y: 65, width: 29, height: 35 },
    zoom: 3.0,
    color: "#dc2626",
    desc: "The rosier southern lands",
    clipPath: "polygon(50.981161695447405% 65.8598830987075%, 56.31868131868132% 73.7630690705524%, 58.594976452119305% 89.17428171564995%, 30% 100%, 34.41915227629514% 95.36511072692846%, 36.14599686028257% 88.6474026508603%, 35.67503924646782% 78.90013995225158%, 35.12558869701727% 75.6071457973162%, 42.425431711146% 71.26039351280151%)"
  },
  akeli: { 
    name: "Akeli", 
    center: { x: 80, y: 34 }, 
    bounds: { x: 60, y: 11, width: 40, height: 46 },
    zoom: 2.5,
    color: "#7c3aed",
    desc: "Eastern crystal formations",
    clipPath: "polygon(76.88383045525903% 11.591339425372519%, 99.33281004709576% 23.7095579155347%, 94.78021978021978% 47.94599489585906%, 63.775510204081634% 55.98090063390138%, 60.40031397174255% 30.954145056392523%, 66.52276295133439% 26.080513707088173%)"
  },
  aquarium: { 
    name: "Aquarium", 
    center: { x: 55, y: 52 }, 
    bounds: { x: 50, y: 47, width: 10, height: 10 },
    zoom: 4.0,
    color: "#059669",
    desc: "Mystic water realm",
    clipPath: "circle(3% at 55.06279434850864% 52.42446694657117%)"
  },
  ferros: { 
    name: "Ferros", 
    center: { x: 55, y: 52 }, 
    bounds: { x: 50, y: 47, width: 10, height: 10 },
    zoom: 4.0,
    color: "#b45309",
    desc: "Iron-rich territories",
    clipPath: "circle(3% at 55.06279434850864% 52.42446694657117%)"
  }
};

export default function WorldMapInteractive({ locations }: WorldMapProps) {
  const auth = useAuth();
  const isAdmin = !!auth?.isAdmin;

  // Basic states
  const [hoveredContinent, setHoveredContinent] = useState<string | null>(null);
  
  // Map reference
  const mapRef = useRef<HTMLDivElement>(null);
  // Edit states (missing in this file previously)
  const [editMode, setEditMode] = useState(false);
  const [selectedRegionForEdit, setSelectedRegionForEdit] = useState<string | null>(null);
  const [editableRegions, setEditableRegions] = useState(regions);
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
      // accept decimals in radius and center
      const match = clipPath.match(/circle\(([0-9.]+)% at ([0-9.]+)% ([0-9.]+)%\)/);
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

  // Use container rect for coordinate calculation (handles object-cover cropping)
  const containerRect = mapRef.current.getBoundingClientRect();
  const relativeX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
  const relativeY = ((e.clientY - containerRect.top) / containerRect.height) * 100;

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

  // Use container rect for coordinate calculation
  const containerRect = mapRef.current.getBoundingClientRect();
  const relativeX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
  const relativeY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
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

  // Copy region coordinates
  const copyRegionCoordinates = (regionKey: string) => {
    const region = editableRegions[regionKey as keyof typeof editableRegions];
    const points = parseClipPath(region.clipPath);
    
    if (points) {
      const coordsText = points.map((point, index) => 
        `Point ${index + 1}: ${point.x.toFixed(1)}%, ${point.y.toFixed(1)}%`
      ).join('\n');
      
      const fullText = `${region.name} Coordinates:\n${coordsText}\n\nClip Path: ${region.clipPath}`;
      
      navigator.clipboard.writeText(fullText);
      console.log('Region coordinates copied:', fullText);
      alert(`${region.name} coordinates copied to clipboard!`);
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
    // Prefer editableRegions if available
    const region = (editableRegions && editableRegions[regionKey as keyof typeof editableRegions]) || regions[regionKey as keyof typeof regions];
    const clipPath = (region as any).clipPath;
    if (!clipPath) return false;

    // circle
    if (clipPath.startsWith('circle(')) {
      const match = clipPath.match(/circle\(([0-9.]+)% at ([0-9.]+)% ([0-9.]+)%\)/);
      if (match) {
        const radius = parseFloat(match[1]);
        const centerX = parseFloat(match[2]);
        const centerY = parseFloat(match[3]);
        const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        return distance <= radius;
      }
      return false;
    }

    // polygon
    if (clipPath.startsWith('polygon(')) {
      const points = parseClipPath(clipPath);
      if (!points || points.length < 3) return false;

      // ray-casting algorithm
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x, yi = points[i].y;
        const xj = points[j].x, yj = points[j].y;

        const intersect = ((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi + Number.EPSILON) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
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

              {/* Region Name Label - only in edit mode */}
              {editMode && (
                <div
                  className="absolute pointer-events-none z-30"
                  style={{
                    left: `${region.center.x}%`,
                    top: `${region.center.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div className={`px-3 py-1 rounded-full text-sm font-bold shadow-lg border-2 ${
                    isSelected 
                      ? 'bg-yellow-400 text-black border-yellow-600' 
                      : 'bg-black bg-opacity-80 text-white border-gray-600'
                  }`}>
                    {region.name}
                  </div>
                </div>
              )}

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
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        e.stopPropagation();
                        const coords = `${point.x.toFixed(1)}%, ${point.y.toFixed(1)}%`;
                        navigator.clipboard.writeText(coords);
                        console.log(`Coordinates copied: ${coords}`);
                        alert(`Coordenadas copiadas: ${coords}`);
                      }
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
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-3 py-2 rounded whitespace-nowrap pointer-events-none opacity-0 hover:opacity-100 transition-opacity z-60">
                      <div className="font-bold text-yellow-300">{region.name}</div>
                      <div>Point {index + 1}</div>
                      <div className="text-xs text-gray-300">
                        {point.x.toFixed(1)}%, {point.y.toFixed(1)}%
                      </div>
                      <div className="text-xs text-blue-300 mt-1">
                        Ctrl+Click to copy coords
                      </div>
                      <div className="text-xs text-red-300">
                        Double-click to remove
                      </div>
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
                  <div className="space-y-2">
                    <div>
                      Editing: <strong className="text-blue-600 dark:text-blue-400">{editableRegions[selectedRegionForEdit as keyof typeof editableRegions].name}</strong>
                      {' • '}
                      Points: <strong>{parseClipPath(editableRegions[selectedRegionForEdit as keyof typeof editableRegions].clipPath)?.length || 0}</strong>
                    </div>
                    <div className="text-xs">
                      <span className="text-green-600">Double-click map to add point</span>
                      {' • '}
                      <span className="text-blue-600">Ctrl+Click point to copy coords</span>
                      {' • '}
                      <span className="text-red-600">Double-click point to remove</span>
                    </div>
                  </div>
                ) : (
                  'Click a region to start editing'
                )}
              </div>
              
              {selectedRegionForEdit && (
                <motion.button
                  className="px-4 py-2 rounded-lg font-medium text-sm bg-blue-500 hover:bg-blue-600 text-white transition-all"
                  onClick={() => copyRegionCoordinates(selectedRegionForEdit)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  📋 Copy All Coordinates
                </motion.button>
              )}
              
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

              <motion.button
                className="px-4 py-2 rounded-lg font-medium text-sm bg-indigo-500 hover:bg-indigo-600 text-white transition-all"
                onClick={() => {
                  // Save to localStorage
                  try {
                    localStorage.setItem('worldMapMasks', JSON.stringify(editableRegions));
                    alert('Coordenadas salvas localmente (localStorage).');
                  } catch (err) {
                    console.error(err);
                    alert('Falha ao salvar localmente.');
                  }
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                💾 Save Local
              </motion.button>

              <motion.button
                className="px-4 py-2 rounded-lg font-medium text-sm bg-rose-500 hover:bg-rose-600 text-white transition-all"
                onClick={async () => {
                  // Export JSON download
                  const dataStr = JSON.stringify(editableRegions, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'world-map-masks.json';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ⤓ Export JSON
              </motion.button>

              <motion.button
                className="px-4 py-2 rounded-lg font-medium text-sm bg-sky-600 hover:bg-sky-700 text-white transition-all"
                onClick={async () => {
                  // Attempt to POST to server endpoint
                  try {
                    const resp = await fetch('/api/map-masks', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(editableRegions)
                    });
                    if (resp.ok) {
                      alert('Coordenadas salvas no servidor.');
                    } else {
                      const txt = await resp.text();
                      console.error('Server save failed', txt);
                      alert('Falha ao salvar no servidor. Veja console.');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('Erro de rede ao salvar no servidor.');
                  }
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ☁️ Save Server
              </motion.button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
