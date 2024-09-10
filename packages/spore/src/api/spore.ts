import {
  CellInput,
  Hex,
  KnownScript,
  Script,
  Signer,
  Transaction,
} from "@ckb-ccc/core";
import {
  assembleCreateSporeAction,
  assembleMeltSporeAction,
  assembleTransferClusterAction,
  assembleTransferSporeAction,
  findClusterCelldepByClusterId,
  injectCommonCobuildProof,
} from "../advanced";
import { packRawSporeData, SporeData } from "../codec";
import {
  balanceAndSignTransaction,
  computeTypeId,
  injectOneCapacityCell,
  searchOneCellByLock,
} from "../helper";

/**
 * Create one or more Spore cells with the specified Spore data.
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeDataCollection specific format of data required by Spore protocol with its owner, which will be replaced with signer if no provided
 * @param clusterMode how to process cluster cell
 *   - lockProxy: put a cell that uses the same lock from Cluster cell in both Inputs and Outputs
 *   - clusterCell: directly put Cluster cell in Inputs and Outputs
 *   - skip: skip to provide Cluster authority, users should handle it mannually
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param balanceAndSign whether to balance and sign the transaction, default is false
 * @returns a new transaction that contains created Spore cells
 */
export async function createSporeCells(params: {
  signer: Signer;
  sporeDataCollection: {
    sporeData: SporeData;
    sporeOwner?: Script;
  }[];
  clusterMode: "lockProxy" | "clusterCell" | "skip";
  tx?: Transaction;
  balanceAndSign?: boolean;
}): Promise<Transaction> {
  const { signer, sporeDataCollection, tx, balanceAndSign, clusterMode } =
    params;

  // prepare transaction
  let actions = [];
  let txSkeleton = tx || Transaction.from({});
  if (txSkeleton.inputs.length === 0) {
    txSkeleton = await injectOneCapacityCell(signer, txSkeleton);
  }
  const { script: lock } = await signer.getRecommendedAddressObj();

  // build spore cell
  for (const { sporeData, sporeOwner } of sporeDataCollection) {
    const sporeId = computeTypeId(txSkeleton, txSkeleton.outputs.length);
    const sporeTypeScript = await Script.fromKnownScript(
      signer.client,
      KnownScript.Spore,
      sporeId,
    );
    const packedSporeData = packRawSporeData(sporeData);
    txSkeleton.addOutput(
      {
        lock: sporeOwner || lock,
        type: sporeTypeScript,
      },
      packedSporeData,
    );

    // process cluster cell accroding to the mode if provided
    if (sporeData.clusterId) {
      const { clusterCell, clusterCelldep } =
        await findClusterCelldepByClusterId(signer.client, sporeData.clusterId);
      switch (clusterMode) {
        case "lockProxy": {
          const clusterLock = clusterCell.cellOutput.lock;
          const lockProxyInputIndex = await txSkeleton.findInputIndexByLock(
            clusterLock,
            signer.client,
          );
          if (!lockProxyInputIndex) {
            const clusterLockProxyCell = await searchOneCellByLock(
              signer.client,
              clusterLock,
            );
            if (!clusterLockProxyCell) {
              throw new Error("Cluster lock proxy cell not found");
            }
            txSkeleton.inputs.push(
              new CellInput(
                clusterLockProxyCell.outPoint,
                BigInt(0),
                clusterLockProxyCell.cellOutput,
                clusterLockProxyCell.outputData,
              ),
            );
          }
          const lockProxyOutputIndex = txSkeleton.outputs.findIndex(
            (output) => output.lock === clusterLock,
          );
          if (lockProxyOutputIndex === -1) {
            txSkeleton.addOutput({
              lock: clusterLock,
            });
          }
          txSkeleton.addCellDeps(clusterCelldep);
          break;
        }
        case "clusterCell": {
          const clusterInput = new CellInput(
            clusterCell.outPoint,
            BigInt(0),
            clusterCell.cellOutput,
            clusterCell.outputData,
          );
          txSkeleton.inputs.push(clusterInput);
          txSkeleton.witnesses.push("0x");
          txSkeleton.addOutput(clusterCell.cellOutput, clusterCell.outputData);
          txSkeleton.addCellDeps(clusterCelldep);
          txSkeleton.addCellDepsOfKnownScripts(
            signer.client,
            KnownScript.Cluster,
          );
          const transferCluster = assembleTransferClusterAction(
            clusterCell.cellOutput,
            clusterCell.cellOutput,
          );
          actions.push(transferCluster);
          break;
        }
        case "skip": {
        }
      }
    }

    const sporeOutput = txSkeleton.outputs[txSkeleton.outputs.length - 1];
    const createSpore = assembleCreateSporeAction(sporeOutput, packedSporeData);
    actions.push(createSpore);
  }

  // complete celldeps and cobuild actions
  txSkeleton.addCellDepsOfKnownScripts(signer.client, KnownScript.Spore);
  txSkeleton = injectCommonCobuildProof(txSkeleton, actions);

  // balance and sign if specified
  if (balanceAndSign) {
    txSkeleton = await balanceAndSignTransaction(signer, txSkeleton);
  }

  return txSkeleton;
}

