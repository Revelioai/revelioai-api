import { RpcProvider } from "starknet";
import {
  Hex,
  RPC,
  SimulateTransactionRequest,
  SimulateTransactionResponse,
  SimulationFlag,
  TraceTransactionRequest,
  Transaction,
  TransactionReceipt,
  TransactionTrace,
} from "./types";

const apiKey = process.env.VOYAGER_API_KEY;

const rpcUrl = `https://free-rpc.nethermind.io/mainnet-juno/?apikey=${apiKey}`;

export const provider = new RpcProvider({ nodeUrl: rpcUrl });

async function getTransactionByHash(txHash: Hex) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "starknet_getTransactionByHash",
      params: {
        transaction_hash: txHash,
      },
      id: 1,
    }),
  }).then((res) => {
    if (res.status === 200) return res.json() as Promise<RPC<Transaction>>;
    throw new Error(
      `starknet_getTransactionByHash responded with status ${res.status}`
    );
  });

  return response.result;
}

async function getTransactionReceipt(txHash: Hex) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "starknet_getTransactionReceipt",
      params: {
        transaction_hash: txHash,
      },
      id: 1,
    }),
  }).then((res) => {
    if (res.status === 200)
      return res.json() as Promise<RPC<TransactionReceipt>>;
    throw new Error(
      `starknet_getTransactionByHash responded with status ${res.status}`
    );
  });

  return response.result;
}

async function traceTransaction(txHash: Hex) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "starknet_traceTransaction",
      params: {
        transaction_hash: txHash,
      } satisfies TraceTransactionRequest,
      id: 1,
    }),
  }).then((res) => {
    if (res.status === 200) return res.json() as Promise<RPC<TransactionTrace>>;
    throw new Error(
      `starknet_getTransactionByHash responded with status ${res.status}`
    );
  });

  return response.result;
}

// @dev blockNumber simulations are made with the latest sate (at least for nonce)
export async function makeRpcSimulionCall(transaction: Transaction) {
  const _body = {
    jsonrpc: "2.0",
    method: "starknet_simulateTransactions",
    params: {
      block_id: "latest",
      transactions: [
        {
          type: transaction.type,
          version: transaction.version,
          sender_address: transaction.sender_address,
          calldata: transaction.calldata,
          max_fee: transaction.max_fee,
          signature: transaction.signature,
          nonce: transaction.nonce,
        },
      ],
      simulation_flags: [SimulationFlag.SKIP_VALIDATE],
    } satisfies SimulateTransactionRequest,
    id: 1,
  };

  console.log("simulation _body");
  console.dir(_body, { depth: null });

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(_body),
  }).then((res) => {
    if (res.status === 200)
      return res.json() as Promise<RPC<SimulateTransactionResponse>>;
    throw new Error(
      `starknet_getTransactionByHash responded with status ${res.status}`
    );
  });

  console.log("simulation response", response);

  return response;
}

// @dev Returns the same output as starknet_simulateTransaction but for a past transaction
//         this is because starknet_simulateTransaction can't be used to "re-simulate" past
//         transactions
export async function getPastTransactionSimulationLike(
  txHash: Hex
): Promise<SimulateTransactionResponse> {
  const txReceipt = await getTransactionReceipt(txHash);
  const txTrace = await traceTransaction(txHash);

  return [
    {
      transaction_trace: {
        type: txTrace.type,
        execute_invocation: txTrace.execute_invocation,
        fee_transfer_invocation: txTrace.fee_transfer_invocation,
        state_diff: txTrace.state_diff,
        execution_resources: txTrace.execution_resources,
      },
      fee_estimation: {
        gas_consumed: "0x",
        gas_price: "0x",
        data_gas_consumed: "0x",
        data_gas_price: "0x",
        overall_fee: txReceipt.actual_fee.amount,
        unit: txReceipt.actual_fee.unit,
      },
    },
  ];
}
