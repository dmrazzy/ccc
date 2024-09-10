import {
  Cell,
  CellInput,
  Client,
  hashTypeId,
  Hex,
  Script,
  Signer,
  Transaction,
} from "@ckb-ccc/core";

export async function searchOneCellByLock(
  client: Client,
  lock: Script,
): Promise<Cell | undefined> {
  let liveCell: Cell | undefined = undefined;
  for await (const cell of client.findCells({
    script: lock,
    scriptType: "lock",
    scriptSearchMode: "exact",
    filter: {
      scriptLenRange: [0, 1],
      outputDataLenRange: [0, 1],
    },
  })) {
    liveCell = cell;
    break;
  }
  return liveCell;
}

export async function injectOneCapacityCell(
  signer: Signer,
  tx: Transaction,
): Promise<Transaction> {
  const { script: lock } = await signer.getRecommendedAddressObj();
  const liveCell = await searchOneCellByLock(signer.client, lock);
  if (!liveCell) {
    const address = await signer.getRecommendedAddress();
    throw new Error("No live cell found in address: " + address);
  }
  const cellInput = new CellInput(
    liveCell.outPoint,
    BigInt(0),
    liveCell.cellOutput,
    liveCell.outputData,
  );
  tx.inputs.push(cellInput);
  return tx;
}

export function computeTypeId(tx: Transaction, outputIndex: number): Hex {
  const firstInput = tx.inputs[0];
  if (!firstInput) {
    throw new Error("No input found in transaction");
  }
  return hashTypeId(firstInput, outputIndex);
}

export async function balanceAndSignTransaction(
  signer: Signer,
  tx: Transaction,
): Promise<Transaction> {
  const { script: lock } = await signer.getRecommendedAddressObj();

  // change cell
  tx.addOutput({ lock });

  // balance and sign
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeChangeToOutput(signer, tx.outputs.length - 1, 1000);
  return await signer.signTransaction(tx);
}
