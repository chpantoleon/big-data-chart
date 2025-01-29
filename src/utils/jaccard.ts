import { Point } from "interfaces/point";

export const calculateJaccardSimilarity = (pixelArray1: Point[], pixelArray2: Point[]): number => {
  const set1 = new Set(pixelArray1.map(({ x, y }) => `${x},${y}`));
  const set2 = new Set(pixelArray2.map(({ x, y }) => `${x},${y}`));

  // Compute intersection size
  const intersectionSize = [...set1].filter(pixel => set2.has(pixel)).length;

  // Compute union size
  const unionSize = new Set([...set1, ...set2]).size;

  // Compute Jaccard similarity
  return intersectionSize / unionSize;
}
