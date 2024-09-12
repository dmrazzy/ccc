import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { assert, describe, it } from "vitest";
import { transferClusterCell } from "..";
import { balanceAndSignTransaction } from "../advanced";

describe("transferCluster [testnet]", async () => {
    assert(process.env.PRIVATE_KEY, "PRIVATE_KEY is required");

    it("should transfer a Cluster cell by sporeId", async () => {
        const client = new ccc.ClientPublicTestnet();
        const signer = new ccc.SignerCkbPrivateKey(client, process.env.PRIVATE_KEY!);

        // Create a new owner
        const owner = await ccc.Address.fromString("ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqv5puz2ee96nuh9nmc6rtm0n8v7agju4rgdmxlnk", signer.client);

        // Build transaction
        let { transaction: tx, actions } = await transferClusterCell({
            signer,
            clusterId: "0x91b94378902009f359b02ae33613055570e78cd37f364127eb1e4b3a9d77c092",
            clusterOwner: owner.script,
        });

        // Complete transaction
        tx = await balanceAndSignTransaction(signer, tx, actions);
        console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

        // Send transaction
        let txHash = await signer.sendTransaction(tx);
        console.log(txHash);
    }, 60000);
});
