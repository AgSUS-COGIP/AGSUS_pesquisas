export type PreSampleMatrix = {
  items: Array<{ id: string; code: string; label: string }>;
  rows: Array<{ values: Record<string, number | null> }>;
};

export type PreSampleStatistics = {
  respondents: number;
  completeCases: number;
  items: number;
  cronbachAlpha: number | null;
  omegaTotal: number | null;
  kmo: number | null;
  bartlett: { chiSquare: number; degreesOfFreedom: number; pValue: number } | null;
  scree: Array<{ component: number; eigenvalue: number; explainedPercent: number }>;
  warnings: string[];
};

const EPSILON = 1e-10;

function identity(size: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => row === column ? 1 : 0));
}

function determinant(matrix: number[][]) {
  const work = matrix.map((row) => [...row]);
  let result = 1;
  for (let column = 0; column < work.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < work.length; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    }
    if (Math.abs(work[pivot][column]) < EPSILON) return 0;
    if (pivot !== column) {
      [work[pivot], work[column]] = [work[column], work[pivot]];
      result *= -1;
    }
    const diagonal = work[column][column];
    result *= diagonal;
    for (let row = column + 1; row < work.length; row += 1) {
      const factor = work[row][column] / diagonal;
      for (let next = column + 1; next < work.length; next += 1) {
        work[row][next] -= factor * work[column][next];
      }
    }
  }
  return result;
}

function inverse(matrix: number[][]) {
  const size = matrix.length;
  const work = matrix.map((row, index) => [...row, ...identity(size)[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
    }
    if (Math.abs(work[pivot][column]) < EPSILON) return null;
    [work[pivot], work[column]] = [work[column], work[pivot]];
    const diagonal = work[column][column];
    work[column] = work[column].map((value) => value / diagonal);
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = work[row][column];
      work[row] = work[row].map((value, index) => value - factor * work[column][index]);
    }
  }
  return work.map((row) => row.slice(size));
}

function covarianceMatrix(rows: number[][]) {
  const columns = rows[0].length;
  const means = Array.from({ length: columns }, (_, column) =>
    rows.reduce((sum, row) => sum + row[column], 0) / rows.length);
  return Array.from({ length: columns }, (_, left) =>
    Array.from({ length: columns }, (_, right) =>
      rows.reduce((sum, row) => sum + (row[left] - means[left]) * (row[right] - means[right]), 0)
      / (rows.length - 1)));
}

function correlationMatrix(covariance: number[][]) {
  return covariance.map((row, left) => row.map((value, right) => {
    const denominator = Math.sqrt(covariance[left][left] * covariance[right][right]);
    return denominator > EPSILON ? value / denominator : 0;
  }));
}

/** Autovalores/vetores de uma matriz simétrica pelo método de Jacobi. */
function symmetricEigen(matrix: number[][]) {
  const size = matrix.length;
  const values = matrix.map((row) => [...row]);
  const vectors = identity(size);
  for (let iteration = 0; iteration < Math.max(50, size * size * 20); iteration += 1) {
    let p = 0; let q = 1; let maximum = 0;
    for (let row = 0; row < size; row += 1) for (let column = row + 1; column < size; column += 1) {
      if (Math.abs(values[row][column]) > maximum) { maximum = Math.abs(values[row][column]); p = row; q = column; }
    }
    if (maximum < EPSILON) break;
    const angle = 0.5 * Math.atan2(2 * values[p][q], values[q][q] - values[p][p]);
    const cosine = Math.cos(angle); const sine = Math.sin(angle);
    for (let index = 0; index < size; index += 1) {
      const ip = values[index][p]; const iq = values[index][q];
      values[index][p] = cosine * ip - sine * iq;
      values[index][q] = sine * ip + cosine * iq;
    }
    for (let index = 0; index < size; index += 1) {
      const pi = values[p][index]; const qi = values[q][index];
      values[p][index] = cosine * pi - sine * qi;
      values[q][index] = sine * pi + cosine * qi;
      const vip = vectors[index][p]; const viq = vectors[index][q];
      vectors[index][p] = cosine * vip - sine * viq;
      vectors[index][q] = sine * vip + cosine * viq;
    }
  }
  return values.map((row, index) => ({
    value: Math.max(0, row[index]),
    vector: vectors.map((vectorRow) => vectorRow[index]),
  })).sort((left, right) => right.value - left.value);
}

