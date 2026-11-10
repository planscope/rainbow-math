#!/bin/bash
# Saves a new ElevenLabs API key for tools/eleven.mjs. The key is typed hidden and never shown.
read -r -s -p "Paste the ElevenLabs key (it won't show), then press Return: " K; echo
if [ -z "$K" ]; then echo "Nothing pasted, nothing saved."; exit 1; fi
mkdir -p ~/.config/elevenlabs && printf '%s' "$K" > ~/.config/elevenlabs/api_key && chmod 600 ~/.config/elevenlabs/api_key && echo "Saved. Tell Claude: key saved."
