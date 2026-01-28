#!/bin/bash
set -euo pipefail

echo "🔨 Construyendo frontend..."
cd frontend
npm install
npm run build

echo "📦 Copiando frontend al backend..."
rm -rf ../backend/static
cp -r dist ../backend/static

echo "✅ Build completado!"
echo "📁 Frontend copiado a backend/static/"
