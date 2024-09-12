import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { assert, describe, it } from "vitest";
import { meltSporeCells } from "..";
import { balanceAndSignTransaction } from "../advanced";

describe("meltSpore [testnet]", async () => {
    assert(process.env.PRIVATE_KEY, "PRIVATE_KEY is required");

    it("should melt a Spore cell by sporeId", async () => {
        const client = new ccc.ClientPublicTestnet();
        const signer = new ccc.SignerCkbPrivateKey(client, process.env.PRIVATE_KEY!);

        // Build transaction
        let { transaction: tx, actions } = await meltSporeCells({
            signer,
            sporeIdCollection: [
                // Change this if you have a different sporeId
                "0xcd7fca303a4fb5809209349df1ff63dce74665e3b727011fdc59793b6030ef8a",
            ]
        });

        // Complete transaction
        tx = await balanceAndSignTransaction(signer, tx, actions);
        console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

        // Send transaction
        let txHash = await signer.sendTransaction(tx);
        console.log(txHash);
    }, 60000);
});
