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
  }

  override public func layoutSubviews() {
    super.layoutSubviews()
    scene.frame = bounds
  }

  override public func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      scene.session.pause()
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
    if window != nil { openSession() }
  }

  func setMarkers(json: String) {
    guard let data = json.data(using: .utf8),
          let items = (try? JSONSerialization.jsonObject(with: data)) as? [[String: String]] else {
      titles = [:]
      return
    }
    titles = Dictionary(items.compactMap { item -> (String, String)? in
      guard let id = item["id"], let title = item["title"],
            !id.isEmpty, !title.isEmpty else { return nil }
      return ("memor.text." + id, title)
    }, uniquingKeysWith: { _, last in last })
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
    if let id = mapID {
      do {
        configuration.initialWorldMap = try Self.readMap(Self.url(for: id))
        // Scanning a restored map is opt-in; default is lightweight viewing.
        configuration.planeDetection = []
      } catch {
        sendError("Não foi possível abrir o mapa salvo: \(error.localizedDescription)")
        return
      }
    }
    scene.debugOptions = []
    scene.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
  }

  private func sendError(_ message: String) {
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
    promise.resolve(nil)
  }

  func cancelExpansion(promise: Promise) {
    guard expanding, !busy else {
      promise.reject("ERR_NOT_EXPANDING", "Nenhuma ampliação disponível.")
      return
    }
    // The on-disk worldmap.archive remains unchanged.
    setExpansion(false)
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

  // The richer text/photo editor remains React Native. This method is the
  // native anchor-commit boundary for subsequent editor integration.
  func placeText(id: String, title: String, promise: Promise) {
    guard let mapID, localized, !busy, !expanding,
          let _ = UUID(uuidString: id), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      promise.reject("ERR_NOT_LOCALIZED", "Reconheça o lugar antes de posicionar a intervenção.")
      return
    }
    let point = CGPoint(x: scene.bounds.midX, y: scene.bounds.midY)
    guard let hit = scene.hitTest(point, types: [.existingPlaneUsingExtent, .existingPlane]).first else {
      promise.reject("ERR_NO_SURFACE", "Aponte a mira para uma superfície reconhecida.")
      return
    }
    let anchor = ARAnchor(name: "memor.text." + id.lowercased(), transform: hit.worldTransform)
    busy = true
    scene.session.add(anchor: anchor)
    scene.session.getCurrentWorldMap { [weak self] map, error in
      guard let self, let map else {
        DispatchQueue.main.async {
          self?.scene.session.remove(anchor: anchor)
          self?.busy = false
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
            self.titles[anchor.name ?? ""] = title
            promise.resolve(["id": id, "transform": matrix])
          }
        } catch {
          DispatchQueue.main.async {
            self.scene.session.remove(anchor: anchor)
            self.busy = false
            promise.reject("ERR_PLACE_TEXT", error.localizedDescription)
          }
        }
      }
    }
  }

  public func renderer(_ renderer: SCNSceneRenderer, nodeFor anchor: ARAnchor) -> SCNNode? {
    guard let name = anchor.name, name.hasPrefix("memor.text."),
          let title = titles[name] else { return SCNNode() }
    let text = SCNText(string: title, extrusionDepth: 0.002)
    text.font = UIFont.systemFont(ofSize: 0.14)
    text.flatness = 0.01
    text.firstMaterial?.diffuse.contents = UIColor.white
    let node = SCNNode(geometry: text)
    node.scale = SCNVector3(0.5, 0.5, 0.5)
    return node
  }
}
