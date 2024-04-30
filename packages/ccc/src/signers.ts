import { Signer } from "@ckb-ccc/core";

export enum SignerType {
  Eip6963 = "Eip6963",
  UniSat = "UniSat",
  OkxBitcoin = "OkxBitcoin",
}

export class SignerInfo {
  constructor(
    public type: SignerType,
    public id: string,
    public name: string,
    public icon: string,
    public signer: Signer,
  ) {}
}