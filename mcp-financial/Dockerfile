FROM golang:1.25-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/mcp-financial .

FROM alpine:3.22

RUN addgroup -S app && adduser -S -G app app
COPY --from=builder /out/mcp-financial /usr/local/bin/mcp-financial

USER app
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/mcp-financial"]
