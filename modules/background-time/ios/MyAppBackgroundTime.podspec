# 保存のあいだにアプリが裏に回っても、iOS が許す少しのあいだ動き続けるよう頼む、このアプリだけの小さな部品
# （src/platform/backgroundTime.ts から使う）
Pod::Spec.new do |s|
  s.name           = 'MyAppBackgroundTime'
  s.version        = '1.0.0'
  s.summary        = 'Asks iOS for background execution time while a save is in progress'
  s.description    = s.summary
  s.license        = 'MIT'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }
end
