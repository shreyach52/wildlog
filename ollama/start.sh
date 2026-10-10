#!/bin/sh
ollama serve &
sleep 8
ollama pull gemma3:4b
wait