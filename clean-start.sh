#!/bin/bash

# ===========================================
# Clean Start Script for Mac
# 모든 서버 종료 + 캐시 완전 삭제 + 5173 포트로 시작
# ===========================================

echo "🧹 Clean Start Script 시작..."
echo ""

# 현재 스크립트 PID 저장 (자기 자신은 죽이지 않기 위해)
SCRIPT_PID=$$

# 1. 5173-5177 포트 사용 중인 프로세스 종료
echo "📌 Step 1: 개발 서버 프로세스 종료..."
for port in 5173 5174 5175 5176 5177; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "   포트 $port 사용 중인 프로세스($pid) 종료..."
    kill -9 $pid 2>/dev/null
  fi
done

# vite 프로세스만 종료 (node 전체 죽이면 스크립트도 죽음)
pkill -f "vite" 2>/dev/null
pkill -f "esbuild" 2>/dev/null

sleep 1
echo "   ✅ 프로세스 종료 완료"
echo ""

# 2. 캐시 완전 삭제
echo "📌 Step 2: 캐시 완전 삭제..."

# Vite 캐시 삭제
if [ -d "node_modules/.vite" ]; then
  echo "   node_modules/.vite 삭제 중..."
  rm -rf node_modules/.vite
fi

# dist 폴더 삭제
if [ -d "dist" ]; then
  echo "   dist 삭제 중..."
  rm -rf dist
fi

# .cache 삭제
if [ -d ".cache" ]; then
  echo "   .cache 삭제 중..."
  rm -rf .cache
fi

# node_modules 삭제
if [ -d "node_modules" ]; then
  echo "   node_modules 삭제 중..."
  rm -rf node_modules
fi

# npm 캐시 정리
echo "   npm 캐시 정리 중..."
npm cache clean --force 2>/dev/null

echo "   ✅ 캐시 삭제 완료"
echo ""

# 3. 의존성 재설치
echo "📌 Step 3: 의존성 재설치..."
npm install
echo "   ✅ 의존성 설치 완료"
echo ""

# 4. 5173 포트로 서버 시작
echo "📌 Step 4: 개발 서버 시작 (포트 5173)..."
echo ""
echo "============================================"
echo "🚀 http://localhost:5173 에서 실행됩니다"
echo "   종료하려면 Ctrl+C"
echo "============================================"
echo ""

# 강제로 5173 포트 사용
npm run dev -- --port 5173 --strictPort
