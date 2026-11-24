# Build and install the Expo development build on the connected Android device.
# Keeping the environment setup here avoids repeating it in every new shell.
$ErrorActionPreference = 'Stop'

Push-Location (Join-Path $PSScriptRoot '..')
try {
  $env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.21.102-hotspot'
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
  $env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
  $env:JAVA_TOOL_OPTIONS = '-Xmx4096m -XX:MaxMetaspaceSize=1024m'
  $env:GRADLE_OPTS = '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'

  & npx.cmd expo run:android @args
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
