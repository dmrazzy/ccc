import { ccc } from "@ckb-ccc/core";
import { blockchain } from "@ckb-lumos/base";
import { BytesLike, molecule } from "@ckb-lumos/codec";
import { bufferToRawString, hexify } from "./helper.js";

export const MolSporeData = molecule.table(
  {
    contentType: blockchain.Bytes,
    content: blockchain.Bytes,
    clusterId: blockchain.BytesOpt,
  },
  ["contentType", "content", "clusterId"],
);

export interface SporeData {
  contentType: string;
  content: BytesLike;
  clusterId?: ccc.HexLike;
}

export function packRawSporeData(packable: SporeData): Uint8Array {
  return MolSporeData.pack({
    contentType: ccc.bytesFrom(packable.contentType, "utf8"),
    content: packable.content,
    clusterId: packable.clusterId,
  });
}

export function unpackToRawSporeData(unpackable: BytesLike): SporeData {
  const unpacked = MolSporeData.unpack(unpackable);
  return {
    contentType: bufferToRawString(unpacked.contentType),
    content: unpacked.content,
    clusterId: hexify(unpacked.clusterId),
  };
}
