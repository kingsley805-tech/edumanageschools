import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProctoringConfig {
  enabled: boolean;
  fullscreenRequired: boolean;
  tabSwitchLimit: number;
  webcamRequired: boolean;
  attemptId: string | null;
  studentId: string | null;
  userId: string | null;
  snapshotIntervalSeconds?: number;
  faceDetectionEnabled?: boolean;
  onAutoSubmit?: () => void;
}

interface FaceDetectionResult {
  faceCount: number;
  timestamp: number;
}

export const useExamProctoring = (config: ProctoringConfig) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [violations, setViolations] = useState<string[]>([]);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<"ok" | "no_face" | "multiple_faces">("ok");
  const [lastFaceCount, setLastFaceCount] = useState(1);
  const isActive = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const faceDetectorRef = useRef<any>(null);
  const lastFaceViolationRef = useRef<number>(0);

  const logViolation = useCallback(
    async (type: string, description: string, snapshotUrl?: string) => {
      if (!config.attemptId || !config.studentId) return;

      setViolations((prev) => [...prev, `${type}: ${description}`]);

      try {
        await supabase.from("exam_proctoring_logs").insert({
          attempt_id: config.attemptId,
          student_id: config.studentId,
          violation_type: type,
          description,
          snapshot_url: snapshotUrl || null,
        });
      } catch (error) {
        console.error("Failed to log violation:", error);
      }
    },
    [config.attemptId, config.studentId]
  );

  const captureSnapshot = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !config.userId || !config.studentId || !config.attemptId) return null;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(videoRef.current, 0, 0);
      
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7);
      });

      if (!blob) return null;

      const timestamp = Date.now();
      const filePath = `${config.userId}/${config.studentId}/${config.attemptId}/${timestamp}.jpg`;

      const { data, error } = await supabase.storage
        .from("proctoring-snapshots")
        .upload(filePath, blob, { contentType: "image/jpeg" });

      if (error) {
        console.error("Snapshot upload error:", error);
        return null;
      }

      setSnapshotCount((prev) => prev + 1);
      return data?.path || null;
    } catch (error) {
      console.error("Snapshot capture error:", error);
      return null;
    }
  }, [config.userId, config.studentId, config.attemptId]);

  // Face detection using FaceDetector API (if available) or canvas-based detection
  const detectFaces = useCallback(async (): Promise<FaceDetectionResult> => {
    if (!videoRef.current) return { faceCount: 1, timestamp: Date.now() };

    try {
      // Check if FaceDetector API is available (Chrome only)
      if ('FaceDetector' in window) {
        if (!faceDetectorRef.current) {
          // @ts-ignore - FaceDetector is not in TypeScript types
          faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
        }
        
        const faces = await faceDetectorRef.current.detect(videoRef.current);
        return { faceCount: faces.length, timestamp: Date.now() };
      }

      // Fallback: basic brightness detection (very basic approximation)
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { faceCount: 1, timestamp: Date.now() };

      ctx.drawImage(videoRef.current, 0, 0);
      
      // Get center region (where face should be)
      const centerX = canvas.width * 0.25;
      const centerY = canvas.height * 0.1;
      const regionWidth = canvas.width * 0.5;
      const regionHeight = canvas.height * 0.6;
      
      const imageData = ctx.getImageData(centerX, centerY, regionWidth, regionHeight);
      const data = imageData.data;
      
      // Calculate brightness variance to detect presence
      let totalBrightness = 0;
      let pixelCount = 0;
      
      for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        totalBrightness += brightness;
        pixelCount++;
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      
      // Very basic heuristic: if screen is too dark or too uniform, might not be a face
      // This is a fallback and not very accurate
      if (avgBrightness < 30) {
        return { faceCount: 0, timestamp: Date.now() };
      }
      
      return { faceCount: 1, timestamp: Date.now() };
    } catch (error) {
      console.error("Face detection error:", error);
      return { faceCount: 1, timestamp: Date.now() };
    }
  }, []);

  const handleFaceDetectionResult = useCallback(async (result: FaceDetectionResult) => {
    const now = Date.now();
    const cooldownMs = 10000; // 10 second cooldown between face violations
    
    setLastFaceCount(result.faceCount);
    
    if (result.faceCount === 0) {
      setFaceDetectionStatus("no_face");
      
      if (now - lastFaceViolationRef.current > cooldownMs) {
        lastFaceViolationRef.current = now;
        const snapshotPath = await captureSnapshot();
        logViolation("no_face_detected", "No face detected in webcam", snapshotPath || undefined);
        toast.warning("Please ensure your face is visible in the camera");
      }
    } else if (result.faceCount > 1) {
      setFaceDetectionStatus("multiple_faces");
      
      if (now - lastFaceViolationRef.current > cooldownMs) {
        lastFaceViolationRef.current = now;
        const snapshotPath = await captureSnapshot();
        logViolation("multiple_faces_detected", `${result.faceCount} faces detected in webcam`, snapshotPath || undefined);
        toast.error("Multiple faces detected! Only the exam taker should be visible.");
      }
    } else {
      setFaceDetectionStatus("ok");
    }
  }, [captureSnapshot, logViolation]);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      setWebcamStream(stream);
      setWebcamError(null);
      return stream;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to access webcam";
      setWebcamError(errorMessage);
      logViolation("webcam_error", `Webcam access denied: ${errorMessage}`);
      toast.error("Please allow webcam access for this proctored exam");
      return null;
    }
  }, [logViolation]);

  const stopWebcam = useCallback(() => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
  }, [webcamStream]);

  const setVideoElement = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    if (element && webcamStream) {
      element.srcObject = webcamStream;
      element.play().catch(console.error);
    }
  }, [webcamStream]);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } catch (error) {
      console.error("Fullscreen error:", error);
      toast.error("Please enable fullscreen mode to continue the exam");
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  }, []);

  // Initialize webcam, snapshots, and face detection
  useEffect(() => {
    if (!config.enabled || !config.webcamRequired) return;

    let mounted = true;

    const initWebcam = async () => {
      const stream = await startWebcam();
      if (stream && mounted) {
        // Start periodic snapshots
        const intervalMs = (config.snapshotIntervalSeconds || 30) * 1000;
        snapshotIntervalRef.current = setInterval(async () => {
          if (isActive.current) {
            const snapshotPath = await captureSnapshot();
            if (snapshotPath) {
              await supabase.from("exam_proctoring_logs").insert({
                attempt_id: config.attemptId,
                student_id: config.studentId,
                violation_type: "periodic_snapshot",
                description: "Periodic webcam snapshot",
                snapshot_url: snapshotPath,
              });
            }
          }
        }, intervalMs);

        // Start face detection if enabled
        if (config.faceDetectionEnabled !== false) {
          // Wait for video to be ready
          setTimeout(() => {
            faceDetectionIntervalRef.current = setInterval(async () => {
              if (isActive.current && videoRef.current) {
                const result = await detectFaces();
                await handleFaceDetectionResult(result);
              }
            }, 3000); // Check every 3 seconds
          }, 2000);
        }
      }
    };

    initWebcam();

    return () => {
      mounted = false;
      stopWebcam();
    };
  }, [config.enabled, config.webcamRequired, config.snapshotIntervalSeconds, config.faceDetectionEnabled, startWebcam, stopWebcam, captureSnapshot, detectFaces, handleFaceDetectionResult, config.attemptId, config.studentId]);

  // Main proctoring effect
  useEffect(() => {
    if (!config.enabled) return;
    isActive.current = true;

    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);

      // Only log violation if user deliberately exited fullscreen (not just a brief transition)
      // Don't log if we're not active or fullscreen isn't required
      if (!inFullscreen && isActive.current && config.fullscreenRequired) {
        // Small delay to check if this was intentional
        setTimeout(() => {
          if (!document.fullscreenElement && isActive.current) {
            logViolation("fullscreen_exit", "Student exited fullscreen mode");
            toast.warning("Please stay in fullscreen mode during the exam");
            // Re-enter fullscreen automatically
            enterFullscreen();
          }
        }, 100);
      }
    };

    const handleVisibilityChange = async () => {
      if (document.hidden && isActive.current) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        
        // Capture snapshot on tab switch
        const snapshotPath = config.webcamRequired ? await captureSnapshot() : null;
        logViolation("tab_switch", `Tab switch detected (${newCount}/${config.tabSwitchLimit})`, snapshotPath || undefined);

        if (newCount >= config.tabSwitchLimit) {
          toast.error("Maximum tab switches reached! Exam will be auto-submitted.");
          config.onAutoSubmit?.();
        } else {
          toast.warning(`Warning: Tab switch detected (${newCount}/${config.tabSwitchLimit})`);
        }
      }
    };

    const handleBlur = () => {
      if (isActive.current) {
        logViolation("window_blur", "Window lost focus");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation("right_click", "Right-click attempted");
      toast.error("Right-click is disabled during the exam");
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "C", "x", "X", "v", "V", "a", "A"].includes(e.key)
      ) {
        e.preventDefault();
        logViolation("copy_attempt", `Keyboard shortcut attempted: Ctrl+${e.key}`);
        toast.error("Copy/Paste is disabled during the exam");
        return false;
      }

      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && e.key === "u")
      ) {
        e.preventDefault();
        logViolation("dev_tools", "Developer tools shortcut attempted");
        return false;
      }

      if (e.key === "Escape" && config.fullscreenRequired) {
        e.preventDefault();
        toast.warning("Please stay in fullscreen mode");
        return false;
      }
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    const handleDragStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("dragstart", handleDragStart);

    if (config.fullscreenRequired) {
      enterFullscreen();
    }

    return () => {
      isActive.current = false;
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("dragstart", handleDragStart);

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [config.enabled, config.fullscreenRequired, config.tabSwitchLimit, config.webcamRequired, tabSwitchCount, logViolation, enterFullscreen, captureSnapshot, config.onAutoSubmit]);

  return {
    isFullscreen,
    tabSwitchCount,
    violations,
    webcamStream,
    webcamError,
    snapshotCount,
    faceDetectionStatus,
    lastFaceCount,
    enterFullscreen,
    exitFullscreen,
    setVideoElement,
    captureSnapshot,
    stopWebcam,
  };
};
