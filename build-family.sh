#!/bin/bash
# Build the Pilon Family AI image and land it on the head GX10.
#   ./build-family.sh 0.11.3-family2
#
# How it works, and why:
#  1. The frontend is compiled NATIVELY on the laptop (48 GB RAM). Inside the
#     laptop's Docker VM (8 GB RAM, ~31 GB disk cap) vite runs out of memory.
#  2. Only the compiled ./build (~100 MB gzipped) is copied to the head; the
#     head pulls the fork's source from GitHub itself at home-network speed.
#  3. The head packages the image with Dockerfile.family (frontend stage = COPY
#     ./build), so no 6 GB image ever crosses the laptop's uplink.
set -e
VER="${1:?usage: ./build-family.sh <version-tag>}"
HEAD="ian@192.168.1.3"; JUMP="-J mini01@100.94.190.111"
SHA="$(git rev-parse --short HEAD)"; HASH="family-$SHA"
git push -q origin family
npm ci --force
APP_BUILD_HASH="$HASH" NODE_OPTIONS=--max-old-space-size=12288 npm run build
tar -czf /tmp/fe-build.tar.gz build
ssh $JUMP $HEAD "if [ -d ~/open-webui ]; then cd ~/open-webui && git fetch -q origin && git checkout -q family && git reset -q --hard $SHA; else git clone -q -b family https://github.com/ianpilon/open-webui.git ~/open-webui; fi"
scp $JUMP /tmp/fe-build.tar.gz $HEAD:~/open-webui/fe-build.tar.gz
rm /tmp/fe-build.tar.gz
ssh $JUMP $HEAD "cd ~/open-webui && rm -rf build && tar -xzf fe-build.tar.gz && rm fe-build.tar.gz && docker build --platform linux/arm64 -f Dockerfile.family --build-arg BUILD_HASH=$HASH -t pilon-family-ai:$VER . | tail -3"
echo
echo "built pilon-family-ai:$VER on the head. Deploy with:"
echo "  ssh $JUMP $HEAD 'IMAGE=pilon-family-ai:$VER ~/bin/open-webui-run.sh'"
echo "then bump the default IMAGE in ~/bin/open-webui-run.sh on the head."
