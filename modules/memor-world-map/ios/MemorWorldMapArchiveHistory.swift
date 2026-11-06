import Foundation

/// Atomic map bytes + bounded local history. Scene geometry is NOT serialized
/// here; only ARKit's ARWorldMap archive is passed in by PlaceLibrary.
enum MemorWorldMapArchiveHistory {
    /// Preserve the very first map plus at most two recent snapshots.
    static let maxRevisions = 3
    static let originalFileName = "original.archive"

    static func originalVersion(of current: URL,
                                fileManager: FileManager = .default) -> URL? {
        let file = revisionsDirectory(for: current)
            .appendingPathComponent(originalFileName)
        return fileManager.fileExists(atPath: file.path) ? file : nil
    }

    static func previousVersions(of current: URL,
                                 fileManager: FileManager = .default) throws -> [URL] {
        let folder = revisionsDirectory(for: current)
        guard fileManager.fileExists(atPath: folder.path) else { return [] }
        return try fileManager.contentsOfDirectory(
            at: folder, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]
        )
        .filter { $0.pathExtension == "archive" &&
            (try? $0.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true }
        .sorted {
            if $0.lastPathComponent == originalFileName { return false }
            if $1.lastPathComponent == originalFileName { return true }
            return $0.lastPathComponent > $1.lastPathComponent
        }
    }

    @discardableResult
    static func replace(_ current: URL, with newData: Data,
                        fileManager: FileManager = .default) throws -> URL {
        guard !newData.isEmpty, fileManager.fileExists(atPath: current.path) else {
            throw MemorWorldMapHistoryError.missingCurrentMap
        }
        let oldData = try Data(contentsOf: current)
        guard !oldData.isEmpty else { throw MemorWorldMapHistoryError.missingCurrentMap }
        let folder = revisionsDirectory(for: current)
        try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)
        let baseline = folder.appendingPathComponent(originalFileName)
        let datePrefix = String(format: "%020.9f", Date().timeIntervalSince1970)
        let backup = fileManager.fileExists(atPath: baseline.path)
            ? folder.appendingPathComponent(
                "\(datePrefix)-\(UUID().uuidString).archive"
              )
            : baseline
        try oldData.write(to: backup, options: .atomic)
        do {
            try newData.write(to: current, options: .atomic)
        } catch {
            try? fileManager.removeItem(at: backup)
            throw error
        }
        return backup
    }

    /// Roll back a successful map write when its corresponding metadata write
    /// fails; map and metadata must describe the same locally visible revision.
    static func undoFailedCommit(_ current: URL, backup: URL,
                                 fileManager: FileManager = .default) throws {
        let oldData = try Data(contentsOf: backup)
        try oldData.write(to: current, options: .atomic)
        try fileManager.removeItem(at: backup)
    }

    static func prune(_ current: URL, fileManager: FileManager = .default) throws {
        let recent = try previousVersions(of: current, fileManager: fileManager)
            .filter { $0.lastPathComponent != originalFileName }
        for archive in recent.dropFirst(maxRevisions - 1) {
            try fileManager.removeItem(at: archive)
        }
    }

    static func revisionsDirectory(for current: URL) -> URL {
        current.deletingLastPathComponent().appendingPathComponent(
            "worldmap-history", isDirectory: true
        )
    }
}

enum MemorWorldMapHistoryError: LocalizedError {
    case missingCurrentMap, missingSavedAnchor, invalidMap, unavailableHistory

    var errorDescription: String? {
        switch self {
        case .missingCurrentMap: return "O mapa original não está disponível."
        case .missingSavedAnchor: return "A nova captura não preservou todas as intervenções."
        case .invalidMap: return "A revisão do mapa não é válida."
        case .unavailableHistory: return "Não existe revisão anterior para restaurar."
        }
    }
}
