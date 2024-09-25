import { ccc } from "@ckb-ccc/core";
import { DappRequestType, buildJoyIDURL } from "@joyid/common";
import { createPopup } from "../common/index.js";
import {
  Connection,
  ConnectionsRepo,
  ConnectionsRepoLocalStorage,
} from "../connectionsStorage/index.js";

/**
 * Class representing an EVM signer that extends SignerEvm
 * @public
 */
export class EvmSigner extends ccc.SignerEvm {
  private connection?: Connection;

  /**
   * Ensures that the signer is connected and returns the connection.
   * @throws Will throw an error if not connected.
   * @returns The current connection.
   */
  private assertConnection(): Connection {
    if (!this.isConnected() || !this.connection) {
      throw new Error("Not connected");
    }

    return this.connection;
  }

  /**
   * Creates an instance of EvmSigner.
   * @param client - The client instance.
   * @param name - The name of the signer.
   * @param icon - The icon URL of the signer.
   * @param _appUri - The application URI.
   * @param connectionsRepo - The connections repository.
   */
  constructor(
    client: ccc.Client,
    private readonly name: string,
    private readonly icon: string,
    private readonly _appUri?: string,
    private readonly connectionsRepo: ConnectionsRepo = new ConnectionsRepoLocalStorage(),
  ) {
    super(client);
  }

  /**
   * Gets the configuration for JoyID.
   * @returns The configuration object.
   */
  private getConfig() {
    return {
      redirectURL: location.href,
      joyidAppURL:
        (this._appUri ?? this.client.addressPrefix === "ckb")
          ? "https://app.joy.id"
          : "https://testnet.joyid.dev",
      requestNetwork: `ethereum`,
      name: this.name,
      logo: this.icon,
    };
  }

  /**
   * Gets the EVM account address.
   * @returns A promise that resolves to the EVM account address.
   */
  async getEvmAccount(): Promise<ccc.Hex> {
    return this.assertConnection().address as ccc.Hex;
  }

  /**
   * Connects to the provider by requesting authentication.
   * @returns A promise that resolves when the connection is established.
   */
  async connect(): Promise<void> {
    const config = this.getConfig();

    const res = await createPopup(buildJoyIDURL(config, "popup", "/auth"), {
      ...config,
      type: DappRequestType.Auth,
    });

    this.connection = {
      address: res.ethAddress,
      publicKey: ccc.hexFrom(res.pubkey),
      keyType: res.keyType,
    };
    await this.saveConnection();
  }

  async disconnect(): Promise<void> {
    await super.disconnect();

    this.connection = undefined;
    await this.saveConnection();
  }

  /**
   * Checks if the signer is connected.
   * @returns A promise that resolves to true if connected, false otherwise.
   */
  async isConnected(): Promise<boolean> {
    if (this.connection) {
      return true;
    }
    await this.restoreConnection();
    return this.connection !== undefined;
  }

  /**
   * Signs a raw message with the EVM account.
   * @param message - The message to sign.
   * @returns A promise that resolves to the signed message.
   */
  async signMessageRaw(message: string | ccc.BytesLike): Promise<ccc.Hex> {
    const { address } = this.assertConnection();

    const challenge =
      typeof message === "string" ? message : ccc.hexFrom(message).slice(2);

    const config = this.getConfig();
    const { signature } = await createPopup(
      buildJoyIDURL(
        {
          ...config,
          challenge,
          isData: typeof message !== "string",
          address,
        },
        "popup",
        "/sign-message",
      ),
      { ...config, type: DappRequestType.SignMessage },
    );
    return ccc.hexFrom(signature);
  }

  /**
   * Saves the current connection.
   * @returns
   */
  private async saveConnection(): Promise<void> {
    return this.connectionsRepo.set(
      {
        uri: this.getConfig().joyidAppURL,
        addressType: "ethereum",
      },
      this.connection,
    );
  }

  /**
   * Restores the previous connection.
   * @returns
   */
  private async restoreConnection(): Promise<void> {
    this.connection = await this.connectionsRepo.get({
      uri: this.getConfig().joyidAppURL,
      addressType: "ethereum",
    });
  }
}
