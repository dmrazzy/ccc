import { Hex } from "@ckb-ccc/core";
import { blockchain } from "@ckb-lumos/base";
import { bytes, BytesLike, molecule } from "@ckb-lumos/codec";
import { bufferToRawString, bytifyRawString, hexify } from "./helper";

export const MolClusterDataV1 = molecule.table(
  {
    name: blockchain.Bytes,
    description: blockchain.Bytes,
  },
  ["name", "description"],
);
export const MolClusterDataV2 = molecule.table(
  {
    name: blockchain.Bytes,
    description: blockchain.Bytes,
    mutantId: blockchain.BytesOpt,
  },
  ["name", "description", "mutantId"],
);

export interface ClusterDataV1 {
  name: string;
  description: string;
}
export interface ClusterDataV2 {
  name: string;
  description: string;
  mutantId?: Hex;
}
export type ClusterData = ClusterDataV2;

export type ClusterDataVersion = "v1" | "v2";

/**
 * Pack RawClusterData to Uint8Array.
 * Pass an optional "version" field to select a specific packing version.
 */
export function packRawClusterData(packable: ClusterData): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV1,
  version: "v1",
): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV2,
  version: "v2",
): Uint8Array;
export function packRawClusterData(
  packable: ClusterDataV1 | ClusterDataV2,
  version?: unknown,
): Uint8Array {
  if (!version) {
    return packRawClusterDataV2(packable);
  }

  switch (version) {
    case "v1":
      return packRawClusterDataV1(packable);
    case "v2":
      return packRawClusterDataV2(packable);
    default:
      throw new Error(`Unsupported ClusterData version: ${version}`);
  }
}
export function packRawClusterDataV1(packable: ClusterDataV1): Uint8Array {
  return MolClusterDataV1.pack({
    name: bytifyRawString(packable.name),
    description: bytifyRawString(packable.description),
  });
}
export function packRawClusterDataV2(packable: ClusterDataV2): Uint8Array {
  return MolClusterDataV2.pack({
    name: bytifyRawString(packable.name),
    description: bytifyRawString(packable.description),
    mutantId: packable.mutantId,
  });
}

/**
 * Unpack Hex/Bytes to RawClusterData.
 * Pass an optional "version" field to select a specific unpacking version.
 */
export function unpackToRawClusterData(unpackable: BytesLike): ClusterData;
export function unpackToRawClusterData(
  unpackable: BytesLike,
  version: "v1",
): ClusterDataV1;
export function unpackToRawClusterData(
  unpackable: BytesLike,
  version: "v2",
): ClusterDataV2;
export function unpackToRawClusterData(
  unpackable: BytesLike,
  version?: unknown,
): unknown {
  if (version) {
    switch (version) {
      case "v1":
        return unpackToRawClusterDataV1(unpackable);
      case "v2":
        return unpackToRawClusterDataV2(unpackable);
      default:
        throw new Error(`Unsupported ClusterData version: ${version}`);
    }
  }

  try {
    return unpackToRawClusterDataV2(unpackable);
  } catch {
    try {
      return unpackToRawClusterDataV1(unpackable);
    } catch {
      throw new Error(
        `Cannot unpack ClusterData, no matching molecule: ${bytes.hexify(unpackable)}`,
      );
    }
  }
}
export function unpackToRawClusterDataV1(unpackable: BytesLike): ClusterDataV1 {
  const decoded = MolClusterDataV1.unpack(unpackable);
  return {
    name: bufferToRawString(decoded.name),
    description: bufferToRawString(decoded.description),
  };
}
export function unpackToRawClusterDataV2(unpackable: BytesLike): ClusterDataV2 {
  const decoded = MolClusterDataV2.unpack(unpackable);
  return {
    name: bufferToRawString(decoded.name),
    description: bufferToRawString(decoded.description),
    mutantId: hexify(decoded.mutantId),
  };
}
