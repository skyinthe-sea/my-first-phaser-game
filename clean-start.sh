#!/bin/bash
echo "🗑️  Cleaning Vite cache and dist folder..."
rm -rf node_modules/.vite
rm -rf .vite
rm -rf dist

echo "✅ Cache cleaned!"
echo "🚀 Starting development server..."
npm run dev
