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
  onAutoSubmit?: () => void;
}

export const useExamProctoring = (config: ProctoringConfig) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [violations, setViolations] = useState<string[]>([]);
  const isActive = useRef(false);

  const logViolation = useCallback(
    async (type: string, description: string) => {
      if (!config.attemptId || !config.studentId) return;

      setViolations((prev) => [...prev, `${type}: ${description}`]);

      try {
        await supabase.from("exam_proctoring_logs").insert({
          attempt_id: config.attemptId,
          student_id: config.studentId,
          violation_type: type,
          description,
        });
      } catch (error) {
        console.error("Failed to log violation:", error);
      }
    },
    [config.attemptId, config.studentId]
  );

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

  useEffect(() => {
    if (!config.enabled) return;
    isActive.current = true;

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);

      if (!inFullscreen && isActive.current && config.fullscreenRequired) {
        logViolation("fullscreen_exit", "Student exited fullscreen mode");
        toast.warning("Please stay in fullscreen mode during the exam");
      }
    };

    // Visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden && isActive.current) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        logViolation("tab_switch", `Tab switch detected (${newCount}/${config.tabSwitchLimit})`);

        if (newCount >= config.tabSwitchLimit) {
          toast.error("Maximum tab switches reached! Exam will be auto-submitted.");
          config.onAutoSubmit?.();
        } else {
          toast.warning(`Warning: Tab switch detected (${newCount}/${config.tabSwitchLimit})`);
        }
      }
    };

    // Window blur (focus lost)
    const handleBlur = () => {
      if (isActive.current) {
        logViolation("window_blur", "Window lost focus");
      }
    };

    // Right-click prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logViolation("right_click", "Right-click attempted");
      toast.error("Right-click is disabled during the exam");
      return false;
    };

    // Copy/Paste prevention
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

      // Prevent developer tools
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && e.key === "u")
      ) {
        e.preventDefault();
        logViolation("dev_tools", "Developer tools shortcut attempted");
        return false;
      }

      // Prevent Escape from exiting fullscreen too easily
      if (e.key === "Escape" && config.fullscreenRequired) {
        e.preventDefault();
        toast.warning("Please stay in fullscreen mode");
        return false;
      }
    };

    // Prevent text selection
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Prevent drag
    const handleDragStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Add event listeners
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("dragstart", handleDragStart);

    // Enter fullscreen if required
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

      // Exit fullscreen when exam ends
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [config.enabled, config.fullscreenRequired, config.tabSwitchLimit, tabSwitchCount, logViolation, enterFullscreen, config.onAutoSubmit]);

  return {
    isFullscreen,
    tabSwitchCount,
    violations,
    enterFullscreen,
    exitFullscreen,
  };
};