/**
 * Transfer one or more Spore cells
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeIdCollection sporeId with its new owner
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param balanceAndSign whether to balance and sign the transaction, default is false
 * @returns a new transaction that contains transferred Spore cells
 */
export async function transferSporeCells(params: {
  signer: Signer;
  sporeIdCollection: {
    sporeId: Hex;
    sporeOwner: Script;
  }[];
  tx?: Transaction;
  balanceAndSign?: boolean;
}): Promise<Transaction> {
  const { signer, sporeIdCollection, tx, balanceAndSign } = params;

  // prepare transaction
  let actions = [];
  let txSkeleton = tx || Transaction.from({});

  // build spore cell
  for (const { sporeId, sporeOwner } of sporeIdCollection) {
    const sporeTypeScript = await Script.fromKnownScript(
      signer.client,
      KnownScript.Spore,
      sporeId,
    );
    const sporeCell =
      await signer.client.findSingletonCellByType(sporeTypeScript);
    if (!sporeCell) {
      throw new Error("Spore cell not found of sporeId: " + sporeId);
    }
    txSkeleton.inputs.push(
      new CellInput(
        sporeCell.outPoint,
        BigInt(0),
        sporeCell.cellOutput,
        sporeCell.outputData,
      ),
    );
    txSkeleton.witnesses.push("0x");
    txSkeleton.addOutput(
      {
        lock: sporeOwner,
        type: sporeTypeScript,
      },
      sporeCell.outputData,
    );

    const sporeOutput = txSkeleton.outputs[txSkeleton.outputs.length - 1];
    const transferSpore = assembleTransferSporeAction(
      sporeCell.cellOutput,
      sporeOutput,
    );
    actions.push(transferSpore);
  }

  // complete celldeps and cobuild actions
  txSkeleton.addCellDepsOfKnownScripts(signer.client, KnownScript.Spore);
  txSkeleton = injectCommonCobuildProof(txSkeleton, actions);

  // balance and sign if specified
  if (balanceAndSign) {
    txSkeleton = await balanceAndSignTransaction(signer, txSkeleton);
  }

  return txSkeleton;
}

/**
 * Melt one or more Spore cells
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeIdCollection collection of sporeId to be melted
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @param balanceAndSign whether to balance and sign the transaction, default is false
 * @returns a new transaction that contains melted Spore cells
 */
export async function meltSporeCells(params: {
  signer: Signer;
  sporeIdCollection: Hex[];
  tx?: Transaction;
  balanceAndSign?: boolean;
}): Promise<Transaction> {
  const { signer, sporeIdCollection, tx, balanceAndSign } = params;

  // prepare transaction
  let actions = [];
  let txSkeleton = tx || Transaction.from({});

  // build spore cell
  for (const sporeId of sporeIdCollection) {
    const sporeTypeScript = await Script.fromKnownScript(
      signer.client,
      KnownScript.Spore,
      sporeId,
    );
    const sporeCell =
      await signer.client.findSingletonCellByType(sporeTypeScript);
    if (!sporeCell) {
      throw new Error("Spore cell not found of sporeId: " + sporeId);
    }
    txSkeleton.inputs.push(
      new CellInput(
        sporeCell.outPoint,
        BigInt(0),
        sporeCell.cellOutput,
        sporeCell.outputData,
      ),
    );
    txSkeleton.witnesses.push("0x");

    const meltSpore = assembleMeltSporeAction(sporeCell.cellOutput);
    actions.push(meltSpore);
  }

  // complete celldleps cobuild actions
  txSkeleton.addCellDepsOfKnownScripts(signer.client, KnownScript.Spore);
  txSkeleton = injectCommonCobuildProof(txSkeleton, actions);

  // balance and sign if specified
  if (balanceAndSign) {
    txSkeleton = await balanceAndSignTransaction(signer, txSkeleton);
  }

  return txSkeleton;
}
