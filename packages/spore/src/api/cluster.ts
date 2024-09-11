import { ccc } from "@ckb-ccc/core";
import {
  assembleCreateClusterAction,
  assembleTransferClusterAction,
  injectCommonCobuildProof,
} from "../advanced";
import { ClusterData, packRawClusterData } from "../codec";
import { computeTypeId, injectOneCapacityCell } from "../helper";
import {
  buildProcotolCelldep,
  buildProtoclScript,
  SporeScriptInfo,
} from "../predefined";

/**
 * Create a new Cluster cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param clusterData specific format of data required by Cluster protocol
 * @param clusterOwner the owner of the Cluster cell, which will be replaced with signer if not provided
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns a new transaction that contains created Cluster cell
 */
export async function createClusterCell(params: {
  signer: ccc.Signer;
  clusterData: ClusterData;
  clusterOwner?: ccc.ScriptLike;
  sporeScriptInfo: SporeScriptInfo;
  tx?: ccc.TransactionLike;
}): Promise<ccc.Transaction> {
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
  txSkeleton = injectCommonCobuildProof(txSkeleton, [createCluster]);

  return txSkeleton;
}

/**
 * Transfer a Cluster cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param clusterId the id of the Cluster cell to be transferred
 * @param clusterOwner the new owner of the Cluster cell
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns a new transaction that contains transferred Cluster cell
 */
export async function transferClusterCell(params: {
  signer: ccc.Signer;
  clusterId: ccc.Hex;
  clusterOwner: ccc.ScriptLike;
  sporeScriptInfo: SporeScriptInfo;
  tx?: ccc.TransactionLike;
}): Promise<ccc.Transaction> {
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
  const clusterCell =
    await signer.client.findSingletonCellByType(clusterTypeScript);
  if (!clusterCell) {
    throw new Error("Cluster cell not found of clusterId: " + clusterId);
  }
  txSkeleton.inputs.push(
    ccc.CellInput.from({
      previousOutput: clusterCell.outPoint,
      ...clusterCell,
    }),
  );
  txSkeleton.witnesses.push("0x");
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
  txSkeleton = injectCommonCobuildProof(txSkeleton, [transferCluster]);

  return txSkeleton;
}
