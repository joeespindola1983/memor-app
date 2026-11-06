import Foundation
import simd

/// A *virtual* horizontal surface aligned with one floor point confirmed by ARKit.
/// Its radius does not represent a physically measured or collision-safe area.
/// Coordinates are expressed in the saved ARWorldMap's world coordinate system.
struct MemorVirtualGround: Codable, Equatable {
    var x: Float
    var y: Float
    var z: Float
    var radiusMeters: Float

    static let defaultRadius: Float = 5
    static let maximumRadius: Float = 10
    static let minimumRadius: Float = 3

    init?(center: SIMD3<Float>, radiusMeters: Float = defaultRadius) {
        guard center.x.isFinite, center.y.isFinite, center.z.isFinite else { return nil }
        x = center.x
        y = center.y
        z = center.z
        self.radiusMeters = Self.clampedRadius(radiusMeters)
    }

    private enum CodingKeys: String, CodingKey {
        case x, y, z, radiusMeters
    }

    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        let center = SIMD3<Float>(
            try values.decode(Float.self, forKey: .x),
            try values.decode(Float.self, forKey: .y),
            try values.decode(Float.self, forKey: .z)
        )
        let radius = try values.decode(Float.self, forKey: .radiusMeters)
        guard let validated = Self(center: center, radiusMeters: radius) else {
            throw DecodingError.dataCorruptedError(
                forKey: .x, in: values, debugDescription: "Coordenadas inválidas do chão."
            )
        }
        self = validated
    }

    var center: SIMD3<Float> { SIMD3(x, y, z) }

    static func clampedRadius(_ radius: Float) -> Float {
        guard radius.isFinite else { return defaultRadius }
        return min(max(radius, minimumRadius), maximumRadius)
    }

    /// Intersects a camera ray with the remembered floor's height. Never infer
    /// a surface beyond this horizontal plane or outside the allowed radius.
    func intersection(rayOrigin: SIMD3<Float>,
                      rayDirection: SIMD3<Float>) -> SIMD3<Float>? {
        guard rayOrigin.x.isFinite, rayOrigin.y.isFinite, rayOrigin.z.isFinite,
              rayDirection.x.isFinite, rayDirection.y.isFinite,
              rayDirection.z.isFinite, abs(rayDirection.y) > 0.00001 else { return nil }
        let t = (y - rayOrigin.y) / rayDirection.y
        guard t.isFinite, t > 0.0001 else { return nil }
        let hit = rayOrigin + rayDirection * t
        let dx = hit.x - x
        let dz = hit.z - z
        guard hit.x.isFinite, hit.z.isFinite,
              dx * dx + dz * dz <= radiusMeters * radiusMeters else { return nil }
        return SIMD3<Float>(hit.x, y, hit.z)
    }

    func contains(_ point: SIMD3<Float>, heightTolerance: Float = 0.12) -> Bool {
        guard point.x.isFinite, point.y.isFinite, point.z.isFinite else { return false }
        let dx = point.x - x
        let dz = point.z - z
        return abs(point.y - y) <= heightTolerance &&
               dx * dx + dz * dz <= radiusMeters * radiusMeters
    }

    /// The ARAnchor is at ground level, upright, with its +Z toward the
    /// visitor when the artist places the work. No camera-facing constraint.
    static func standTransform(at point: SIMD3<Float>,
                               facing camera: SIMD3<Float>) -> simd_float4x4? {
        guard point.x.isFinite, point.y.isFinite, point.z.isFinite,
              camera.x.isFinite, camera.z.isFinite else { return nil }
        let dx = camera.x - point.x
        let dz = camera.z - point.z
        let length = simd_length(SIMD2<Float>(dx, dz))
        guard length > 0.05, length.isFinite else { return nil }
        let sine = dx / length
        let cosine = dz / length
        var pose = matrix_identity_float4x4
        pose.columns.0 = SIMD4<Float>(cosine, 0, -sine, 0)
        pose.columns.1 = SIMD4<Float>(0, 1, 0, 0)
        pose.columns.2 = SIMD4<Float>(sine, 0, cosine, 0)
        pose.columns.3 = SIMD4<Float>(point.x, point.y, point.z, 1)
        return pose
    }

    static func rotateStand(_ pose: simd_float4x4, degrees: Float) -> simd_float4x4 {
        guard degrees.isFinite else { return pose }
        let radians = min(max(degrees, -180), 180) * .pi / 180
        var rotation = matrix_identity_float4x4
        rotation.columns.0 = SIMD4<Float>(cos(radians), 0, -sin(radians), 0)
        rotation.columns.2 = SIMD4<Float>(sin(radians), 0, cos(radians), 0)
        return simd_mul(pose, rotation)
    }
}

enum MemorSpatialPlacementMode: String, CaseIterable, Hashable {
    case surface
    case groundStand

    var label: String {
        switch self {
        case .surface: return "Superfície"
        case .groundStand: return "Estande no chão"
        }
    }
}

enum MemorPhotoPresentation: String, Codable, CaseIterable {
    case surface
    case groundStand
}
