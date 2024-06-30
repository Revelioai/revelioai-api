import { Router } from "express";
import {
  getPastTransactionSimulationLike,
  makeRpcSimulionCall,
} from "./utils/rpcWrapper";
import { decodeTrace } from "./utils/decoder";
import {
  HumanReadableTransactionTrace,
  humanReadableDecoder,
} from "./utils/humanReadableDecoder";
import { explain } from "./utils/explain";
import { flattenCalldata } from "./utils/simulation";
import { Hex } from "./utils/types";

const router = Router();

router.post("/simulateTransactionByHash", async (req, res) => {
  const data = req.body;
  const response = await getPastTransactionSimulationLike(data.txHash);
  res.send(response);
});

router.post("/decodeTransactionByHash", async (req, res) => {
  const data = req.body;
  const simulation = await getPastTransactionSimulationLike(data.txHash);
  const response = await Promise.all(
    simulation.map((s) => decodeTrace(s.transaction_trace))
  );
  res.send(response);
});

router.post("/HumanReadableDecodeTransactionByHash", async (req, res) => {
  const data = req.body;
  const simulation = await getPastTransactionSimulationLike(data.txHash);

  const decode = await Promise.all(
    simulation.map((s) => decodeTrace(s.transaction_trace))
  );

  const response = await Promise.all(decode.map(humanReadableDecoder));
  res.send(response);
});

router.post("/explainTransactionByHash", async (req, res) => {
  const data = req.body;
  const simulation = await getPastTransactionSimulationLike(data.txHash);

  const decode = await Promise.all(
    simulation.map((s) => decodeTrace(s.transaction_trace))
  );

  const humanReadable = await Promise.all(decode.map(humanReadableDecoder));

  if (typeof humanReadable == "string") {
    throw new Error("cannot parse reverted transactions");
  }
  const response = await explain(
    humanReadable as unknown as HumanReadableTransactionTrace[],
    data.is_simulation
  );
  res.send(response);
});

router.post("/explainTransaction", async (req, res) => {
  const parsedBody = req.body;
  const flatCalldata = flattenCalldata(parsedBody.calls);
  const hexCalldata = flatCalldata.map(
    (value) => `0x${BigInt(value).toString(16)}` as Hex
  );

  const nonce = parsedBody.nonce;

  const simulation = await makeRpcSimulionCall({
    type: "INVOKE",
    version: "0x1",
    sender_address: parsedBody.walletAddress,
    calldata: hexCalldata,
    max_fee: "0x0",
    nonce: nonce as Hex,
    signature: [],
  }).then((res) => {
    return res.result;
  });
  const decode = await Promise.all(
    simulation.map((s) => decodeTrace(s.transaction_trace))
  );

  console.log("decoded", decode);

  const humanReadable = await Promise.all(decode.map(humanReadableDecoder));
  console.log("explaining");
  if (typeof humanReadable == "string") {
    throw new Error("cannot parse reverted transactions");
  }

  console.log("humanReadable", humanReadable);

  const response = await explain(
    humanReadable as unknown as HumanReadableTransactionTrace[],
    true
  );
  res.send(response);
});

export default router;
