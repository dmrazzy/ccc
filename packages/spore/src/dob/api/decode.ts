import { CellOutputLike, Client, Hex, hexFrom, OutPoint } from "@ckb-ccc/core";
import { Axios } from "axios";
import { getErrorByCode } from "../helper/error";
import { RenderOutput } from "../helper/object";

export async function decodeDobBySporeId(
  sporeId: Hex,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const axios = new Axios({
    baseURL: dobServerUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const result = await axios.post(
    "/",
    JSON.stringify({
      id: 0,
      jsonrpc: "2.0",
      method: "dob_decode",
      params: [sporeId.replace(/^0x/, "")],
    }),
  );
  const decoderResult = JSON.parse(result.data);
  if ("error" in decoderResult) {
    const serverError = getErrorByCode(decoderResult.error.code as number);
    throw new Error(`Decode DOB failed: ${serverError}`);
  }
  const renderResult = JSON.parse(decoderResult.result);
  const renderOutput = JSON.parse(renderResult.render_output);
  return renderOutput;
}

export async function decodeDobBySporeCell(
  sporeOutput: CellOutputLike,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const sporeId = sporeOutput.type?.args;
  if (sporeId === undefined) {
    throw new Error("Invalid spore cell: missing spore id");
  }
  return decodeDobBySporeId(hexFrom(sporeId), dobServerUrl);
}

export async function decodeDobBySporeOutpoint(
  client: Client,
  sporeOutpoint: OutPoint,
  dobServerUrl: string,
): Promise<RenderOutput> {
  const liveCell = await client.getCell(sporeOutpoint);
  if (!liveCell) {
    throw new Error("Invalid spore outpoint: missing spore cell");
  }
  return decodeDobBySporeCell(liveCell!.cellOutput, dobServerUrl);
}
