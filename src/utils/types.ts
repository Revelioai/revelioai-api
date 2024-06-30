export type Hex = `0x${string}`
export type Address = Hex

export type RPC<T> = {
  jsonrpc: '2.0'
  result: T
  id: number
}

export type TransactionType = 'INVOKE' // TODO add other types

export type Transaction = {
  transaction_hash?: Hex
  type: TransactionType
  version: '0x1'
  nonce: Hex
  max_fee: Hex
  sender_address: Address
  signature: Hex[]
  calldata: Hex[]
}

export type TransactionEvent = {
  from_address?: Address
  order: number
  keys: Hex[]
  data: Hex[]
}

export type TransactionReceipt = {
  type: TransactionType
  transaction_hash: Hex
  actual_fee: {
    amount: Hex
    unit: 'WEI' // TODO add other units
  }
  execution_status: 'SUCCEDED' // TODO add other status
  finality_status: 'ACCEPTED_ON_L1' // TODO add otehr status
  block_hash: Hex
  block_number: number
  messages_sent: unknown[]
  events: TransactionEvent[]
  execution_resources: {
    steps: number
    pedersen_builtin_applications: number
    range_check_builtin_applications: number
    ec_op_builtin_applications: number
    data_availability: {
      l1_gas: number
      l1_data_gas: number
    }
  }
}

export type TraceTransactionRequest = {
  transaction_hash: Hex
}

export enum EntryPointType {
  'EXTERNAL' = 'EXTERNAL',
  // TODO add other entry_point_type
}

export enum CallType {
  'CALL' = 'CALL',
  'DEPLOY_ACCOUNT' = 'DEPLOY_ACCOUNT',
  // TODO add other call_type
}

export type InvocationSuccess = {
  contract_address: Address
  entry_point_selector: Hex
  calldata: Hex[]
  caller_address: '0x0' | Address
  class_hash: Hex
  entry_point_type: EntryPointType
  call_type: CallType
  result: Hex[]
  calls: InvocationSuccess[]
  events: TransactionEvent[]
  messages: unknown[]
  execution_resources: {
    steps: number
    memory_holes: number
    pedersen_builtin_applications: number
    range_check_builtin_applications: number
  }
}

export type InvocationRevert = {
  revert_reason: '' | string
}

export type Invocation = InvocationRevert | InvocationSuccess

export type StorageDiffs = {
  address: Address
  storage_entries: {
    key: Hex
    value: Hex
  }[]
}

type StateDiff = {
  storage_diffs: StorageDiffs[]
  nonces: Array<{
    contract_address: Address
    nonce: Hex
  }>
  deployed_contracts: unknown[]
  deprecated_declared_classes: unknown[]
  declared_classes: unknown[]
  replaced_classes: unknown[]
}

export enum SimulationFlag {
  'SKIP_VALIDATE' = 'SKIP_VALIDATE',
  // TODO add other flags
}

export type SimulateTransactionRequest = {
  block_id:
    | {
        block_number: number
      }
    | {
        block_hash: Hex
      }
    | 'latest'
    | 'pending'

  transactions: Array<{
    type: TransactionType
    version: '0x1'
    sender_address: Address
    calldata: Hex[]
    max_fee: Hex
    signature: Hex[]
    nonce: Hex
  }>
  simulation_flags: SimulationFlag[]
}

export type TransactionTrace = {
  type: TransactionType
  validate_invocation?: Invocation
  execute_invocation: Invocation
  fee_transfer_invocation: Invocation
  state_diff: StateDiff
  execution_resources: {
    steps: number
    memory_holes: number
    pedersen_builtin_applications: number
    range_check_builtin_applications: number
    ec_op_builtin_applications: number
    data_availability: {
      l1_gas: number
      l1_data_gas: number
    }
  }
}

export type SimulateTransactionResponse = Array<{
  transaction_trace: TransactionTrace
  fee_estimation: {
    gas_consumed: Hex
    gas_price: Hex
    data_gas_consumed: Hex
    data_gas_price: Hex
    overall_fee: Hex
    unit: 'WEI' // TODO add other units
  }
}>

export type Put = {
  name: string
  type: string
  value: any
}

export type CallPuts = Omit<Put, 'value'>[]

export type DecodedSelector = {
  [key: string]: {
    name: string
    inputs: CallPuts
    outputs: CallPuts
  }
}

export type DecodedTransactionTrace = {
  contract_address: Address
  function_name: string
  call_type: CallType
  inputs: Put[]
  outputs: Put[]
  internal_calls: DecodedTransactionTrace[]
}
