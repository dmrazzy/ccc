import { ccc } from "@ckb-ccc/core";
import { bytes, UnpackResult } from "@ckb-lumos/codec";
import {
  Action,
  ActionVec,
  SporeAction,
  WitnessLayout,
} from "./codec/index.js";
import { buildProtoclScript, SporeScriptInfo } from "./predefined.js";

const SCRIPT_INFO_HASH = ccc.hashCkb(ccc.bytesFrom("hello, cobuild", "utf8"));

export async function findClusterCelldepByClusterId(
  client: ccc.Client,
  clusterId: ccc.HexLike,
  scriptInfo?: SporeScriptInfo,
): Promise<{
  clusterCell: ccc.Cell;
  clusterCelldep: ccc.CellDep;
}> {
  const clusterTypeScript = buildProtoclScript(
    client,
    "cluster",
    clusterId,
    scriptInfo,
  );
  const clusterCell = await client.findSingletonCellByType(
    clusterTypeScript,
    true,
  );
  if (!clusterCell) {
    throw new Error("Cluster celldep not found of clusterId: " + clusterId);
  }
  const clusterCelldep = ccc.CellDep.from({
    outPoint: clusterCell.outPoint,
    depType: "code",
  });
  return { clusterCell, clusterCelldep };
}

export function assembleCreateSporeAction(
  sporeOutput: ccc.CellOutputLike,
  sporeData: ccc.BytesLike,
): UnpackResult<typeof Action> {
  if (!sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "CreateSpore",
    value: {
      sporeId: sporeType.args,
      dataHash: ccc.hashCkb(sporeData),
      to: {
        type: "Script",
        value: ccc.Script.from(sporeOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: SCRIPT_INFO_HASH,
    scriptHash: sporeTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleTransferSporeAction(
  sporeInput: ccc.CellOutputLike,
  sporeOutput: ccc.CellOutputLike,
): UnpackResult<typeof Action> {
  if (!sporeInput.type || !sporeOutput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeOutput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "TransferSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(sporeInput.lock),
      },
      to: {
        type: "Script",
        value: ccc.Script.from(sporeOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: SCRIPT_INFO_HASH,
    scriptHash: sporeTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleMeltSporeAction(
  sporeInput: ccc.CellOutputLike,
): UnpackResult<typeof Action> {
  if (!sporeInput.type) {
    throw new Error("Spore cell must have a type script");
  }
  const sporeType = ccc.Script.from(sporeInput.type);
  const sporeTypeHash = sporeType.hash();
  const actionData = SporeAction.pack({
    type: "MeltSpore",
    value: {
      sporeId: sporeType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(sporeInput.lock),
      },
    },
  });
  return {
    scriptInfoHash: SCRIPT_INFO_HASH,
    scriptHash: sporeTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleCreateClusterAction(
  clusterOutput: ccc.CellOutputLike,
  clusterData: ccc.BytesLike,
): UnpackResult<typeof Action> {
  if (!clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "CreateCluster",
    value: {
      clusterId: clusterType.args,
      dataHash: ccc.hashCkb(clusterData),
      to: {
        type: "Script",
        value: ccc.Script.from(clusterOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: SCRIPT_INFO_HASH,
    scriptHash: clusterTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function assembleTransferClusterAction(
  clusterInput: ccc.CellOutputLike,
  clusterOutput: ccc.CellOutputLike,
): UnpackResult<typeof Action> {
  if (!clusterInput.type || !clusterOutput.type) {
    throw new Error("Cluster cell must have a type script");
  }
  const clusterType = ccc.Script.from(clusterOutput.type);
  const clusterTypeHash = clusterType.hash();
  const actionData = SporeAction.pack({
    type: "TransferCluster",
    value: {
      clusterId: clusterType.args,
      from: {
        type: "Script",
        value: ccc.Script.from(clusterInput.lock),
      },
      to: {
        type: "Script",
        value: ccc.Script.from(clusterOutput.lock),
      },
    },
  });
  return {
    scriptInfoHash: SCRIPT_INFO_HASH,
    scriptHash: clusterTypeHash,
    data: bytes.hexify(actionData),
  };
}

export function injectCommonCobuildProof(
  tx: ccc.TransactionLike,
  actions: UnpackResult<typeof ActionVec>,
): ccc.Transaction {
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
  const txSkeleton = ccc.Transaction.from(tx);
  txSkeleton.witnesses.push(ccc.hexFrom(witnessLayout));
  return txSkeleton;
}
