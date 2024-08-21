"use client";

import { useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { tokenInfoToBytes, useGetExplorerLink } from "@/src/utils";
import { Message } from "@/src/components/Message";
import React from "react";
import { useApp } from "@/src/context";

export default function IssueXUdtSul() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Issue xUDT (SUS)");

  const { explorerTransaction } = useGetExplorerLink();

  const [amount, setAmount] = useState<string>("");
  const [decimals, setDecimals] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");

  return (
    <>
      <div className="mb-1 flex w-9/12 flex-col items-stretch gap-2">
        <Message title="Hint" type="info">
          You will need to sign two or three transactions.
        </Message>

        <TextInput
          label="Amount"
          placeholder="Amount to issue"
          state={[amount, setAmount]}
        />
        <TextInput
          label="Decimals"
          placeholder="Decimals of the token"
          state={[decimals, setDecimals]}
        />
        <TextInput
          label="Symbol"
          placeholder="Symbol of the token"
          state={[symbol, setSymbol]}
        />
        <TextInput
          label="Name"
          placeholder="Name of the token, same as symbol if empty"
          state={[name, setName]}
        />

        <Button
          className="self-center"
          onClick={async () => {
            if (!signer) {
              return;
            }
            if (decimals === "" || symbol === "") {
              error("Invalid token info");
              return;
            }

            const { script } = await signer.getRecommendedAddressObj();

            const susTx = ccc.Transaction.from({
              outputs: [
                {
                  lock: script,
                },
              ],
            });
            await susTx.completeInputsByCapacity(signer);
            await susTx.completeFeeBy(signer, 1000);
            const susTxHash = await signer.sendTransaction(susTx);
            log("Transaction sent:", explorerTransaction(susTxHash));
            await signer.client.markUnusable({ txHash: susTxHash, index: 0 });

            const singleUseLock = await ccc.Script.fromKnownScript(
              signer.client,
              ccc.KnownScript.SingleUseLock,
              ccc.OutPoint.from({
                txHash: susTxHash,
                index: 0,
              }).toBytes(),
            );
            const lockTx = ccc.Transaction.from({
              outputs: [
                // Owner cell
                {
                  lock: singleUseLock,
                },
              ],
            });
            await lockTx.completeInputsByCapacity(signer);
            await lockTx.completeFeeBy(signer, 1000);
            const lockTxHash = await signer.sendTransaction(lockTx);
            log("Transaction sent:", explorerTransaction(lockTxHash));

            const mintTx = ccc.Transaction.from({
              inputs: [
                // SUS
                {
                  previousOutput: {
                    txHash: susTxHash,
                    index: 0,
                  },
                },
                // Owner cell
                {
                  previousOutput: {
                    txHash: lockTxHash,
                    index: 0,
                  },
                },
              ],
              outputs: [
                // Issued xUDT
                {
                  lock: script,
                  type: await ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.XUdt,
                    singleUseLock.hash(),
                  ),
                },
                // xUDT Info
                {
                  lock: script,
                  type: await ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.UniqueType,
                    "00".repeat(32),
                  ),
                },
              ],
              outputsData: [
                ccc.numLeToBytes(amount, 16),
                tokenInfoToBytes(decimals, symbol, name),
              ],
            });
            await mintTx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.SingleUseLock,
              ccc.KnownScript.XUdt,
              ccc.KnownScript.UniqueType,
            );
            await mintTx.completeInputsByCapacity(signer);
            if (!mintTx.outputs[1].type) {
              error("Unexpected disappeared output");
              return;
            }
            mintTx.outputs[1].type!.args = ccc.hexFrom(
              ccc.bytesFrom(ccc.hashTypeId(mintTx.inputs[0], 1)).slice(0, 20),
            );
            await mintTx.completeFeeBy(signer, 1000);
            log(
              "Transaction sent:",
              explorerTransaction(await signer.sendTransaction(mintTx)),
            );
          }}
        >
          Issue
        </Button>
      </div>
    </>
  );
}