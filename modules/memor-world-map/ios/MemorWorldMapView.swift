import ARKit
import ExpoModulesCore
import SceneKit
import UIKit

/// Native ARKit engine hosted inside the React Native UI.
/// This retains the same world-map expansion policy/history/anchor logic used
/// by Memor's original Swift experiment (feat/memor-progressive-world-mapping).
public final class MemorWorldMapView: ExpoView, ARSessionDelegate, ARSCNViewDelegate {
  let onStatus = EventDispatcher()
  private let scene = ARSCNView(frame: .zero)
  private var mapID: String?
  private var titles: [String: String] = [:]
  private var markersJSON = "[]"
  private var photoURLs: [String: URL] = [:]
  private var lastTrackingSignature = ""
  private var sessionID = UUID().uuidString
  private var sawRelocalizing = false
  private var localized = false
  private var expanding = false
  private var busy = false
  private var lastStatus: TimeInterval = -1

  required public init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    scene.scene = SCNScene()
    scene.delegate = self
    scene.session.delegate = self
    scene.automaticallyUpdatesLighting = false
    scene.autoenablesDefaultLighting = false
    addSubview(scene)
    MemorSpatialTrace.write("engine.initialized", fields: ["session": sessionID])
  }

  override public func layoutSubviews() {
    super.layoutSubviews()
    scene.frame = bounds
  }

  override public func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      scene.session.pause()
      MemorSpatialTrace.write("session.paused", fields: ["session": sessionID])
    } else {
      openSession()
    }
  }

  deinit {
    scene.session.delegate = nil
    scene.delegate = nil
    scene.session.pause()
  }

  static func url(for id: String) throws -> URL {
    guard let uuid = UUID(uuidString: id) else {
      throw NSError(domain: "MemorWorldMap", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "Identificador de mapa inválido."])
    }
    let root = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("MemorWorldMaps", isDirectory: true)
      .appendingPathComponent(uuid.uuidString.lowercased(), isDirectory: true)
    return root.appendingPathComponent("worldmap.archive")
  }

  static func fileRecord(id: String, url: URL, byteCount: Int) -> [String: Any] {
    [
      "provider": "arkit-worldmap",
      "version": 1,
      "id": id.lowercased(),
      "uri": url.absoluteString,
      "byteCount": byteCount,
      "createdAt": ISO8601DateFormatter().string(from: Date())
    ]
  }

  static func readMap(_ url: URL) throws -> ARWorldMap {
    let data = try Data(contentsOf: url, options: .mappedIfSafe)
    guard let map = try NSKeyedUnarchiver.unarchivedObject(ofClass: ARWorldMap.self, from: data) else {
      throw MemorWorldMapHistoryError.invalidMap
    }
    return map
  }

  func configure(mapId: String?) {
    guard mapID != mapId else { return }
    mapID = mapId
    setMarkers(json: markersJSON)
    if window != nil { openSession() }
  }

  func setMarkers(json: String) {
    markersJSON = json
    guard let data = json.data(using: .utf8),
          let items = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]] else {
      MemorSpatialTrace.write("render.metadata.invalid")
      return
    }
    var nextTitles: [String: String] = [:]
    var nextPhotos: [String: URL] = [:]
    for item in items {
      guard let id = item["id"], let title = item["title"], !title.isEmpty,
            UUID(uuidString: id) != nil else { continue }
      if item["kind"] == "photo", let mapID {
        let name = "memor.photo." + id.lowercased()
        nextTitles[name] = title
        nextPhotos[name] = Self.photoURL(for: mapID, artworkID: id)
      } else if item["kind"] == "text" || item["kind"] == nil {
        nextTitles["memor.text." + id.lowercased()] = title
      }
    }
    titles = nextTitles
    photoURLs = nextPhotos
    MemorSpatialTrace.write("render.metadata.loaded", fields: [
      "textCount": nextTitles.count - nextPhotos.count, "photoCount": nextPhotos.count
    ])
    refreshArtworkNodes()
  }

  static func photoURL(for mapID: String, artworkID: String) -> URL {
    // Both IDs must be UUIDs before the path is used.
    let root = (try? url(for: mapID))?.deletingLastPathComponent()
    return (root ?? FileManager.default.temporaryDirectory)
      .appendingPathComponent("media", isDirectory: true)
      .appendingPathComponent(artworkID.lowercased() + ".jpg")
  }

  private func refreshArtworkNodes() {
    for anchor in scene.session.currentFrame?.anchors ?? [] {
      guard let name = anchor.name, WorldMapAnchorPersistence.isInterventionAnchor(name),
            let node = scene.node(for: anchor) else { continue }
      renderArtwork(name: name, on: node)
    }
  }

  private func renderArtwork(name: String, on node: SCNNode) {
    node.childNodes.filter { $0.name == "memor.rendered.artwork" }.forEach { $0.removeFromParentNode() }
    guard let title = titles[name] else {
      MemorSpatialTrace.write("render.metadata.missing", fields: ["anchor": name])
      return
    }
    let kind = name.hasPrefix("memor.photo.") ? "photo" : "text"
    guard let artwork = MemorArtworkSceneFactory.node(
      kind: kind, title: title, photoURL: photoURLs[name]
    ) else {
      MemorSpatialTrace.write("render.asset.unavailable", fields: ["anchor": name, "kind": kind])
      return
    }
    // The node is a SceneKit container associated with the world anchor.
    // Adding the card after the metadata arrives fixes the empty-node race.
    for child in artwork.childNodes {
      child.removeFromParentNode()
      node.addChildNode(child)
    }
    let projected = scene.projectPoint(node.worldPosition)
    let inViewport = projected.z > 0 && projected.z < 1 &&
      projected.x >= 0 && projected.x <= Float(scene.bounds.width) &&
      projected.y >= 0 && projected.y <= Float(scene.bounds.height)
    MemorSpatialTrace.write("render.node.attached", fields: [
      "anchor": name, "kind": kind, "inViewport": inViewport
    ])
  }

  private func openSession() {
    guard window != nil, ARWorldTrackingConfiguration.isSupported else { return }
    let configuration = ARWorldTrackingConfiguration()
    configuration.planeDetection = [.horizontal, .vertical]
    configuration.environmentTexturing = .none
    expanding = false
    localized = false
    sawRelocalizing = false
    lastStatus = -1
    lastTrackingSignature = ""
    sessionID = UUID().uuidString
    MemorSpatialTrace.write("session.open", fields: ["session": sessionID, "restoring": mapID != nil])
    if let id = mapID {
      do {
        let restoredMap = try Self.readMap(Self.url(for: id))
        configuration.initialWorldMap = restoredMap
        MemorSpatialTrace.write("map.restore.loaded", fields: ["anchorCount": restoredMap.anchors.count, "session": sessionID])
        // Keep plane hit-tests available for placing new works; LiDAR mesh
        // reconstruction remains disabled except during explicit expansion.
      } catch {
        MemorSpatialTrace.write("map.restore.failed")
        sendError("Não foi possível abrir o mapa salvo: \(error.localizedDescription)")
        return
      }
    }
    scene.debugOptions = []
    scene.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
  }

  private func sendError(_ message: String) {
    MemorSpatialTrace.write("session.error", fields: ["session": sessionID])
    onStatus([
      "tracking": "starting", "mapping": "unavailable",
      "localized": false, "expanding": expanding,
      "mapId": mapID as Any? ?? NSNull(), "error": message
    ])
  }

  private func trackName(_ state: ARCamera.TrackingState) -> String {
    switch state {
    case .normal: return "ready"
    case .limited: return "limited"
    case .notAvailable: return "starting"
    }
  }

  private func mapName(_ state: ARFrame.WorldMappingStatus) -> String {
    switch state {
    case .mapped: return "mapped"
    case .extending: return "extending"
    case .limited: return "limited"
    case .notAvailable: return "unavailable"
    @unknown default: return "unavailable"
    }
  }

  public func session(_ session: ARSession, didUpdate frame: ARFrame) {
    if case .limited(.relocalizing) = frame.camera.trackingState {
      sawRelocalizing = true
    }
    guard lastStatus < 0 || frame.timestamp - lastStatus >= 0.35 else { return }
    lastStatus = frame.timestamp
    let normal: Bool
    if case .normal = frame.camera.trackingState { normal = true } else { normal = false }
    let didRelocalize = mapID != nil && sawRelocalizing && normal
    let state = trackName(frame.camera.trackingState)
    let mapping = mapName(frame.worldMappingStatus)
    DispatchQueue.main.async { [weak self] in
      guard let self, self.window != nil else { return }
      let signature = state + "/" + mapping + "/" + String(didRelocalize)
      if signature != self.lastTrackingSignature {
        self.lastTrackingSignature = signature
        MemorSpatialTrace.write("tracking.changed", fields: [
          "session": self.sessionID, "tracking": state, "mapping": mapping,
          "localized": didRelocalize, "anchors": frame.anchors.count
        ])
      }
      self.localized = didRelocalize
      self.onStatus([
        "tracking": state,
        "mapping": mapping,
        "localized": didRelocalize,
        "expanding": self.expanding,
        "mapId": self.mapID as Any? ?? NSNull()
      ])
    }
  }

  public func session(_ session: ARSession, didFailWithError error: Error) {
    DispatchQueue.main.async { [weak self] in self?.sendError(error.localizedDescription) }
  }

  private func readyForSave() -> Bool {
    guard let frame = scene.session.currentFrame else { return false }
    return MemorMapExpansionPolicy.canSave(mapping: frame.worldMappingStatus,
                                           tracking: frame.camera.trackingState,
                                           isRelocalized: true)
  }

  func saveMap(promise: Promise) {
    guard mapID == nil, !busy, readyForSave() else {
      promise.reject("ERR_NOT_MAPPED", "Explore o cenário até o ARKit indicar MAPA PRONTO.")
      return
    }
    busy = true
    MemorSpatialTrace.write("map.capture.started")
    let id = UUID().uuidString.lowercased()
    scene.session.getCurrentWorldMap { [weak self] map, error in
      guard let map else {
        DispatchQueue.main.async {
          self?.busy = false
          promise.reject("ERR_SNAPSHOT", error?.localizedDescription ?? "O ARKit não retornou um mapa.")
        }
        return
      }
      DispatchQueue.global(qos: .utility).async {
        do {
          let data = try NSKeyedArchiver.archivedData(withRootObject: map, requiringSecureCoding: true)
          let url = try Self.url(for: id)
          try FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                                   withIntermediateDirectories: true)
          try data.write(to: url, options: .atomic)
          MemorSpatialTrace.write("map.capture.saved", fields: ["id": id, "bytes": data.count, "anchors": map.anchors.count])
          DispatchQueue.main.async {
            self?.busy = false
            promise.resolve(Self.fileRecord(id: id, url: url, byteCount: data.count))
          }
        } catch {
          DispatchQueue.main.async {
            self?.busy = false
            promise.reject("ERR_SAVE_MAP", error.localizedDescription)
          }
        }
      }
    }
  }

  private func setExpansion(_ active: Bool) {
    guard let config = scene.session.configuration as? ARWorldTrackingConfiguration else { return }
    expanding = active
    config.planeDetection = active ? [.horizontal, .vertical] : []
    config.environmentTexturing = .none
    if active && ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
      config.sceneReconstruction = .mesh
    } else {
      config.sceneReconstruction = []
    }
    scene.debugOptions = active ? [.showFeaturePoints] : []
    // No resetTracking/removeExistingAnchors: retain the restored spatial frame.
    scene.session.run(config, options: [])
  }

  func beginExpansion(promise: Promise) {
    guard let id = mapID, !id.isEmpty,
          MemorMapExpansionPolicy.canBegin(isWorldMap: true,
                                           isRelocalized: localized,
                                           isBusy: busy || expanding) else {
      promise.reject("ERR_NOT_LOCALIZED", "Reconheça o lugar antes de ampliar o mapa.")
      return
    }
    setExpansion(true)
    MemorSpatialTrace.write("map.expansion.started")
    promise.resolve(nil)
  }

  func cancelExpansion(promise: Promise) {
    guard expanding, !busy else {
      promise.reject("ERR_NOT_EXPANDING", "Nenhuma ampliação disponível.")
      return
    }
    // The on-disk worldmap.archive remains unchanged.
    setExpansion(false)
    MemorSpatialTrace.write("map.expansion.canceled")
    promise.resolve(nil)
  }

  func saveExpansion(promise: Promise) {
    guard let id = mapID, expanding, localized, !busy, readyForSave() else {
      promise.reject("ERR_NOT_MAPPED", "Volte à região reconhecida até o mapa estabilizar.")
      return
    }
    busy = true
    scene.session.getCurrentWorldMap { [weak self] map, error in
      guard let self, let map else {
        DispatchQueue.main.async {
          self?.busy = false
          promise.reject("ERR_SNAPSHOT", error?.localizedDescription ?? "Não foi possível capturar a ampliação.")
        }
        return
      }
      DispatchQueue.main.async {
        guard self.localized, self.expanding, self.readyForSave() else {
          self.busy = false
          promise.reject("ERR_TRACKING_CHANGED", "O rastreamento ficou instável. Tente novamente.")
          return
        }
        DispatchQueue.global(qos: .utility).async {
          do {
            let url = try Self.url(for: id)
            let previous = try Self.readMap(url)
            let required = Set(previous.anchors.compactMap { anchor -> String? in
              guard let name = anchor.name, WorldMapAnchorPersistence.isInterventionAnchor(name) else { return nil }
              return name
            })
            map.anchors = try WorldMapAnchorPersistence.preserved(
              snapshot: map.anchors, previouslySaved: previous.anchors,
              requiredPreviousNames: required
            )
            let data = try NSKeyedArchiver.archivedData(withRootObject: map, requiringSecureCoding: true)
            _ = try MemorWorldMapArchiveHistory.replace(url, with: data)
            try? MemorWorldMapArchiveHistory.prune(url)
            DispatchQueue.main.async {
              self.busy = false
              self.setExpansion(false)
              MemorSpatialTrace.write("map.expansion.saved", fields: ["id": id, "bytes": data.count])
              promise.resolve(Self.fileRecord(id: id, url: url, byteCount: data.count))
            }
          } catch {
            DispatchQueue.main.async {
              self.busy = false
              promise.reject("ERR_EXPANSION", error.localizedDescription)
            }
          }
        }
      }
    }
  }

  func restoreMap(original: Bool, promise: Promise) {
    guard let id = mapID, !busy else {
      promise.reject("ERR_BUSY", "Aguarde a operação atual.")
      return
    }
    busy = true
    DispatchQueue.global(qos: .utility).async {
      do {
        let url = try Self.url(for: id)
        let previous = try Self.readMap(url)
        let targetURL: URL?
        if original {
          targetURL = MemorWorldMapArchiveHistory.originalVersion(of: url)
        } else {
          targetURL = try MemorWorldMapArchiveHistory.previousVersions(of: url).first
        }
        guard let targetURL else { throw MemorWorldMapHistoryError.unavailableHistory }
        let target = try Self.readMap(targetURL)
        let required = Set(previous.anchors.compactMap { anchor -> String? in
          guard let name = anchor.name, WorldMapAnchorPersistence.isInterventionAnchor(name) else { return nil }
          return name
        })
        target.anchors = try WorldMapAnchorPersistence.preserved(
          snapshot: target.anchors, previouslySaved: previous.anchors,
          requiredPreviousNames: required
        )
        let data = try NSKeyedArchiver.archivedData(withRootObject: target, requiringSecureCoding: true)
        _ = try MemorWorldMapArchiveHistory.replace(url, with: data)
        try? MemorWorldMapArchiveHistory.prune(url)
        DispatchQueue.main.async {
          self.busy = false
          self.openSession()  // Reset only when restoring a DIFFERENT map version.
          MemorSpatialTrace.write("map.revision.restored", fields: ["id": id, "original": original])
          promise.resolve(Self.fileRecord(id: id, url: url, byteCount: data.count))
        }
      } catch {
        DispatchQueue.main.async {
          self.busy = false
          promise.reject("ERR_RESTORE", error.localizedDescription)
        }
      }
    }
  }

  /// Release the camera while UIImagePickerController is capturing a photo.
  /// After returning, restart using initialWorldMap: the user must relocalize
  /// before placing the captured image at a physical point.
  func pauseForPhoto(promise: Promise) {
    guard mapID != nil, !busy, !expanding else {
      promise.reject("ERR_NOT_READY", "Feche as operações espaciais antes de fotografar.")
      return
    }
    scene.session.pause()
    localized = false
    MemorSpatialTrace.write("photo.camera.paused", fields: ["session": sessionID])
    onStatus(["tracking": "starting", "mapping": "unavailable", "localized": false,
              "expanding": false, "mapId": mapID as Any? ?? NSNull()])
    promise.resolve(nil)
  }

  func resumeAfterPhoto(promise: Promise) {
    guard mapID != nil else {
      promise.reject("ERR_NO_MAP", "Não existe mapa espacial para reabrir.")
      return
    }
    MemorSpatialTrace.write("photo.camera.resuming")
    openSession()
    promise.resolve(nil)
  }

  /// Convert the temporary iOS camera image to a private JPEG, then commit a
  /// named ARAnchor in the existing ARWorldMap. Never log image pixels or paths.
  func placePhoto(id: String, caption: String, sourceURI: String, promise: Promise) {
    guard let mapID, localized, !busy, !expanding, UUID(uuidString: id) != nil,
          let sourceURL = URL(string: sourceURI), sourceURL.isFileURL else {
      MemorSpatialTrace.write("photo.placement.rejected", fields: ["id": id])
      promise.reject("ERR_NOT_LOCALIZED", "Reconheça o lugar novamente antes de fixar a foto.")
      return
    }
    let point = CGPoint(x: scene.bounds.midX, y: scene.bounds.midY)
    guard let hit = scene.hitTest(
      point, types: [.existingPlaneUsingGeometry, .existingPlaneUsingExtent, .featurePoint]
    ).first else {
      MemorSpatialTrace.write("photo.placement.noSurface", fields: ["id": id])
      promise.reject("ERR_NO_SURFACE", "Aponte a mira para uma superfície reconhecida.")
      return
    }
    let name = "memor.photo." + id.lowercased()
    let anchor = ARAnchor(name: name, transform: hit.worldTransform)
    let destination = Self.photoURL(for: mapID, artworkID: id)
    busy = true
    MemorSpatialTrace.write("photo.placement.started", fields: ["id": id, "hitType": hit.type.rawValue])
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      do {
        let source = try Data(contentsOf: sourceURL)
        guard source.count <= 25_000_000, let image = UIImage(data: source),
              image.size.width > 0, image.size.height > 0 else {
          throw NSError(domain: "MemorWorldMap", code: 11,
                        userInfo: [NSLocalizedDescriptionKey: "A foto não pôde ser lida."])
        }
        let jpeg = image.jpegData(compressionQuality: 0.80)
        guard let jpeg, jpeg.count <= 5_000_000 else {
          throw NSError(domain: "MemorWorldMap", code: 12,
                        userInfo: [NSLocalizedDescriptionKey: "A foto está muito grande."])
        }
        try FileManager.default.createDirectory(
          at: destination.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        try jpeg.write(to: destination, options: .atomic)
        DispatchQueue.main.async {
          guard let self, self.window != nil, self.localized else {
            try? FileManager.default.removeItem(at: destination)
            self?.busy = false
            MemorSpatialTrace.write("photo.placement.relocalizationLost", fields: ["id": id])
            promise.reject("ERR_TRACKING_CHANGED", "Reconheça o lugar novamente antes de posicionar a foto.")
            return
          }
          self.titles[name] = caption.isEmpty ? "Fotografia" : caption
          self.photoURLs[name] = destination
          self.scene.session.add(anchor: anchor)
          MemorSpatialTrace.write("photo.anchor.added", fields: ["id": id, "bytes": jpeg.count])
          self.scene.session.getCurrentWorldMap { [weak self] map, error in
            guard let self, let map else {
              DispatchQueue.main.async {
                self?.scene.session.remove(anchor: anchor)
                self?.titles.removeValue(forKey: name)
                self?.photoURLs.removeValue(forKey: name)
                self?.busy = false
                try? FileManager.default.removeItem(at: destination)
                MemorSpatialTrace.write("photo.snapshot.failed", fields: ["id": id])
                promise.reject("ERR_SNAPSHOT", error?.localizedDescription ?? "Falha ao preparar o mapa.")
              }
              return
            }
            DispatchQueue.global(qos: .utility).async {
              do {
                let url = try Self.url(for: mapID)
                let previous = try Self.readMap(url)
                let required = Set(previous.anchors.compactMap { anchor -> String? in
                  guard let name = anchor.name,
                        WorldMapAnchorPersistence.isInterventionAnchor(name) else { return nil }
                  return name
                })
                map.anchors = WorldMapAnchorPersistence.merged(
                  snapshot: map.anchors, previouslySaved: previous.anchors,
                  requiredPreviousNames: required, adding: anchor
                )
                let archived = try NSKeyedArchiver.archivedData(
                  withRootObject: map, requiringSecureCoding: true
                )
                _ = try MemorWorldMapArchiveHistory.replace(url, with: archived)
                try? MemorWorldMapArchiveHistory.prune(url)
                let t = anchor.transform
                let matrix: [Float] = [
                  t.columns.0.x, t.columns.0.y, t.columns.0.z, t.columns.0.w,
                  t.columns.1.x, t.columns.1.y, t.columns.1.z, t.columns.1.w,
                  t.columns.2.x, t.columns.2.y, t.columns.2.z, t.columns.2.w,
                  t.columns.3.x, t.columns.3.y, t.columns.3.z, t.columns.3.w
                ]
                DispatchQueue.main.async {
                  self.busy = false
                  self.refreshArtworkNodes()
                  MemorSpatialTrace.write("photo.anchor.saved", fields: [
                    "id": id, "imageBytes": jpeg.count, "mapBytes": archived.count
                  ])
                  promise.resolve(["id": id, "transform": matrix, "photoUri": destination.absoluteString])
                }
              } catch {
                DispatchQueue.main.async {
                  self.scene.session.remove(anchor: anchor)
                  self.titles.removeValue(forKey: name)
                  self.photoURLs.removeValue(forKey: name)
                  self.busy = false
                  try? FileManager.default.removeItem(at: destination)
                  MemorSpatialTrace.write("photo.anchor.failed", fields: ["id": id])
                  promise.reject("ERR_SAVE_PHOTO", error.localizedDescription)
                }
              }
            }
          }
        }
      } catch {
        DispatchQueue.main.async {
          self?.busy = false
          MemorSpatialTrace.write("photo.jpeg.failed", fields: ["id": id])
          promise.reject("ERR_PHOTO_FILE", error.localizedDescription)
        }
      }
    }
  }

  // The richer text/photo editor remains React Native. This method is the
  // native anchor-commit boundary for subsequent editor integration.
  func placeText(id: String, title: String, promise: Promise) {
    guard let mapID, localized, !busy, !expanding,
          let _ = UUID(uuidString: id), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      promise.reject("ERR_NOT_LOCALIZED", "Reconheça o lugar antes de posicionar a intervenção.")
      return
    }
    MemorSpatialTrace.write("text.placement.started", fields: ["id": id])
    let point = CGPoint(x: scene.bounds.midX, y: scene.bounds.midY)
    guard let hit = scene.hitTest(
      point, types: [.existingPlaneUsingGeometry, .existingPlaneUsingExtent, .featurePoint]
    ).first else {
      MemorSpatialTrace.write("text.placement.noSurface", fields: ["id": id])
      promise.reject("ERR_NO_SURFACE", "Aponte a mira para uma superfície reconhecida.")
      return
    }
    let name = "memor.text." + id.lowercased()
    let anchor = ARAnchor(name: name, transform: hit.worldTransform)
    busy = true
    // Populate rendering metadata BEFORE ARKit calls the renderer delegate.
    titles[name] = title
    MemorSpatialTrace.write("text.anchor.adding", fields: ["id": id, "hitType": hit.type.rawValue])
    scene.session.add(anchor: anchor)
    scene.session.getCurrentWorldMap { [weak self] map, error in
      guard let self, let map else {
        DispatchQueue.main.async {
          self?.scene.session.remove(anchor: anchor)
          self?.titles.removeValue(forKey: name)
          self?.busy = false
          MemorSpatialTrace.write("text.snapshot.failed", fields: ["id": id])
          promise.reject("ERR_SNAPSHOT", error?.localizedDescription ?? "Falha ao salvar a posição da obra.")
        }
        return
      }
      DispatchQueue.global(qos: .utility).async {
        do {
          let url = try Self.url(for: mapID)
          let previous = try Self.readMap(url)
          let required = Set(previous.anchors.compactMap { anchor -> String? in
            guard let name = anchor.name, WorldMapAnchorPersistence.isInterventionAnchor(name) else { return nil }
            return name
          })
          map.anchors = WorldMapAnchorPersistence.merged(
            snapshot: map.anchors, previouslySaved: previous.anchors,
            requiredPreviousNames: required, adding: anchor
          )
          let data = try NSKeyedArchiver.archivedData(withRootObject: map, requiringSecureCoding: true)
          _ = try MemorWorldMapArchiveHistory.replace(url, with: data)
          try? MemorWorldMapArchiveHistory.prune(url)
          let transform = anchor.transform
          let matrix: [Float] = [
            transform.columns.0.x, transform.columns.0.y, transform.columns.0.z, transform.columns.0.w,
            transform.columns.1.x, transform.columns.1.y, transform.columns.1.z, transform.columns.1.w,
            transform.columns.2.x, transform.columns.2.y, transform.columns.2.z, transform.columns.2.w,
            transform.columns.3.x, transform.columns.3.y, transform.columns.3.z, transform.columns.3.w
          ]
          DispatchQueue.main.async {
            self.busy = false
            self.refreshArtworkNodes()
            MemorSpatialTrace.write("text.anchor.saved", fields: ["id": id, "mapBytes": data.count])
            promise.resolve(["id": id, "transform": matrix])
          }
        } catch {
          DispatchQueue.main.async {
            self.scene.session.remove(anchor: anchor)
            self.titles.removeValue(forKey: name)
            self.busy = false
            MemorSpatialTrace.write("text.anchor.failed", fields: ["id": id])
            promise.reject("ERR_PLACE_TEXT", error.localizedDescription)
          }
        }
      }
    }
  }

  public func renderer(_ renderer: SCNSceneRenderer, nodeFor anchor: ARAnchor) -> SCNNode? {
    // SceneKit may ask for this node before RN has hydrated artwork metadata.
    // Always return an empty container, then add content in didAdd/setMarkers.
    return SCNNode()
  }

  public func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
    guard let name = anchor.name, WorldMapAnchorPersistence.isInterventionAnchor(name) else { return }
    DispatchQueue.main.async { [weak self, weak node] in
      guard let self, let node else { return }
      MemorSpatialTrace.write("render.anchor.attached", fields: ["anchor": name])
      self.renderArtwork(name: name, on: node)
    }
  }
}
