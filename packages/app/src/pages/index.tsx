import { NextPage } from 'next';
import { useMemo, useState } from 'react';

/* =======================
   TYPES
======================= */

type Period = 'monthly' | 'annual';

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

const calculateInsurance = (
  gross: number,
  enabled: boolean,
  rates: Record<string, number>
): number => (enabled ? gross * sumRates(rates) : 0);

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

const exportCSV = (rows: string[][], filename: string) => {
  const csv = rows.map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

/* =======================
   PAGE
======================= */

const HomePage: NextPage = () => {
  const [period, setPeriod] = useState<Period>('monthly');
  const [grossIncome, setGrossIncome] = useState(20_000_000);
  const [dependents, setDependents] = useState(0);
  const [insuranceEnabled, setInsuranceEnabled] = useState(true);

  const data = useMemo(() => {
    const grossMonthly = toMonthly(grossIncome, period);

    const employeeInsurance = calculateInsurance(
      grossMonthly,
      insuranceEnabled,
      EMPLOYEE_INSURANCE
    );

    const employerInsurance = calculateInsurance(
      grossMonthly,
      insuranceEnabled,
      EMPLOYER_INSURANCE
    );

    const deductions =
      PERSONAL_DEDUCTION + dependents * DEPENDENT_DEDUCTION + employeeInsurance;

    const taxableIncome = Math.max(0, grossMonthly - deductions);

    const { breakdown, totalTax } = calculateTaxBreakdown(taxableIncome);

    const netMonthly = grossMonthly - employeeInsurance - totalTax;

    return {
      grossMonthly,
      employeeInsurance,
      employerInsurance,
      totalLaborCost: grossMonthly + employerInsurance,
      taxableIncome,
      breakdown,
      totalTax,
      netMonthly,
    };
  }, [grossIncome, dependents, period, insuranceEnabled]);

  return (
    <main className="bg-base-200 min-h-screen p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-center text-xl font-bold">
          🇻🇳 Máy tính Thuế TNCN Việt Nam
        </h1>

        {/* Period */}
        <div className="tabs tabs-boxed justify-center">
          <button
            className={`tab ${period === 'monthly' && 'tab-active'}`}
            onClick={() => setPeriod('monthly')}>
            Tháng
          </button>
          <button
            className={`tab ${period === 'annual' && 'tab-active'}`}
            onClick={() => setPeriod('annual')}>
            Năm
          </button>
        </div>

        {/* Inputs */}
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-3">
            <input
              type="number"
              className="input input-bordered"
              placeholder="Thu nhập gộp"
              value={grossIncome}
              onChange={(e) => setGrossIncome(+e.target.value)}
            />

            <input
              type="number"
              className="input input-bordered"
              placeholder="Người phụ thuộc"
              value={dependents}
              onChange={(e) => setDependents(+e.target.value)}
            />

            <label className="label cursor-pointer">
              <span className="label-text">Tính bảo hiểm</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={insuranceEnabled}
                onChange={() => setInsuranceEnabled((v) => !v)}
              />
            </label>
          </div>
        </div>

        {/* Results */}
        <div className="card bg-base-100 shadow">
          <div className="card-body space-y-2">
            <p>
              💼 <b>Bảo hiểm NLĐ:</b> {data.employeeInsurance.toLocaleString()}{' '}
              VND
            </p>
            <p>
              🏢 <b>Bảo hiểm DN:</b> {data.employerInsurance.toLocaleString()}{' '}
              VND
            </p>
            <p>
              🧾 <b>Thu nhập chịu thuế:</b>{' '}
              {data.taxableIncome.toLocaleString()} VND
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

        {/* Tax Breakdown */}
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="mb-2 font-semibold">🧮 Chi tiết thuế theo bậc</h2>

            <div className="overflow-x-auto">
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
        </div>

        {/* Export */}
        <div className="flex gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() =>
              exportCSV(
                [
                  ['Gross', data.grossMonthly.toString()],
                  ['Employee insurance', data.employeeInsurance.toString()],
                  ['Tax', data.totalTax.toString()],
                  ['Net', data.netMonthly.toString()],
                ],
                'pit-vietnam.csv'
              )
            }>
            📤 CSV
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => window.print()}>
            📄 PDF
          </button>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
