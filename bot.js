// bot.js - Eksperimen Commit -> Register

// 1. Impor library
require('dotenv').config();
const { ethers } = require('ethers');

// 2. Konfigurasi
const PHAROS_RPC_URL = process.env.PHAROS_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const REGISTRAR_CONTRACT_ADDRESS = "0x51bE1EF20a1fD5179419738FC71D95A8b6f8A175";

// 3. ABI (menggabungkan yang dibutuhkan)
const REGISTRAR_ABI = [
    "function MinCommitmentAge() view returns (uint256)",
    "function Commit(bytes32 commitment) external",
    "function Resolver() view returns (address)",
    "function Register(string calldata name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] calldata data, bool reverseRecord, uint16 ownerControlledFuses) external payable"
];
const RESOLVER_ABI = [
    "function setAddr(bytes32 node, address a)"
];

// 4. Koneksi
if (!PHAROS_RPC_URL || !PRIVATE_KEY) throw new Error("Harap isi RPC_URL dan PRIVATE_KEY di .env");
const provider = new ethers.JsonRpcProvider(PHAROS_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(REGISTRAR_CONTRACT_ADDRESS, REGISTRAR_ABI, wallet);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function registerWithCommit(label) {
    const tld = "phrs";
    const fullNormalizedName = `${ethers.ensNormalize(label)}.${tld}`;
    console.log(`🚀 Memulai registrasi (Commit -> Register) untuk '${fullNormalizedName}'...`);

    try {
        const ownerAddress = await wallet.getAddress();
        const duration = 31536000; // 1 tahun
        
        // LANGKAH 1: Buat Komitmen
        console.log("[1/4] Membuat komitmen...");
        const secret = ethers.randomBytes(32);
        const commitment = ethers.solidityPackedKeccak256(
            ['string', 'address', 'bytes32'],
            [label, ownerAddress, secret]
        );
        console.log("✅ Komitmen dibuat.");

        // LANGKAH 2: Commit
        console.log("[2/4] Mengirim transaksi 'Commit'...");
        const commitTx = await contract.Commit(commitment);
        await commitTx.wait();
        console.log(`✅ Commit berhasil: ${commitTx.hash}`);

        // LANGKAH 3: Menunggu
        const waitTime = Number(await contract.MinCommitmentAge()) + 15;
        console.log(`[3/4] Menunggu selama ${waitTime} detik...`);
        await sleep(waitTime * 1000);

        // LANGKAH 4: Registrasi Final
        console.log("[4/4] Mempersiapkan dan mengirim 'Register'...");
        const hardcodedPrice = ethers.parseUnits("0.00312500000000349", "ether");
        const resolverAddress = await contract.Resolver();
        const node = ethers.namehash(fullNormalizedName);
        const resolverInterface = new ethers.Interface(RESOLVER_ABI);
        const dataPayload = [
            resolverInterface.encodeFunctionData("setAddr", [node, ownerAddress])
        ];
        
        const registerTx = await contract.Register(
            label, ownerAddress, duration, secret, resolverAddress,
            dataPayload, false, 0, { value: hardcodedPrice }
        );
        await registerTx.wait();
        
        console.log("\n🎉🎉🎉 PENDAFTARAN SUKSES! 🎉🎉🎉");
        console.log(`Tx Hash: ${registerTx.hash}`);

    } catch (error) {
        console.error("\n🔥🔥🔥 GAGAL 🔥🔥🔥");
        console.error("   - Pesan:", error.reason || error.message);
    }
}

// Ganti label di bawah ini dan jalankan
registerWithCommit("patneurjuara");
