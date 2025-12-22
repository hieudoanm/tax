import { NextPage } from 'next';
import { useEffect, useMemo, useState } from 'react';

/* =======================
   TYPES
======================= */

type Period = 'monthly' | 'annual';
type SalaryMode = 'gross' | 'net';

type TaxBracket = {
  limit: number;
  rate: number;
};

type TaxBreakdownItem = {
  rate: number;
  taxable: number;
  tax: number;
};

/* =======================
   CONSTANTS
======================= */

const PERSONAL_DEDUCTION = 11_000_000;
const DEPENDENT_DEDUCTION = 4_400_000;

/** Approx insurance salary cap (configurable) */
const INSURANCE_CAP = 36_000_000;

/** Employee contribution */
const EMPLOYEE_INSURANCE = {
  BHXH: 0.08,
  BHYT: 0.015,
  BHTN: 0.01,
};

/** Employer contribution */
const EMPLOYER_INSURANCE = {
  BHXH: 0.175,
  BHYT: 0.03,
  BHTN: 0.01,
};

const TAX_BRACKETS: readonly TaxBracket[] = [
  { limit: 5_000_000, rate: 0.05 },
  { limit: 5_000_000, rate: 0.1 },
  { limit: 8_000_000, rate: 0.15 },
  { limit: 14_000_000, rate: 0.2 },
  { limit: 20_000_000, rate: 0.25 },
  { limit: 28_000_000, rate: 0.3 },
  { limit: Infinity, rate: 0.35 },
];

/* =======================
   PURE FUNCTIONS
======================= */

const toMonthly = (value: number, period: Period): number =>
  period === 'annual' ? value / 12 : value;

const sumRates = (rates: Record<string, number>): number =>
  Object.values(rates).reduce((a, b) => a + b, 0);

const clampInsuranceBase = (gross: number, enabled: boolean): number =>
  enabled ? Math.min(gross, INSURANCE_CAP) : 0;

const calculateTaxBreakdown = (
  taxableIncome: number
): { breakdown: TaxBreakdownItem[]; totalTax: number } => {
  let remaining = taxableIncome;
  let totalTax = 0;
  const breakdown: TaxBreakdownItem[] = [];

  for (const bracket of TAX_BRACKETS) {
    if (remaining <= 0) break;

    const applied = Math.min(bracket.limit, remaining);
    const tax = applied * bracket.rate;

    breakdown.push({
      rate: bracket.rate,
      taxable: applied,
      tax,
    });

    totalTax += tax;
    remaining -= applied;
  }

  return { breakdown, totalTax };
};

/** Iterative net → gross solver */
const solveGrossFromNet = (
  targetNet: number,
  dependents: number,
  insuranceEnabled: boolean
): number => {
  let gross = targetNet;

  for (let i = 0; i < 20; i++) {
    const insuranceBase = clampInsuranceBase(gross, insuranceEnabled);
    const insurance = insuranceBase * sumRates(EMPLOYEE_INSURANCE);

    const deductions =
      PERSONAL_DEDUCTION + dependents * DEPENDENT_DEDUCTION + insurance;

    const taxable = Math.max(0, gross - deductions);
    const { totalTax } = calculateTaxBreakdown(taxable);

    const net = gross - insurance - totalTax;
    gross += targetNet - net;
  }

  return Math.max(0, gross);
};

const exportCSV = (rows: string[][], filename: string) => {
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const readInitialState = () => {
  const p = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );

  return {
    income: Number(p.get('income')) || 20_000_000,
    dependents: Number(p.get('dep')) || 0,
    period: (p.get('period') as Period) || 'monthly',
    salaryMode: (p.get('mode') as SalaryMode) || 'gross',
    insuranceEnabled: p.get('ins') !== '0',
  };
};

/* =======================
   PAGE
======================= */

