#!/bin/bash
# Build the Pilon Family AI image (laptop, arm64) and ship it to the head GX10.
#   ./build-family.sh 0.11.3-family2
set -e
VER="${1:?usage: ./build-family.sh <version-tag>}"
HASH="family-$(git rev-parse --short HEAD)"
npm ci --force
APP_BUILD_HASH="$HASH" NODE_OPTIONS=--max-old-space-size=12288 npm run build
docker build --platform linux/arm64 -f Dockerfile.family --build-arg BUILD_HASH="$HASH" -t "pilon-family-ai:$VER" .
# The laptop's Docker VM disk is capped at ~31 GB and the image is ~6.5 GB, so export
# to host disk, drop the image from the VM, then copy. Never let the VM sit at 100%:
# the live RTL containers on this laptop would start failing writes.
echo "exporting pilon-family-ai:$VER ..."
docker save "pilon-family-ai:$VER" | gzip -1 > "/tmp/pilon-family-ai-$VER.tar.gz"
docker rmi "pilon-family-ai:$VER" >/dev/null
docker builder prune -af >/dev/null
echo "shipping to the head GX10 ..."
scp -J mini01@100.94.190.111 "/tmp/pilon-family-ai-$VER.tar.gz" ian@192.168.1.3:~/
ssh -J mini01@100.94.190.111 ian@192.168.1.3 "gunzip -c ~/pilon-family-ai-$VER.tar.gz | docker load && rm ~/pilon-family-ai-$VER.tar.gz"
rm "/tmp/pilon-family-ai-$VER.tar.gz"
echo "done. On the head:  IMAGE=pilon-family-ai:$VER ~/bin/open-webui-run.sh   (then bump the default in that script)"
