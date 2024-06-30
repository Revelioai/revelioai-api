import { RpcProvider, Abi, Contract, selector } from 'starknet'
import { CallPuts, DecodedSelector, Put } from './types'

export const isProxy = (abi: Abi): string => {
  return (
    abi.find((f) => f?.type === 'function' && f?.name.includes('implementation') && f.stateMutability === 'view')
      ?.name || ''
  )
}

export const getAbi = async (address: string, provider: RpcProvider): Promise<Abi> => {
  const classHash = await provider.getClassHashAt(address)
  let abi = (await provider.getClass(classHash)).abi
  if (isProxy(abi)) {
    const implementationFunction = isProxy(abi)
    const contract = new Contract(abi, address, provider)
    const implementationHash = await contract[implementationFunction]()
    abi = (await provider.getClass(implementationHash)).abi
  }
  return abi
}

export const getSelectors = (abi: Abi): DecodedSelector => {
  return abi.reduce((acc, f) => {
    if (
      f.type === 'function' ||
      (f.type === 'interface' && f.items.some((item: { type: string }) => item.type === 'function'))
    ) {
      const functions =
        f.type === 'function' ? [f] : f.items.filter((item: { type: string }) => item.type === 'function')
      functions.forEach((func: { name: string; inputs: any; outputs: any }) => {
        acc[selector.getSelectorFromName(func.name)] = {
          name: func?.name,
          inputs: func?.inputs,
          outputs: func?.outputs,
        }
      })
    }
    return acc
  }, {})
}

export const getFunctionName = (entryPointSelector: string, selectors: DecodedSelector) =>
  selectors[entryPointSelector]?.name

export const decodeCallData = (
  abi: Abi,
  calldata: string[],
  result: string[],
  entryPointSelector: string,
  selectors: DecodedSelector,
): { inputs: Put[]; outputs: Put[] } => {
  const selector = selectors[entryPointSelector]
  if (selector) {
    const { inputs, outputs } = selector
    return {
      inputs: decodePuts(abi, calldata, inputs).decoded,
      outputs: decodePuts(abi, result, outputs).decoded,
    }
  } else {
    return {
      inputs: [],
      outputs: [],
    }
  }
}

const StarknetAbiTypes = [
  'felt',
  'felt*',
  'complex',
  'Uint256',
  'core::felt252',
  'core::integer::u8',
  'core::integer::u16',
  'core::integer::u32',
  'core::integer::u64',
  'core::integer::u128',
  'core::integer::u256',
  'core::starknet::contract_address::ContractAddress',
  'core::starknet::class_hash::ClassHash',
  'core::bool',
  'core::byte_array::ByteArray',
]

const decodePuts = (abi: Abi, call: string[], puts: CallPuts) => {
  const decodedCall: {
    name: string
    type: string
    value: any
  }[] = []

  let startIndex = 0
  for (const put of puts) {
    let stopIndex = startIndex
    const elementTypeMatch = put.type.match(/core::array::Array::<(.+)>/)
    const elementType = elementTypeMatch ? elementTypeMatch[1] : put.type

    // TODO: Handle bool, byteArray, and complex.
    if (!StarknetAbiTypes.includes(elementType)) {
      const structTypes = abi.filter((item) => item.type === 'struct' && item.name === elementType)
      if (structTypes.length > 0) {
        const structType = structTypes[0]
        const structInputs = structType.members.map(({ name, type }: { name: string; type: string }) => ({
          name,
          type,
        }))

        let decodedStruct: any[] = []

        // If it's an array
        if (elementTypeMatch) {
          const noOfElements = parseInt(call[startIndex], 16)
          startIndex += 1 // Move past the length element
          for (let i = 0; i < noOfElements; i++) {
            const structResult = decodePuts(abi, call.slice(startIndex), structInputs)
            decodedStruct.push(structResult.decoded)
            startIndex += structResult.consumed // Increment startIndex by the number of elements consumed in the struct
          }
        } else {
          const structResult = decodePuts(abi, call.slice(startIndex), structInputs)
          decodedStruct = structResult.decoded
          startIndex += structResult.consumed // Adjust startIndex based on the consumed elements in the struct
        }

        decodedCall.push({
          name: put?.name,
          type: put?.type,
          value: decodedStruct,
        })
      }
    } else {
      let value
      if (elementType.includes('integer::u256') || elementType === 'Uint256') {
        stopIndex += 2 // For integers and Uint256
        value = call.slice(startIndex, stopIndex)

        const lowInt = BigInt(value[0])
        const highInt = BigInt(value[1])
        value = ((highInt << 128n) + lowInt).toString(10)
      } else if (elementType.includes('integer')) {
        stopIndex += 1 // Increment stopIndex for recognized StarknetAbiTypes
        value = call.slice(startIndex, stopIndex)
        value = BigInt(value[0]).toString(10)
      } else {
        stopIndex += 1 // Increment stopIndex for recognized StarknetAbiTypes
        value = call.slice(startIndex, stopIndex)
      }
      decodedCall.push({
        name: put?.name,
        type: put?.type,
        value,
      })
    }

    startIndex = stopIndex // Update startIndex for the next iteration
  }

  return {
    decoded: decodedCall,
    consumed: startIndex, // Return the total number of elements consumed to decode this call
  }
}
