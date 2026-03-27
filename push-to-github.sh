#!/bin/bash
# Push to GitHub using stored PAT
REMOTE_URL="https://Bot360noscope:${GITHUB_PAT}@github.com/Bot360noscope/LiftFlow.git"
git push --force "$REMOTE_URL" HEAD:main
