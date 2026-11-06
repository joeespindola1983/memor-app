import ARKit
import Foundation

/// A restored world coordinate frame is a prerequisite, not proof that a
/// newly mapped outdoor region is stable enough to archive.
enum MemorMapExpansionPolicy {
    static func canBegin(isWorldMap: Bool, isRelocalized: Bool,
                         isBusy: Bool) -> Bool {
        isWorldMap && isRelocalized && !isBusy
    }

    static func canSave(mapping: ARFrame.WorldMappingStatus,
                        tracking: ARCamera.TrackingState,
                        isRelocalized: Bool) -> Bool {
        guard isRelocalized else { return false }
        guard case .normal = tracking else { return false }
        if case .mapped = mapping { return true }
        return false
    }

    static func explanation(mapping: ARFrame.WorldMappingStatus,
                            tracking: ARCamera.TrackingState) -> String {
        guard case .normal = tracking else {
            return "Rastreamento instável. Retorne a uma área reconhecida."
        }
        switch mapping {
        case .mapped:
            return "Mapa estável nesta região. Já pode salvar uma nova revisão."
        case .extending:
            return "Novas referências em coleta. Volte a uma área conhecida para estabilizar."
        case .limited:
            return "Poucas referências. Caminhe devagar, observe bordas e texturas."
        case .notAvailable:
            return "Aguardando referências espaciais do ARKit."
        @unknown default:
            return "Continue o reconhecimento do ambiente."
        }
    }
}
