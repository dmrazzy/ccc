import { ccc } from "@ckb-ccc/core";
import { JsonRpcTransformers } from "@ckb-ccc/core/advanced";
import { assert, describe, it } from "vitest";
import { createSporeCells } from "..";
import { balanceAndSignTransaction } from "../advanced";

describe("createSpore [testnet]", async () => {
    assert(process.env.PRIVATE_KEY, "PRIVATE_KEY is required");

    it("should create a Spore cell under DOB procotol", async () => {
        const client = new ccc.ClientPublicTestnet();
        const signer = new ccc.SignerCkbPrivateKey(client, process.env.PRIVATE_KEY!);

        // Generate the DNA of DOB protocol for `createDobCluster` example required
        //
        // note: each different DOB pattern may require different DNA length and format
        const hasher = new ccc.HasherCkb(7);
        hasher.update(ccc.bytesFrom("hello, dob", "utf8"));
        let dna = ccc.bytesFrom(hasher.digest());
        dna = ccc.bytesConcat(dna, ccc.bytesFrom("hello, world!", "utf8"));
        assert(dna.length === 20);
        const hexedDna = ccc.bytesTo(dna, "hex"); // no leading "0x"
        const content = `{"dna":"${hexedDna}"}`;

        // Build transaction
        let { transaction: tx, actions, sporeIds } = await createSporeCells({
            signer,
            sporeDataCollection: [
                {
                    sporeData: {
                        contentType: "dob/1",
                        content: ccc.bytesFrom(content, "utf8"),
                        clusterId: "0x91b94378902009f359b02ae33613055570e78cd37f364127eb1e4b3a9d77c092",
                    }
                }
            ],
            clusterMode: "clusterCell",
        });
        console.log("sporeIds:", sporeIds);

        // Complete transaction
        tx = await balanceAndSignTransaction(signer, tx, actions);
        console.log(JSON.stringify(JsonRpcTransformers.transactionFrom(tx)));

        // Send transaction
        let txHash = await signer.sendTransaction(tx);
        console.log(txHash);
    }, 60000);
});
