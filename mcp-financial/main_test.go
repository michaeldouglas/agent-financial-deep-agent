package main

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestLogToolCallRecordsSafeMetadataOnly(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	handler := logToolCall(logger, "mock_get_account_balance", getMockBalance)
	sensitiveAlias := "private-account-alias"

	_, output, err := handler(context.Background(), nil, balanceInput{AccountAlias: sensitiveAlias})
	if err != nil {
		t.Fatalf("handler returned an unexpected error: %v", err)
	}
	if output.AccountAlias != sensitiveAlias {
		t.Fatalf("handler output alias = %q, want %q", output.AccountAlias, sensitiveAlias)
	}

	logOutput := logs.String()
	for _, expected := range []string{
		`"tool":"mock_get_account_balance"`,
		`"status":"success"`,
		`"duration_ms":`,
	} {
		if !strings.Contains(logOutput, expected) {
			t.Errorf("log output %q does not contain %q", logOutput, expected)
		}
	}
	for _, secret := range []string{sensitiveAlias, "5274.83", mockNotice} {
		if strings.Contains(logOutput, secret) {
			t.Errorf("log output contains sensitive or financial data %q: %s", secret, logOutput)
		}
	}
}

func TestLogToolCallDoesNotLogErrorDetails(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	handler := logToolCall(logger, "mock_get_market_quote", func(
		context.Context,
		*mcp.CallToolRequest,
		marketQuoteInput,
	) (*mcp.CallToolResult, marketQuoteOutput, error) {
		return nil, marketQuoteOutput{}, errors.New("private-symbol-validation-detail")
	})

	_, _, err := handler(context.Background(), nil, marketQuoteInput{Symbol: "PRIVATE"})
	if err == nil {
		t.Fatal("handler error = nil, want a failure")
	}

	logOutput := logs.String()
	for _, expected := range []string{
		`"tool":"mock_get_market_quote"`,
		`"status":"error"`,
		`"duration_ms":`,
	} {
		if !strings.Contains(logOutput, expected) {
			t.Errorf("log output %q does not contain %q", logOutput, expected)
		}
	}
	for _, privateValue := range []string{"PRIVATE", "private-symbol-validation-detail"} {
		if strings.Contains(logOutput, privateValue) {
			t.Errorf("log output contains private value %q: %s", privateValue, logOutput)
		}
	}
}

func TestChartFixturesCoverChartExperiments(t *testing.T) {
	for _, dataset := range []string{"monthly_series", "market_movers", "portfolio_allocation", "expense_categories"} {
		_, output, err := getMockChartDataset(context.Background(), nil, chartDatasetInput{Dataset: dataset})
		if err != nil {
			t.Fatalf("dataset %q returned an unexpected error: %v", dataset, err)
		}
		if !output.Mock || output.Notice == "" || len(output.Rows) < 3 {
			t.Errorf("dataset %q should be labeled mock and contain chart rows: %+v", dataset, output)
		}
	}

	if _, _, err := getMockChartDataset(context.Background(), nil, chartDatasetInput{Dataset: "unknown"}); err == nil {
		t.Fatal("unknown dataset should return an error")
	}
}
