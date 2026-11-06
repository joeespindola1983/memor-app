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
    }

    AsyncFunction("saveMap") { (promise: Promise) in
      DispatchQueue.main.async {
        guard let view = MemorWorldMapView.active else {
          promise.reject("ERR_NO_CAMERA", "A câmera ARKit não está aberta.")
          return
        }
        view.saveMap(promise: promise)
      }
    }

    AsyncFunction("placeText") { (id: String, title: String, promise: Promise) in
      DispatchQueue.main.async {
        guard let view = MemorWorldMapView.active else {
          promise.reject("ERR_NO_CAMERA", "A câmera ARKit não está aberta.")
          return
        }
        view.placeText(id: id, title: title, promise: promise)
      }
    }

    AsyncFunction("removeMap") { (id: String, promise: Promise) in
      DispatchQueue.global(qos: .utility).async {
        do {
          let url = try MemorWorldMapView.url(for: id)
          if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
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
          let source = URL(string: fileUri)
          guard let source, source.isFileURL else {
            throw NSError(domain: "MemorWorldMap", code: 4,
              userInfo: [NSLocalizedDescriptionKey: "Arquivo local inválido."])
          }
          let data = try Data(contentsOf: source, options: .mappedIfSafe)
          guard let _ = try NSKeyedUnarchiver.unarchivedObject(ofClass: ARWorldMap.self, from: data) else {
            throw NSError(domain: "MemorWorldMap", code: 5,
              userInfo: [NSLocalizedDescriptionKey: "O arquivo não contém um ARWorldMap válido."])
          }
          let target = try MemorWorldMapView.url(for: id)
          if FileManager.default.fileExists(atPath: target.path) {
            throw NSError(domain: "MemorWorldMap", code: 6,
              userInfo: [NSLocalizedDescriptionKey: "Já existe um mapa local com este identificador."])
          }
          try data.write(to: target, options: .atomic)
          promise.resolve(MemorWorldMapView.fileRecord(id: id, url: target, byteCount: data.count))
        } catch {
          promise.reject("ERR_IMPORT_MAP", error.localizedDescription)
        }
      }
    }
  }
}
