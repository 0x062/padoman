import { JsonRpcProvider, Interface } from "ethers";

// 1. RPC & hash
const provider = new JsonRpcProvider("https://testnet.dplabs-internal.com");
const txHash = "0xcaf6a6ecfb264e956003c68ecf3982808274bd90cd96fc153aaa1406a1a2cefd";

// 2. ABI dengan SEMUA kemungkinan nama fungsi commit
const POSSIBLE_ABIS = [
    // Ini adalah fungsi yang kita coba decode
    "function register(string name,address owner,uint256 duration,bytes32 secret,address resolver,bytes[] data,bool reverseRecord,uint16 ownerControlledFuses)",
    
    // Ini adalah tersangka-tersangka kita untuk transaksi commit
    "function commit(bytes32 commitment)",
    "function Commit(bytes32 commitment)",
    "function makeCommitment(bytes32 commitment)"
];
const iface = new Interface(POSSIBLE_ABIS);

(async () => {
    try {
        // 3. Ambil tx
        const tx = await provider.getTransaction(txHash);
        if (!tx) {
            console.log("Tx belum ditemukan");
            return;
        }

        // 4. Decode calldata
        const decoded = iface.parseTransaction({ data: tx.data, value: tx.value });

        if (!decoded) {
            console.log("Gagal men-decode transaksi. Tidak ada fungsi di ABI yang cocok.");
            return;
        }

        console.log("✅ Berhasil men-decode transaksi pertama!");
        console.log("-----------------------------------------");
        console.log("• Nama Fungsi Sebenarnya:", decoded.name);
        console.log("• Argumen (commitment hash):", decoded.args[0]);
        console.log("• Value:", tx.value.toString());

    } catch (error) {
        console.error("Terjadi error:", error.message);
    }
})();
