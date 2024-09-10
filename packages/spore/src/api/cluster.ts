import {
  CellInput,
  Hex,
  KnownScript,
  Script,
  Signer,
  Transaction,
} from "@ckb-ccc/core";
import {
  assembleCreateClusterAction,
  assembleTransferClusterAction,
  injectCommonCobuildProof,
} from "../advanced";
import { ClusterData, packRawClusterData } from "../codec";
import {
  balanceAndSignTransaction,
  computeTypeId,
  injectOneCapacityCell,
} from "../helper";

/**
 * Create a new Cluster cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param clusterData specific format of data required by Cluster protocol
 * @param clusterOwner the owner of the Cluster cell, which will be replaced with signer if not provided
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param balanceAndSign whether to balance and sign the transaction, default is false
 * @returns a new transaction that contains created Cluster cell
 */
export async function createClusterCell(params: {
  signer: Signer;
  clusterData: ClusterData;
  clusterOwner?: Script;
  tx?: Transaction;
  balanceAndSign?: boolean;
}): Promise<Transaction> {
  const { signer, clusterData, tx, balanceAndSign, clusterOwner } = params;

  // prepare transaction
  let txSkeleton = tx || Transaction.from({});
  if (txSkeleton.inputs.length === 0) {
    txSkeleton = await injectOneCapacityCell(signer, txSkeleton);
  }
  const { script: lock } = await signer.getRecommendedAddressObj();

  // build cluster cell
  const clusterId = computeTypeId(txSkeleton, txSkeleton.outputs.length);
  const clusterTypeScript = await Script.fromKnownScript(
    signer.client,
    KnownScript.Cluster,
    clusterId,
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
  txSkeleton.addCellDepsOfKnownScripts(signer.client, KnownScript.Cluster);
  txSkeleton = injectCommonCobuildProof(txSkeleton, [createCluster]);

  // balance and sign if specified
  if (balanceAndSign) {
    txSkeleton = await balanceAndSignTransaction(signer, txSkeleton);
  }

  return txSkeleton;
}

/**
 * Transfer a Cluster cell
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param clusterId the id of the Cluster cell to be transferred
 * @param clusterOwner the new owner of the Cluster cell
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param balanceAndSign whether to balance and sign the transaction, default is false
 * @returns a new transaction that contains transferred Cluster cell
 */
export async function transferClusterCell(params: {
  signer: Signer;
  clusterId: Hex;
  clusterOwner: Script;
  tx?: Transaction;
  balanceAndSign?: boolean;
}): Promise<Transaction> {
  const { signer, clusterId, tx, balanceAndSign, clusterOwner } = params;

  // prepare transaction
  let txSkeleton = tx || Transaction.from({});

  // build cluster cell
  const clusterTypeScript = await Script.fromKnownScript(
    signer.client,
    KnownScript.Cluster,
    clusterId,
  );
  const clusterCell =
    await signer.client.findSingletonCellByType(clusterTypeScript);
  if (!clusterCell) {
    throw new Error("Cluster cell not found of clusterId: " + clusterId);
  }
  txSkeleton.inputs.push(
    new CellInput(
      clusterCell.outPoint,
      BigInt(0),
      clusterCell.cellOutput,
      clusterCell.outputData,
    ),
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
  txSkeleton.addCellDepsOfKnownScripts(signer.client, KnownScript.Cluster);
  txSkeleton = injectCommonCobuildProof(txSkeleton, [transferCluster]);

  // balance and sign if specified
  if (balanceAndSign) {
    txSkeleton = await balanceAndSignTransaction(signer, txSkeleton);
  }

  return txSkeleton;
}
