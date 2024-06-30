import { prisma } from "./prisma";
import { HumanReadableTransactionTrace } from "./humanReadableDecoder";

export type Explanation = {
  images: string[];
  title: string;
  purpose: string;
  explanation: string;
  transfers: { token: string; from: string; to: string; amount: string }[];
};

const PROMPT_EXSISTING = `You are an assistant specialized in blockchain transactions. Your task is to receive a JSON input describing all the steps in a blockchain transaction that has already happened starting from the user's account and provide precise and specific details using past tense, such as exact numbers without contract addresses. The assistant ensures that the information is accurate, accessible, concise, and describes all token transfer values. It should include the exact values of any transferred tokens or fees. The assistant should indicate the general purpose of the transaction and whenever the user's account is affected. It communicates in a friendly and concise manner, starting the explanation directly.
Avoid using vague terms like "minor" or "several." Instead, provide specific details and exact values.

The output should be a valid JSON object (without comments) with the following attributes:

"title": Start with an action like 'Swap' or 'Transfer' and include the names of the main tokens or contracts.
"purpose": Short and concise, indicating the contracts or tokens involved.
"explanation": In one paragraph, provide a detailed description of the transaction, including the exact values of transferred tokens and the impact on the user's account without including contract addresses. Also pay attention to indicate when an account is deployed (not only a transfer).
"transfers": A list of all token transfers, each described with "token", "amount", "from", and "to". The values for the transfer attributese should be all strings`;

const PROMPT_SIMULATION = `You are an assistant specialized in blockchain transactions. Your task is to receive a JSON input describing all the steps in a simulated blockchain transaction starting from the user's account and provide precise and specific details using future tense, such as exact numbers without contract addresses. The assistant ensures that the information is accurate, accessible, concise, and describes all token transfer values. It should include the exact values of any transferred tokens or fees. The assistant should indicate the general purpose of the transaction and whenever the user's account is affected. It communicates in a friendly and concise manner, starting the explanation directly.
Avoid using vague terms like "minor" or "several." Instead, provide specific details and exact values.

The output should be a valid JSON object (without comments) with the following attributes:

"title": Start with an action like 'Swap' or 'Transfer' and include the names of the main tokens or contracts.
"purpose": Short and concise, indicating the contracts or tokens involved.
"explanation": In one paragraph, provide a detailed description of the transaction, including the exact values of transferred tokens and the impact on the user's account without including contract addresses. Also pay attention to indicate when an account is deployed (not only a transfer).
"transfers": A list of all token transfers, each described with "token", "amount", "from", and "to". The values for the transfer attributese should be all strings`;

export const explain = async (
  transaction: HumanReadableTransactionTrace[],
  is_simulation: boolean = false
): Promise<Explanation> => {
  const images = new Set(extractImages(transaction[0]));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPEN_AI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: is_simulation ? PROMPT_SIMULATION : PROMPT_EXSISTING,
        },
        {
          role: "user",
          content: `${JSON.stringify(transaction)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("something went wrong with the call");
    console.error(JSON.stringify(transaction));
    const error = await response.text();
    throw new Error(error);
  }

  const data: any = await response.json();
  console.log(data);

  console.log("-----------------------------------------------");
  console.log(data.choices[0].message.content);

  const llm_reponse = (data.choices[0].message.content as string)
    .replace("```json", "")
    .replace("```", "");

  console.log("--------------- resposne -----------------");
  console.log(llm_reponse);
  const answer = JSON.parse(llm_reponse);
  return { ...answer, images: [...images] };
};

const extractImages = (
  transaction: HumanReadableTransactionTrace
): string[] => {
  const image_url = transaction.image_url;

  const other_images = [
    ...(transaction.internal_calls || [])
      .map((t) => extractImages(t))
      .flatMap((x) => x),
  ];
  if (image_url) {
    return [image_url, ...other_images];
  } else {
    return other_images;
  }
};
