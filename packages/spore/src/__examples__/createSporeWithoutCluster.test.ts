import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import "dotenv/config";
import { injectCommonCobuildProof } from "../advanced";
import { createSporeCells } from "../api/spore.js";

describe("createSpore [testnet]", () => {
  expect(process.env.PRIVATE_KEY).toBeDefined();

  it("should create a simple Spore cell without cluster", async () => {
    const client = new ccc.ClientPublicTestnet();
    const signer = new ccc.SignerCkbPrivateKey(
      client,
      process.env.PRIVATE_KEY!,
    );

    // Build transaction
    let {
      transaction: tx,
      actions,
      sporeIds,
    } = await createSporeCells({
      signer,
      sporeDataCollection: [
        {
          sporeData: {
            contentType: "text/plain",
            content: ccc.bytesFrom("hello, spore", "utf8"),
          },
        },
      ],
      clusterMode: "skip",
    });
    console.log("sporeIds:", sporeIds);

    // Complete transaction
    tx = injectCommonCobuildProof(tx, actions);
    await tx.completeFeeBy(signer, 1000);
    tx = await signer.signTransaction(tx);
    console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

    // Send transaction
    let txHash = await signer.sendTransaction(tx);
    console.log(txHash);
  }, 60000);
});
