package ui

import (
	"encoding/csv"
	"fmt"
	"os"
	"strconv"

	"charm.land/bubbles/v2/textinput"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

/* =======================
   DOMAIN TYPES
======================= */

type Period string
type SalaryMode string

const (
	Monthly Period = "monthly"
	Annual  Period = "annual"

	Gross SalaryMode = "gross"
	Net   SalaryMode = "net"
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
	InsuranceCap       = 36_000_000
)

var EmployeeInsurance = map[string]float64{
	"BHXH": 0.08,
	"BHYT": 0.015,
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
   PURE LOGIC
======================= */

func toMonthly(v float64, p Period) float64 {
	if p == Annual {
		return v / 12
	}
	return v
}

func sumRates(r map[string]float64) float64 {
	s := 0.0
	for _, v := range r {
		s += v
	}
	return s
}

func clampInsuranceBase(gross float64, enabled bool) float64 {
	if !enabled {
		return 0
	}
	if gross > InsuranceCap {
		return InsuranceCap
	}
	return gross
}

func calculateTax(taxable float64) ([]TaxBreakdown, float64) {
	var out []TaxBreakdown
	remain := taxable
	total := 0.0

	for _, b := range TaxBrackets {
		if remain <= 0 {
			break
		}
		apply := min(b.Limit, remain)
		tax := apply * b.Rate
		out = append(out, TaxBreakdown{b.Rate, apply, tax})
		total += tax
		remain -= apply
	}
	return out, total
}

func solveGrossFromNet(targetNet float64, dependents int, insurance bool) float64 {
	gross := targetNet
	for i := 0; i < 20; i++ {
		base := clampInsuranceBase(gross, insurance)
		ins := base * sumRates(EmployeeInsurance)
		deductions := PersonalDeduction + float64(dependents)*DependentDeduction + ins
		taxable := max(0, gross-deductions)
		_, tax := calculateTax(taxable)
		net := gross - ins - tax
		gross += targetNet - net
	}
	return gross
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
   TUI MODEL
======================= */

type step int

const (
	stepMode step = iota
	stepPeriod
	stepIncome
	stepDependents
	stepInsurance
	stepResult
)

type model struct {
	step       step
	mode       SalaryMode
	period     Period
	income     float64
	dependents int
	insurance  bool
	input      textinput.Model
}

/* =======================
   STYLES
======================= */

var title = lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("212"))
var active = lipgloss.NewStyle().Foreground(lipgloss.Color("42"))
var dim = lipgloss.NewStyle().Foreground(lipgloss.Color("240"))

/* =======================
   INIT
======================= */

func initialModel() model {
	ti := textinput.New()
	ti.Focus()
	ti.CharLimit = 20

	return model{
		step:      stepMode,
		mode:      Gross,
		period:    Monthly,
		insurance: true,
		input:     ti,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func RunTaxTUI() error {
	_, err := tea.NewProgram(initialModel()).Run()
	return err
}

/* =======================
   UPDATE
======================= */

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.KeyMsg:
		switch msg.String() {

		case "ctrl+c", "q":
			return m, tea.Quit

		case "left", "right":
			m.toggle()
			return m, nil

		case "enter":
			return m.next()
		}
	}

	if m.step == stepIncome || m.step == stepDependents {
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	}

	return m, nil
}

func (m *model) toggle() {
	switch m.step {
	case stepMode:
		if m.mode == Gross {
			m.mode = Net
		} else {
			m.mode = Gross
		}
	case stepPeriod:
		if m.period == Monthly {
			m.period = Annual
		} else {
			m.period = Monthly
		}
	case stepInsurance:
		m.insurance = !m.insurance
	}
}

func (m model) next() (tea.Model, tea.Cmd) {
	switch m.step {

	case stepMode:
		m.step = stepPeriod

	case stepPeriod:
		m.step = stepIncome
		m.input.Placeholder = "Thu nhập (VND)"
		m.input.SetValue("")
		m.input.Focus()

	case stepIncome:
		if val, err := strconv.ParseFloat(m.input.Value(), 64); err == nil {
			m.income = val
		}
		m.step = stepDependents
		m.input.Placeholder = "Số người phụ thuộc"
		m.input.SetValue("")
		m.input.Focus()

	case stepDependents:
		if val, err := strconv.Atoi(m.input.Value()); err == nil {
			m.dependents = val
		}
		m.input.Blur()
		m.step = stepInsurance

	case stepInsurance:
		m.step = stepResult

	case stepResult:
		exportCSV(m)
		return m, tea.Quit
	}

	return m, nil
}

/* =======================
   VIEW (v2)
======================= */

func (m model) View() tea.View {
	switch m.step {

	case stepMode:
		return tea.NewView(
			title.Render("🔁 Chế độ lương\n\n") +
				radio("Gross → Net", m.mode == Gross) +
				radio("Net → Gross", m.mode == Net),
		)

	case stepPeriod:
		return tea.NewView(
			title.Render("📅 Kỳ tính\n\n") +
				radio("Tháng", m.period == Monthly) +
				radio("Năm", m.period == Annual),
		)

	case stepIncome, stepDependents:
		return tea.NewView(
			title.Render("✏️ Nhập dữ liệu\n\n") +
				m.input.View() + "\n\nEnter tiếp tục",
		)

	case stepInsurance:
		return tea.NewView(
			title.Render("🛡️ Bảo hiểm\n\n") +
				radio("Có", m.insurance) +
				radio("Không", !m.insurance),
		)

	case stepResult:
		return tea.NewView(m.resultView())
	}

	return tea.NewView("")
}

/* =======================
   HELPERS (FIXED)
======================= */

func radio(label string, on bool) string {
	if on {
		return active.Render("🔘 " + label + "\n")
	}
	return dim.Render("⚪ " + label + "\n")
}

func (m model) resultView() string {
	var gross float64
	if m.mode == Gross {
		gross = toMonthly(m.income, m.period)
	} else {
		gross = solveGrossFromNet(m.income, m.dependents, m.insurance)
	}

	base := clampInsuranceBase(gross, m.insurance)
	empIns := base * sumRates(EmployeeInsurance)

	deductions := PersonalDeduction + float64(m.dependents)*DependentDeduction + empIns
	taxable := max(0, gross-deductions)
	breakdown, tax := calculateTax(taxable)
	net := gross - empIns - tax

	out := title.Render("📊 Kết quả\n\n")
	out += fmt.Sprintf("Gross: %.0f VND\n", gross)
	out += fmt.Sprintf("Net:   %.0f VND\n", net)
	out += fmt.Sprintf("Tax:   %.0f VND\n\n", tax)

	out += "🧮 Chi tiết:\n"
	for _, b := range breakdown {
		out += fmt.Sprintf(" %.0f%% → %.0f\n", b.Rate*100, b.Tax)
	}

	out += "\nEnter để xuất CSV • q để thoát"
	return out
}

func exportCSV(m model) {
	file, _ := os.Create("pit-vietnam.csv")
	defer file.Close()

	w := csv.NewWriter(file)
	defer w.Flush()

	w.WriteAll([][]string{
		{"Gross", fmt.Sprintf("%.0f", m.income)},
	})
}
