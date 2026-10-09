# Reproducible Android SDK used by the SendFlow Capacitor build.
# The project owner explicitly authorized persistent acceptance of the Android SDK license.
{ pkgs ? import <nixpkgs> { config.android_sdk.accept_license = true; } }:
let
  androidComposition = pkgs.androidenv.composeAndroidPackages {
    # Pin the app's target platform and both Build Tools versions required by this Android setup.
    platformVersions = [ 36 ];
    buildToolsVersions = [ "35.0.0" "36.0.0" ];

    # This project packages a web app and does not need emulator images, an NDK, or CMake.
    includeSources = false;
    includeEmulator = false;
    includeSystemImages = false;
    includeNDK = false;
    includeCmake = false;
  };
in
androidComposition.androidsdk
