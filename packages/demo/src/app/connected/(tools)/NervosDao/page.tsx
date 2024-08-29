"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TextInput } from "@/src/components/Input";
import { Button } from "@/src/components/Button";
import { ccc } from "@ckb-ccc/connector-react";
import { useGetExplorerLink } from "@/src/utils";
import { useApp } from "@/src/context";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { BigButton } from "@/src/components/BigButton";

function getProfit(
  dao: ccc.Cell,
  depositHeader: ccc.ClientBlockHeader,
  withdrawHeader: ccc.ClientBlockHeader,
): ccc.Num {
  const occupiedSize = ccc.fixedPointFrom(
    dao.cellOutput.occupiedSize + ccc.bytesFrom(dao.outputData).length,
  );
  const profitableSize = dao.cellOutput.capacity - occupiedSize;

  return (
    (profitableSize * withdrawHeader.dao.ar) / depositHeader.dao.ar -
    profitableSize
  );
}

function getClaimEpoch(
  depositHeader: ccc.ClientBlockHeader,
  withdrawHeader: ccc.ClientBlockHeader,
): ccc.Epoch {
  const depositEpoch = depositHeader.epoch;
  const withdrawEpoch = withdrawHeader.epoch;
  const intDiff = withdrawEpoch[0] - depositEpoch[0];
  // deposit[1]    withdraw[1]
  // ---------- <= -----------
  // deposit[2]    withdraw[2]
  if (
    intDiff % ccc.numFrom(180) !== ccc.numFrom(0) ||
    depositEpoch[1] * withdrawEpoch[2] <= depositEpoch[2] * withdrawEpoch[1]
  ) {
    return [
      depositEpoch[0] +
        (intDiff / ccc.numFrom(180) + ccc.numFrom(1)) * ccc.numFrom(180),
      depositEpoch[1],
      depositEpoch[2],
    ];
  }

  return [
    depositEpoch[0] + (intDiff / ccc.numFrom(180)) * ccc.numFrom(180),
    depositEpoch[1],
    depositEpoch[2],
  ];
}

function DaoButton({ dao }: { dao: ccc.Cell }) {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [infos, setInfos] = useState<
    | [
        ccc.Num,
        ccc.ClientTransactionResponse,
        (
          | undefined
          | [
              ccc.ClientTransactionResponse,
              ccc.ClientBlockHeader,
              ccc.ClientBlockHeader,
            ]
        ),
      ]
    | undefined
  >();

  const isNew = useMemo(() => dao.outputData === "0x0000000000000000", [dao]);
  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const previousTx = await signer.client.getTransaction(
        dao.outPoint.txHash,
      );
      if (!previousTx?.blockHash) {
        return;
      }
      const previousHeader = await signer.client.getHeaderByHash(
        previousTx.blockHash,
      );
      if (!previousHeader) {
        return;
      }

      const claimInfo = await (async (): Promise<typeof infos> => {
        if (isNew) {
          return;
        }

        const depositTxHash =
          previousTx.transaction.inputs[Number(dao.outPoint.index)]
            .previousOutput.txHash;
        const depositTx = await signer.client.getTransaction(depositTxHash);
        if (!depositTx?.blockHash) {
          return;
        }
        const depositHeader = await signer.client.getHeaderByHash(
          depositTx.blockHash,
        );

        if (!depositHeader) {
          return;
        }
        return [
          getProfit(dao, depositHeader, previousHeader),
          previousTx,
          [depositTx, depositHeader, previousHeader],
        ];
      })();

      if (claimInfo) {
        setInfos(claimInfo);
      } else {
        const tipHeader = await signer.client.getTipHeader();
        setInfos([
          getProfit(dao, previousHeader, tipHeader),
          previousTx,
          undefined,
        ]);
      }
    })();
  }, [dao, signer, isNew]);

  return (
    <BigButton
      key={ccc.hexFrom(dao.outPoint.toBytes())}
      size="sm"
      iconName="Vault"
      onClick={() => {
        if (!signer || !infos) {
          return;
        }

        (async () => {
          const [profit, previousTx] = infos;
          if (!previousTx.blockHash || !previousTx.blockNumber) {
            error(
              "Unexpected empty block info for",
              explorerTransaction(dao.outPoint.txHash),
            );
            return;
          }
          const { blockHash, blockNumber } = previousTx;

          let tx;
          if (isNew) {
            tx = ccc.Transaction.from({
              headerDeps: [blockHash],
              inputs: [{ previousOutput: dao.outPoint }],
              outputs: [dao.cellOutput],
              outputsData: [ccc.numLeToBytes(blockNumber, 8)],
            });

            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer, 1000);
          } else {
            if (!infos[2]) {
              error("Unexpected no found deposit info");
              return;
            }
            const [depositTx, depositHeader, withdrawHeader] = infos[2];
            if (!depositTx.blockHash) {
              error("Unexpected empty deposit tx block info for");
              return;
            }

            tx = ccc.Transaction.from({
              headerDeps: [blockHash, depositTx.blockHash],
              inputs: [
                {
                  previousOutput: dao.outPoint,
                  since: {
                    relative: "absolute",
                    metric: "epoch",
                    value: ccc.numLeFromBytes(
                      ccc.epochToHex(
                        getClaimEpoch(depositHeader, withdrawHeader),
                      ),
                    ),
                  },
                },
              ],
              outputs: [
                {
                  lock: dao.cellOutput.lock,
                },
              ],
              witnesses: [
                ccc.WitnessArgs.from({
                  inputType: ccc.numLeToBytes(1, 8),
                }).toBytes(),
              ],
            });
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeChangeToOutput(signer, 0, 1000);
            tx.outputs[0].capacity += profit;
          }

          // Sign and send the transaction
          log(
            "Transaction sent:",
            explorerTransaction(await signer.sendTransaction(tx)),
          );
        })();
      }}
      className={`align-center ${isNew ? "text-yellow-400" : "text-orange-400"}`}
    >
      <div className="text-md flex flex-col">
        {ccc.fixedPointToString(
          (dao.cellOutput.capacity / ccc.fixedPointFrom("0.01")) *
            ccc.fixedPointFrom("0.01"),
        )}
        {infos ? (
          <span className="-mt-1 text-sm">
            +
            {ccc.fixedPointToString(
              (infos[0] / ccc.fixedPointFrom("0.0001")) *
                ccc.fixedPointFrom("0.0001"),
            )}
          </span>
        ) : undefined}
      </div>
      <span className="text-sm">{isNew ? "Withdraw" : "Claim"}</span>
    </BigButton>
  );
}

