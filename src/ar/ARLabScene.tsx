import { useEffect, useMemo, useRef } from "react";
import {
  ViroARScene, ViroAmbientLight, ViroBox, ViroMaterials, ViroNode, ViroText,
  ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import { useARSession } from "./session";
import { sceneBridge } from "./sceneBridge";

ViroMaterials.createMaterials({
  memorPanel: { diffuseColor: "#D7F5DF" },
  memorFrame: { diffuseColor: "#20352A" },
  memorPost: { diffuseColor: "#718577" },
});

const labelStyle = { fontSize: 22, color: "#17271C", textAlign: "center" as const };

export default function ARLabScene() {
  const sceneRef = useRef<ViroARScene>(null);
  useEffect(() => sceneBridge.registerRaycaster(async () => {
    if (!sceneRef.current) throw new Error("Cena AR ainda não foi montada.");
    return await sceneRef.current.performARHitTestWithRay([0, 0, -1]);
  }), []);
  // Each intervention is visible only in this tracked session. A different
  // AR session has a different origin and requires a real localization anchor.
  const session = useARSession();
  const artworks = useMemo(() => session.artworks, [session.artworks]);
  return (
    <ViroARScene
      ref={sceneRef}
      anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
      onTrackingUpdated={(state) => {
        sceneBridge.setTracking(state === ViroTrackingStateConstants.TRACKING_NORMAL
          ? "ready" : state === ViroTrackingStateConstants.TRACKING_LIMITED
          ? "limited" : "starting");
      }}
    >
      <ViroAmbientLight color="#ffffff" intensity={220} />
      {artworks.map((item) => (
        <ViroNode key={item.id} position={item.sessionPosition}>
          <ViroBox
            position={[0, item.kind === "text" ? 0.38 : 0.64, 0]}
            width={item.kind === "text" ? 0.8 : 0.62}
            height={item.kind === "text" ? 0.35 : 0.8}
            length={0.035}
            materials={["memorPanel"]}
          />
          {item.kind === "card" ? (
            <ViroBox
              position={[0, 0.28, -0.03]}
              width={0.035} height={0.52} length={0.035}
              materials={["memorPost"]}
            />
          ) : null}
          <ViroText
            text={item.kind === "card" ? `FOTO / TESTE\n${item.title}` : item.title}
            width={0.75}
            height={0.35}
            position={[0, item.kind === "text" ? 0.4 : 0.75, 0.038]}
            style={labelStyle}
            scale={[0.7, 0.7, 0.7]}
          />
        </ViroNode>
      ))}
    </ViroARScene>
  );
}
