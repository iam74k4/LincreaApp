# ヘルスケア（HealthKit）から歩数を読む、このアプリだけの小さな部品（src/platform/health.ts から使う）
Pod::Spec.new do |s|
  s.name           = 'MyAppHealth'
  s.version        = '1.0.0'
  s.summary        = 'Reads daily step counts from HealthKit'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
end
