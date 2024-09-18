import { blockchain } from "@ckb-lumos/base";
import { BytesLike, molecule, number } from "@ckb-lumos/codec";
import { bufferToRawString, bytifyRawString } from "../helper.js";

/**
 * The codec for packing/unpacking UTF-8 raw strings.
 * Should be packed like so: String.pack('something')
 */
const RawString = molecule.byteVecOf({
  pack: (packable: string) => bytifyRawString(packable),
  unpack: (unpackable: BytesLike) => bufferToRawString(unpackable),
});

const Uint32Opt = molecule.option(number.Uint32LE);

const Hash = blockchain.Byte32;

export const Action = molecule.table(
  {
    scriptInfoHash: Hash,
    scriptHash: Hash,
    data: blockchain.Bytes,
  },
  ["scriptInfoHash", "scriptHash", "data"],
);

export const ActionVec = molecule.vector(Action);

export const Message = molecule.table(
  {
    actions: ActionVec,
  },
  ["actions"],
);

export const ResolvedInputs = molecule.table(
  {
    outputs: blockchain.CellOutputVec,
    outputsData: blockchain.BytesVec,
  },
  ["outputs", "outputsData"],
);

export const ScriptInfo = molecule.table(
  {
    name: RawString,
    url: RawString,
    scriptHash: Hash,
    schema: RawString,
    messageType: RawString,
  },
  ["name", "url", "scriptHash", "schema", "messageType"],
);

export const ScriptInfoVec = molecule.vector(ScriptInfo);

export const BuildingPacketV1 = molecule.table(
  {
    message: Message,
    payload: blockchain.Transaction,
    resolvedInputs: ResolvedInputs,
    changeOutput: Uint32Opt,
    scriptInfos: ScriptInfoVec,
    lockActions: ActionVec,
  },
  [
    "message",
    "payload",
    "resolvedInputs",
    "changeOutput",
    "scriptInfos",
    "lockActions",
  ],
);

export const BuildingPacket = molecule.union(
  {
    BuildingPacketV1,
  },
  ["BuildingPacketV1"],
);
