#!/bin/bash
# Build the Pilon Family AI image (laptop, arm64) and ship it to the head GX10.
#   ./build-family.sh 0.11.3-family2
set -e
VER="${1:?usage: ./build-family.sh <version-tag>}"
HASH="family-$(git rev-parse --short HEAD)"
npm ci --force
APP_BUILD_HASH="$HASH" NODE_OPTIONS=--max-old-space-size=12288 npm run build
docker build --platform linux/arm64 -f Dockerfile.family --build-arg BUILD_HASH="$HASH" -t "pilon-family-ai:$VER" .
echo "shipping pilon-family-ai:$VER to the head GX10 ..."
docker save "pilon-family-ai:$VER" | gzip | ssh -J mini01@100.94.190.111 ian@192.168.1.3 'gunzip | docker load'
echo "done. On the head:  IMAGE=pilon-family-ai:$VER ~/bin/open-webui-run.sh   (then bump the default in that script)"
