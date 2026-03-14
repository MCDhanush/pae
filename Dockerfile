# Build stage
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy the entire project
COPY . .

# Build the backend binary
RUN cd backend && \
    go mod download && \
    go build -tags netgo -ldflags '-s -w' -o ../app ./cmd/api

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/app .

EXPOSE 8080

CMD ["./app"]
