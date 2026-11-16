package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	serverName    = "mcp-financial"
	serverVersion = "0.1.0"
	mockNotice    = "DADO FICTÍCIO PARA TESTES. Não representa conta ou cotação real."
)

type balanceInput struct {
	AccountAlias string `json:"account_alias,omitempty" jsonschema:"optional demo account alias"`
}

type balanceOutput struct {
	AccountAlias string  `json:"account_alias"`
	Balance      float64 `json:"balance"`
	Currency     string  `json:"currency"`
	Mock         bool    `json:"mock"`
	Notice       string  `json:"notice"`
}

type transactionInput struct {
	AccountAlias string `json:"account_alias,omitempty" jsonschema:"optional demo account alias"`
	Limit        int    `json:"limit,omitempty" jsonschema:"maximum number of demo transactions to return, between 1 and 3"`
}

type mockTransaction struct {
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Currency    string  `json:"currency"`
	Type        string  `json:"type"`
}

type transactionOutput struct {
	AccountAlias string            `json:"account_alias"`
	Transactions []mockTransaction `json:"transactions"`
	Mock         bool              `json:"mock"`
	Notice       string            `json:"notice"`
}

type marketQuoteInput struct {
	Symbol string `json:"symbol" jsonschema:"investment symbol or product name for the mock quote"`
}

type marketQuoteOutput struct {
	Symbol   string  `json:"symbol"`
	Value    float64 `json:"value"`
	Currency string  `json:"currency"`
	AsOf     string  `json:"as_of"`
	Mock     bool    `json:"mock"`
	Notice   string  `json:"notice"`
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	server := newMCPServer()
	mcpHandler := mcp.NewStreamableHTTPHandler(
		func(*http.Request) *mcp.Server { return server },
		&mcp.StreamableHTTPOptions{
			Stateless:           true,
			JSONResponse:        true,
			MaxRequestBodyBytes: 1 << 20,
			Logger:              logger,
		},
	)

	mux := http.NewServeMux()
	mux.Handle("/mcp", mcpHandler)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","data":"mock-only"}`))
	})

	addr := os.Getenv("MCP_ADDR")
	if addr == "" {
		addr = ":8081"
	}

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			logger.Error("graceful shutdown failed", "error", err)
		}
	}()

	logger.Info("starting mock MCP server", "address", addr, "endpoint", "/mcp")
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		logger.Error("MCP server stopped", "error", err)
		os.Exit(1)
	}
}

func newMCPServer() *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    serverName,
		Version: serverVersion,
	}, nil)
	readOnlyLocal := &mcp.ToolAnnotations{
		ReadOnlyHint: true,
		OpenWorldHint: func() *bool {
			value := false
			return &value
		}(),
	}

	mcp.AddTool(server, &mcp.Tool{
		Name:        "mock_get_account_balance",
		Title:       "Mock: consultar saldo de demonstração",
		Description: "Returns a fixed fictional balance for local testing only. It is not connected to a bank and must never be presented as a real account balance.",
		Annotations: readOnlyLocal,
	}, getMockBalance)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "mock_list_transactions",
		Title:       "Mock: listar transações de demonstração",
		Description: "Returns fixed fictional transactions for local testing only. It is not connected to a bank and must never be presented as real account activity.",
		Annotations: readOnlyLocal,
	}, listMockTransactions)

	mcp.AddTool(server, &mcp.Tool{
		Name:        "mock_get_market_quote",
		Title:       "Mock: consultar cotação de demonstração",
		Description: "Returns a fixed fictional market value for local testing only. It is not a live price or investment offer.",
		Annotations: readOnlyLocal,
	}, getMockMarketQuote)

	return server
}

func getMockBalance(_ context.Context, _ *mcp.CallToolRequest, input balanceInput) (*mcp.CallToolResult, balanceOutput, error) {
	accountAlias := strings.TrimSpace(input.AccountAlias)
	if accountAlias == "" {
		accountAlias = "conta-demo"
	}
	return nil, balanceOutput{
		AccountAlias: accountAlias,
		Balance:      5274.83,
		Currency:     "BRL",
		Mock:         true,
		Notice:       mockNotice,
	}, nil
}

func listMockTransactions(_ context.Context, _ *mcp.CallToolRequest, input transactionInput) (*mcp.CallToolResult, transactionOutput, error) {
	accountAlias := strings.TrimSpace(input.AccountAlias)
	if accountAlias == "" {
		accountAlias = "conta-demo"
	}
	limit := input.Limit
	if limit < 1 || limit > 3 {
		limit = 3
	}
	transactions := []mockTransaction{
		{Date: "2026-01-15", Description: "Crédito de demonstração", Amount: 2500.00, Currency: "BRL", Type: "credit"},
		{Date: "2026-01-16", Description: "Compra de demonstração", Amount: -84.90, Currency: "BRL", Type: "debit"},
		{Date: "2026-01-17", Description: "Pagamento de demonstração", Amount: -120.00, Currency: "BRL", Type: "debit"},
	}
	return nil, transactionOutput{
		AccountAlias: accountAlias,
		Transactions: transactions[:limit],
		Mock:         true,
		Notice:       mockNotice,
	}, nil
}

func getMockMarketQuote(_ context.Context, _ *mcp.CallToolRequest, input marketQuoteInput) (*mcp.CallToolResult, marketQuoteOutput, error) {
	symbol := strings.ToUpper(strings.TrimSpace(input.Symbol))
	if symbol == "" {
		return nil, marketQuoteOutput{}, errors.New("symbol is required")
	}
	return nil, marketQuoteOutput{
		Symbol:   symbol,
		Value:    100.00,
		Currency: "BRL",
		AsOf:     "MOCK DATA — sem data de mercado real",
		Mock:     true,
		Notice:   mockNotice,
	}, nil
}
