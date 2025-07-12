import { JsonRpcProvider, Interface } from "ethers";

// 1. RPC & hash
const provider = new JsonRpcProvider("https://testnet.dplabs-internal.com");
const txHash   = "0xaf8d016ebe6601e4f5016971b932665a6ad57257d60471ee05b5f9d7d585d12b";

// 2. ABI fungsi register di registrar
const REG_ABI = [
  "function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses)"
];
const iface = new Interface(REG_ABI);

(async () => {
  // 3. Ambil tx
  const tx   = await provider.getTransaction(txHash);
  if (!tx) { console.log("Tx belum ditemukan"); return; }

  // 4. Decode calldata
  const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });

  console.log("• Function:", decoded.name);
  console.log("• Args   :", decoded.args);
  console.log("• Value  :", tx.value.toString());
})();
