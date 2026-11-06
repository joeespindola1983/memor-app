import ARKit
import ExpoModulesCore

public final class MemorWorldMapModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MemorWorldMap")

    View(MemorWorldMapView.self) {
      Events("onStatus")
      Prop("mapId") { (view: MemorWorldMapView, value: String?) in
        view.configure(mapId: value)
      }
      Prop("markersJSON") { (view: MemorWorldMapView, value: String?) in
        view.setMarkers(json: value ?? "[]")
      }
      AsyncFunction("saveMap") { (view: MemorWorldMapView, promise: Promise) in
        view.saveMap(promise: promise)
      }
      AsyncFunction("beginExpansion") { (view: MemorWorldMapView, promise: Promise) in
        view.beginExpansion(promise: promise)
      }
      AsyncFunction("cancelExpansion") { (view: MemorWorldMapView, promise: Promise) in
        view.cancelExpansion(promise: promise)
      }
      AsyncFunction("saveExpansion") { (view: MemorWorldMapView, promise: Promise) in
        view.saveExpansion(promise: promise)
      }
      AsyncFunction("restoreMap") { (view: MemorWorldMapView, original: Bool, promise: Promise) in
        view.restoreMap(original: original, promise: promise)
      }
      AsyncFunction("placeText") { (view: MemorWorldMapView, id: String, title: String, promise: Promise) in
        view.placeText(id: id, title: title, promise: promise)
      }
      AsyncFunction("pauseForPhoto") { (view: MemorWorldMapView, promise: Promise) in
        view.pauseForPhoto(promise: promise)
      }
      AsyncFunction("resumeAfterPhoto") { (view: MemorWorldMapView, promise: Promise) in
        view.resumeAfterPhoto(promise: promise)
      }
      AsyncFunction("placePhoto") { (view: MemorWorldMapView, id: String, caption: String, sourceURI: String, promise: Promise) in
        view.placePhoto(id: id, caption: caption, sourceURI: sourceURI, promise: promise)
      }
    }

    AsyncFunction("exportDiagnostics") { () -> String in
      MemorSpatialTrace.export()
    }

    AsyncFunction("logEvent") { (event: String, recordID: String?) in
      // Only event names and opaque UUIDs are allowed across this boundary.
      guard event.range(of: #"^[a-zA-Z0-9._-]{1,72}$"#, options: .regularExpression) != nil else { return }
      MemorSpatialTrace.write(event, fields: ["id": recordID ?? ""])
    }

    AsyncFunction("removeMap") { (id: String, promise: Promise) in
      DispatchQueue.global(qos: .utility).async {
        do {
          let url = try MemorWorldMapView.url(for: id)
          // Delete archive and history only after the caller has removed the
          // corresponding place metadata, not during ordinary editing.
          let folder = url.deletingLastPathComponent()
          if FileManager.default.fileExists(atPath: folder.path) {
            try FileManager.default.removeItem(at: folder)
          }
          promise.resolve(nil)
        } catch {
          promise.reject("ERR_REMOVE_MAP", error.localizedDescription)
        }
      }
    }

    AsyncFunction("importMap") { (id: String, fileUri: String, promise: Promise) in
      DispatchQueue.global(qos: .utility).async {
        do {
          guard let source = URL(string: fileUri), source.isFileURL else {
            throw MemorWorldMapHistoryError.invalidMap
          }
          let data = try Data(contentsOf: source, options: .mappedIfSafe)
          guard let _ = try NSKeyedUnarchiver.unarchivedObject(ofClass: ARWorldMap.self, from: data) else {
            throw MemorWorldMapHistoryError.invalidMap
          }
          let target = try MemorWorldMapView.url(for: id)
          guard !FileManager.default.fileExists(atPath: target.path) else {
            throw NSError(domain: "MemorWorldMap", code: 9,
                          userInfo: [NSLocalizedDescriptionKey: "Um mapa com esse ID já existe."])
          }
          try FileManager.default.createDirectory(at: target.deletingLastPathComponent(),
                                                   withIntermediateDirectories: true)
          try data.write(to: target, options: .atomic)
          promise.resolve(MemorWorldMapView.fileRecord(id: id, url: target, byteCount: data.count))
        } catch {
          promise.reject("ERR_IMPORT_MAP", error.localizedDescription)
        }
      }
    }
  }
}