// Regularized upper incomplete gamma; used for the chi-square survival function.
function gammaLog(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019571e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - gammaLog(1 - value);
  let shifted = value - 1; let series = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => { series += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function gammaQ(shape: number, value: number) {
  if (value <= 0) return 1;
  if (value < shape + 1) {
    let term = 1 / shape; let sum = term;
    for (let index = 1; index < 200; index += 1) {
      term *= value / (shape + index); sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    const lower = sum * Math.exp(-value + shape * Math.log(value) - gammaLog(shape));
    return Math.max(0, Math.min(1, 1 - lower));
  }
  let b = value + 1 - shape; let c = 1 / 1e-30; let d = 1 / b; let fraction = d;
  for (let index = 1; index < 200; index += 1) {
    const a = -index * (index - shape); b += 2; d = a * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + a / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const delta = d * c; fraction *= delta; if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.max(0, Math.min(1, Math.exp(-value + shape * Math.log(value) - gammaLog(shape)) * fraction));
}

export function calculatePreSampleStatistics(input: PreSampleMatrix): PreSampleStatistics {
  const warnings: string[] = [];
  const complete = input.rows.map((row) => input.items.map((item) => row.values[item.id]))
    .filter((row): row is number[] => row.every((value) => typeof value === "number" && Number.isFinite(value)));
  const base = { respondents: input.rows.length, completeCases: complete.length, items: input.items.length, warnings };
  if (input.items.length < 2 || complete.length < 3) {
    warnings.push("São necessários ao menos 3 casos completos e 2 itens quantitativos para calcular os indicadores.");
    return { ...base, cronbachAlpha: null, omegaTotal: null, kmo: null, bartlett: null, scree: [] };
  }
  if (complete.length < input.items.length * 5) warnings.push("A pré-amostra tem menos de 5 casos completos por item; interprete os indicadores com cautela.");
  const covariance = covarianceMatrix(complete);
  if (covariance.some((row, index) => row[index] < EPSILON)) {
    warnings.push("Um ou mais itens não variam na pré-amostra; a matriz de correlação é singular.");
  }
  const itemVariance = covariance.reduce((sum, row, index) => sum + row[index], 0);
  const totalVariance = covariance.flat().reduce((sum, value) => sum + value, 0);
  const cronbachAlpha = totalVariance > EPSILON
    ? (input.items.length / (input.items.length - 1)) * (1 - itemVariance / totalVariance) : null;
  const correlation = correlationMatrix(covariance);
  const eigen = symmetricEigen(correlation);
  const totalEigen = eigen.reduce((sum, item) => sum + item.value, 0);
  const scree = eigen.map((item, index) => ({ component: index + 1, eigenvalue: item.value,
    explainedPercent: totalEigen > 0 ? item.value / totalEigen * 100 : 0 }));
  const first = eigen[0];
  const loadings = first.vector.map((component) => component * Math.sqrt(first.value));
  const loadingSum = loadings.reduce((sum, loading) => sum + loading, 0);
  const uniqueness = loadings.reduce((sum, loading) => sum + Math.max(0, 1 - loading * loading), 0);
  const omegaTotal = loadingSum * loadingSum + uniqueness > EPSILON
    ? loadingSum * loadingSum / (loadingSum * loadingSum + uniqueness) : null;
  const inverted = inverse(correlation);
  let kmo: number | null = null;
  if (inverted) {
    let correlationsSquared = 0; let partialsSquared = 0;
    for (let row = 0; row < correlation.length; row += 1) for (let column = row + 1; column < correlation.length; column += 1) {
      correlationsSquared += correlation[row][column] ** 2;
      const denominator = Math.sqrt(inverted[row][row] * inverted[column][column]);
      if (denominator > EPSILON) partialsSquared += (-inverted[row][column] / denominator) ** 2;
    }
    if (correlationsSquared + partialsSquared > EPSILON) kmo = correlationsSquared / (correlationsSquared + partialsSquared);
  } else warnings.push("Não foi possível inverter a matriz de correlação; o KMO não está disponível.");
  const det = determinant(correlation);
  const degreesOfFreedom = input.items.length * (input.items.length - 1) / 2;
  const chiSquare = det > EPSILON
    ? -(complete.length - 1 - (2 * input.items.length + 5) / 6) * Math.log(det) : null;
  const bartlett = chiSquare !== null && chiSquare >= 0
    ? { chiSquare, degreesOfFreedom, pValue: gammaQ(degreesOfFreedom / 2, chiSquare / 2) } : null;
  if (!bartlett) warnings.push("A matriz não permite calcular o teste de Bartlett.");
  return { ...base, cronbachAlpha, omegaTotal, kmo, bartlett, scree };
}
