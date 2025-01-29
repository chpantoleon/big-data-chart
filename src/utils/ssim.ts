import { Point } from 'interfaces/point';

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

const variance = (values: number[], meanVal: number): number =>
  values.reduce((sum, v) => sum + (v - meanVal) ** 2, 0) / values.length;

const covariance = (values1: number[], values2: number[], mean1: number, mean2: number): number =>
  values1.reduce((sum, v, i) => sum + (v - mean1) * (values2[i] - mean2), 0) / values1.length;

/**
 * The structural similarity index measure (SSIM) is a method for predicting the perceived quality of digital television and cinematic pictures, as well as other kinds of digital images and videos. (source: Wikipedia)
 * @param line1 Array of {x: number, y: number} objects which represents the first line
 * @param line2 Array of {x: number, y: number} objects which represents the second line
 * @param L the dynamic range of the pixel-values (0-255). We use 1 because we only care for whether the pixel is on or off
 * @param k1
 * @param k2
 * @returns
 */
export const calculateSSIM = (line1: Point[], line2: Point[], L: number = 1, k1: number = 0.01, k2: number = 0.03): number => {
  if (line1.length !== line2.length) {
    throw new Error('Lines must have the same number of points for SSIM comparison.');
  }

  const x = line1.map((l) => l.y);
  const y = line2.map((l) => l.y);

  const mx = mean(x);
  const my = mean(y);

  const sigmaxSq = variance(x, mx);
  const sigmaySq = variance(y, my);
  const sigmaxy = covariance(x, y, mx, my);

  const c1 = (k1 * L) ** 2;
  const c2 = (k2 * L) ** 2;

  return (
    ((2 * mx * my + c1) * (2 * sigmaxy + c2)) /
    ((mx ** 2 + my ** 2 + c1) * (sigmaxSq + sigmaySq + c2))
  );
}
