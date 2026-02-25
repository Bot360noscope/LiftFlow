#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FFMPEG_KIT_DIR="$PROJECT_DIR/../ffmpeg-kit"
DEST_DIR="$PROJECT_DIR/ffmpeg-kit-ios-https"

echo "=== LiftFlow: FFmpeg Kit iOS Setup ==="
echo ""

if [ -d "$DEST_DIR" ] && [ "$(ls -A "$DEST_DIR"/*.xcframework 2>/dev/null)" ]; then
  echo "xcframeworks already exist in $DEST_DIR"
  echo "Skipping build. Delete $DEST_DIR to rebuild."
else
  echo "Step 1: Checking for ffmpeg-kit source..."
  if [ ! -d "$FFMPEG_KIT_DIR" ]; then
    echo "Cloning ffmpeg-kit repository (next to project)..."
    git clone https://github.com/arthenica/ffmpeg-kit.git "$FFMPEG_KIT_DIR"
  else
    echo "Found existing ffmpeg-kit at $FFMPEG_KIT_DIR"
  fi

  echo ""
  echo "Step 2: Checking build dependencies..."
  for dep in automake libtool pkg-config autoconf; do
    if ! command -v $dep &> /dev/null; then
      echo "Installing $dep via Homebrew..."
      brew install $dep
    fi
  done

  echo ""
  echo "Step 3: Building FFmpeg Kit for iOS (this takes 15-30 minutes)..."
  cd "$FFMPEG_KIT_DIR"
  ./ios.sh -x --disable-arm64e

  echo ""
  echo "Step 4: Copying xcframeworks to project..."
  mkdir -p "$DEST_DIR"
  cp -R "$FFMPEG_KIT_DIR/prebuilt/bundle-apple-xcframework-ios/"*.xcframework "$DEST_DIR/"
fi

echo ""
echo "Step 5: Patching ffmpeg-kit-react-native podspec..."
PODSPEC="$PROJECT_DIR/node_modules/ffmpeg-kit-react-native/ffmpeg-kit-react-native.podspec"
if [ -f "$PODSPEC" ]; then
  if grep -q "liftflow-ffmpeg-kit-ios-https" "$PODSPEC"; then
    echo "Podspec already patched."
  else
    sed -i '' 's/s\.dependency "ffmpeg-kit-ios-#{ffmpeg_kit_package}".*/s.dependency "liftflow-ffmpeg-kit-ios-https"/' "$PODSPEC"
    echo "Patched podspec to use local frameworks."
  fi
else
  echo "WARNING: Could not find podspec at $PODSPEC"
  echo "Make sure you ran 'npm install' first."
fi

echo ""
echo "Step 6: Running pod install..."
cd "$PROJECT_DIR"

if [ ! -d "ios" ]; then
  echo "Running expo prebuild first..."
  npx expo prebuild --clean
fi

PODFILE="$PROJECT_DIR/ios/Podfile"
if [ -f "$PODFILE" ]; then
  if ! grep -q "liftflow-ffmpeg-kit-ios-https" "$PODFILE"; then
    sed -i '' "/use_expo_modules\!/a\\
  pod 'liftflow-ffmpeg-kit-ios-https', :path => '..'
" "$PODFILE"
    echo "Added local pod to Podfile."
  else
    echo "Podfile already has local pod reference."
  fi
fi

cd ios
pod install
cd ..

echo ""
echo "=== Done! ==="
echo "Open ios/LiftFlow.xcworkspace in Xcode and build to your device."
echo ""
echo "  open ios/LiftFlow.xcworkspace"
echo ""
