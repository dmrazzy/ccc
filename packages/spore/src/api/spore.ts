import { ccc } from "@ckb-ccc/core";
import { UnpackResult } from "@ckb-lumos/codec";
import {
  assembleCreateSporeAction,
  assembleMeltSporeAction,
  assembleTransferClusterAction,
  assembleTransferSporeAction,
  findClusterCelldepByClusterId,
} from "../advanced.js";
import { ActionVec, packRawSporeData, SporeData } from "../codec/index.js";
import {
  computeTypeId,
  injectOneCapacityCell,
  searchOneCellByLock,
} from "../helper.js";
import {
  buildProcotolCelldep,
  buildProtoclScript as buildProtocolScript,
  SporeScriptInfo,
} from "../predefined.js";

/**
 * Create one or more Spore cells with the specified Spore data.
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeDataCollection specific format of data required by Spore protocol with its owner, which will be replaced with signer if no provided
 * @param clusterMode how to process cluster cell **(if clusterId is not provided in SporeData, this parameter will be ignored)**
 *   - lockProxy: put a cell that uses the same lock from Cluster cell in both Inputs and Outputs
 *   - clusterCell: directly put Cluster cell in Inputs and Outputs
 *   - skip: skip to provide Cluster authority, users should handle it mannually
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **transaction**: a new transaction that contains created Spore cells
 *  - **actions**: cobuild actions that can be used to generate cobuild proof
 *  - **sporeIds**: the sporeId of each created Spore cell
 */
export async function createSporeCells(params: {
  signer: ccc.Signer;
  sporeDataCollection: {
    sporeData: SporeData;
    sporeOwner?: ccc.ScriptLike;
  }[];
  clusterMode: "lockProxy" | "clusterCell" | "skip";
  sporeScriptInfo?: SporeScriptInfo;
  tx?: ccc.Transaction;
}): Promise<{
  transaction: ccc.Transaction;
  actions: UnpackResult<typeof ActionVec>;
  sporeIds: ccc.Hex[];
}> {
  const { signer, sporeDataCollection, tx, clusterMode, sporeScriptInfo } =
    params;

  // prepare transaction
  let actions = [];
  let sporeIds = new Array<ccc.Hex>();
  let txSkeleton = ccc.Transaction.from(tx ?? {});
  if (txSkeleton.inputs.length === 0) {
    txSkeleton = await injectOneCapacityCell(signer, txSkeleton);
  }
  const { script: lock } = await signer.getRecommendedAddressObj();

  // build spore cell
  let clusterIds = new Array<ccc.Hex>();
  for (const { sporeData, sporeOwner } of sporeDataCollection) {
    const sporeId = computeTypeId(txSkeleton, txSkeleton.outputs.length);
    sporeIds.push(sporeId);
    const sporeTypeScript = buildProtocolScript(
      signer.client,
      "spore",
      sporeId,
      sporeScriptInfo,
    );
    const packedSporeData = packRawSporeData(sporeData);
    txSkeleton.addOutput(
      {
        lock: sporeOwner || lock,
        type: sporeTypeScript,
      },
      packedSporeData,
    );

    // create spore action
    const sporeOutput = txSkeleton.outputs[txSkeleton.outputs.length - 1];
    const createSpore = assembleCreateSporeAction(sporeOutput, packedSporeData);
    actions.push(createSpore);

    // process cluster cell accroding to the mode if provided
    if (
      sporeData.clusterId &&
      !clusterIds.includes(ccc.hexFrom(sporeData.clusterId))
    ) {
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
            const clusterLockProxyCell = await searchOneCellByLock(signer);
            if (!clusterLockProxyCell) {
              throw new Error("Cluster lock proxy cell not found");
            }
            txSkeleton.inputs.push(
              ccc.CellInput.from({
                previousOutput: clusterLockProxyCell.outPoint,
                ...clusterLockProxyCell,
              }),
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
          const clusterInput = ccc.CellInput.from({
            previousOutput: clusterCell.outPoint,
            ...clusterCell,
          });
          txSkeleton.inputs.push(clusterInput);
          txSkeleton.addOutput(clusterCell.cellOutput, clusterCell.outputData);
          txSkeleton.addCellDeps(clusterCelldep);
          await txSkeleton.addCellDepInfos(
            signer.client,
            buildProcotolCelldep(signer.client, "cluster", sporeScriptInfo),
          );
          const transferCluster = assembleTransferClusterAction(
            clusterCell.cellOutput,
            clusterCell.cellOutput,
          );
          actions.push(transferCluster);
          break;
        }
        case "skip": {
          // nothing to do here
        }
      }
      clusterIds.push(ccc.hexFrom(sporeData.clusterId));
    }
  }

  // complete celldeps and cobuild actions
  await txSkeleton.addCellDepInfos(
    signer.client,
    buildProcotolCelldep(signer.client, "spore", sporeScriptInfo),
  );
  txSkeleton = await signer.prepareTransaction(txSkeleton);

  return {
    transaction: txSkeleton,
    actions,
    sporeIds,
  };
}

