import { useEffect, useRef } from "react";
import { ViroARScene, ViroTrackingStateConstants } from "@reactvision/react-viro";
import { scanBridge } from "./scanBridge";

/**
 * Tracking-only capture scene. Unlike ARLabScene, this scene does not mount any
 * saved artwork or claim a restorable ARWorldMap. It observes *real* Viro
 * anchors, actual camera movement, depth and tracking quality.
 */
export default function CaptureScene() {
  const sceneRef = useRef<ViroARScene>(null);
  useEffect(() => {
    // CaptureScene owns no AR native resources outside ViroARScene.
    return () => { sceneRef.current = null; };
  }, []);
  return (
    <ViroARScene
      ref={sceneRef}
      anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
      onCameraTransformUpdate={(camera) => scanBridge.observeCamera(camera.position)}
      onAnchorFound={(anchor) => scanBridge.observePlane(anchor)}
      onAnchorUpdated={(anchor) => scanBridge.observePlane(anchor)}
      onAnchorRemoved={(anchor) => scanBridge.removePlane(anchor)}
      onDepthReady={() => scanBridge.markDepthAvailable()}
      onTrackingUpdated={(tracking) => {
        scanBridge.setTracking(tracking === ViroTrackingStateConstants.TRACKING_NORMAL
          ? "ready" : tracking === ViroTrackingStateConstants.TRACKING_LIMITED
          ? "limited" : "starting");
      }}
    />
  );
}
