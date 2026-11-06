import SceneKit
import UIKit

/// Builds readable, camera-facing artwork surfaces at fixed world positions.
/// Geometry is constructed only after an ARAnchor is attached to the scene.
enum MemorArtworkSceneFactory {
  static func node(kind: String, title: String, photoURL: URL?) -> SCNNode? {
    let texture: UIImage
    let width: CGFloat
    let height: CGFloat
    if kind == "photo" {
      guard let photoURL, let photo = UIImage(contentsOfFile: photoURL.path) else {
        return nil
      }
      texture = photo
      width = 0.58
      let ratio = photo.size.width > 0 ? photo.size.height / photo.size.width : 0.75
      height = min(0.72, max(0.3, width * ratio))
    } else {
      width = 0.48
      height = 0.26
      texture = textCard(title)
    }
    let plane = SCNPlane(width: width, height: height)
    plane.cornerRadius = 0.01
    plane.firstMaterial?.diffuse.contents = texture
    plane.firstMaterial?.isDoubleSided = true
    plane.firstMaterial?.lightingModel = .constant
    let card = SCNNode(geometry: plane)
    card.constraints = [SCNBillboardConstraint()]
    // A small gap from the real surface reduces depth fighting.
    card.position = SCNVector3(0, 0.02, 0)
    card.name = "memor.rendered.artwork"
    let root = SCNNode()
    root.addChildNode(card)
    return root
  }

  private static func textCard(_ value: String) -> UIImage {
    let size = CGSize(width: 1024, height: 554)
    let renderer = UIGraphicsImageRenderer(size: size)
    return renderer.image { context in
      UIColor(red: 0.08, green: 0.08, blue: 0.09, alpha: 0.96).setFill()
      context.fill(CGRect(origin: .zero, size: size))
      UIColor(red: 0.79, green: 0.96, blue: 0.41, alpha: 1).setFill()
      context.fill(CGRect(x: 44, y: 44, width: 16, height: 16))
      let paragraph = NSMutableParagraphStyle()
      paragraph.lineBreakMode = .byWordWrapping
      let attributes: [NSAttributedString.Key: Any] = [
        .font: UIFont.systemFont(ofSize: 69, weight: .medium),
        .foregroundColor: UIColor.white,
        .paragraphStyle: paragraph
      ]
      (value as NSString).draw(in: CGRect(x: 58, y: 95, width: 905, height: 410),
                               withAttributes: attributes)
    }
  }
}