export default function Transfer() {
  const { signer, createSender } = useApp();
  const { log, error } = createSender("Transfer");

  const { explorerTransaction } = useGetExplorerLink();

  const [amount, setAmount] = useState<string>("");
  const [daos, setDaos] = useState<ccc.Cell[]>([]);

  useEffect(() => {
    if (!signer) {
      return;
    }

    (async () => {
      const { script } = await signer.getRecommendedAddressObj();

      const daos = [];
      for await (const cell of signer.client.findCellsByCollectableSearchKey({
        script,
        scriptType: "lock",
        scriptSearchMode: "exact",
        filter: {
          script: await ccc.Script.fromKnownScript(
            signer.client,
            ccc.KnownScript.NervosDao,
            "0x",
          ),
          scriptLenRange: [33, 34],
          outputDataLenRange: [8, 9],
        },
        withData: true,
      })) {
        daos.push(cell);
      }

      setDaos(daos);
    })();
  }, [signer]);

  return (
    <div className="flex w-full flex-col items-stretch">
      <TextInput
        label="Amount"
        placeholder="Amount to deposit"
        state={[amount, setAmount]}
      />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {daos.map((dao) => (
          <DaoButton key={ccc.hexFrom(dao.outPoint.toBytes())} dao={dao} />
        ))}
      </div>
      <ButtonsPanel>
        <Button
          onClick={async () => {
            if (!signer) {
              return;
            }

            const { script: lock } = await signer.getRecommendedAddressObj();

            const tx = ccc.Transaction.from({
              outputs: [
                {
                  lock,
                  type: await ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.NervosDao,
                    "0x",
                  ),
                },
              ],
              outputsData: ["00".repeat(8)],
            });
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            await tx.completeInputsAll(signer);
            await tx.completeFeeChangeToOutput(signer, 0, 1000);

            const amount = ccc.fixedPointToString(tx.outputs[0].capacity);
            log("You can deposit at most", amount, "CKB");
            setAmount(amount);
          }}
        >
          Max Amount
        </Button>
        <Button
          className="ml-2"
          onClick={async () => {
            if (!signer) {
              return;
            }

            const { script: lock } = await signer.getRecommendedAddressObj();

            const tx = ccc.Transaction.from({
              outputs: [
                {
                  lock,
                  type: await ccc.Script.fromKnownScript(
                    signer.client,
                    ccc.KnownScript.NervosDao,
                    "0x",
                  ),
                },
              ],
              outputsData: ["00".repeat(8)],
            });
            await tx.addCellDepsOfKnownScripts(
              signer.client,
              ccc.KnownScript.NervosDao,
            );

            if (tx.outputs[0].capacity > ccc.fixedPointFrom(amount)) {
              error(
                "Insufficient capacity at output, min",
                ccc.fixedPointToString(tx.outputs[0].capacity),
                "CKB",
              );
              return;
            }
            tx.outputs[0].capacity = ccc.fixedPointFrom(amount);

            await tx.completeInputsByCapacity(signer);
            await tx.completeFeeBy(signer, 1000);

            // Sign and send the transaction
            log(
              "Transaction sent:",
              explorerTransaction(await signer.sendTransaction(tx)),
            );
          }}
        >
          Deposit
        </Button>
      </ButtonsPanel>
    </div>
  );
}