import { prisma } from "./prisma";
import { Address, CallType, DecodedTransactionTrace, Put } from "./types";

export type HumanReadableTransactionTrace = {
  contract: string | Address;
  image_url: string | undefined;
  action: string;
  internal_calls: HumanReadableTransactionTrace[];
};

export const humanReadableDecoder = async (
  trace: string | DecodedTransactionTrace
): Promise<string | HumanReadableTransactionTrace> => {
  if (typeof trace == "string") {
    return "";
  }
  const {
    contract_address: contractAddress,
    function_name: functionName,
    inputs,
    outputs,
    call_type,
    internal_calls: internalCalls,
  } = trace;

  let addressName: string | null = contractAddress as string,
    labelName = null;
  const labeledAddress = await getDbAddress(contractAddress);

  if (labeledAddress) {
    addressName = labeledAddress.address_name;
    labelName = labeledAddress.label_name;
    if (!addressName && labeledAddress.symbol) {
      addressName = labeledAddress.symbol;
    }
    addressName = `${labelName ? labelName + " " : ""}${
      addressName
        ? `${addressName}${
            labeledAddress.symbol ? ` (${labeledAddress.symbol})` : ""
          }`
        : contractAddress
    }`;
  }
  let call = functionName;
  if (functionName != "__execute__") {
    const calls = await Promise.all(
      (inputs || []).map((i) =>
        humandReadableDecodePut(i, labeledAddress?.decimals)
      )
    );
    if (call_type == CallType.DEPLOY_ACCOUNT) {
      call = `deployAccountAnd${call}`;
    }
    call += `(${calls.join(",")})`;
  }

  return {
    contract: addressName!,
    image_url: labeledAddress?.image_url ? labeledAddress.image_url : undefined,
    action: call,
    internal_calls: (await Promise.all(
      (internalCalls || []).map(humanReadableDecoder)
    )) as HumanReadableTransactionTrace[],
  };
};

const humandReadableDecodePut = async (
  put: Put,
  decimals: bigint | null | undefined
): Promise<string> => {
  if (!put) return "";
  // const typeArray = put.type.split('::')
  // const type = typeArray[typeArray.length - 1]
  let str = `${put.name}=`;
  if (decimals && put.type.includes("256")) {
    let value = put.value as string;
    let length = value.length;
    const decimalsCount = Number(decimals);
    let integerPart = "0";
    let fraction = "0";
    if (decimalsCount > length) {
      fraction = value.padStart(decimalsCount + 1, "0");
    } else {
      integerPart = value.slice(0, length - decimalsCount);
      fraction = value.slice(length - decimalsCount);
    }
    str += `${integerPart}.${fraction}`;
  } else if (put.type.includes("ContractAddress")) {
    let value = put.value;
    const labeledAddress = await getDbAddress(value);
    if (labeledAddress) {
      let addressName = labeledAddress.address_name;
      let labelName = labeledAddress.label_name;
      if (!addressName && labeledAddress.symbol) {
        addressName = labeledAddress.symbol;
      }
      value = `${labelName ? labelName + " " : ""}${
        addressName ? addressName : value
      }`;
    }
    str += value;
  } else {
    str += put.value;
  }
  return str;
};

const getDbAddress = async (address: any) => {
  if (typeof address === "object") {
    address = address[0];
  }
  let normalizedContractAddress = `0x${address
    .toLowerCase()
    .slice(2)
    .padStart(64, "0")}`;
  const labeledAddress = await prisma.addresses.findFirst({
    where: {
      address: normalizedContractAddress,
    },
  });

  return labeledAddress;
};
