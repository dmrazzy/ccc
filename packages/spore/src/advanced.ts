import {
  BytesLike,
  Cell,
  CellDep,
  CellOutput,
  Client,
  hashCkb,
  Hex,
  hexFrom,
  KnownScript,
  Script,
  Transaction,
} from "@ckb-ccc/core";
import { bytes, UnpackResult } from "@ckb-lumos/codec";
import { Action, ActionVec, SporeAction, WitnessLayout } from "./codec";

export async function findClusterCelldepByClusterId(
  client: Client,
  clusterId: Hex,
): Promise<{
  clusterCell: Cell;
  clusterCelldep: CellDep;
}> {
  const clusterTypeScript = await Script.fromKnownScript(
    client,
    KnownScript.Cluster,
    clusterId,
  );
  const clusterCell = await client.findSingletonCellByType(clusterTypeScript);
  if (!clusterCell) {
    throw new Error("Cluster celldep not found of clusterId: " + clusterId);
  }
  const clusterCelldep = new CellDep(clusterCell.outPoint, "code");
  return { clusterCell, clusterCelldep };
}

export function assembleCreateSporeAction(
  sporeOutput: CellOutput,
  sporeData: BytesLike,
): UnpackResult<typeof Action> {
  const sporeType = sporeOutput.type!;
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "CreateSpore",
    value: {
      sporeId: sporeType.args,
      dataHash: hashCkb(sporeData),
      to: {
        type: "Script",
        value: sporeOutput.lock,
      },
    },
  });
  return {
    scriptInfoHash: hashCkb("fucking cobuild"),
    scriptHash: sporeTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleTransferSporeAction(
  sporeInput: CellOutput,
  sporeOutput: CellOutput,
): UnpackResult<typeof Action> {
  const sporeType = sporeOutput.type!;
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "TransferSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: sporeInput.lock,
      },
      to: {
        type: "Script",
        value: sporeOutput.lock,
      },
    },
  });
  return {
    scriptInfoHash: hashCkb("fucking cobuild"),
    scriptHash: sporeTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleMeltSporeAction(
  sporeInput: CellOutput,
): UnpackResult<typeof Action> {
  const sporeType = sporeInput.type!;
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "MeltSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: sporeInput.lock,
      },
    },
  });
  return {
    scriptInfoHash: hashCkb("fucking cobuild"),
    scriptHash: sporeTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleCreateClusterAction(
  clusterOutput: CellOutput,
  clusterData: BytesLike,
): UnpackResult<typeof Action> {
  const clusterType = clusterOutput.type!;
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "CreateCluster",
    value: {
      clusterId: clusterType.args,
      dataHash: hashCkb(clusterData),
      to: {
        type: "Script",
        value: clusterOutput.lock,
      },
    },
  });
  return {
    scriptInfoHash: hashCkb("fucking cobuild"),
    scriptHash: clusterTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleTransferClusterAction(
  clusterInput: CellOutput,
  clusterOutput: CellOutput,
): UnpackResult<typeof Action> {
  const clusterType = clusterOutput.type!;
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "TransferCluster",
    value: {
      clusterId: clusterType.args,
      from: {
        type: "Script",
        value: clusterInput.lock,
      },
      to: {
        type: "Script",
        value: clusterOutput.lock,
      },
    },
  });
  return {
    scriptInfoHash: hashCkb("fucking cobuild"),
    scriptHash: clusterTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function injectCommonCobuildProof(
  tx: Transaction,
  actions: UnpackResult<typeof ActionVec>,
): Transaction {
  const witnessLayout = bytes.hexify(
    WitnessLayout.pack({
      type: "SighashAll",
      value: {
        seal: "0x",
        message: {
          actions,
        },
      },
    }),
  );
  tx.witnesses.push(hexFrom(witnessLayout));
  return tx;
}