/**
 * Transfer one or more Spore cells
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeIdCollection sporeId with its new owner
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **transaction**: a new transaction that contains transferred Spore cells
 *  - **actions**: cobuild actions that can be used to generate cobuild proof
 */
export async function transferSporeCells(params: {
  signer: ccc.Signer;
  sporeIdCollection: {
    sporeId: ccc.HexLike;
    sporeOwner: ccc.ScriptLike;
  }[];
  sporeScriptInfo?: SporeScriptInfo;
  tx?: ccc.TransactionLike;
}): Promise<{
  transaction: ccc.Transaction;
  actions: UnpackResult<typeof ActionVec>;
}> {
  const { signer, sporeIdCollection, tx, sporeScriptInfo } = params;

  // prepare transaction
  let actions = [];
  let txSkeleton = ccc.Transaction.from(tx ?? {});

  // build spore cell
  for (const { sporeId, sporeOwner } of sporeIdCollection) {
    const sporeTypeScript = buildProtocolScript(
      signer.client,
      "spore",
      sporeId,
      sporeScriptInfo,
    );
    const sporeCell = await signer.client.findSingletonCellByType(
      sporeTypeScript,
      true,
    );
    if (!sporeCell) {
      throw new Error("Spore cell not found of sporeId: " + sporeId);
    }
    txSkeleton.inputs.push(
      ccc.CellInput.from({
        previousOutput: sporeCell.outPoint,
        ...sporeCell,
      }),
    );
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
  await txSkeleton.addCellDepInfos(
    signer.client,
    buildProcotolCelldep(signer.client, "spore", sporeScriptInfo),
  );
  txSkeleton = await signer.prepareTransaction(txSkeleton);

  return {
    transaction: txSkeleton,
    actions,
  };
}

/**
 * Melt one or more Spore cells
 *
 * @param signer who takes the responsibility to balance and sign the transaction
 * @param sporeIdCollection collection of sporeId to be melted
 * @param sporeScriptInfo the script info of Spore cell, if not provided, the default script info will be used
 * @param tx the transaction skeleton, if not provided, a new one will be created
 * @returns
 *  - **transaction**: a new transaction that contains melted Spore cells
 *  - **actions**: cobuild actions that can be used to generate cobuild proof
 */
export async function meltSporeCells(params: {
  signer: ccc.Signer;
  sporeIdCollection: ccc.HexLike[];
  sporeScriptInfo?: SporeScriptInfo;
  tx?: ccc.TransactionLike;
}): Promise<{
  transaction: ccc.Transaction;
  actions: UnpackResult<typeof ActionVec>;
}> {
  const { signer, sporeIdCollection, tx, sporeScriptInfo } = params;

  // prepare transaction
  let actions = [];
  let txSkeleton = ccc.Transaction.from(tx ?? {});

  // build spore cell
  for (const sporeId of sporeIdCollection) {
    const sporeTypeScript = buildProtocolScript(
      signer.client,
      "spore",
      sporeId,
      sporeScriptInfo,
    );
    const sporeCell =
      await signer.client.findSingletonCellByType(sporeTypeScript);
    if (!sporeCell) {
      throw new Error("Spore cell not found of sporeId: " + sporeId);
    }
    txSkeleton.inputs.push(
      ccc.CellInput.from({
        previousOutput: sporeCell.outPoint,
        ...sporeCell,
      }),
    );

    const meltSpore = assembleMeltSporeAction(sporeCell.cellOutput);
    actions.push(meltSpore);
  }

  // complete celldleps cobuild actions
  await txSkeleton.addCellDepInfos(
    signer.client,
    buildProcotolCelldep(signer.client, "spore", sporeScriptInfo),
  );
  txSkeleton = await signer.prepareTransaction(txSkeleton);

  return {
    transaction: txSkeleton,
    actions,
  };
}
