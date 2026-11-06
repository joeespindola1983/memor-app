import Foundation

/// Rolling on-device history for QA. Never records artwork text, images,
/// GPS coordinates, auth credentials, or full file URLs.
enum MemorSpatialTrace {
  private static let queue = DispatchQueue(label: "art.memor.spatial.trace", qos: .utility)
  private static let maxBytes = 250_000
  private static let retainedBytes = 180_000

  static func write(_ event: String, fields: [String: Any] = [:]) {
    let safe = fields.filter { key, value in
      !["text", "title", "caption", "photoUri", "url", "latitude", "longitude", "key", "token"].contains(key)
      && JSONSerialization.isValidJSONObject([key: value])
    }
    queue.async {
      var entry: [String: Any] = safe
      entry["event"] = event
      entry["at"] = ISO8601DateFormatter().string(from: Date())
      entry["schema"] = 1
      guard let data = try? JSONSerialization.data(withJSONObject: entry, options: [.sortedKeys]),
            let line = String(data: data, encoding: .utf8) else { return }
      let message = "[Memor][Spatial] " + line
      NSLog("%@", message)
      do {
        let file = self.url()
        try FileManager.default.createDirectory(
          at: file.deletingLastPathComponent(), withIntermediateDirectories: true
        )
        let old = (try? Data(contentsOf: file)) ?? Data()
        var appended = old
        appended.append(Data((line + "\n").utf8))
        if appended.count > maxBytes {
          let tail = appended.suffix(retainedBytes)
          // Drop a partial first record after trimming.
          if let firstNewline = tail.firstIndex(of: 10) {
            appended = Data(tail[(firstNewline + 1)...])
          } else {
            appended = Data(tail)
          }
        }
        try appended.write(to: file, options: .atomic)
      } catch {
        NSLog("[Memor][Spatial] trace.write.failed")
      }
    }
  }

  static func export() -> String {
    queue.sync {
      let file = url()
      return ((try? String(contentsOf: file, encoding: .utf8)) ?? "")
    }
  }

  private static func url() -> URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("MemorLogs", isDirectory: true)
      .appendingPathComponent("spatial.jsonl")
  }
}
