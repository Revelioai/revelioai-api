import { AllowArray, Call, CallData, hash } from "starknet";

// Function to ensure calldata is an array
function ensureArray<T>(data: T | T[]): T[] {
  return Array.isArray(data) ? data : [data];
}

export const flattenCalldata = (calls: AllowArray<Call>): string[] => {
  const callArray = ensureArray(calls); // Ensure calls is an array
  return callArray.reduce(
    (acc: string[], call: Call) => {
      if (call.calldata === undefined) return acc;
      const compiledCallData = CallData.compile(call.calldata);
      const flattenedCallData = [
        call.contractAddress,
        hash.getSelectorFromName(call.entrypoint),
        compiledCallData.length.toString(),
        ...compiledCallData,
      ];
      return acc.concat(flattenedCallData);
    },
    [`0x${callArray.length.toString(16)}`]
  );
};
