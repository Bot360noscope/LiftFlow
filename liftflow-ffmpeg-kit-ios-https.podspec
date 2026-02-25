require "json"

Pod::Spec.new do |s|
  s.name         = "liftflow-ffmpeg-kit-ios-https"
  s.version      = "6.0.2"
  s.summary      = "FFmpeg Kit iOS Https - Local Build"
  s.description  = "Locally built FFmpeg Kit for iOS with https support."
  s.homepage     = "https://github.com/arthenica/ffmpeg-kit"
  s.license      = { :type => "LGPL-3.0" }
  s.authors      = "LiftFlow"

  s.platform          = :ios
  s.ios.deployment_target = "12.1"
  s.requires_arc      = true
  s.static_framework  = true

  s.source        = { :path => '.' }

  s.libraries = [
    "z",
    "bz2",
    "c++",
    "iconv"
  ]

  s.frameworks = [
    "AudioToolbox",
    "AVFoundation",
    "CoreMedia",
    "VideoToolbox"
  ]

  s.vendored_frameworks = [
    "ffmpeg-kit-ios-https/ffmpegkit.xcframework",
    "ffmpeg-kit-ios-https/libavcodec.xcframework",
    "ffmpeg-kit-ios-https/libavdevice.xcframework",
    "ffmpeg-kit-ios-https/libavfilter.xcframework",
    "ffmpeg-kit-ios-https/libavformat.xcframework",
    "ffmpeg-kit-ios-https/libavutil.xcframework",
    "ffmpeg-kit-ios-https/libswresample.xcframework",
    "ffmpeg-kit-ios-https/libswscale.xcframework",
  ]
end
