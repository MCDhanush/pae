#!/bin/bash
set -e

echo "Building PAE backend..."
cd backend
go build -tags netgo -ldflags '-s -w' -o ../app cmd/api/main.go
echo "Build complete!"
