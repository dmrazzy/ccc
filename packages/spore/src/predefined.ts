import { ccc } from "@ckb-ccc/core";

export type SporeScript = "spore" | "cluster";
export type SporeScriptInfo = Record<
  SporeScript,
  Pick<ccc.Script, "codeHash" | "hashType"> & {
    cellDeps: ccc.CellDepInfoLike[];
  }
>;

export const SPORE_MAINNET_SCRIPTS: SporeScriptInfo = Object.freeze({
  ["spore"]: {
    codeHash:
      "0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c9788cb75dcf6747247132b9f5",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x96b198fb5ddbd1eed57ed667068f1f1e55d07907b4c0dbd38675a69ea1b69824",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  },
  ["cluster"]: {
    codeHash:
      "0x7366a61534fa7c7e6225ecc0d828ea3b5366adec2b58206f2ee84995fe030075",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0xe464b7fb9311c5e2820e61c99afc615d6b98bdefbe318c34868c010cbd0dc938",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  },
});

export const SPORE_TESTNET_SCRIPTS: SporeScriptInfo = Object.freeze({
  ["spore"]: {
    codeHash:
      "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0x5e8d2a517d50fd4bb4d01737a7952a1f1d35c8afc77240695bb569cd7d9d5a1f",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  },
  ["cluster"]: {
    codeHash:
      "0x0bbe768b519d8ea7b96d58f1182eb7e6ef96c541fbd9526975077ee09f049058",
    hashType: "data1",
    cellDeps: [
      {
        cellDep: {
          outPoint: {
            txHash:
              "0xcebb174d6e300e26074aea2f5dbd7f694bb4fe3de52b6dfe205e54f90164510a",
            index: 0,
          },
          depType: "code",
        },
      },
    ],
  },
});

export function buildProtoclScript(
  client: ccc.Client,
  procotol: SporeScript,
  args: ccc.HexLike,
  scriptInfo?: SporeScriptInfo,
): ccc.Script {
  if (scriptInfo) {
    return ccc.Script.from({
      args,
      ...scriptInfo[procotol],
    });
  }
  if (client.addressPrefix == "ckb") {
    return ccc.Script.from({
      args,
      ...SPORE_MAINNET_SCRIPTS[procotol],
    });
  }
  return ccc.Script.from({
    args,
    ...SPORE_TESTNET_SCRIPTS[procotol],
  });
}

export function buildProcotolCelldep(
  client: ccc.Client,
  procotol: SporeScript,
  scriptInfo?: SporeScriptInfo,
): ccc.CellDepInfoLike[] {
  if (scriptInfo) {
    return scriptInfo[procotol].cellDeps;
  }
  if (client.addressPrefix == "ckb") {
    return SPORE_MAINNET_SCRIPTS[procotol].cellDeps;
  }
  return SPORE_TESTNET_SCRIPTS[procotol].cellDeps;
}
