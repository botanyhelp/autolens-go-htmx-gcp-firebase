# Multi-stage production build for AutoLens Go + HTMX
# Resulting container image is ~18MB with zero external runtime dependencies

FROM golang:1.23-alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod ./
RUN go mod download || true

# Copy source code and embed files
COPY . .

# Build static Linux binary without CGO
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o autolens main.go

# Minimal runtime image
FROM scratch

# Root SSL certificates for outbound GCP API authentication
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /app/autolens /autolens

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/autolens"]
