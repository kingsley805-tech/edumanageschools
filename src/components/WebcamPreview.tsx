import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Minimize2, Maximize2, Move } from "lucide-react";

interface WebcamPreviewProps {
  stream: MediaStream | null;
  onVideoRef: (element: HTMLVideoElement | null) => void;
}

export const WebcamPreview = ({ stream, onVideoRef }: WebcamPreviewProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
      onVideoRef(videoRef.current);
    }
    return () => {
      onVideoRef(null);
    };
  }, [stream, onVideoRef]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 200);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 150);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    e.preventDefault();
  };

  if (isHidden || !stream) return null;

  return (
    <Card
      ref={containerRef}
      className="fixed z-50 shadow-xl overflow-hidden bg-black"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? "grabbing" : "auto",
      }}
    >
      {/* Header/Drag Handle */}
      <div
        className="flex items-center justify-between px-2 py-1 bg-muted/90 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Move className="h-3 w-3" />
          <span>Webcam</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setIsHidden(true)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Video */}
      {!isMinimized && (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-48 h-36 object-cover transform -scale-x-100"
          />
          {/* Recording indicator */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-white drop-shadow-md">REC</span>
          </div>
        </div>
      )}
    </Card>
  );
};
