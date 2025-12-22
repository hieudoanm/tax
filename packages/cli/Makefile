.PHONY: lint format build install all

BIN_DIR := bin
BIN_NAME := tax
SRC := ./main.go

## Commands
lint:
	go vet ./...

format:
	go fmt ./...

## Build binary into ./bin
build: format lint
	@mkdir -p $(BIN_DIR)
	go env GOOS GOARCH
	go clean -cache -modcache
	go build -trimpath -ldflags="-s -w" -o $(BIN_DIR)/$(BIN_NAME) $(SRC)

## Install binary into ~/bin
install: build
	@mkdir -p $(HOME)/bin
	cp $(BIN_DIR)/$(BIN_NAME) $(HOME)/bin/
	chmod +x $(HOME)/bin/$(BIN_NAME)
	@echo "Installed to $$HOME/bin"
	@echo "Make sure $$HOME/bin is in your PATH:"
	@echo '  export PATH="$$HOME/bin:$$PATH"'
