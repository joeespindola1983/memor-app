import ARKit

/// The ARWorldMap returned by getCurrentWorldMap is a snapshot. New session
/// anchors may not be present yet when that callback executes. Compose the
/// persistent static anchors explicitly rather than depending on frame timing.
enum WorldMapAnchorPersistence {
    static func merged(
        snapshot: [ARAnchor],
        previouslySaved: [ARAnchor],
        requiredPreviousNames: Set<String>,
        adding newAnchor: ARAnchor
    ) -> [ARAnchor] {
        var result = [ARAnchor]()
        var names = Set<String>()
        let pendingName = newAnchor.name

        for anchor in snapshot {
            if let name = anchor.name, Self.isInterventionAnchor(name) {
                // Exclude orphan anchors from failed attempts or deleted notes.
                guard name == pendingName || requiredPreviousNames.contains(name),
                      names.insert(name).inserted else { continue }
            }
            result.append(anchor)
        }

        for anchor in previouslySaved {
            guard let name = anchor.name,
                  requiredPreviousNames.contains(name),
                  names.insert(name).inserted else { continue }
            result.append(anchor)
        }

        // The session can legitimately return a snapshot before the newly
        // added anchor is incorporated. Always persist it exactly once.
        if let pendingName {
            if !names.contains(pendingName) { result.append(newAnchor) }
        } else {
            result.append(newAnchor)
        }

        return result
    }

    /// A map revision is not a new artwork. Keep only still-authorized
    /// intervention anchors and restore any required anchors that ARKit's
    /// latest snapshot omitted while walking into the extended area.
    /// Fail closed if a required artwork was not in either map.
    static func preserved(
        snapshot: [ARAnchor],
        previouslySaved: [ARAnchor],
        requiredPreviousNames: Set<String>
    ) throws -> [ARAnchor] {
        let originals = Dictionary(
            previouslySaved.compactMap { anchor -> (String, ARAnchor)? in
                guard let name = anchor.name,
                      requiredPreviousNames.contains(name) else { return nil }
                return (name, anchor)
            },
            uniquingKeysWith: { first, _ in first }
        )
        var result: [ARAnchor] = []
        var names = Set<String>()
        for anchor in snapshot {
            if let name = anchor.name, isInterventionAnchor(name) {
                guard requiredPreviousNames.contains(name),
                      names.insert(name).inserted else { continue }
                // Preserve the previously saved spatial anchor ID and pose.
                // Expanding the feature map must not move existing artworks.
                result.append(originals[name] ?? anchor)
            } else {
                result.append(anchor)
            }
        }
        for anchor in previouslySaved {
            guard let name = anchor.name,
                  requiredPreviousNames.contains(name),
                  names.insert(name).inserted else { continue }
            result.append(anchor)
        }
        guard requiredPreviousNames.isSubset(of: names) else {
            throw MemorWorldMapHistoryError.missingSavedAnchor
        }
        return result
    }

    static func isInterventionAnchor(_ name: String) -> Bool {
        name.hasPrefix("memor.text.") || name.hasPrefix("memor.photo.")
    }
}
