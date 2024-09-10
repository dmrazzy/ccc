import { Hex } from "@ckb-ccc/core";
import { blockchain } from "@ckb-lumos/base";
import { BytesLike, molecule } from "@ckb-lumos/codec";
import { bufferToRawString, bytifyRawString, hexify } from "./helper";

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
  clusterId?: Hex;
}

export function packRawSporeData(packable: SporeData): Uint8Array {
  return MolSporeData.pack({
    contentType: bytifyRawString(packable.contentType),
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
