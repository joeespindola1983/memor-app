Pod::Spec.new do |s|
  s.name           = 'MemorWorldMap'
  s.version        = '0.1.0'
  s.summary        = 'Offline ARKit world-map capture and relocalization for Memor'
  s.description    = 'Local-only ARKit ARWorldMap persistence. No ReactVision Spatial.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Memor'
  s.homepage       = 'https://github.com/joeespindola1983/memor-app'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/joeespindola1983/memor-app.git', :tag => s.version.to_s }
  s.static_framework = true
  s.source_files   = '**/*.swift'
  s.frameworks     = 'ARKit', 'SceneKit', 'UIKit'
  s.dependency 'ExpoModulesCore'
end
