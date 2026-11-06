import Constants from "expo-constants";
import { useEffect, useRef } from "react";
import {
  ViroARScene, ViroAmbientLight, ViroARCloudAnchor, ViroBox,
  ViroMaterials, ViroNode, ViroText, ViroTrackingStateConstants,
} from "@reactvision/react-viro";
import { usePlaces } from "../data/PlaceStore";
import type { ArtworkDraft, Vec3 } from "../domain/models";
import { useARSession } from "./session";
import { sceneBridge } from "./sceneBridge";

ViroMaterials.createMaterials({
  memorPanel: { diffuseColor: "#D7F5DF" },
  memorFrame: { diffuseColor: "#20352A" },
  memorPost: { diffuseColor: "#718577" },
});

const labelStyle = { fontSize: 22, color: "#17271C", textAlign: "center" as const };

function ArtworkVisual({ item, position }: { item: ArtworkDraft; position: Vec3 }) {
  return (
    <ViroNode position={position}>
      <ViroBox
        position={[0, item.kind === "text" ? 0.38 : 0.64, 0]}
        width={item.kind === "text" ? 0.8 : 0.62}
        height={item.kind === "text" ? 0.35 : 0.8}
        length={0.035} materials={["memorPanel"]}
      />
      {item.kind === "card" ? (
        <ViroBox position={[0, 0.28, -0.03]}
          width={0.035} height={0.52} length={0.035}
          materials={["memorPost"]}/>
      ) : null}
      <ViroText text={item.kind === "card" ? `FOTO / TESTE\n${item.title}` : item.title}
        width={0.75} height={0.35}
        position={[0, item.kind === "text" ? 0.4 : 0.75, 0.038]}
        style={labelStyle} scale={[0.7, 0.7, 0.7]}/>
    </ViroNode>
  );
}

export default function ARLabScene({ arSceneNavigator }: { arSceneNavigator?: any } = {}) {
  const sceneRef = useRef<ViroARScene>(null);
  const session = useARSession();
  const { places } = usePlaces();
  const place = places.find((p) => p.id === session.placeId);
  const rvConfigured = Constants.expoConfig?.extra?.reactvisionConfigured === true;
  const anchorID = rvConfigured ? place?.cloudAnchor?.cloudAnchorId : undefined;

  useEffect(() => sceneBridge.registerRaycaster(async (cameraForward) => {
    if (!sceneRef.current) throw new Error("Cena AR ainda não foi montada.");
    return await sceneRef.current.performARHitTestWithRay(cameraForward);
  }), []);

  // Local-only artwork remains visible exclusively in the live AR session.
  const currentWorldArtworks = session.artworks.filter((item) => !item.locationPosition);
  // Unlike world-space sessionPosition, locationPosition is relative to a
  // frame that ViroARCloudAnchor will resolve on each new AR session/device.
  const anchoredArtworks = place?.artworks.filter((item) =>
    item.locationPosition && item.locationAnchorId === anchorID) ?? [];

  return (
    <ViroARScene
      ref={sceneRef}
      onCameraTransformUpdate={(camera) => sceneBridge.setCameraForward(camera.forward)}
      onDepthReady={() => sceneBridge.setDepthReady(true)}
      anchorDetectionTypes={["PlanesHorizontal", "PlanesVertical"]}
      onTrackingUpdated={(state) => {
        sceneBridge.setTracking(state === ViroTrackingStateConstants.TRACKING_NORMAL
          ? "ready" : state === ViroTrackingStateConstants.TRACKING_LIMITED
          ? "limited" : "starting");
      }}
    >
      <ViroAmbientLight color="#ffffff" intensity={220} />
      {currentWorldArtworks.map((item) => (
        <ArtworkVisual key={item.id} item={item} position={item.sessionPosition} />
      ))}
      {anchorID && arSceneNavigator ? (
        <ViroARCloudAnchor
          cloudAnchorId={anchorID}
          arSceneNavigator={arSceneNavigator}
          onLocalized={(event) => sceneBridge.setAnchorFrame(event.transform)}
          onLocalizeError={(error) => sceneBridge.setAnchorError(error)}
        >
          <ViroText
            text="MEMOR\nLOCAL RECONHECIDO"
            width={1.2} height={0.45}
            position={[0, 0.25, 0]}
            style={{...labelStyle, fontSize: 17}}
            scale={[0.6, 0.6, 0.6]}
          />
          {anchoredArtworks.map((item) => (
            <ArtworkVisual key={item.id} item={item} position={item.locationPosition!} />
          ))}
        </ViroARCloudAnchor>
      ) : null}
    </ViroARScene>
  );
}
