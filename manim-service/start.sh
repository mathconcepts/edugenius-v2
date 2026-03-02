#!/bin/bash
# EduGenius Manim Render Service — start script
export MANIM_PYTHON=/usr/bin/python3
export MANIM_MEDIA_DIR=/tmp/manim_renders
export MANIM_CACHE_DIR=/tmp/manim_cache
export MANIM_PORT=7341
cd "$(dirname "$0")"
echo "Starting Manim service on port $MANIM_PORT..."
/usr/bin/python3 main.py