const HomePage: NextPage = () => {
  const initial = readInitialState();

  const [income, setIncome] = useState(initial.income);
  const [dependents, setDependents] = useState(initial.dependents);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [salaryMode, setSalaryMode] = useState<SalaryMode>(initial.salaryMode);
  const [insuranceEnabled, setInsuranceEnabled] = useState(
    initial.insuranceEnabled
  );

  /* Sync URL */
  useEffect(() => {
    const params = new URLSearchParams({
      income: income.toString(),
      dep: dependents.toString(),
      period,
      mode: salaryMode,
      ins: insuranceEnabled ? '1' : '0',
    });

    window.history.replaceState({}, '', `?${params.toString()}`);
  }, [income, dependents, period, salaryMode, insuranceEnabled]);

  const data = useMemo(() => {
    const grossBase =
      salaryMode === 'gross'
        ? income
        : solveGrossFromNet(income, dependents, insuranceEnabled);

    const grossMonthly = toMonthly(grossBase, period);

    const insuranceBase = clampInsuranceBase(grossMonthly, insuranceEnabled);

    const employeeInsurance = insuranceBase * sumRates(EMPLOYEE_INSURANCE);

    const employerInsurance = insuranceBase * sumRates(EMPLOYER_INSURANCE);

    const personalDeduction = PERSONAL_DEDUCTION;
    const dependentDeduction = dependents * DEPENDENT_DEDUCTION;

    const totalDeductions =
      personalDeduction + dependentDeduction + employeeInsurance;

    const taxableIncome = Math.max(0, grossMonthly - totalDeductions);

    const { breakdown, totalTax } = calculateTaxBreakdown(taxableIncome);

    const netMonthly = grossMonthly - employeeInsurance - totalTax;

    return {
      grossMonthly,
      insuranceBase,
      employeeInsurance,
      employerInsurance,
      personalDeduction,
      dependentDeduction,
      totalDeductions,
      taxableIncome,
      breakdown,
      totalTax,
      netMonthly,
      effectiveTaxRate: grossMonthly ? totalTax / grossMonthly : 0,
      totalLaborCost: grossMonthly + employerInsurance,
    };
  }, [income, dependents, period, insuranceEnabled, salaryMode]);

  return (
    <main className="bg-base-200 min-h-screen p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-center text-lg font-bold md:text-xl">
            🇻🇳 Tính Thuế TNCN
          </h1>

          {/* Period */}
          <div className="join flex justify-center">
            <label className="join-item">
              <input
                type="radio"
                name="period"
                className="peer hidden"
                checked={period === 'monthly'}
                onChange={() => setPeriod('monthly')}
              />
              <div className="btn btn-sm peer-checked:btn-primary transition-all duration-200 peer-checked:text-white">
                📅 Tháng
              </div>
            </label>
            <label className="join-item">
              <input
                type="radio"
                name="period"
                className="peer hidden"
                checked={period === 'annual'}
                onChange={() => setPeriod('annual')}
              />
              <div className="btn btn-sm peer-checked:btn-primary transition-all duration-200 peer-checked:text-white">
                🗓️ Năm
              </div>
            </label>
          </div>
        </div>

        {/* Inputs */}
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-4">
            {/* Gross ↔ Net switch */}
            <div className="flex justify-center">
              <button
                className="btn btn-primary flex w-full items-center gap-2"
                onClick={() =>
                  setSalaryMode((m) => (m === 'gross' ? 'net' : 'gross'))
                }>
                {salaryMode === 'gross' ? (
                  <span>Gross → Net</span>
                ) : (
                  <span>Net → Gross</span>
                )}
              </button>
            </div>

            {/* Income input */}
            <div className="form-control">
              <label className="label mb-1">
                <span className="label-text font-medium">
                  {salaryMode === 'gross'
                    ? '💼 Thu nhập gộp (Gross)'
                    : '💰 Thu nhập thực lĩnh (Net)'}
                </span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                value={income}
                onChange={(e) => setIncome(+e.target.value)}
              />
            </div>

            {/* Dependents */}
            <div className="form-control">
              <label className="label mb-1">
                <span className="label-text font-medium">
                  👨‍👩‍👧 Người phụ thuộc
                </span>
              </label>
              <input
                type="number"
                className="input input-bordered w-full"
                value={dependents}
                onChange={(e) => setDependents(+e.target.value)}
              />
            </div>

            {/* Insurance toggle */}
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text font-medium">🛡️ Tính bảo hiểm</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={insuranceEnabled}
                  onChange={() => setInsuranceEnabled((v) => !v)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="card bg-base-100 text-sm shadow">
          <div className="card-body space-y-1">
            <h2 className="font-semibold">🧾 Khấu trừ</h2>
            <p>👤 Cá nhân: {data.personalDeduction.toLocaleString()} VND</p>
            <p>👨‍👩‍👧 Phụ thuộc: {data.dependentDeduction.toLocaleString()} VND</p>
            <p>
              💼 Bảo hiểm NLĐ: {data.employeeInsurance.toLocaleString()} VND
            </p>
            <div className="divider my-1" />
            <p className="font-bold">
              Tổng: {data.totalDeductions.toLocaleString()} VND
            </p>
            {insuranceEnabled && data.insuranceBase < data.grossMonthly && (
              <p className="text-warning text-xs">⚠ Áp dụng trần bảo hiểm</p>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-2">
            <p>
              🧾 Thu nhập chịu thuế: {data.taxableIncome.toLocaleString()} VND
            </p>
            <p>
              📉 Thuế hiệu dụng: {(data.effectiveTaxRate * 100).toFixed(2)}%
            </p>
            <div className="divider" />
            <p className="text-primary text-lg font-bold">
              💰 Thực lĩnh: {data.netMonthly.toLocaleString()} VND
            </p>
            <p className="text-sm opacity-70">
              Tổng chi phí DN: {data.totalLaborCost.toLocaleString()} VND
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="mb-2 font-semibold">🧮 Chi tiết thuế</h2>
            <table className="table-sm table">
              <thead>
                <tr>
                  <th>Thuế suất</th>
                  <th>Chịu thuế</th>
                  <th>Thuế</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.map((b, i) => (
                  <tr key={i}>
                    <td>{b.rate * 100}%</td>
                    <td>{b.taxable.toLocaleString()}</td>
                    <td>{b.tax.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Export & Share */}
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-3">
            <h2 className="text-sm font-semibold">📤 Xuất & Chia sẻ</h2>

            <div className="flex flex-wrap gap-2">
              {/* CSV */}
              <button
                className="btn btn-primary btn-sm flex-1"
                onClick={() =>
                  exportCSV(
                    [
                      ['Gross', data.grossMonthly.toString()],
                      ['Insurance', data.employeeInsurance.toString()],
                      ['Tax', data.totalTax.toString()],
                      ['Net', data.netMonthly.toString()],
                    ],
                    'thue-tncn-vietnam.csv'
                  )
                }>
                📊 CSV
              </button>

              {/* PDF */}
              <button
                className="btn btn-secondary btn-sm flex-1"
                onClick={() => window.print()}>
                🖨️ PDF
              </button>

              {/* Share */}
              <button
                className="btn btn-accent btn-sm flex-1"
                onClick={async () => {
                  const url = window.location.href;

                  try {
                    await navigator.clipboard.writeText(url);
                    alert('🔗 Đã sao chép link chia sẻ!');
                  } catch {
                    alert('❌ Không thể sao chép link');
                  }
                }}>
                🔗 Chia sẻ
              </button>
            </div>

            <p className="text-xs opacity-60">
              Link chia sẻ sẽ giữ nguyên thu nhập, số người phụ thuộc và chế độ
              tính.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
