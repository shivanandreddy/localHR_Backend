/**
 * Calculates Euclidean distance between two face descriptor arrays.
 * A distance below ~0.6 typically indicates a matching face.
 */
export const calculateFaceDistance = (descriptorA, descriptorB) => {
  if (!descriptorA || !descriptorB || descriptorA.length !== descriptorB.length) {
    return 1.0; // Return max distance (no match) if invalid
  }

  let sum = 0.0;
  for (let i = 0; i < descriptorA.length; i++) {
    sum += Math.pow(descriptorA[i] - descriptorB[i], 2);
  }
  return Math.sqrt(sum);
};