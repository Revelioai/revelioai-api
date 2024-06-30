import { decodeCallData, getAbi, getFunctionName, getSelectors } from './decoder.utils'
import { provider } from './rpcWrapper'
import { CallType, DecodedSelector, DecodedTransactionTrace, InvocationSuccess, TransactionTrace } from './types'

export const decodeTrace = async (trace: TransactionTrace) => {
  console.log('decoding trace', trace)
  const {
    execute_invocation: executeInvocation,
    validate_invocation: validateInvocation,
    fee_transfer_invocation: feeTransferInvocation,
  } = trace
  if (validateInvocation && 'revert_reason' in validateInvocation) {
    return validateInvocation.revert_reason
  } else if (executeInvocation && 'revert_reason' in executeInvocation) {
    return executeInvocation.revert_reason
  } else if (feeTransferInvocation && 'revert_reason' in feeTransferInvocation) {
    return feeTransferInvocation.revert_reason
  }
  feeTransferInvocation.call_type = CallType.DEPLOY_ACCOUNT
  const invocation = executeInvocation || validateInvocation || feeTransferInvocation
  return await decodeMainInvocation(invocation)
}

const getContractAddresses = (invocation: InvocationSuccess): string[] => {
  return [invocation.contract_address, ...invocation.calls.map(getContractAddresses).flatMap((x) => x)]
}
const getAllAbis = async (
  allContracts: string[],
): Promise<Record<string, { abi: any; selectors: DecodedSelector }>> => {
  const abis: Record<string, any> = {}
  for (const c of allContracts) {
    if (!abis[c]) {
      const abi = await getAbi(c, provider)
      const selectors = await getSelectors(abi)
      abis[c] = { abi, selectors }
    }
  }
  return abis
}

const decodeMainInvocation = async (mainInvocation: InvocationSuccess): Promise<DecodedTransactionTrace> => {
  const allContracts = getContractAddresses(mainInvocation)
  const allAbis = await getAllAbis(allContracts)

  return decodeInvocation(mainInvocation, allAbis)
}

const decodeInvocation = async (
  invocation: InvocationSuccess,
  abis: Record<string, { abi: any; selectors: DecodedSelector }>,
): Promise<DecodedTransactionTrace> => {
  const {
    contract_address: contractAddress,
    calldata,
    result,
    call_type: callType,
    entry_point_selector: entryPointSelector,
    calls = [],
  } = invocation

  const { abi, selectors } = abis[contractAddress]

  const functionName = getFunctionName(entryPointSelector, selectors)

  const { inputs, outputs } = decodeCallData(abi, calldata, result, entryPointSelector, selectors)

  const functionInvocationTrace = {
    contract_address: contractAddress,
    function_name: functionName,
    call_type: callType,
    inputs,
    outputs,
    internal_calls: await Promise.all(calls.map((i) => decodeInvocation(i, abis))),
  }

  return functionInvocationTrace
}
