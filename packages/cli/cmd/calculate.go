package cmd

import (
	"bufio"
	"encoding/csv"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

/* =======================
   TYPES
======================= */

type Period string

const (
	Monthly Period = "monthly"
	Annual  Period = "annual"
)

type TaxBracket struct {
	Limit float64
	Rate  float64
}

type TaxBreakdown struct {
	Rate    float64
	Taxable float64
	Tax     float64
}

/* =======================
   CONSTANTS
======================= */

const (
	PersonalDeduction  = 11_000_000
	DependentDeduction = 4_400_000
)

var EmployeeInsurance = map[string]float64{
	"BHXH": 0.08,
	"BHYT": 0.015,
	"BHTN": 0.01,
}

var EmployerInsurance = map[string]float64{
	"BHXH": 0.175,
	"BHYT": 0.03,
	"BHTN": 0.01,
}

var TaxBrackets = []TaxBracket{
	{5_000_000, 0.05},
	{5_000_000, 0.10},
	{8_000_000, 0.15},
	{14_000_000, 0.20},
	{20_000_000, 0.25},
	{28_000_000, 0.30},
	{1e18, 0.35},
}

/* =======================
   PURE FUNCTIONS
======================= */

func toMonthly(amount float64, period Period) float64 {
	if period == Annual {
		return amount / 12
	}
	return amount
}

func sumRates(r map[string]float64) float64 {
	total := 0.0
	for _, v := range r {
		total += v
	}
	return total
}

func insurance(gross float64, enabled bool, rates map[string]float64) float64 {
	if !enabled {
		return 0
	}
	return gross * sumRates(rates)
}

func calculateTax(taxable float64) ([]TaxBreakdown, float64) {
	var breakdown []TaxBreakdown
	remaining := taxable
	total := 0.0

	for _, b := range TaxBrackets {
		if remaining <= 0 {
			break
		}
		applied := min(b.Limit, remaining)
		tax := applied * b.Rate

		breakdown = append(breakdown, TaxBreakdown{
			Rate:    b.Rate,
			Taxable: applied,
			Tax:     tax,
		})

		total += tax
		remaining -= applied
	}
	return breakdown, total
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

/* =======================
   IO HELPERS
======================= */

var reader = bufio.NewReader(os.Stdin)

func ask(prompt string) string {
	fmt.Print(prompt)
	input, _ := reader.ReadString('\n')
	return strings.TrimSpace(input)
}

func askFloat(prompt string) float64 {
	for {
		val, err := strconv.ParseFloat(ask(prompt), 64)
		if err == nil {
			return val
		}
		fmt.Println("❌ Invalid number, try again.")
	}
}

func askInt(prompt string) int {
	for {
		val, err := strconv.Atoi(ask(prompt))
		if err == nil {
			return val
		}
		fmt.Println("❌ Invalid integer, try again.")
	}
}

func askBool(prompt string) bool {
	for {
		val := strings.ToLower(ask(prompt + " (y/n): "))
		if val == "y" {
			return true
		}
		if val == "n" {
			return false
		}
		fmt.Println("❌ Enter y or n.")
	}
}

/* =======================
   CSV
======================= */

func exportCSV(filename string, rows [][]string) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	return writer.WriteAll(rows)
}

/* =======================
   COMMAND
======================= */

var calculateCmd = &cobra.Command{
	Use:   "calculate",
	Short: "Tính thuế thu nhập cá nhân Việt Nam (interactive)",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("\n🇻🇳 Vietnam PIT Calculator")
		fmt.Println("--------------------------")

		periodInput := ask("Enter period (monthly/annual): ")
		period := Period(strings.ToLower(periodInput))
		if period != Monthly && period != Annual {
			return fmt.Errorf("invalid period")
		}

		income := askFloat("Enter gross income (VND): ")
		dependents := askInt("Enter number of dependents: ")
		insuranceEnabled := askBool("Calculate insurance?")
		export := askBool("Export CSV?")

		grossMonthly := toMonthly(income, period)

		empIns := insurance(grossMonthly, insuranceEnabled, EmployeeInsurance)
		erIns := insurance(grossMonthly, insuranceEnabled, EmployerInsurance)

		deductions :=
			PersonalDeduction +
				float64(dependents)*DependentDeduction +
				empIns

		taxable := max(0, grossMonthly-deductions)
		breakdown, tax := calculateTax(taxable)
		net := grossMonthly - empIns - tax
		totalCost := grossMonthly + erIns

		fmt.Println("\n📊 Result")
		fmt.Printf("Gross income:        %f,.0f VND\n", grossMonthly)
		fmt.Printf("Employee insurance:  %f,.0f VND\n", empIns)
		fmt.Printf("Employer insurance:  %f,.0f VND\n", erIns)
		fmt.Printf("Taxable income:      %f,.0f VND\n", taxable)
		fmt.Printf("Personal income tax: %f,.0f VND\n", tax)
		fmt.Printf("Net income:          %f,.0f VND\n", net)
		fmt.Printf("Total employer cost: %f,.0f VND\n", totalCost)

		fmt.Println("\n🧮 Tax breakdown:")
		for _, b := range breakdown {
			fmt.Printf("  %2.0f%% → %f,.0f → %f,.0f\n",
				b.Rate*100, b.Taxable, b.Tax)
		}

		if export {
			filename := ask("CSV filename: ")
			rows := [][]string{
				{"Gross", fmt.Sprintf("%.0f", grossMonthly)},
				{"EmployeeInsurance", fmt.Sprintf("%.0f", empIns)},
				{"EmployerInsurance", fmt.Sprintf("%.0f", erIns)},
				{"TaxableIncome", fmt.Sprintf("%.0f", taxable)},
				{"Tax", fmt.Sprintf("%.0f", tax)},
				{"NetIncome", fmt.Sprintf("%.0f", net)},
				{"TotalEmployerCost", fmt.Sprintf("%.0f", totalCost)},
			}
			if err := exportCSV(filename, rows); err != nil {
				return err
			}
			fmt.Println("📤 CSV exported:", filename)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(calculateCmd)
}
