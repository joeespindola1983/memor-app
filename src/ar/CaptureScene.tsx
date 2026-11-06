import { useEffect, useRef } from "react";
import { ViroARScene, ViroTrackingStateConstants } from "@reactvision/react-viro";
import { scanBridge, type VPSNavigator } from "./scanBridge";

/**
 * Tracking-only capture scene. Unlike ARLabScene, this scene does not mount any
 * saved artwork or claim a restorable ARWorldMap. It observes *real* Viro
 * anchors, actual camera movement, depth and tracking quality.
 */
export default function CaptureScene({ arSceneNavigator }: { arSceneNavigator?: VPSNavigator }) {
  const sceneRef = useRef<ViroARScene>(null);
  useEffect(() => {
    if (!arSceneNavigator) return;
    return scanBridge.registerVPSNavigator(arSceneNavigator);
  }, [arSceneNavigator]);
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
