import { ccc } from "@ckb-ccc/core";
import { UnpackResult } from "@ckb-lumos/codec";
import {
  assembleCreateClusterAction,
  assembleTransferClusterAction,
} from "../advanced.js";
import { ActionVec, ClusterData, packRawClusterData } from "../codec/index.js";
import { computeTypeId, injectOneCapacityCell } from "../helper.js";
import {
  buildProcotolCelldep,
  buildProtoclScript,
  SporeScriptInfo,
} from "../predefined.js";

/**
 * Create a new Cluster cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param clusterData specific format of data required by Cluster protocol
 * @param clusterOwner the owner of the Cluster cell, which will be replaced with signer if not provided
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **transaction**: a new transaction that contains created Cluster cell
 *  - **actions**: cobuild actions that can be used to generate cobuild proof
 *  - **clusterId**: the id of the created Cluster cell
 */
export async function createClusterCell(params: {
  signer: ccc.Signer;
  clusterData: ClusterData;
  clusterOwner?: ccc.ScriptLike;
  sporeScriptInfo?: SporeScriptInfo;
  tx?: ccc.TransactionLike;
}): Promise<{
  transaction: ccc.Transaction;
  actions: UnpackResult<typeof ActionVec>;
  clusterId: ccc.Hex;
}> {
  const { signer, clusterData, tx, clusterOwner, sporeScriptInfo } = params;

  // prepare transaction
  let txSkeleton = ccc.Transaction.from(tx ?? {});
  if (txSkeleton.inputs.length === 0) {
    txSkeleton = await injectOneCapacityCell(signer, txSkeleton);
  }
  const { script: lock } = await signer.getRecommendedAddressObj();

  // build cluster cell
  const clusterId = computeTypeId(txSkeleton, txSkeleton.outputs.length);
  const clusterTypeScript = buildProtoclScript(
    signer.client,
    "cluster",
    clusterId,
    sporeScriptInfo,
  );
  const packedClusterData = packRawClusterData(clusterData);
  txSkeleton.addOutput(
    {
      lock: clusterOwner || lock,
      type: clusterTypeScript,
    },
    packedClusterData,
  );

  // generate cobuild action
  const clusterOutput = txSkeleton.outputs[txSkeleton.outputs.length - 1];
  const createCluster = assembleCreateClusterAction(
    clusterOutput,
    packedClusterData,
  );

  // complete celldeps and cobuild actions
  await txSkeleton.addCellDepInfos(
    signer.client,
    buildProcotolCelldep(signer.client, "cluster", sporeScriptInfo),
  );
  txSkeleton = await signer.prepareTransaction(txSkeleton);

  return {
    transaction: txSkeleton,
    actions: [createCluster],
    clusterId,
  };
}

/**
 * Transfer a Cluster cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param clusterId the id of the Cluster cell to be transferred
 * @param clusterOwner the new owner of the Cluster cell
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **transaction**: a new transaction that contains transferred Cluster cell
 *  - **actions**: cobuild actions that can be used to generate cobuild proof
 */
export async function transferClusterCell(params: {
  signer: ccc.Signer;
  clusterId: ccc.HexLike;
  clusterOwner: ccc.ScriptLike;
  sporeScriptInfo?: SporeScriptInfo;
  tx?: ccc.TransactionLike;
}): Promise<{
  transaction: ccc.Transaction;
  actions: UnpackResult<typeof ActionVec>;
}> {
  const { signer, clusterId, tx, clusterOwner, sporeScriptInfo } = params;

  // prepare transaction
  let txSkeleton = ccc.Transaction.from(tx ?? {});

  // build cluster cell
  const clusterTypeScript = buildProtoclScript(
    signer.client,
    "cluster",
    clusterId,
    sporeScriptInfo,
  );
  const clusterCell = await signer.client.findSingletonCellByType(
    clusterTypeScript,
    true,
  );
  if (!clusterCell) {
    throw new Error("Cluster cell not found of clusterId: " + clusterId);
  }
  txSkeleton.inputs.push(
    ccc.CellInput.from({
      previousOutput: clusterCell.outPoint,
      ...clusterCell,
    }),
  );
  txSkeleton.addOutput(
    {
      lock: clusterOwner,
      type: clusterTypeScript,
    },
    clusterCell.outputData,
  );

  // generate cobuild action
  const clusterOutput = txSkeleton.outputs[txSkeleton.outputs.length - 1];
  const transferCluster = assembleTransferClusterAction(
    clusterCell.cellOutput,
    clusterOutput,
  );

  // complete celldeps and cobuild actions
  await txSkeleton.addCellDepInfos(
    signer.client,
    buildProcotolCelldep(signer.client, "cluster", sporeScriptInfo),
  );
  txSkeleton = await signer.prepareTransaction(txSkeleton);

  return {
    transaction: txSkeleton,
    actions: [transferCluster],
  };
}
