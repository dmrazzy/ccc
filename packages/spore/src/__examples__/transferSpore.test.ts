import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { assert, describe, it } from "vitest";
import { transferSporeCells } from "../api/spore";
import { balanceAndSignTransaction } from "../advanced";

describe("transferSpore [testnet]", async () => {
    assert(process.env.PRIVATE_KEY, "PRIVATE_KEY is required");

    it("should transfer a Spore cell by sporeId", async () => {
        const client = new ccc.ClientPublicTestnet();
        const signer = new ccc.SignerCkbPrivateKey(client, process.env.PRIVATE_KEY!);

        // Create a new owner
        const owner = await ccc.Address.fromString("ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqv5puz2ee96nuh9nmc6rtm0n8v7agju4rgdmxlnk", signer.client);

        // Build transaction
        let { transaction: tx, actions } = await transferSporeCells({
            signer,
            sporeIdCollection: [
                {
                    // Change this if you have a different sporeId
                    sporeId: "0x9d6352fd9815badcb543d4260c2ab0f8404ca61da72c8f023dd55818c2c97af8",
                    sporeOwner: owner.script,
                }
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
